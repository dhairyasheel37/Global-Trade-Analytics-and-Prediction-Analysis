"""
Geospatial Map API:
Provides aggregated trade flows, trade balance, and data tier classification
across all 190+ sovereign countries for interactive world choropleth mapping.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, distinct, and_

from app.database import get_db
from app.models import TradeRecordV2, Country, Product, User
from app.dependencies import get_current_user
from app.schemas import (
    MapCountryItem,
    MapSummaryMetrics,
    MapDataResponse,
)

router = APIRouter(prefix="/map", tags=["Geospatial Map"])


@router.get("/countries", response_model=MapDataResponse)
def get_map_countries_data(
    year: Optional[int] = Query(None, description="Specific reference year (2014-2025)"),
    start_year: Optional[int] = Query(None, description="Start year filter"),
    end_year: Optional[int] = Query(None, description="End year filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MapDataResponse:
    """
    Returns aggregated export, import, total trade, and trade balance metrics
    for all 190 sovereign countries in the dataset, along with global totals
    and granular tier classification.
    
    Guarantees:
    - 0 double counting (strictly filters partner = World and product = TOTAL for macro values).
    - Always returns all 190 sovereign countries (LEFT JOIN pattern).
    - Accurately flags the 4 granular economies (IND, USA, CHN, DEU).
    """
    # 1. World & TOTAL IDs for aggregate filtering
    world_c = db.query(Country).filter(Country.iso_code == "W00").first()
    world_id = world_c.country_id if world_c else -1

    total_p = db.query(Product).filter(Product.product_code == "TOTAL").first()
    total_id = total_p.product_id if total_p else -1

    # 2. Granular reporter IDs (IND, USA, CHN, DEU)
    granular_rep_ids = set(
        r[0]
        for r in db.query(distinct(TradeRecordV2.reporter_id))
        .filter(TradeRecordV2.partner_id != world_id, TradeRecordV2.product_id != total_id)
        .all()
    )

    # 3. Available years for timeline controls
    year_rows = (
        db.query(distinct(TradeRecordV2.year))
        .filter(TradeRecordV2.partner_id == world_id, TradeRecordV2.product_id == total_id)
        .order_by(TradeRecordV2.year.asc())
        .all()
    )
    available_years = [r[0] for r in year_rows if r[0] is not None]

    # Resolve active time filters
    sy = year if year is not None else start_year
    ey = year if year is not None else end_year

    # 4. Join conditions for trade_records_v2
    join_conditions = [
        TradeRecordV2.reporter_id == Country.country_id,
        TradeRecordV2.partner_id == world_id,
        TradeRecordV2.product_id == total_id,
    ]
    if sy is not None:
        join_conditions.append(TradeRecordV2.year >= sy)
    if ey is not None:
        join_conditions.append(TradeRecordV2.year <= ey)

    # 5. Query all 190 sovereign countries via outerjoin
    rows = (
        db.query(
            Country.country_id.label("country_id"),
            Country.iso_code.label("iso_code"),
            Country.country_name.label("country_name"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("exports"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("imports"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("total_trade"),
        )
        .outerjoin(TradeRecordV2, and_(*join_conditions))
        .filter(Country.iso_code != "W00")
        .group_by(Country.country_id, Country.iso_code, Country.country_name)
        .order_by(func.sum(TradeRecordV2.primary_value).desc())
        .all()
    )

    # 6. Transform rows into response models and accumulate global totals
    countries_list: List[MapCountryItem] = []
    global_exports = 0.0
    global_imports = 0.0
    global_total = 0.0
    granular_count = 0
    countries_with_trade = 0

    for r in rows:
        exp = float(r.exports or 0.0)
        imp = float(r.imports or 0.0)
        tot = float(r.total_trade or 0.0)
        bal = exp - imp

        if tot == 0.0:
            status = "No Data"
        elif abs(bal) < 1e-4:
            status = "Balanced Trade"
        elif bal > 0:
            status = "Trade Surplus"
        else:
            status = "Trade Deficit"

        if tot > 0:
            countries_with_trade += 1

        is_granular = r.country_id in granular_rep_ids
        if is_granular:
            granular_count += 1

        countries_list.append(
            MapCountryItem(
                iso_code=r.iso_code,
                country_name=r.country_name,
                exports=exp,
                imports=imp,
                total_trade=tot,
                trade_balance=bal,
                trade_balance_status=status,
                has_granular_data=is_granular,
            )
        )

        global_exports += exp
        global_imports += imp
        global_total += tot

    global_balance = global_exports - global_imports

    summary = MapSummaryMetrics(
        total_global_trade=global_total,
        total_global_exports=global_exports,
        total_global_imports=global_imports,
        global_trade_balance=global_balance,
        countries_with_data=countries_with_trade,
        granular_countries_count=granular_count,
    )

    return MapDataResponse(
        year=year,
        start_year=sy if year is None else None,
        end_year=ey if year is None else None,
        available_years=available_years,
        summary=summary,
        countries=countries_list,
    )
