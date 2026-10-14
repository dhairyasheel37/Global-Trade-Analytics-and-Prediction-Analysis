"""
Phase 9: Data Management API — Admin-only endpoints for dataset overview and CSV upload.

All endpoints use the existing `require_admin` dependency from Phase 2.
Validation logic reuses REQUIRED_COLUMNS / NUMERIC_COLUMNS from config.py
and is NOT duplicated from data_pipeline.py.
"""
from __future__ import annotations

import io
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

import pandas as pd
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Query, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.config import REQUIRED_COLUMNS, NUMERIC_COLUMNS
from app.database import get_db
from app.dependencies import require_admin
from app.models import TradeRecord, User, Country, Product, TradeRecordV2, DataSyncLog
from app.schemas import (
    DataOverviewResponse,
    DataQualitySummary,
    MissingColumnDetail,
    RejectionDetail,
    UploadResponse,
    YearRange,
    SyncStatusResponse,
    SyncTriggerRequest,
    SyncTriggerResponse,
    SyncConfigRequest,
    DataSyncLogItem,
)
from app.services.sync_service import sync_service
from app.utils.logger import logger

router = APIRouter(prefix="/admin/data", tags=["Admin Data Management"])

# ── Constants ────────────────────────────────────────────────────────────────

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
KNOWN_FLOW_CODES: Set[str] = {"M", "X"}
VALID_YEAR_MIN = 1900
VALID_YEAR_MAX = 2100

# Columns whose NULL counts we track in the overview
NULLABLE_COLUMNS = ["qty", "netWgt", "grossWgt", "cifvalue", "fobvalue", "tradeValue"]
# All DB columns we report (matches TradeRecord minus id/createdAt)
ALL_TRACKED_COLUMNS = [
    "refYear", "reporterISO", "reporterDesc", "flowCode", "flowDesc",
    "partnerISO", "partnerDesc", "cmdCode", "cmdDesc",
    "aggrLevel", "isLeaf",
    "qty", "netWgt", "grossWgt", "cifvalue", "fobvalue",
    "primaryValue", "tradeValue",
]

# Required columns for granular trade data upload (targets trade_records_v2)
GRANULAR_CORE_COLUMNS = [
    "refYear", "reporterISO", "reporterDesc",
    "partnerISO", "partnerDesc",
    "flowCode", "flowDesc",
    "cmdCode", "cmdDesc",
    "primaryValue",
]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _compute_missing_values(db: Session) -> Dict[str, int]:
    """
    Returns a dict of column → null-row-count for every tracked column.
    Only nullable columns can ever have nulls in this schema; mandatory string
    columns are reported as 0 without hitting the DB.
    """
    result: Dict[str, int] = {}
    for col in ALL_TRACKED_COLUMNS:
        if col in NULLABLE_COLUMNS:
            attr = getattr(TradeRecord, col, None)
            if attr is not None:
                count = db.query(func.count()).filter(attr.is_(None)).scalar() or 0
                result[col] = int(count)
            else:
                result[col] = 0
        else:
            result[col] = 0
    return result


def _composite_key(row: pd.Series) -> Tuple:
    """Extracts the composite dedup key from a DataFrame row."""
    return (
        int(row["refYear"]),
        str(row["reporterISO"]).strip().upper(),
        str(row["partnerISO"]).strip().upper(),
        str(row["flowCode"]).strip().upper(),
        str(row["cmdCode"]).strip(),
    )


def _looks_like_iso_code(code: str) -> bool:
    """
    Basic ISO country-code format check (2–4 uppercase letters/digits).
    Not an exhaustive whitelist — real codes like W00 (World) are accepted.
    """
    return bool(re.fullmatch(r"[A-Z0-9]{2,4}", code.strip().upper()))


# ── GET /api/admin/data/overview ─────────────────────────────────────────────

