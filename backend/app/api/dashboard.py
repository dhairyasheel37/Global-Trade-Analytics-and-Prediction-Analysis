from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, case

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
    DashboardKPIsResponse,
    YearlyTradeData,
    YearlyImportExportData,
    TopReporterData,
    FlowDistributionData,
    YearlyTradeBalanceData,
    FilterOptionsResponse,
    ReporterOption,
    FlowOption,
    PartnerOption,
    ProductOption,
    ScopeNoticeResponse,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/scope", response_model=ScopeNoticeResponse)
def get_dashboard_scope(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the dynamic scope of the dataset:
    - Counts of reporters with granular data vs World/TOTAL only
    - Names of granular reporters, distinct partners, and distinct products
    - Dynamically compiled human-readable notice message
    """
    world_c = db.query(Country).filter(Country.iso_code == "W00").first()
    world_id = world_c.country_id if world_c else -1

    total_p = db.query(Product).filter(Product.product_code == "TOTAL").first()
    total_id = total_p.product_id if total_p else -1

    granular_rep_ids = [
        r[0]
        for r in db.query(distinct(TradeRecordV2.reporter_id))
        .filter(TradeRecordV2.partner_id != world_id, TradeRecordV2.product_id != total_id)
        .all()
    ]

    granular_reporters_rows = (
        db.query(Country.country_name)
        .filter(Country.country_id.in_(granular_rep_ids))
        .order_by(Country.country_name.asc())
        .all()
    )
    granular_reporters = [r[0] for r in granular_reporters_rows]

    total_reporters_count = (
        db.query(func.count(distinct(TradeRecordV2.reporter_id))).scalar() or 0
    )
    granular_reporters_count = len(granular_reporters)
    aggregate_only_count = total_reporters_count - granular_reporters_count

    # Distinct non-World partners in granular bilateral records
    partner_rows = (
        db.query(Country.country_name)
        .join(TradeRecordV2, TradeRecordV2.partner_id == Country.country_id)
        .filter(Country.iso_code != "W00", TradeRecordV2.product_id != total_id)
        .distinct()
        .order_by(Country.country_name.asc())
        .all()
    )
    distinct_partners = [r[0] for r in partner_rows]

    # Distinct non-TOTAL products in granular bilateral records
    product_rows = (
        db.query(Product.product_name)
        .join(TradeRecordV2, TradeRecordV2.product_id == Product.product_id)
        .filter(Product.product_code != "TOTAL", TradeRecordV2.partner_id != world_id)
        .distinct()
        .order_by(Product.product_name.asc())
        .all()
    )
    distinct_products = [r[0] for r in product_rows]

    if granular_reporters_count > 0:
        rep_names_str = ", ".join(granular_reporters)
        notice = (
            f"Granular partner- and product-level data is available for {granular_reporters_count} "
            f"of {total_reporters_count} reporters ({rep_names_str}), covering "
            f"{len(distinct_partners)} partner countries and {len(distinct_products)} product categories. "
            f"The remaining {aggregate_only_count} reporters have only aggregate World/TOTAL data."
        )
    else:
        notice = (
            f"Unified macroeconomic trade dataset covering all {total_reporters_count} global economies. "
            f"All records represent authoritative total merchandise trade flows (2014–2025)."
        )

    return ScopeNoticeResponse(
        granular_reporters_count=granular_reporters_count,
        granular_reporters=granular_reporters,
        aggregate_only_reporters_count=aggregate_only_count,
        total_reporters_count=total_reporters_count,
        distinct_partners_count=len(distinct_partners),
        distinct_partners=distinct_partners,
        distinct_products_count=len(distinct_products),
        distinct_products=distinct_products,
        notice=notice,
    )


@router.get("/kpis", response_model=DashboardKPIsResponse)
def get_dashboard_kpis(
    reporter: Optional[str] = Query(None, description="Reporter ISO or Country Name"),
    flow: Optional[str] = Query(None, description="Flow Code ('M' or 'X')"),
    start_year: Optional[int] = Query(None, description="Start year filter"),
    end_year: Optional[int] = Query(None, description="End year filter"),
    partner: Optional[str] = Query(None, description="Partner ISO"),
    product: Optional[str] = Query(None, description="Product code"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Computes key performance indicators (KPIs) dynamically for the filtered trade dataset.
    Returns no_data: true if no records match rather than failing.
    """
    base_query = get_trade_v2_base_query(
        db,
        reporter=reporter,
        flow=flow,
        start_year=start_year,
        end_year=end_year,
        partner=partner,
        product=product,
    )

    num_records = base_query.count()
    if num_records == 0:
        return DashboardKPIsResponse(
            total_trade_value=0.0,
            total_export=0.0,
            total_import=0.0,
            trade_balance=0.0,
            trade_balance_status="Balanced Trade",
            num_countries=0,
            num_records=0,
            no_data=True,
        )

    # Aggregations for export, import, total, distinct countries
    export_val_expr = func.coalesce(
        func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)),
        0.0,
    )
    import_val_expr = func.coalesce(
        func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)),
        0.0,
    )
    total_val_expr = func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0)
    country_count_expr = func.count(distinct(TradeRecordV2.reporter_id))

    agg_result = base_query.with_entities(
        export_val_expr,
        import_val_expr,
        total_val_expr,
        country_count_expr,
    ).first()

    total_export = float(agg_result[0] or 0.0)
    total_import = float(agg_result[1] or 0.0)
    total_trade = float(agg_result[2] or 0.0)
    num_countries = int(agg_result[3] or 0)

    trade_balance = total_export - total_import
    if trade_balance > 0:
        status_label = "Trade Surplus"
    elif trade_balance < 0:
        status_label = "Trade Deficit"
    else:
        status_label = "Balanced Trade"

    return DashboardKPIsResponse(
        total_trade_value=total_trade,
        total_export=total_export,
        total_import=total_import,
        trade_balance=trade_balance,
        trade_balance_status=status_label,
        num_countries=num_countries,
        num_records=num_records,
        no_data=False,
    )


