from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_, or_

from app.database import get_db
from app.models import TradeRecordV2, Country, Product, User
from app.dependencies import get_current_user
from app.query_helpers import (
    get_trade_v2_base_query,
    ReporterCountry,
    PartnerCountry,
    ProductEntity,
)
from app.schemas import (
    TradeBalanceSummaryResponse,
    TradeBalanceYearlyItem,
    CountryBalanceCompareItem,
)

router = APIRouter(prefix="/trade-balance", tags=["Trade Balance"])


@router.get("/summary", response_model=TradeBalanceSummaryResponse)
def get_trade_balance_summary(
    reporter: Optional[str] = Query(None, description="Reporter ISO, country name, or 'GLOBAL'"),
    start_year: Optional[int] = Query(None, description="Start year filter"),
    end_year: Optional[int] = Query(None, description="End year filter"),
    partner: Optional[str] = Query(None, description="Partner ISO"),
    product: Optional[str] = Query(None, description="Product code"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Computes global or single-country total exports, imports, and net trade balance.
    Defaults to World aggregate and TOTAL commodity series.
    """
    min_year_db, max_year_db = db.query(
        func.min(TradeRecordV2.year), func.max(TradeRecordV2.year)
    ).first()
    resolved_start_year = start_year if start_year is not None else int(min_year_db or 2014)
    resolved_end_year = end_year if end_year is not None else int(max_year_db or 2025)

    is_global = not reporter or not reporter.strip() or reporter.strip().upper() == "GLOBAL" or reporter.strip() == "ALL"

    resolved_reporter = "GLOBAL"
    rep_param = None

    if not is_global:
        rep_clean = reporter.strip()
        c_obj = (
            db.query(Country)
            .filter(or_(Country.iso_code == rep_clean, Country.country_name == rep_clean))
            .first()
        )
        if not c_obj:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid or unknown reporter country: '{reporter}'",
            )
        resolved_reporter = c_obj.iso_code
        rep_param = rep_clean

    base_query = get_trade_v2_base_query(
        db,
        reporter=rep_param,
        start_year=start_year,
        end_year=end_year,
        partner=partner,
        product=product,
    )

    num_records = base_query.count()
    if num_records == 0:
        return TradeBalanceSummaryResponse(
            reporter=resolved_reporter,
            total_export=0.0,
            total_import=0.0,
            total_trade_value=0.0,
            trade_balance=0.0,
            trade_balance_status="Balanced Trade",
            start_year=resolved_start_year,
            end_year=resolved_end_year,
            no_data=True,
        )

    export_val_expr = func.coalesce(
        func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)),
        0.0,
    )
    import_val_expr = func.coalesce(
        func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)),
        0.0,
    )
    total_val_expr = func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0)

    agg = base_query.with_entities(export_val_expr, import_val_expr, total_val_expr).first()
    total_export = float(agg[0] or 0.0)
    total_import = float(agg[1] or 0.0)
    total_trade = float(agg[2] or 0.0)
    trade_balance = total_export - total_import

    if trade_balance > 0:
        status_label = "Trade Surplus"
    elif trade_balance < 0:
        status_label = "Trade Deficit"
    else:
        status_label = "Balanced Trade"

    return TradeBalanceSummaryResponse(
        reporter=resolved_reporter,
        total_export=total_export,
        total_import=total_import,
        total_trade_value=total_trade,
        trade_balance=trade_balance,
        trade_balance_status=status_label,
        start_year=resolved_start_year,
        end_year=resolved_end_year,
        no_data=False,
    )


@router.get("/by-year", response_model=List[TradeBalanceYearlyItem])
def get_trade_balance_by_year(
    reporter: Optional[str] = Query(None, description="Optional reporter filter (or 'GLOBAL')"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    partner: Optional[str] = Query(None),
    product: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns annual historical export, import, and net trade balance series.
    """
    is_global = not reporter or not reporter.strip() or reporter.strip().upper() == "GLOBAL" or reporter.strip() == "ALL"
    rep_param = None

    if not is_global:
        rep_clean = reporter.strip()
        c_obj = (
            db.query(Country)
            .filter(or_(Country.iso_code == rep_clean, Country.country_name == rep_clean))
            .first()
        )
        if not c_obj:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid or unknown reporter country: '{reporter}'",
            )
        rep_param = rep_clean

    base_query = get_trade_v2_base_query(
        db,
        reporter=rep_param,
        start_year=start_year,
        end_year=end_year,
        partner=partner,
        product=product,
    )

    rows = (
        base_query.with_entities(
            TradeRecordV2.year.label("year"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("export_val"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("import_val"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("total_val"),
        )
        .group_by(TradeRecordV2.year)
        .order_by(TradeRecordV2.year.asc())
        .all()
    )

    results = []
    for r in rows:
        exp = float(r.export_val or 0.0)
        imp = float(r.import_val or 0.0)
        tot = float(r.total_val or 0.0)
        bal = exp - imp
        stat = "Trade Surplus" if bal > 0 else "Trade Deficit" if bal < 0 else "Balanced Trade"
        results.append(
            TradeBalanceYearlyItem(
                year=r.year,
                export_value=exp,
                import_value=imp,
                total_value=tot,
                trade_balance=bal,
                status=stat,
            )
        )
    return results


@router.get("/compare-countries", response_model=List[CountryBalanceCompareItem])
def compare_countries_trade_balance(
    reporters: str = Query(..., description="Comma-separated reporter ISO codes (2 to 5 countries)"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    partner: Optional[str] = Query(None),
    product: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accepts 2 to 5 country codes and returns comparative trade balance statistics.
    """
    if not reporters or not reporters.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least 2 countries to compare.",
        )

    raw_list = [r.strip().upper() for r in reporters.split(",") if r.strip()]
    unique_reporters = list(dict.fromkeys(raw_list))

    if len(unique_reporters) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least 2 countries to compare.",
        )

    if len(unique_reporters) > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 5 countries for comparison.",
        )

    results = []
    for rep in unique_reporters:
        base_query = get_trade_v2_base_query(
            db,
            reporter=rep,
            start_year=start_year,
            end_year=end_year,
            partner=partner,
            product=product,
        )

        record_count = base_query.count()

        if record_count == 0:
            c_obj = (
                db.query(Country)
                .filter(or_(Country.iso_code == rep, Country.country_name == rep))
                .first()
            )
            iso = c_obj.iso_code if c_obj else rep
            desc = c_obj.country_name if c_obj else rep
            results.append(
                CountryBalanceCompareItem(
                    reporter_iso=iso,
                    reporter_desc=desc,
                    total_export=0.0,
                    total_import=0.0,
                    total_trade=0.0,
                    trade_balance=0.0,
                    status="Balanced Trade",
                )
            )
            continue

        first_rec = (
            base_query.with_entities(ReporterCountry.iso_code, ReporterCountry.country_name).first()
        )
        iso = first_rec[0]
        desc = first_rec[1]

        export_val_expr = func.coalesce(
            func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)),
            0.0,
        )
        import_val_expr = func.coalesce(
            func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)),
            0.0,
        )
        total_val_expr = func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0)

        agg = base_query.with_entities(export_val_expr, import_val_expr, total_val_expr).first()
        exp = float(agg[0] or 0.0)
        imp = float(agg[1] or 0.0)
        tot = float(agg[2] or 0.0)
        bal = exp - imp
        stat = "Trade Surplus" if bal > 0 else "Trade Deficit" if bal < 0 else "Balanced Trade"

        results.append(
            CountryBalanceCompareItem(
                reporter_iso=iso,
                reporter_desc=desc,
                total_export=exp,
                total_import=imp,
                total_trade=tot,
                trade_balance=bal,
                status=stat,
            )
        )

    return results