@router.get("/overview", response_model=DataOverviewResponse)
def get_data_overview(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> DataOverviewResponse:
    """
    Returns an authoritative, live dataset overview and health snapshot.
    Strict Metric-Selection & Source-of-Truth Rules:
    - trade_records_v2 is the source of truth for active dataset statistics and granular scope.
    - trade_records is queried for baseline records (3,925).
    - Granular bilateral records (952) reflect non-World/TOTAL granular data.
    - Computed fresh on every call — never cached.
    """
    logger.info(f"Admin '{admin.username}' requested data overview.")

    # 1. Active vs Baseline Record Counts
    total_active_records = db.query(func.count(TradeRecordV2.id)).scalar() or 0
    baseline_records = db.query(func.count(TradeRecord.id)).scalar() or 0

    # 2. Granular vs Aggregate Breakdown
    # Granular bilateral record = partner != W00 AND product != TOTAL
    world_c = db.query(Country).filter(Country.iso_code == "W00").first()
    world_id = world_c.country_id if world_c else -1

    total_p = db.query(Product).filter(Product.product_code == "TOTAL").first()
    total_id = total_p.product_id if total_p else -1

    granular_bilateral_records = (
        db.query(func.count(TradeRecordV2.id))
        .filter(
            TradeRecordV2.partner_id != world_id,
            TradeRecordV2.product_id != total_id,
        )
        .scalar() or 0
    )

    # 3. Year Range from active records (2014–2025)
    yr = db.query(
        func.min(TradeRecordV2.year),
        func.max(TradeRecordV2.year),
    ).first()
    min_year = int(yr[0]) if yr[0] is not None else 2014
    max_year = int(yr[1]) if yr[1] is not None else 2025
    year_range = YearRange(min=min_year, max=max_year)

    # 4. Reporters from active v2 dataset (190)
    unique_reporters = (
        db.query(func.count(func.distinct(TradeRecordV2.reporter_id))).scalar() or 0
    )

    # Granular reporters with valid bilateral granular records (CHN, DEU, IND, USA)
    granular_rep_ids = [
        r[0]
        for r in db.query(func.distinct(TradeRecordV2.reporter_id))
        .filter(
            TradeRecordV2.partner_id != world_id,
            TradeRecordV2.product_id != total_id,
        )
        .all()
    ]
    granular_reps_rows = (
        db.query(Country.country_name)
        .filter(Country.country_id.in_(granular_rep_ids))
        .order_by(Country.country_name.asc())
        .all()
    )
    granular_reporters = [r[0] for r in granular_reps_rows]
    granular_reporter_count = len(granular_reporters)
    aggregate_only_reporter_count = unique_reporters - granular_reporter_count

    # 5. Granular Partners (excluding W00/World and excluding TOTAL product) -> 5
    partner_rows = (
        db.query(Country.country_name)
        .join(TradeRecordV2, TradeRecordV2.partner_id == Country.country_id)
        .filter(
            Country.iso_code != "W00",
            TradeRecordV2.product_id != total_id,
        )
        .distinct()
        .order_by(Country.country_name.asc())
        .all()
    )
    granular_partners = [r[0] for r in partner_rows]
    granular_partner_count = len(granular_partners)

    # 6. Granular Products (excluding TOTAL and excluding W00 partner) -> 4 HS Chapters
    product_rows = (
        db.query(Product.product_code, Product.product_name)
        .join(TradeRecordV2, TradeRecordV2.product_id == Product.product_id)
        .filter(
            Product.product_code != "TOTAL",
            TradeRecordV2.partner_id != world_id,
        )
        .distinct()
        .order_by(Product.product_code.asc())
        .all()
    )
    granular_products = [f"{r[1]} (HS {r[0]})" for r in product_rows]
    granular_product_count = len(granular_products)

    # 7. Trade Flows (2 flows: M and X)
    unique_flows = (
        db.query(func.count(func.distinct(TradeRecordV2.flow_code))).scalar() or 0
    )

    # 8. Missing Values and Health Evaluation
    missing_values = _compute_missing_values(db)

    # Critical fields: reporter, year, flow, partner, product, primaryValue
    CRITICAL_COLUMNS = ["primaryValue", "reporterISO", "refYear", "flowCode", "partnerISO", "cmdCode"]
    OPTIONAL_MEASUREMENT_COLUMNS = ["qty", "netWgt", "grossWgt", "cifvalue", "fobvalue"]

    critical_missing_cells = sum(missing_values.get(c, 0) for c in CRITICAL_COLUMNS)
    optional_missing_cells = sum(missing_values.get(c, 0) for c in OPTIONAL_MEASUREMENT_COLUMNS)
    total_missing_cells = critical_missing_cells + optional_missing_cells
    columns_with_missing = sum(1 for c in OPTIONAL_MEASUREMENT_COLUMNS if missing_values.get(c, 0) > 0)

    # Dynamic calculation over the active dataset (trade_records_v2: 4,877 records x 18 columns = 87,786 cells)
    tracked_columns_count = len(ALL_TRACKED_COLUMNS)  # 18
    total_active_cells = total_active_records * tracked_columns_count
    missing_cell_percentage = (
        round(((optional_missing_cells + critical_missing_cells) / total_active_cells) * 100, 2)
        if total_active_cells > 0 else 0.0
    )

    # Critical fields detail list (primaryValue + core dimensions)
    critical_field_metadata = [
        ("primaryValue", "Primary Trade Value (USD)", "Core analytical valuation measure; 100% complete across all records"),
        ("reporterISO", "Reporter Economy", "Reporting country sovereign identifier; 100% complete"),
        ("refYear", "Reference Year", "Time period identifier; 100% complete across 2014–2025"),
        ("flowCode", "Trade Flow", "Direction of trade (Import/Export); 100% complete"),
        ("partnerISO", "Partner Territory", "Trade counterparty identifier; 100% complete"),
        ("cmdCode", "Product Classification", "Commodity chapter/aggregate code; 100% complete"),
    ]
    critical_missing_details: List[MissingColumnDetail] = []
    for col, label, desc in critical_field_metadata:
        cnt = missing_values.get(col, 0)
        pct = round((cnt / total_active_records) * 100, 2) if total_active_records > 0 else 0.0
        critical_missing_details.append(
            MissingColumnDetail(
                column=col,
                missing_count=cnt,
                total_records=total_active_records,
                missing_percentage=pct,
                is_critical=True,
                field_label=label,
                description=desc,
            )
        )

    # Optional measurement fields detail list (Excludes primaryValue!)
    optional_field_metadata = [
        ("qty", "Quantity (qty)", "Secondary physical unit; trade values remain 100% complete"),
        ("netWgt", "Net Weight (netWgt)", "Secondary mass metric (kg); not required for monetary valuation"),
        ("grossWgt", "Gross Weight (grossWgt)", "Optional shipping metric; often unrecorded in customs filings"),
        ("cifvalue", "CIF Valuation (cifvalue)", "Optional insurance/freight split; primaryValue provides authoritative total"),
        ("fobvalue", "FOB Valuation (fobvalue)", "Optional free-on-board split; primaryValue provides authoritative total"),
    ]
    optional_missing_details: List[MissingColumnDetail] = []
    for col, label, desc in optional_field_metadata:
        cnt = missing_values.get(col, 0)
        pct = round((cnt / total_active_records) * 100, 2) if total_active_records > 0 else 0.0
        optional_missing_details.append(
            MissingColumnDetail(
                column=col,
                missing_count=cnt,
                total_records=total_active_records,
                missing_percentage=pct,
                is_critical=False,
                field_label=label,
                description=desc,
            )
        )

    # Combined missing details
    missing_details: List[MissingColumnDetail] = critical_missing_details + optional_missing_details

    # 9. Exact composite-key duplicates check
    dup_subq = (
        db.query(
            TradeRecord.refYear,
            TradeRecord.reporterISO,
            TradeRecord.partnerISO,
            TradeRecord.flowCode,
            TradeRecord.cmdCode,
            func.count().label("cnt"),
        )
        .group_by(
            TradeRecord.refYear,
            TradeRecord.reporterISO,
            TradeRecord.partnerISO,
            TradeRecord.flowCode,
            TradeRecord.cmdCode,
        )
        .having(func.count() > 1)
        .subquery()
    )
    duplicate_record_count = db.query(func.count()).select_from(dup_subq).scalar() or 0

    # 10. Refined Health Status Determination
    total_issues = columns_with_missing + (1 if duplicate_record_count > 0 else 0)
    if critical_missing_cells > 0 or duplicate_record_count > 0:
        health_status = "ISSUES"
        health_label = "Critical Data Issues"
    elif optional_missing_cells > 0:
        health_status = "WARNINGS"
        health_label = "Partial Missing Data"
    else:
        health_status = "GOOD"
        health_label = "Healthy"

    quality_summary = DataQualitySummary(
        total_issues=total_issues,
        columns_with_missing=columns_with_missing,
        total_missing_cells=total_missing_cells,
        has_duplicates=duplicate_record_count > 0,
        duplicate_count=duplicate_record_count,
        health_status=health_status,
        health_label=health_label,
        critical_missing_cells=critical_missing_cells,
        optional_missing_cells=optional_missing_cells,
        missing_cell_percentage=missing_cell_percentage,
        total_active_cells=total_active_cells,
    )

    if granular_reporter_count > 0:
        rep_names_str = ", ".join(granular_reporters)
        scope_notice = (
            f"Granular partner- and product-level data is available for {granular_reporter_count} "
            f"of {unique_reporters} reporters ({rep_names_str}), covering "
            f"{granular_partner_count} partner countries and {granular_product_count} HS product categories. "
            f"The remaining {aggregate_only_reporter_count} reporters have aggregate World/TOTAL data."
        )
    else:
        scope_notice = (
            f"Authoritative macroeconomic trade dataset covering all {unique_reporters} global economies. "
            f"All {total_active_records} records represent total merchandise trade flows (2014–2025)."
        )

    return DataOverviewResponse(
        record_count=total_active_records,  # 4,877 total active records
        column_count=len(ALL_TRACKED_COLUMNS),  # 18 tracked schema fields
        year_range=year_range,
        unique_reporters=unique_reporters,  # 190
        unique_partners=granular_partner_count if granular_partner_count > 0 else 1,
        unique_products=granular_product_count if granular_product_count > 0 else 1,
        unique_flows=unique_flows,  # 2
        missing_values=missing_values,
        duplicate_record_count=duplicate_record_count,
        data_quality_summary=quality_summary,
        total_active_records=total_active_records,
        total_active_cells=total_active_cells,
        baseline_records=baseline_records,
        granular_bilateral_records=granular_bilateral_records,
        granular_reporter_count=granular_reporter_count,
        granular_reporters=granular_reporters,
        aggregate_only_reporter_count=aggregate_only_reporter_count,
        granular_partner_count=granular_partner_count,
        granular_partners=granular_partners,
        granular_product_count=granular_product_count,
        granular_products=granular_products,
        has_aggregate_product=True,
        aggregate_product_label="TOTAL (All Commodities)",
        missing_details=missing_details,
        critical_missing_details=critical_missing_details,
        optional_missing_details=optional_missing_details,
        scope_notice=scope_notice,
    )


# ── POST /api/admin/data/upload ───────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    target: Optional[str] = Query(
        None,
        description="Target schema: 'v1' for legacy trade_records, 'v2' for normalized trade_records_v2. Defaults to auto-detect."
    ),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> UploadResponse:
    """
    Accepts a CSV upload, validates it row-by-row, and inserts only new
    records (composite-key dedup). Supports both legacy format (v1) and
    granular format (v2 targeting trade_records_v2 + countries + products).
    Never modifies or deletes existing data.
    """
    filename = file.filename or "unknown.csv"
    logger.info(f"Admin '{admin.username}' uploading file: {filename} (target={target})")

    # ── File-level validations ────────────────────────────────────────────────

    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Only .csv files are accepted. Received: '{filename}'",
        )

    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum allowed size is 50 MB. Received: {len(raw_bytes) / 1024 / 1024:.1f} MB",
        )

    # ── Parse CSV ─────────────────────────────────────────────────────────────

    try:
        try:
            df = pd.read_csv(io.BytesIO(raw_bytes), encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(raw_bytes), encoding="latin-1")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not parse CSV file: {exc}",
        )

    records_read = len(df)
    logger.info(f"Parsed {records_read} rows from '{filename}'.")

    # ── Target schema detection ───────────────────────────────────────────────

    present_cols = set(df.columns)

    if target in ("v2", "trade_records_v2"):
        is_v2 = True
    elif target in ("v1", "trade_records"):
        is_v2 = False
    else:
        # Auto-detect:
        # Check if file has granular markers or is missing v1-only optional columns
        has_granular_markers = bool({"isReported", "isAggregate", "legacyEstimationFlag"}.intersection(present_cols))
        missing_v1_cols = [c for c in REQUIRED_COLUMNS if c not in present_cols]
        missing_granular_cols = [c for c in GRANULAR_CORE_COLUMNS if c not in present_cols]

        if not missing_granular_cols and (has_granular_markers or missing_v1_cols):
            is_v2 = True
        elif not missing_v1_cols:
            is_v2 = False
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Missing required columns: {missing_v1_cols}. "
                    f"Required: {REQUIRED_COLUMNS}"
                ),
            )

    def _safe_float(val) -> Optional[float]:
        converted = pd.to_numeric(val, errors="coerce")
        return float(converted) if not pd.isna(converted) else None

    # ══════════════════════════════════════════════════════════════════════════
    # PATH A: Granular Schema Upload (targets trade_records_v2)
    # ══════════════════════════════════════════════════════════════════════════
    if is_v2:
        missing_granular = [c for c in GRANULAR_CORE_COLUMNS if c not in present_cols]
        if missing_granular:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required columns for granular upload: {missing_granular}. Required: {GRANULAR_CORE_COLUMNS}",
            )

        rejection_buckets: Dict[str, List[int]] = defaultdict(list)
        valid_rows: List[Dict[str, Any]] = []

        for raw_idx, row in df.iterrows():
            row_num = int(raw_idx) + 2
            reasons_this_row: List[str] = []

            # 1. Year validation
            try:
                year_val = int(pd.to_numeric(row["refYear"], errors="raise"))
                if year_val < VALID_YEAR_MIN or year_val > VALID_YEAR_MAX:
                    reasons_this_row.append(
                        f"invalid_year (value={year_val}, must be {VALID_YEAR_MIN}–{VALID_YEAR_MAX})"
                    )
            except (ValueError, TypeError):
                reasons_this_row.append(f"non_numeric_year (value='{row.get('refYear', '')}')")
                year_val = None

            # 2. flowCode validation
            flow_val = str(row.get("flowCode", "")).strip().upper()
            if flow_val not in KNOWN_FLOW_CODES:
                reasons_this_row.append(
                    f"invalid_flow_code (value='{row.get('flowCode', '')}', must be one of {sorted(KNOWN_FLOW_CODES)})"
                )

            # 3. ISO code format check (reporterISO, partnerISO)
            rep_iso = str(row.get("reporterISO", "")).strip()
            if not _looks_like_iso_code(rep_iso):
                reasons_this_row.append(f"invalid_reporter_iso (value='{rep_iso}')")
            par_iso = str(row.get("partnerISO", "")).strip()
            if not _looks_like_iso_code(par_iso):
                reasons_this_row.append(f"invalid_partner_iso (value='{par_iso}')")

            # 4. primaryValue must be numeric
            pv = pd.to_numeric(row.get("primaryValue", None), errors="coerce")
            if pd.isna(pv):
                reasons_this_row.append(
                    f"non_numeric_primaryValue (value='{row.get('primaryValue', '')}')"
                )

            if reasons_this_row:
                for r in reasons_this_row:
                    rejection_buckets[r].append(row_num)
                continue

            valid_rows.append({
                "year": year_val,
                "reporterISO": rep_iso.upper(),
                "reporterDesc": str(row.get("reporterDesc", rep_iso)),
                "partnerISO": par_iso.upper(),
                "partnerDesc": str(row.get("partnerDesc", par_iso)),
                "flowCode": flow_val,
                "flowDesc": str(row.get("flowDesc", flow_val)),
                "cmdCode": str(row.get("cmdCode", "TOTAL")).strip().upper(),
                "cmdDesc": str(row.get("cmdDesc", "All Commodities")),
                "primaryValue": float(pv),
                "fobvalue": _safe_float(row.get("fobvalue")),
                "cifvalue": _safe_float(row.get("cifvalue")),
                "qty": _safe_float(row.get("qty")),
                "isReported": bool(row["isReported"]) if "isReported" in row and not pd.isna(row["isReported"]) else False,
                "isAggregate": bool(row["isAggregate"]) if "isAggregate" in row and not pd.isna(row["isAggregate"]) else True,
                "legacyEstimationFlag": int(pd.to_numeric(row.get("legacyEstimationFlag", 0), errors="coerce") or 0) if "legacyEstimationFlag" in row else 0,
            })

        all_rejected_rows: Set[int] = set()
        for idxs in rejection_buckets.values():
            all_rejected_rows.update(idxs)
        invalid_count = len(all_rejected_rows)

        # Pre-cache existing countries and products from DB
        countries_by_iso = {c.iso_code.upper(): c for c in db.query(Country).all()}
        products_by_code = {p.product_code.upper(): p for p in db.query(Product).all()}

        # Fetch existing composite keys in trade_records_v2
        existing_v2_keys: Set[Tuple[int, int, int, int, str]] = set(
            db.query(
                TradeRecordV2.year,
                TradeRecordV2.reporter_id,
                TradeRecordV2.partner_id,
                TradeRecordV2.product_id,
                TradeRecordV2.flow_code,
            ).all()
        )

        new_v2_records: List[TradeRecordV2] = []
        skipped_count = 0
        inserted_keys: Set[Tuple[int, int, int, int, str]] = set()

        for rec in valid_rows:
            # Lookup or insert reporter country
            rep_iso = rec["reporterISO"]
            if rep_iso not in countries_by_iso:
                new_c = Country(iso_code=rep_iso, country_name=rec["reporterDesc"])
                db.add(new_c)
                db.flush()
                countries_by_iso[rep_iso] = new_c
            rep_obj = countries_by_iso[rep_iso]

            # Lookup or insert partner country
            par_iso = rec["partnerISO"]
            if par_iso not in countries_by_iso:
                new_c = Country(iso_code=par_iso, country_name=rec["partnerDesc"])
                db.add(new_c)
                db.flush()
                countries_by_iso[par_iso] = new_c
            par_obj = countries_by_iso[par_iso]

            # Lookup or insert product
            cmd_code = rec["cmdCode"]
            if cmd_code not in products_by_code:
                level = "TOTAL" if cmd_code == "TOTAL" else ("HS2" if len(cmd_code) <= 2 else "HS4")
                new_p = Product(product_code=cmd_code, product_name=rec["cmdDesc"], product_level=level)
                db.add(new_p)
                db.flush()
                products_by_code[cmd_code] = new_p
            prod_obj = products_by_code[cmd_code]

            key = (rec["year"], rep_obj.country_id, par_obj.country_id, prod_obj.product_id, rec["flowCode"])
            if key in existing_v2_keys or key in inserted_keys:
                skipped_count += 1
            else:
                new_v2_records.append(
                    TradeRecordV2(
                        year=rec["year"],
                        reporter_id=rep_obj.country_id,
                        partner_id=par_obj.country_id,
                        product_id=prod_obj.product_id,
                        flow_code=rec["flowCode"],
                        flow_name=rec["flowDesc"],
                        primary_value=rec["primaryValue"],
                        fob_value=rec["fobvalue"],
                        cif_value=rec["cifvalue"],
                        quantity=rec["qty"],
                        source="UN_COMTRADE",
                        is_reported=rec["isReported"],
                        is_aggregate=rec["isAggregate"],
                        legacy_estimation_flag=rec["legacyEstimationFlag"],
                    )
                )
                inserted_keys.add(key)

        if new_v2_records:
            try:
                batch_size = 500
                for i in range(0, len(new_v2_records), batch_size):
                    db.bulk_save_objects(new_v2_records[i : i + batch_size])
                db.commit()
                logger.info(
                    f"Granular upload by '{admin.username}': inserted {len(new_v2_records)}, "
                    f"skipped {skipped_count}, rejected {invalid_count} into trade_records_v2."
                )
            except Exception as exc:
                db.rollback()
                logger.error(f"Upload DB error: {exc}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Database error during insert: {exc}",
                )
        else:
            db.commit()

        rejection_details = [
            RejectionDetail(reason=reason, count=len(idxs), row_indices=sorted(idxs))
            for reason, idxs in sorted(rejection_buckets.items())
        ]
        inserted_count = len(new_v2_records)
        msg = (
            f"Upload complete: {inserted_count} new record(s) inserted into trade_records_v2, "
            f"{skipped_count} skipped (duplicates), "
            f"{invalid_count} rejected (validation)."
        )
        return UploadResponse(
            filename=filename,
            records_read=records_read,
            new_records_inserted=inserted_count,
            existing_records_skipped=skipped_count,
            invalid_records_rejected=invalid_count,
            rejection_details=rejection_details,
            success=True,
            message=msg,
        )

    # ══════════════════════════════════════════════════════════════════════════
    # PATH B: Legacy Schema Upload (targets original trade_records)
    # ══════════════════════════════════════════════════════════════════════════
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in present_cols]
    if missing_cols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Missing required columns: {missing_cols}. "
                f"Required: {REQUIRED_COLUMNS}"
            ),
        )

    # ── Row-by-row validation ────────────────────────────────────────────────

    rejection_buckets: Dict[str, List[int]] = defaultdict(list)
    valid_rows: List[Dict[str, Any]] = []

    for raw_idx, row in df.iterrows():
        row_num = int(raw_idx) + 2
        reasons_this_row: List[str] = []

        # 1. Year validation
        try:
            year_val = int(pd.to_numeric(row["refYear"], errors="raise"))
            if year_val < VALID_YEAR_MIN or year_val > VALID_YEAR_MAX:
                reasons_this_row.append(
                    f"invalid_year (value={year_val}, must be {VALID_YEAR_MIN}–{VALID_YEAR_MAX})"
                )
        except (ValueError, TypeError):
            reasons_this_row.append(f"non_numeric_year (value='{row['refYear']}')")
            year_val = None

        # 2. flowCode validation
        flow_val = str(row.get("flowCode", "")).strip().upper()
        if flow_val not in KNOWN_FLOW_CODES:
            reasons_this_row.append(
                f"invalid_flow_code (value='{row.get('flowCode', '')}', must be one of {sorted(KNOWN_FLOW_CODES)})"
            )

        # 3. ISO code format check (reporterISO, partnerISO)
        rep_iso = str(row.get("reporterISO", "")).strip()
        if not _looks_like_iso_code(rep_iso):
            reasons_this_row.append(
                f"invalid_reporter_iso (value='{rep_iso}')"
            )
        par_iso = str(row.get("partnerISO", "")).strip()
        if not _looks_like_iso_code(par_iso):
            reasons_this_row.append(
                f"invalid_partner_iso (value='{par_iso}')"
            )

        # 4. primaryValue must be numeric (required column, not nullable)
        pv = pd.to_numeric(row.get("primaryValue", None), errors="coerce")
        if pd.isna(pv):
            reasons_this_row.append(
                f"non_numeric_primaryValue (value='{row.get('primaryValue', '')}')"
            )

        if reasons_this_row:
            for r in reasons_this_row:
                rejection_buckets[r].append(row_num)
            continue

        valid_rows.append({
            "refYear": year_val,
            "reporterISO": rep_iso.upper(),
            "reporterDesc": str(row.get("reporterDesc", rep_iso)),
            "flowCode": flow_val,
            "flowDesc": str(row.get("flowDesc", flow_val)),
            "partnerISO": par_iso.upper(),
            "partnerDesc": str(row.get("partnerDesc", par_iso)),
            "cmdCode": str(row.get("cmdCode", "TOTAL")).strip(),
            "cmdDesc": str(row.get("cmdDesc", "All Commodities")),
            "aggrLevel": int(pd.to_numeric(row.get("aggrLevel", 0), errors="coerce") or 0),
            "isLeaf": bool(row.get("isLeaf", False)),
            "qty": _safe_float(row.get("qty")),
            "netWgt": _safe_float(row.get("netWgt")),
            "grossWgt": _safe_float(row.get("grossWgt")),
            "cifvalue": _safe_float(row.get("cifvalue")),
            "fobvalue": _safe_float(row.get("fobvalue")),
            "primaryValue": float(pv),
            "tradeValue": _safe_float(row.get("tradeValue")),
        })

    all_rejected_rows: Set[int] = set()
    for idxs in rejection_buckets.values():
        all_rejected_rows.update(idxs)
    invalid_count = len(all_rejected_rows)

    # ── Composite-key dedup against existing DB ───────────────────────────────

    existing_keys: Set[Tuple] = set(
        db.query(
            TradeRecord.refYear,
            TradeRecord.reporterISO,
            TradeRecord.partnerISO,
            TradeRecord.flowCode,
            TradeRecord.cmdCode,
        ).all()
    )
    existing_keys_norm: Set[Tuple] = {
        (r, rep.upper(), par.upper(), fl.upper(), cmd)
        for r, rep, par, fl, cmd in existing_keys
    }

    new_records: List[TradeRecord] = []
    skipped_count = 0
    inserted_keys: Set[Tuple] = set()

    for rec in valid_rows:
        key = (
            rec["refYear"],
            rec["reporterISO"],
            rec["partnerISO"],
            rec["flowCode"],
            rec["cmdCode"],
        )
        if key in existing_keys_norm or key in inserted_keys:
            skipped_count += 1
        else:
            new_records.append(TradeRecord(**rec))
            inserted_keys.add(key)

    # ── Batch insert ──────────────────────────────────────────────────────────

    if new_records:
        try:
            batch_size = 500
            for i in range(0, len(new_records), batch_size):
                db.bulk_save_objects(new_records[i : i + batch_size])
            db.commit()
            logger.info(
                f"Upload by '{admin.username}': inserted {len(new_records)}, "
                f"skipped {skipped_count}, rejected {invalid_count} from '{filename}'."
            )
        except Exception as exc:
            db.rollback()
            logger.error(f"Upload DB error: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error during insert: {exc}",
            )
    else:
        logger.info(
            f"Upload by '{admin.username}': 0 new records to insert from '{filename}'."
        )

    # ── Build rejection details list ──────────────────────────────────────────

    rejection_details: List[RejectionDetail] = [
        RejectionDetail(reason=reason, count=len(idxs), row_indices=sorted(idxs))
        for reason, idxs in sorted(rejection_buckets.items())
    ]

    inserted_count = len(new_records)
    msg = (
        f"Upload complete: {inserted_count} new record(s) inserted, "
        f"{skipped_count} skipped (duplicates), "
        f"{invalid_count} rejected (validation)."
    )

    # Persist audit record in data_sync_logs
    try:
        csv_log = DataSyncLog(
            sync_type="CSV_UPLOAD",
            status="SUCCESS",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            records_processed=records_read,
            records_inserted=inserted_count,
            records_skipped=skipped_count,
            records_rejected=invalid_count,
            source_name=filename,
            details=f"Admin: {admin.username}, Target: {target or 'auto'}",
        )
        db.add(csv_log)
        db.commit()
    except Exception as log_err:
        logger.warning(f"Could not record sync log for CSV upload: {log_err}")

    return UploadResponse(
        filename=filename,
        records_read=records_read,
        new_records_inserted=inserted_count,
        existing_records_skipped=skipped_count,
        invalid_records_rejected=invalid_count,
        rejection_details=rejection_details,
        success=True,
        message=msg,
    )


