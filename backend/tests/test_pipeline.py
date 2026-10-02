import pytest
import pandas as pd
import numpy as np
from pathlib import Path
import tempfile
import os

from app.data_pipeline import TradeDataPipeline, DataValidationError
from app.config import REQUIRED_COLUMNS, NUMERIC_COLUMNS

@pytest.fixture
def pipeline():
    return TradeDataPipeline()

@pytest.fixture
def sample_valid_df():
    return pd.DataFrame([
        {
            "refYear": 2020,
            "reporterISO": "USA",
            "reporterDesc": "United States",
            "partnerISO": "W00",
            "partnerDesc": "World",
            "flowCode": "M",
            "flowDesc": "Import",
            "cmdCode": "TOTAL",
            "cmdDesc": "All Commodities",
            "primaryValue": 1000000.0,
            "fobvalue": 0.0,
            "cifvalue": None,
            "netWgt": 0.0,
            "grossWgt": None,
            "qty": None,
            "aggrLevel": 0,
            "isLeaf": False,
            "tradeValue": 1000000.0,
        },
        {
            "refYear": "2021",
            "reporterISO": "CAN",
            "reporterDesc": "Canada",
            "partnerISO": "W00",
            "partnerDesc": "World",
            "flowCode": "X",
            "flowDesc": "Export",
            "cmdCode": "TOTAL",
            "cmdDesc": "All Commodities",
            "primaryValue": 500000.0,
            "fobvalue": 450000.0,
            "cifvalue": 0.0,
            "netWgt": None,
            "grossWgt": 0.0,
            "qty": 0.0,
            "aggrLevel": 0,
            "isLeaf": False,
            "tradeValue": 500000.0,
        }
    ])


def test_schema_validation_success(pipeline, sample_valid_df):
    """Pipeline should pass when all required columns are present."""
    pipeline.validate_schema(sample_valid_df)


def test_schema_validation_missing_columns(pipeline):
    """Pipeline must fail loudly with DataValidationError when required columns are missing."""
    df_missing = pd.DataFrame([{"refYear": 2020, "reporterISO": "USA"}])
    with pytest.raises(DataValidationError) as excinfo:
        pipeline.validate_schema(df_missing)
    assert "missing" in str(excinfo.value).lower()
    assert "required column" in str(excinfo.value).lower()


def test_refyear_conversion(pipeline, sample_valid_df):
    """refYear should be converted to integer even if given as string."""
    cleaned_df, stats = pipeline.clean_and_transform(sample_valid_df)
    assert cleaned_df["refYear"].dtype == np.int64 or cleaned_df["refYear"].dtype == int
    assert list(cleaned_df["refYear"]) == [2020, 2021]


def test_preserves_zero_and_null(pipeline, sample_valid_df):
    """Genuine 0 must stay 0.0, genuine NULL must stay NaN / None."""
    cleaned_df, stats = pipeline.clean_and_transform(sample_valid_df)
    
    # Row 0: fobvalue is 0.0, cifvalue is NaN
    assert cleaned_df.loc[0, "fobvalue"] == 0.0
    assert pd.isna(cleaned_df.loc[0, "cifvalue"])
    
    # Row 1: cifvalue is 0.0, netWgt is NaN
    assert cleaned_df.loc[1, "cifvalue"] == 0.0
    assert pd.isna(cleaned_df.loc[1, "netWgt"])


def test_coerces_invalid_numeric_to_null(pipeline):
    """Non-numeric values in numeric columns should be coerced to NULL and counted."""
    df = pd.DataFrame([
        {
            "refYear": 2020,
            "reporterISO": "USA",
            "reporterDesc": "United States",
            "partnerISO": "W00",
            "partnerDesc": "World",
            "flowCode": "M",
            "flowDesc": "Import",
            "cmdCode": "TOTAL",
            "cmdDesc": "All Commodities",
            "primaryValue": 1000.0,
            "fobvalue": "INVALID_NUMBER",
            "cifvalue": "N/A",
            "netWgt": 0.0,
            "grossWgt": 50.0,
            "qty": "unknown",
        }
    ])
    cleaned_df, stats = pipeline.clean_and_transform(df)
    assert pd.isna(cleaned_df.loc[0, "fobvalue"])
    assert pd.isna(cleaned_df.loc[0, "cifvalue"])
    assert pd.isna(cleaned_df.loc[0, "qty"])
    assert stats["coerced_counts"]["fobvalue"] == 1
    assert stats["coerced_counts"]["cifvalue"] == 1
    assert stats["coerced_counts"]["qty"] == 1


def test_exact_duplicate_removal_only(pipeline, sample_valid_df):
    """Only completely identical rows across all columns should be removed."""
    # Duplicate row 0 exactly
    df_with_dupe = pd.concat([sample_valid_df, sample_valid_df.iloc[[0]]], ignore_index=True)
    assert len(df_with_dupe) == 3

    cleaned_df, stats = pipeline.clean_and_transform(df_with_dupe)
    assert len(cleaned_df) == 2
    assert stats["exact_duplicates_removed"] == 1


def test_flags_negative_values_without_dropping(pipeline):
    """Negative values should be counted/flagged, but row must be kept."""
    df_with_neg = pd.DataFrame([
        {
            "refYear": 2020,
            "reporterISO": "USA",
            "reporterDesc": "United States",
            "partnerISO": "W00",
            "partnerDesc": "World",
            "flowCode": "M",
            "flowDesc": "Import",
            "cmdCode": "TOTAL",
            "cmdDesc": "All Commodities",
            "primaryValue": -5000.0,
            "fobvalue": 0.0,
            "cifvalue": None,
            "netWgt": 0.0,
            "grossWgt": 0.0,
            "qty": 0.0,
        }
    ])
    cleaned_df, stats = pipeline.clean_and_transform(df_with_neg)
    assert len(cleaned_df) == 1
    assert stats["negative_counts"]["primaryValue"] == 1
    assert cleaned_df.loc[0, "primaryValue"] == -5000.0


def test_encoding_fallback(pipeline):
    """Test loading a CSV file saved in latin-1 with special characters."""
    with tempfile.NamedTemporaryFile("w", encoding="latin-1", delete=False, suffix=".csv") as tmp:
        tmp.write("refYear,reporterISO,reporterDesc,partnerISO,partnerDesc,flowCode,flowDesc,cmdCode,cmdDesc,primaryValue,fobvalue,cifvalue,netWgt,grossWgt,qty\n")
        tmp.write("2020,CIV,Côte d'Ivoire,W00,World,M,Import,TOTAL,All Commodities,1000.0,0.0,,0.0,,\n")
        tmp_path = tmp.name

    try:
        df, encoding = pipeline.load_csv(Path(tmp_path))
        assert len(df) == 1
        assert encoding in ["utf-8", "latin-1"]
    finally:
        os.remove(tmp_path)