@router.get("/trade-by-year", response_model=List[YearlyTradeData])
def get_trade_by_year(
    reporter: Optional[str] = Query(None),
    flow: Optional[str] = Query(None),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    partner: Optional[str] = Query(None),
    product: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns year-wise total trade value trend respecting filters.
    """
    base_query = get_trade_v2_base_query(
        db,
        reporter=reporter,
        flow=flow,
        start_year=start_year,
        end_year=end_year,
        partner=partner,
        product=product,
    )

    rows = (
        base_query.with_entities(
            TradeRecordV2.year.label("year"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("total_trade_value"),
        )
        .group_by(TradeRecordV2.year)
        .order_by(TradeRecordV2.year.asc())
        .all()
    )

    return [
        YearlyTradeData(year=r.year, total_trade_value=float(r.total_trade_value or 0.0))
        for r in rows
    ]


@router.get("/import-export-by-year", response_model=List[YearlyImportExportData])
def get_import_export_by_year(
    reporter: Optional[str] = Query(None),
    flow: Optional[str] = Query(None),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    partner: Optional[str] = Query(None),
    product: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns grouped yearly import vs export values respecting filters.
    """
    base_query = get_trade_v2_base_query(
        db,
        reporter=reporter,
        flow=flow,
        start_year=start_year,
        end_year=end_year,
        partner=partner,
        product=product,
    )

    rows = (
        base_query.with_entities(
            TradeRecordV2.year.label("year"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("import_value"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("export_value"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("total_value"),
        )
        .group_by(TradeRecordV2.year)
        .order_by(TradeRecordV2.year.asc())
        .all()
    )

    return [
        YearlyImportExportData(
            year=r.year,
            import_value=float(r.import_value or 0.0),
            export_value=float(r.export_value or 0.0),
            total_value=float(r.total_value or 0.0),
        )
        for r in rows
    ]


@router.get("/top-reporters", response_model=List[TopReporterData])
def get_top_reporters(
    limit: int = Query(10, ge=1, le=50, description="Top N reporters"),
    reporter: Optional[str] = Query(None),
    flow: Optional[str] = Query(None),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    partner: Optional[str] = Query(None),
    product: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns top reporter countries ranked by total trade volume.
    """
    base_query = get_trade_v2_base_query(
        db,
        reporter=reporter,
        flow=flow,
        start_year=start_year,
        end_year=end_year,
        partner=partner,
        product=product,
    )

    rows = (
        base_query.with_entities(
            ReporterCountry.iso_code.label("reporter_iso"),
            ReporterCountry.country_name.label("reporter_desc"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("total_value"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("export_value"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("import_value"),
        )
        .group_by(ReporterCountry.iso_code, ReporterCountry.country_name)
        .order_by(func.sum(TradeRecordV2.primary_value).desc())
        .limit(limit)
        .all()
    )

    return [
        TopReporterData(
            reporter_iso=r.reporter_iso,
            reporter_desc=r.reporter_desc,
            total_value=float(r.total_value or 0.0),
            export_value=float(r.export_value or 0.0),
            import_value=float(r.import_value or 0.0),
        )
        for r in rows
    ]


@router.get("/flow-distribution", response_model=List[FlowDistributionData])
def get_flow_distribution(
    reporter: Optional[str] = Query(None),
    flow: Optional[str] = Query(None),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    partner: Optional[str] = Query(None),
    product: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns flow distribution split between Imports and Exports.
    """
    base_query = get_trade_v2_base_query(
        db,
        reporter=reporter,
        flow=flow,
        start_year=start_year,
        end_year=end_year,
        partner=partner,
        product=product,
    )

    rows = (
        base_query.with_entities(
            TradeRecordV2.flow_code.label("flow_code"),
            TradeRecordV2.flow_name.label("flow_desc"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("value"),
        )
        .group_by(TradeRecordV2.flow_code, TradeRecordV2.flow_name)
        .all()
    )
    total_val = sum(float(r.value or 0.0) for r in rows)

    results = []
    for r in rows:
        val = float(r.value or 0.0)
        pct = (val / total_val * 100.0) if total_val > 0 else 0.0
        results.append(
            FlowDistributionData(
                flow=r.flow_desc or ("Import" if r.flow_code == "M" else "Export"),
                flow_code=r.flow_code,
                value=val,
                percentage=round(pct, 2),
            )
        )

    results.sort(key=lambda x: x.flow_code)
    return results


@router.get("/trade-balance-by-year", response_model=List[YearlyTradeBalanceData])
def get_trade_balance_by_year(
    reporter: Optional[str] = Query(None),
    flow: Optional[str] = Query(None),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    partner: Optional[str] = Query(None),
    product: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns year-wise net trade balance (Exports minus Imports).
    """
    base_query = get_trade_v2_base_query(
        db,
        reporter=reporter,
        flow=flow,
        start_year=start_year,
        end_year=end_year,
        partner=partner,
        product=product,
    )

    rows = (
        base_query.with_entities(
            TradeRecordV2.year.label("year"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("export_val"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("import_val"),
        )
        .group_by(TradeRecordV2.year)
        .order_by(TradeRecordV2.year.asc())
        .all()
    )

    results = []
    for r in rows:
        exp = float(r.export_val or 0.0)
        imp = float(r.import_val or 0.0)
        bal = exp - imp
        status_text = (
            "Trade Surplus" if bal > 0 else "Trade Deficit" if bal < 0 else "Balanced Trade"
        )
        results.append(
            YearlyTradeBalanceData(
                year=r.year,
                trade_balance=bal,
                export_value=exp,
                import_value=imp,
                status=status_text,
            )
        )
    return results


@router.get("/filter-options", response_model=FilterOptionsResponse)
def get_filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns dynamically populated filter options directly from the database records.
    Includes distinct partners and products from trade_records_v2.
    """
    # Reporters (190)
    reporter_rows = (
        db.query(Country.iso_code, Country.country_name)
        .join(TradeRecordV2, TradeRecordV2.reporter_id == Country.country_id)
        .distinct()
        .order_by(Country.country_name.asc())
        .all()
    )
    reporters = [ReporterOption(iso=r[0], desc=r[1]) for r in reporter_rows]

    # Years
    year_rows = (
        db.query(distinct(TradeRecordV2.year))
        .order_by(TradeRecordV2.year.asc())
        .all()
    )
    years = [int(r[0]) for r in year_rows]

    # Flows
    flow_rows = (
        db.query(TradeRecordV2.flow_code, TradeRecordV2.flow_name)
        .distinct()
        .order_by(TradeRecordV2.flow_code.asc())
        .all()
    )
    flows = [
        FlowOption(code=r[0], desc=r[1] or ("Import" if r[0] == "M" else "Export"))
        for r in flow_rows
    ]

    # Partners (distinct non-World partners from trade_records_v2)
    partner_rows = (
        db.query(Country.iso_code, Country.country_name)
        .join(TradeRecordV2, TradeRecordV2.partner_id == Country.country_id)
        .filter(Country.iso_code != "W00")
        .distinct()
        .order_by(Country.country_name.asc())
        .all()
    )
    partners = [PartnerOption(iso="ALL", desc="All Partners (World aggregate)")] + [
        PartnerOption(iso=r[0], desc=r[1]) for r in partner_rows
    ]

    # Products (distinct non-TOTAL products from trade_records_v2)
    product_rows = (
        db.query(Product.product_code, Product.product_name)
        .join(TradeRecordV2, TradeRecordV2.product_id == Product.product_id)
        .filter(Product.product_code != "TOTAL")
        .distinct()
        .order_by(Product.product_name.asc())
        .all()
    )
    products = [ProductOption(code="ALL", desc="All Commodities (TOTAL aggregate)")] + [
        ProductOption(code=r[0], desc=r[1]) for r in product_rows
    ]

    return FilterOptionsResponse(
        reporters=reporters,
        years=years,
        flows=flows,
        partners=partners,
        products=products,
    )
