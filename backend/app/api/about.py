"""
Phase 11: About Project & Dataset Stats API.

Provides high-level dynamic dataset figures for the About page.
Accessible to all authenticated roles (ADMIN and USER).
Exposes only high-level summary figures, avoiding internal data-quality details.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import TradeRecord, User
from app.schemas import (
    AboutDatasetStatsResponse,
    AboutYearRange,
)
from app.utils.logger import logger

router = APIRouter(prefix="/about", tags=["About Project"])


@router.get("/dataset-stats", response_model=AboutDatasetStatsResponse)
def get_about_dataset_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AboutDatasetStatsResponse:
    """
    Returns live high-level summary statistics of the trade dataset.
    Accessible to any authenticated user (both ADMIN and USER).
    """
    logger.info(f"User '{current_user.username}' requested About dataset stats.")

    total_records = db.query(func.count(TradeRecord.id)).scalar() or 0

    if total_records == 0:
        return AboutDatasetStatsResponse(
            total_records=0,
            year_range=AboutYearRange(start_year=None, end_year=None),
            reporter_count=0,
            flow_count=0,
            product_count=0,
            partner_count=0,
        )

    min_year, max_year = db.query(
        func.min(TradeRecord.refYear),
        func.max(TradeRecord.refYear),
    ).first()

    reporter_count = db.query(func.count(distinct(TradeRecord.reporterISO))).scalar() or 0
    flow_count = db.query(func.count(distinct(TradeRecord.flowCode))).scalar() or 0
    product_count = db.query(func.count(distinct(TradeRecord.cmdCode))).scalar() or 0
    partner_count = db.query(func.count(distinct(TradeRecord.partnerISO))).scalar() or 0

    return AboutDatasetStatsResponse(
        total_records=total_records,
        year_range=AboutYearRange(
            start_year=int(min_year) if min_year is not None else None,
            end_year=int(max_year) if max_year is not None else None,
        ),
        reporter_count=reporter_count,
        flow_count=flow_count,
        product_count=product_count,
        partner_count=partner_count,
    )