# ── Live UN Comtrade Sync Endpoints ──────────────────────────────────────────

@router.get("/sync/status", response_model=SyncStatusResponse)
async def get_sync_status(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> SyncStatusResponse:
    """
    Returns the real-time status of the UN Comtrade API sync engine,
    including scheduler status, last execution, and recent audit logs.
    """
    status_data = sync_service.get_status(db)
    return SyncStatusResponse(**status_data)


@router.post("/sync/trigger", response_model=SyncTriggerResponse)
async def trigger_sync(
    payload: Optional[SyncTriggerRequest] = None,
    admin: User = Depends(require_admin),
) -> SyncTriggerResponse:
    """
    Triggers an immediate background fetch & synchronization against the
    UN Comtrade v1 REST API for specified or default reporters and years.
    """
    if sync_service.is_running:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A data synchronization task is already in progress.",
        )

    # Execute async API sync
    reporters = payload.reporters if payload else None
    years = payload.years if payload else None
    flows = payload.flows if payload else None
    commodities = payload.commodities if payload else None

    logger.info(f"Admin '{admin.username}' triggered manual UN Comtrade API sync.")
    result = await sync_service.execute_api_sync(
        reporters=reporters,
        years=years,
        flows=flows,
        commodities=commodities,
        sync_type="API_PULL",
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"API Sync failed: {result.get('message', 'External UN Comtrade API error')}",
        )

    return SyncTriggerResponse(
        success=True,
        message=(
            f"Sync completed successfully. Fetched {result.get('records_fetched', 0)} records: "
            f"{result.get('records_inserted', 0)} inserted, {result.get('records_skipped', 0)} skipped."
        ),
        log_id=result.get("log_id"),
        sync_type="API_PULL",
    )


@router.post("/sync/config", response_model=SyncStatusResponse)
async def update_sync_config(
    payload: SyncConfigRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> SyncStatusResponse:
    """
    Updates the automated background cron scheduler settings
    (enabling/disabling auto-sync and adjusting frequency interval).
    """
    logger.info(
        f"Admin '{admin.username}' updated sync config: enabled={payload.scheduler_enabled}, "
        f"interval={payload.sync_interval_hours}h"
    )
    sync_service.scheduler_enabled = payload.scheduler_enabled
    sync_service.sync_interval_hours = payload.sync_interval_hours

    status_data = sync_service.get_status(db)
    return SyncStatusResponse(**status_data)

