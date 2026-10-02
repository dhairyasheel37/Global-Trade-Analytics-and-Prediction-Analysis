from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import Country, User
from app.dependencies import get_current_user
from app.api.country_analysis import (
    get_country_profile,
    get_country_partners,
    get_country_products,
    get_country_trend,
)
from app.schemas import (
    CountryComparisonResponse,
    CountrySideComparison,
    DifferenceMetrics,
    CommonCommodityItem,
    CommonCommoditiesComparison,
)

router = APIRouter(prefix="/country-comparison", tags=["Country Comparison"])


@router.get("", response_model=CountryComparisonResponse)
@router.get("/", response_model=CountryComparisonResponse, include_in_schema=False)
def compare_countries(
    countryA: str = Query(..., description="First reporter ISO code or country name"),
    countryB: str = Query(..., description="Second reporter ISO code or country name"),
    start_year: Optional[int] = Query(None, description="Start year filter"),
    end_year: Optional[int] = Query(None, description="End year filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compares two countries side-by-side by composing existing validated Country Analysis
    functions (get_country_profile, get_country_partners, get_country_products, get_country_trend).
    
    Adheres strictly to the dataset dual-tier architecture:
    - 4 granular reporters (IND, USA, CHN, DEU) have bilateral partners and HS2 commodities.
    - 186 reporters have baseline World/TOTAL aggregate data.
    - Never invents or estimates partner/commodity data for aggregate reporters.
    - Difference metrics strictly follow direction: Country A - Country B.
    """
    if not countryA or not countryA.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'countryA' is required and cannot be empty.",
        )
    if not countryB or not countryB.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'countryB' is required and cannot be empty.",
        )

    clean_a = countryA.strip()
    clean_b = countryB.strip()

    # Resolve Country A
    obj_a = (
        db.query(Country)
        .filter(
            or_(
                Country.iso_code == clean_a,
                Country.country_name == clean_a,
                Country.iso_code == clean_a.upper(),
            )
        )
        .first()
    )
    if not obj_a:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Country '{countryA}' not found in database.",
        )

    # Resolve Country B
    obj_b = (
        db.query(Country)
        .filter(
            or_(
                Country.iso_code == clean_b,
                Country.country_name == clean_b,
                Country.iso_code == clean_b.upper(),
            )
        )
        .first()
    )
    if not obj_b:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Country '{countryB}' not found in database.",
        )

    # Disallow identical countries
    if obj_a.iso_code == obj_b.iso_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Country A and Country B must be different countries.",
        )

    # Year clamping if both provided
    resolved_start_year = start_year
    resolved_end_year = end_year
    if start_year is not None and end_year is not None and start_year > end_year:
        resolved_start_year, resolved_end_year = end_year, start_year

    def fetch_side(reporter_iso: str):
        profile = get_country_profile(
            reporter=reporter_iso,
            start_year=resolved_start_year,
            end_year=resolved_end_year,
            partner=None,
            product=None,
            db=db,
            current_user=current_user,
        )
        partners_res = get_country_partners(
            reporter=reporter_iso,
            start_year=resolved_start_year,
            end_year=resolved_end_year,
            db=db,
            current_user=current_user,
        )
        products_res = get_country_products(
            reporter=reporter_iso,
            start_year=resolved_start_year,
            end_year=resolved_end_year,
            db=db,
            current_user=current_user,
        )
        yearly_trend = get_country_trend(
            reporter=reporter_iso,
            start_year=resolved_start_year,
            end_year=resolved_end_year,
            partner=None,
            product=None,
            db=db,
            current_user=current_user,
        )

        has_granular = bool(partners_res.has_granular_data)
        partner_cnt = len(partners_res.partners) if has_granular else None
        commodity_cnt = len(products_res.products) if has_granular else None
        partner_msg = None

        side_obj = CountrySideComparison(
            iso=profile.reporter_iso,
            name=profile.reporter_name,
            exports=profile.total_exports,
            imports=profile.total_imports,
            totalTrade=profile.total_trade_value,
            tradeBalance=profile.trade_balance,
            tradeBalanceStatus=profile.trade_balance_status,
            exportGrowth=profile.export_growth,
            importGrowth=profile.import_growth,
            partnerCount=partner_cnt,
            commodityCount=commodity_cnt,
            hasGranularData=has_granular,
            partnerDataMessage=partner_msg,
            partners=partners_res.partners,
            commodities=products_res.products,
            yearly=yearly_trend,
        )
        return side_obj, products_res

    side_a, prod_res_a = fetch_side(obj_a.iso_code)
    side_b, prod_res_b = fetch_side(obj_b.iso_code)

    # Difference metrics strictly (Country A - Country B)
    diff_metrics = DifferenceMetrics(
        direction="Country A - Country B",
        exportsDiff=round(side_a.exports - side_b.exports, 2),
        importsDiff=round(side_a.imports - side_b.imports, 2),
        totalTradeDiff=round(side_a.totalTrade - side_b.totalTrade, 2),
        tradeBalanceDiff=round(side_a.tradeBalance - side_b.tradeBalance, 2),
    )

    # Common commodities breakdown
    common_items: List[CommonCommodityItem] = []
    if side_a.hasGranularData and side_b.hasGranularData:
        b_map = {p.cmd_code: p for p in prod_res_b.products}
        for pa in prod_res_a.products:
            pb = b_map.get(pa.cmd_code)
            if pb:
                common_items.append(
                    CommonCommodityItem(
                        cmdCode=pa.cmd_code,
                        cmdDesc=pa.cmd_desc,
                        countryAValue=round(pa.trade_value, 2),
                        countryBValue=round(pb.trade_value, 2),
                        diffValue=round(pa.trade_value - pb.trade_value, 2),
                        countryAExport=round(pa.export_value, 2),
                        countryBExport=round(pb.export_value, 2),
                        countryAImport=round(pa.import_value, 2),
                        countryBImport=round(pb.import_value, 2),
                    )
                )
        common_items.sort(key=lambda x: (x.countryAValue + x.countryBValue), reverse=True)
        common_commodities = CommonCommoditiesComparison(
            isAvailable=True,
            message=None,
            items=common_items,
        )
    else:
        common_commodities = CommonCommoditiesComparison(
            isAvailable=False,
            message=(
                "Macroeconomic mode active across all 190 economies. Trade comparisons evaluate "
                "total merchandise export/import volumes, trade balances, and historical growth trajectories."
            ),
            items=[],
        )

    return CountryComparisonResponse(
        countryA=side_a,
        countryB=side_b,
        difference=diff_metrics,
        commonCommodities=common_commodities,
        start_year=resolved_start_year,
        end_year=resolved_end_year,
    )
