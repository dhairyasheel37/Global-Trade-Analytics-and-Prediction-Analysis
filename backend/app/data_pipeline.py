import sys
import argparse
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

# Ensure package parent directory is in sys.path when run directly
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

import pandas as pd
import numpy as np
from sqlalchemy.orm import Session

from app.config import (
    REQUIRED_COLUMNS,
    NUMERIC_COLUMNS,
    DEFAULT_CSV_PATH,
    DB_PATH,
)
from app.database import engine, init_db, SessionLocal
from app.models import TradeRecord
from app.utils.logger import logger


class DataValidationError(Exception):
    """Raised when dataset fails required structural or format validation."""
    pass


class TradeDataPipeline:
    """
    Ingestion, validation, cleaning, and database loading pipeline
    for global trade datasets.
    """

    def __init__(self, required_columns=None, numeric_columns=None):
        self.required_columns = required_columns or REQUIRED_COLUMNS
        self.numeric_columns = numeric_columns or NUMERIC_COLUMNS

    def load_csv(self, file_path: Path) -> Tuple[pd.DataFrame, str]:
        """
        Reads CSV file with automatic encoding fallback (utf-8 -> latin-1).
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"CSV file not found at: {file_path}")

        encoding_used = "utf-8"
        try:
            logger.info(f"Attempting to read CSV with utf-8 encoding: {file_path}")
            df = pd.read_csv(file_path, encoding="utf-8")
        except UnicodeDecodeError:
            logger.warning("utf-8 decoding failed. Falling back to latin-1 encoding.")
            encoding_used = "latin-1"
            df = pd.read_csv(file_path, encoding="latin-1")

        logger.info(f"Loaded {len(df)} raw rows from CSV using encoding '{encoding_used}'.")
        return df, encoding_used

    def validate_schema(self, df: pd.DataFrame) -> None:
        """
        Validates presence of all mandatory columns. Fails loudly if missing.
        """
        present_cols = set(df.columns)
        missing_cols = [col for col in self.required_columns if col not in present_cols]
        if missing_cols:
            error_msg = (
                f"Dataset validation failed: missing {len(missing_cols)} required column(s): "
                f"{missing_cols}. Expected columns: {self.required_columns}"
            )
            logger.error(error_msg)
            raise DataValidationError(error_msg)
        logger.info("Schema validation passed: All required columns present.")

    def clean_and_transform(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Preprocesses and cleans the dataframe:
        - Deduplicates exact duplicate rows only
        - Converts refYear to int
        - Converts numeric fields, coercing invalid entries to NULL (NaN)
        - Preserves genuine NULLs as NULL and genuine 0s as 0
        - Flags negative trade values without dropping them
        """
        stats: Dict[str, Any] = {
            "initial_rows": len(df),
            "exact_duplicates_removed": 0,
            "coerced_counts": {},
            "negative_counts": {},
            "null_counts": {},
            "zero_counts": {},
        }

        # 1. Exact Duplicate Row Removal (all columns identical)
        initial_count = len(df)
        df_cleaned = df.drop_duplicates(keep="first").copy()
        dupes_removed = initial_count - len(df_cleaned)
        stats["exact_duplicates_removed"] = dupes_removed
        if dupes_removed > 0:
            logger.info(f"Removed {dupes_removed} exact duplicate row(s).")
        else:
            logger.info("No exact duplicate rows found.")

        # 2. Convert refYear to integer
        try:
            df_cleaned["refYear"] = pd.to_numeric(df_cleaned["refYear"], errors="raise").astype(int)
        except Exception as e:
            error_msg = f"Failed to convert 'refYear' to integer: {e}"
            logger.error(error_msg)
            raise DataValidationError(error_msg)

        # 3. Numeric Fields Conversion & Coercion to NULL
        for col in self.numeric_columns:
            if col in df_cleaned.columns:
                # Identify non-numeric strings that would be coerced
                pre_series = df_cleaned[col]
                converted_series = pd.to_numeric(pre_series, errors="coerce")

                # Count invalid entries that became NaN but were not originally NaN/None/empty
                original_non_null = pre_series.notna() & (pre_series.astype(str).str.strip() != "")
                coerced_mask = original_non_null & converted_series.isna()
                coerced_count = int(coerced_mask.sum())
                stats["coerced_counts"][col] = coerced_count

                if coerced_count > 0:
                    logger.warning(
                        f"Coerced {coerced_count} invalid non-numeric entries in '{col}' to NULL."
                    )

                df_cleaned[col] = converted_series

                # Track metrics
                neg_count = int((df_cleaned[col] < 0).sum())
                zero_count = int((df_cleaned[col] == 0).sum())
                null_count = int(df_cleaned[col].isna().sum())

                stats["negative_counts"][col] = neg_count
                stats["zero_counts"][col] = zero_count
                stats["null_counts"][col] = null_count

                if neg_count > 0:
                    logger.warning(
                        f"Flagged {neg_count} negative value(s) in column '{col}' (preserved, not dropped)."
                    )

        # Ensure boolean and optional fields are properly formatted
        if "isLeaf" in df_cleaned.columns:
            df_cleaned["isLeaf"] = df_cleaned["isLeaf"].astype(bool)
        if "aggrLevel" in df_cleaned.columns:
            df_cleaned["aggrLevel"] = pd.to_numeric(df_cleaned["aggrLevel"], errors="coerce").fillna(0).astype(int)

        stats["final_rows"] = len(df_cleaned)
        logger.info(f"Data cleaning completed. {stats['final_rows']} valid records prepared.")
        return df_cleaned, stats

    def load_to_database(self, df: pd.DataFrame, db: Optional[Session] = None) -> int:
        """
        Loads cleaned records into SQLite database transactionally.
        """
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            init_db()
            logger.info("Clearing existing records in 'trade_records' before reload...")
            db.query(TradeRecord).delete()
            db.commit()

            logger.info(f"Inserting {len(df)} records into SQLite database...")
            
            # Prepare dictionary records, replacing NaN with None for genuine SQL NULLs
            records_to_insert = []
            for _, row in df.iterrows():
                record_dict = {
                    "refYear": int(row["refYear"]),
                    "reporterISO": str(row["reporterISO"]),
                    "reporterDesc": str(row["reporterDesc"]),
                    "flowCode": str(row["flowCode"]),
                    "flowDesc": str(row["flowDesc"]),
                    "partnerISO": str(row["partnerISO"]),
                    "partnerDesc": str(row["partnerDesc"]),
                    "cmdCode": str(row["cmdCode"]),
                    "cmdDesc": str(row["cmdDesc"]),
                    "aggrLevel": int(row.get("aggrLevel", 0)) if pd.notna(row.get("aggrLevel")) else 0,
                    "isLeaf": bool(row.get("isLeaf", False)) if pd.notna(row.get("isLeaf")) else False,
                    "qty": float(row["qty"]) if pd.notna(row.get("qty")) else None,
                    "netWgt": float(row["netWgt"]) if pd.notna(row.get("netWgt")) else None,
                    "grossWgt": float(row["grossWgt"]) if pd.notna(row.get("grossWgt")) else None,
                    "cifvalue": float(row["cifvalue"]) if pd.notna(row.get("cifvalue")) else None,
                    "fobvalue": float(row["fobvalue"]) if pd.notna(row.get("fobvalue")) else None,
                    "primaryValue": float(row["primaryValue"]),
                    "tradeValue": float(row["tradeValue"]) if pd.notna(row.get("tradeValue")) else None,
                }
                records_to_insert.append(TradeRecord(**record_dict))

            # Batch insertion
            batch_size = 500
            for i in range(0, len(records_to_insert), batch_size):
                batch = records_to_insert[i : i + batch_size]
                db.bulk_save_objects(batch)
                db.commit()

            inserted_count = db.query(TradeRecord).count()
            logger.info(f"Successfully committed {inserted_count} trade records to database.")
            return inserted_count
        except Exception as e:
            db.rollback()
            logger.error(f"Database loading failed: {e}")
            raise
        finally:
            if should_close:
                db.close()

    def run(self, csv_path: Path = DEFAULT_CSV_PATH) -> Tuple[int, Dict[str, Any]]:
        """
        Executes full end-to-end pipeline: load -> validate -> clean -> persist.
        """
        logger.info(f"=== Starting Trade Data Pipeline for {csv_path} ===")
        raw_df, encoding = self.load_csv(csv_path)
        self.validate_schema(raw_df)
        cleaned_df, stats = self.clean_and_transform(raw_df)
        stats["encoding"] = encoding
        inserted_count = self.load_to_database(cleaned_df)
        stats["inserted_count"] = inserted_count
        logger.info("=== Trade Data Pipeline Finished Successfully ===")
        return inserted_count, stats


def run_pipeline(csv_path: Optional[Path] = None) -> Tuple[int, Dict[str, Any]]:
    """Helper entry point for external calls."""
    target_csv = csv_path or DEFAULT_CSV_PATH
    pipeline = TradeDataPipeline()
    return pipeline.run(target_csv)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Global Trade Data Ingestion Pipeline")
    parser.add_argument(
        "--csv",
        type=str,
        default=str(DEFAULT_CSV_PATH),
        help="Path to source CSV file",
    )
    args = parser.parse_args()
    count, pipeline_stats = run_pipeline(Path(args.csv))
    print(f"\nPipeline Execution Complete!")
    print(f"Total Rows Loaded: {count}")
    print(f"Stats: {pipeline_stats}")
