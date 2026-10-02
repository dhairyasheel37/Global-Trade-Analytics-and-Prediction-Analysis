from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case, distinct, and_, or_

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
    CountryProfileResponse,
    CountryYearlyTrend,
    TopPartnerItem,
    TopProductItem,
    CountryPartnersResponse,
    CountryProductsResponse,
)

router = APIRouter(prefix="/country-analysis", tags=["Country Analysis"])


@router.get("/profile", response_model=CountryProfileResponse)
def get_country_profile(
    reporter: Optional[str] = Query(None, description="Reporter ISO (e.g. 'USA') or country name"),
    start_year: Optional[int] = Query(None, description="Start year filter"),
    end_year: Optional[int] = Query(None, description="End year filter"),
    partner: Optional[str] = Query(None, description="Partner ISO"),
    product: Optional[str] = Query(None, description="Product code"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Computes a country's trade profile, trade balance, and export/import growth rates.
    Defaults to World aggregate and TOTAL commodity unless granular filters are specified.
    """
    if not reporter or not reporter.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'reporter' is required and cannot be empty.",
        )

    base_query = get_trade_v2_base_query(
        db,
        reporter=reporter,
        start_year=start_year,
        end_year=end_year,
        partner=partner,
        product=product,
    )

    record_count = base_query.count()

    # If no records exist in the filtered range
    if record_count == 0:
        rep_clean = reporter.strip()
        country_record = (
            db.query(Country)
            .filter(or_(Country.iso_code == rep_clean, Country.country_name == rep_clean))
            .first()
        )
        iso = country_record.iso_code if country_record else rep_clean
        name = country_record.country_name if country_record else rep_clean
        return CountryProfileResponse(
            reporter_iso=iso,
            reporter_name=name,
            total_exports=0.0,
            total_imports=0.0,
            total_trade_value=0.0,
            trade_balance=0.0,
            trade_balance_status="Balanced Trade",
            export_growth=None,
            import_growth=None,
            growth_note="No records found for the selected year range.",
            start_year=start_year,
            end_year=end_year,
            no_data=True,
        )

    # Resolve ISO and Name
    first_record = (
        base_query.with_entities(ReporterCountry.iso_code, ReporterCountry.country_name).first()
    )
    reporter_iso = first_record[0]
    reporter_name = first_record[1]

    # Aggregations for total exports and total imports
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
    total_exports = float(agg[0] or 0.0)
    total_imports = float(agg[1] or 0.0)
    total_trade = float(agg[2] or 0.0)
    trade_balance = total_exports - total_imports

    if trade_balance > 0:
        balance_status = "Trade Surplus"
    elif trade_balance < 0:
        balance_status = "Trade Deficit"
    else:
        balance_status = "Balanced Trade"

    # Year-wise totals for growth calculation
    yearly_rows = (
        base_query.with_entities(
            TradeRecordV2.year,
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("exp"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("imp"),
        )
        .group_by(TradeRecordV2.year)
        .order_by(TradeRecordV2.year.asc())
        .all()
    )

    export_growth: Optional[float] = None
    import_growth: Optional[float] = None
    growth_note: Optional[str] = None

    if len(yearly_rows) < 2:
        growth_note = "Growth rate requires at least 2 distinct years of data."
    else:
        first_yr_data = yearly_rows[0]
        last_yr_data = yearly_rows[-1]

        f_exp = float(first_yr_data.exp or 0.0)
        l_exp = float(last_yr_data.exp or 0.0)
        f_imp = float(first_yr_data.imp or 0.0)
        l_imp = float(last_yr_data.imp or 0.0)

        growth_note = f"Growth calculated from {first_yr_data.year} to {last_yr_data.year}."

        if f_exp > 0:
            export_growth = round(((l_exp - f_exp) / f_exp) * 100.0, 2)
        else:
            growth_note = "Initial export value was zero; percentage growth not defined."

        if f_imp > 0:
            import_growth = round(((l_imp - f_imp) / f_imp) * 100.0, 2)
        else:
            growth_note += " Initial import value was zero."

    return CountryProfileResponse(
        reporter_iso=reporter_iso,
        reporter_name=reporter_name,
        total_exports=total_exports,
        total_imports=total_imports,
        total_trade_value=total_trade,
        trade_balance=trade_balance,
        trade_balance_status=balance_status,
        export_growth=export_growth,
        import_growth=import_growth,
        growth_note=growth_note,
        start_year=start_year,
        end_year=end_year,
        no_data=False,
    )


@router.get("/trend", response_model=List[CountryYearlyTrend])
def get_country_trend(
    reporter: Optional[str] = Query(None, description="Reporter ISO or country name"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    partner: Optional[str] = Query(None),
    product: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns year-wise export, import, total trade, and balance for the country.
    """
    if not reporter or not reporter.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'reporter' is required.",
        )

    base_query = get_trade_v2_base_query(
        db,
        reporter=reporter,
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
        results.append(
            CountryYearlyTrend(
                year=r.year,
                export_value=exp,
                import_value=imp,
                total_value=tot,
                trade_balance=bal,
            )
        )
    return results


@router.get("/partners", response_model=CountryPartnersResponse)
def get_country_partners(
    reporter: Optional[str] = Query(None, description="Reporter ISO or country name"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns real top partner countries for a reporter.
    For reporters with granular data (IND, USA, CHN, DEU), returns actual bilateral partners.
    For other reporters (186 countries), clearly reports granular data not uploaded.
    """
    if not reporter or not reporter.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'reporter' is required.",
        )

    rep_clean = reporter.strip()
    c_obj = (
        db.query(Country)
        .filter(or_(Country.iso_code == rep_clean, Country.country_name == rep_clean))
        .first()
    )
    rep_iso = c_obj.iso_code if c_obj else rep_clean
    rep_name = c_obj.country_name if c_obj else rep_clean

    # Check if granular non-World data exists for this reporter
    world_c = db.query(Country).filter(Country.iso_code == "W00").first()
    world_id = world_c.country_id if world_c else -1

    granular_query = (
        db.query(TradeRecordV2)
        .join(ReporterCountry, TradeRecordV2.reporter_id == ReporterCountry.country_id)
        .join(PartnerCountry, TradeRecordV2.partner_id == PartnerCountry.country_id)
        .join(ProductEntity, TradeRecordV2.product_id == ProductEntity.product_id)
        .filter(
            or_(ReporterCountry.iso_code == rep_clean, ReporterCountry.country_name == rep_clean),
            PartnerCountry.iso_code != "W00",
            ProductEntity.product_code != "TOTAL",
        )
    )
    if start_year is not None:
        granular_query = granular_query.filter(TradeRecordV2.year >= start_year)
    if end_year is not None:
        granular_query = granular_query.filter(TradeRecordV2.year <= end_year)

    granular_count = granular_query.count()

    if granular_count == 0:
        return CountryPartnersResponse(
            reporter_iso=rep_iso,
            reporter_name=rep_name,
            has_granular_data=False,
            message="Granular partner/product data has not been uploaded for this reporter.",
            partners=[],
        )

    # Aggregate by partner
    rows = (
        granular_query.with_entities(
            PartnerCountry.iso_code.label("partner_iso"),
            PartnerCountry.country_name.label("partner_desc"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("trade_value"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("export_val"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("import_val"),
        )
        .group_by(PartnerCountry.iso_code, PartnerCountry.country_name)
        .order_by(func.sum(TradeRecordV2.primary_value).desc())
        .all()
    )

    total_trade = sum(float(r.trade_value or 0.0) for r in rows)
    partners = []
    for r in rows:
        val = float(r.trade_value or 0.0)
        pct = (val / total_trade * 100.0) if total_trade > 0 else 0.0
        partners.append(
            TopPartnerItem(
                partner_iso=r.partner_iso,
                partner_desc=r.partner_desc,
                trade_value=val,
                export_value=float(r.export_val or 0.0),
                import_value=float(r.import_val or 0.0),
                share_percentage=round(pct, 2),
            )
        )

    return CountryPartnersResponse(
        reporter_iso=rep_iso,
        reporter_name=rep_name,
        has_granular_data=True,
        message=None,
        partners=partners,
    )


@router.get("/top-partners", response_model=List[TopPartnerItem])
def get_country_top_partners(
    reporter: Optional[str] = Query(None, description="Reporter ISO or country name"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Maintained for full Phase 5 backward compatibility.
    Queries default baseline (World aggregate) series.
    """
    if not reporter or not reporter.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'reporter' is required.",
        )

    base_query = get_trade_v2_base_query(
        db,
        reporter=reporter,
        start_year=start_year,
        end_year=end_year,
    )

    rows = (
        base_query.with_entities(
            PartnerCountry.iso_code.label("partner_iso"),
            PartnerCountry.country_name.label("partner_desc"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("trade_value"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("export_val"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("import_val"),
        )
        .group_by(PartnerCountry.iso_code, PartnerCountry.country_name)
        .order_by(func.sum(TradeRecordV2.primary_value).desc())
        .all()
    )

    total_trade = sum(float(r.trade_value or 0.0) for r in rows)
    results = []
    for r in rows:
        val = float(r.trade_value or 0.0)
        exp = float(r.export_val or 0.0)
        imp = float(r.import_val or 0.0)
        pct = (val / total_trade * 100.0) if total_trade > 0 else 0.0
        results.append(
            TopPartnerItem(
                partner_iso=r.partner_iso,
                partner_desc=r.partner_desc,
                trade_value=val,
                export_value=exp,
                import_value=imp,
                share_percentage=round(pct, 2),
            )
        )
    return results


@router.get("/products", response_model=CountryProductsResponse)
def get_country_products(
    reporter: Optional[str] = Query(None, description="Reporter ISO or country name"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns real commodities/products for a reporter.
    For reporters with granular data, returns actual HS2 commodities.
    For other reporters, clearly reports granular data not uploaded.
    """
    if not reporter or not reporter.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'reporter' is required.",
        )

    rep_clean = reporter.strip()
    c_obj = (
        db.query(Country)
        .filter(or_(Country.iso_code == rep_clean, Country.country_name == rep_clean))
        .first()
    )
    rep_iso = c_obj.iso_code if c_obj else rep_clean
    rep_name = c_obj.country_name if c_obj else rep_clean

    granular_query = (
        db.query(TradeRecordV2)
        .join(ReporterCountry, TradeRecordV2.reporter_id == ReporterCountry.country_id)
        .join(PartnerCountry, TradeRecordV2.partner_id == PartnerCountry.country_id)
        .join(ProductEntity, TradeRecordV2.product_id == ProductEntity.product_id)
        .filter(
            or_(ReporterCountry.iso_code == rep_clean, ReporterCountry.country_name == rep_clean),
            PartnerCountry.iso_code != "W00",
            ProductEntity.product_code != "TOTAL",
        )
    )
    if start_year is not None:
        granular_query = granular_query.filter(TradeRecordV2.year >= start_year)
    if end_year is not None:
        granular_query = granular_query.filter(TradeRecordV2.year <= end_year)

    granular_count = granular_query.count()

    if granular_count == 0:
        return CountryProductsResponse(
            reporter_iso=rep_iso,
            reporter_name=rep_name,
            has_granular_data=False,
            message="Granular partner/product data has not been uploaded for this reporter.",
            products=[],
        )

    rows = (
        granular_query.with_entities(
            ProductEntity.product_code.label("cmd_code"),
            ProductEntity.product_name.label("cmd_desc"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("trade_value"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("export_val"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("import_val"),
        )
        .group_by(ProductEntity.product_code, ProductEntity.product_name)
        .order_by(func.sum(TradeRecordV2.primary_value).desc())
        .all()
    )

    total_trade = sum(float(r.trade_value or 0.0) for r in rows)
    products = []
    for r in rows:
        val = float(r.trade_value or 0.0)
        pct = (val / total_trade * 100.0) if total_trade > 0 else 0.0
        products.append(
            TopProductItem(
                cmd_code=r.cmd_code,
                cmd_desc=r.cmd_desc,
                trade_value=val,
                export_value=float(r.export_val or 0.0),
                import_value=float(r.import_val or 0.0),
                share_percentage=round(pct, 2),
            )
        )

    return CountryProductsResponse(
        reporter_iso=rep_iso,
        reporter_name=rep_name,
        has_granular_data=True,
        message=None,
        products=products,
    )


@router.get("/top-products", response_model=List[TopProductItem])
def get_country_top_products(
    reporter: Optional[str] = Query(None, description="Reporter ISO or country name"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Maintained for full Phase 5 backward compatibility.
    Queries default baseline (TOTAL commodity) series.
    """
    if not reporter or not reporter.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'reporter' is required.",
        )

    base_query = get_trade_v2_base_query(
        db,
        reporter=reporter,
        start_year=start_year,
        end_year=end_year,
    )

    rows = (
        base_query.with_entities(
            ProductEntity.product_code.label("cmd_code"),
            ProductEntity.product_name.label("cmd_desc"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("trade_value"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("export_val"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("import_val"),
        )
        .group_by(ProductEntity.product_code, ProductEntity.product_name)
        .order_by(func.sum(TradeRecordV2.primary_value).desc())
        .all()
    )

    total_trade = sum(float(r.trade_value or 0.0) for r in rows)
    results = []
    for r in rows:
        val = float(r.trade_value or 0.0)
        exp = float(r.export_val or 0.0)
        imp = float(r.import_val or 0.0)
        pct = (val / total_trade * 100.0) if total_trade > 0 else 0.0
        results.append(
            TopProductItem(
                cmd_code=r.cmd_code,
                cmd_desc=r.cmd_desc,
                trade_value=val,
                export_value=exp,
                import_value=imp,
                share_percentage=round(pct, 2),
            )
        )
    return results
