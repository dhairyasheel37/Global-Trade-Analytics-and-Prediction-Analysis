from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, case, text

from ..database import get_db
from ..models import TradeRecord
from ..schemas import (
    DataSummaryResponse,
    YearRange,
    UniqueCounts,
    SampleResponse,
    TradeRecordSchema,
)

router = APIRouter(prefix="/data", tags=["Trade Data"])

@router.get("/summary", response_model=DataSummaryResponse)
def get_data_summary(db: Session = Depends(get_db)):
    """
    Returns live summary statistics computed dynamically from the database.
    - Total record count
    - Year range (min, max)
    - Unique counts for reporters, partners, products, flow types
    - Missing value (NULL) counts per numeric field
    - Exact duplicate count
    - Negative value count
    """
    total_records = db.query(func.count(TradeRecord.id)).scalar() or 0

    if total_records == 0:
        return DataSummaryResponse(
            total_records=0,
            year_range=YearRange(min=None, max=None),
            unique_counts=UniqueCounts(reporters=0, partners=0, products=0, flows=0),
            missing_values={},
            exact_duplicate_count=0,
            negative_value_count=0,
        )

    # Compute year range
    min_year, max_year = db.query(
        func.min(TradeRecord.refYear),
        func.max(TradeRecord.refYear),
    ).first()

    # Compute unique counts
    unique_reporters = db.query(func.count(distinct(TradeRecord.reporterISO))).scalar() or 0
    unique_partners = db.query(func.count(distinct(TradeRecord.partnerISO))).scalar() or 0
    unique_products = db.query(func.count(distinct(TradeRecord.cmdCode))).scalar() or 0
    unique_flows = db.query(func.count(distinct(TradeRecord.flowCode))).scalar() or 0

    # Compute missing values (SQL NULLs) live across columns
    missing_qty = db.query(func.count(TradeRecord.id)).filter(TradeRecord.qty.is_(None)).scalar() or 0
    missing_net_wgt = db.query(func.count(TradeRecord.id)).filter(TradeRecord.netWgt.is_(None)).scalar() or 0
    missing_gross_wgt = db.query(func.count(TradeRecord.id)).filter(TradeRecord.grossWgt.is_(None)).scalar() or 0
    missing_cif = db.query(func.count(TradeRecord.id)).filter(TradeRecord.cifvalue.is_(None)).scalar() or 0
    missing_fob = db.query(func.count(TradeRecord.id)).filter(TradeRecord.fobvalue.is_(None)).scalar() or 0
    missing_primary = db.query(func.count(TradeRecord.id)).filter(TradeRecord.primaryValue.is_(None)).scalar() or 0
    missing_trade_val = db.query(func.count(TradeRecord.id)).filter(TradeRecord.tradeValue.is_(None)).scalar() or 0

    missing_values = {
        "refYear": 0,
        "reporterISO": 0,
        "reporterDesc": 0,
        "flowCode": 0,
        "flowDesc": 0,
        "partnerISO": 0,
        "partnerDesc": 0,
        "cmdCode": 0,
        "cmdDesc": 0,
        "qty": missing_qty,
        "netWgt": missing_net_wgt,
        "grossWgt": missing_gross_wgt,
        "cifvalue": missing_cif,
        "fobvalue": missing_fob,
        "primaryValue": missing_primary,
        "tradeValue": missing_trade_val,
    }

    # Compute exact duplicates count live in SQLite
    # Group by all content columns and find if any combination appears > 1
    dupe_query = text("""
        SELECT COUNT(*) - COUNT(DISTINCT 
            refYear || '|' || reporterISO || '|' || flowCode || '|' || partnerISO || '|' || cmdCode || '|' ||
            COALESCE(qty, -999999) || '|' || COALESCE(netWgt, -999999) || '|' || COALESCE(grossWgt, -999999) || '|' ||
            COALESCE(cifvalue, -999999) || '|' || COALESCE(fobvalue, -999999) || '|' || primaryValue
        ) AS exact_dupes
        FROM trade_records
    """)
    dupe_result = db.execute(dupe_query).scalar() or 0
    exact_duplicate_count = max(0, int(dupe_result))

    # Compute negative values count live across numeric columns
    negative_val_query = text("""
        SELECT 
            COALESCE(SUM(CASE WHEN primaryValue < 0 THEN 1 ELSE 0 END), 0) +
            COALESCE(SUM(CASE WHEN fobvalue < 0 THEN 1 ELSE 0 END), 0) +
            COALESCE(SUM(CASE WHEN cifvalue < 0 THEN 1 ELSE 0 END), 0) +
            COALESCE(SUM(CASE WHEN netWgt < 0 THEN 1 ELSE 0 END), 0) +
            COALESCE(SUM(CASE WHEN grossWgt < 0 THEN 1 ELSE 0 END), 0) +
            COALESCE(SUM(CASE WHEN qty < 0 THEN 1 ELSE 0 END), 0)
        FROM trade_records
    """)
    negative_value_count = int(db.execute(negative_val_query).scalar() or 0)

    return DataSummaryResponse(
        total_records=total_records,
        year_range=YearRange(min=min_year, max=max_year),
        unique_counts=UniqueCounts(
            reporters=unique_reporters,
            partners=unique_partners,
            products=unique_products,
            flows=unique_flows,
        ),
        missing_values=missing_values,
        exact_duplicate_count=exact_duplicate_count,
        negative_value_count=negative_value_count,
    )


@router.get("/sample", response_model=SampleResponse)
def get_data_sample(
    limit: int = Query(20, ge=1, le=500, description="Number of sample records to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db),
):
    """
    Returns a paginated sample of trade records for sanity checking.
    """
    total_records = db.query(func.count(TradeRecord.id)).scalar() or 0
    records = db.query(TradeRecord).order_by(TradeRecord.id.asc()).offset(offset).limit(limit).all()

    record_schemas = [TradeRecordSchema.model_validate(r) for r in records]

    return SampleResponse(
        total_records=total_records,
        limit=limit,
        offset=offset,
        returned_count=len(record_schemas),
        records=record_schemas,
    )
