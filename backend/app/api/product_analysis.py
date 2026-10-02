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
    ProductListItem,
    ProductProfileResponse,
    ProductYearlyTrend,
    ProductTopCountryItem,
)

router = APIRouter(prefix="/product-analysis", tags=["Product Analysis"])


@router.get("/list", response_model=List[ProductListItem])
def get_products_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns actual distinct commodities present in the database.
    """
    rows = (
        db.query(
            Product.product_code.label("cmd_code"),
            Product.product_name.label("cmd_desc"),
            func.count(TradeRecordV2.id).label("total_records"),
        )
        .join(TradeRecordV2, TradeRecordV2.product_id == Product.product_id)
        .group_by(Product.product_code, Product.product_name)
        .order_by(func.count(TradeRecordV2.id).desc())
        .all()
    )

    return [
        ProductListItem(
            cmd_code=r.cmd_code,
            cmd_desc=r.cmd_desc,
            total_records=r.total_records,
        )
        for r in rows
    ]


@router.get("/profile", response_model=ProductProfileResponse)
def get_product_profile(
    product: Optional[str] = Query(None, description="Commodity code (e.g. 'TOTAL' or '30')"),
    start_year: Optional[int] = Query(None, description="Start year filter"),
    end_year: Optional[int] = Query(None, description="End year filter"),
    partner: Optional[str] = Query(None, description="Partner ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Computes global trade profile, export/import totals, and growth rates for a commodity.
    """
    if not product or not product.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'product' is required and cannot be empty.",
        )

    prod_clean = product.strip()
    base_query = get_trade_v2_base_query(
        db,
        product=prod_clean,
        partner=partner,
        start_year=start_year,
        end_year=end_year,
    )

    record_count = base_query.count()

    if record_count == 0:
        p_obj = (
            db.query(Product)
            .filter(or_(Product.product_code == prod_clean, Product.product_name == prod_clean))
            .first()
        )
        code = p_obj.product_code if p_obj else prod_clean
        desc = p_obj.product_name if p_obj else prod_clean
        return ProductProfileResponse(
            cmd_code=code,
            cmd_desc=desc,
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

    first_record = (
        base_query.with_entities(ProductEntity.product_code, ProductEntity.product_name).first()
    )
    cmd_code = first_record[0]
    cmd_desc = first_record[1]

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
        first_year = first_yr_data[0]
        last_year = last_yr_data[0]
        first_exp = float(first_yr_data[1] or 0.0)
        last_exp = float(last_yr_data[1] or 0.0)
        first_imp = float(first_yr_data[2] or 0.0)
        last_imp = float(last_yr_data[2] or 0.0)

        if first_exp > 0:
            export_growth = round(((last_exp - first_exp) / first_exp) * 100.0, 2)
        if first_imp > 0:
            import_growth = round(((last_imp - first_imp) / first_imp) * 100.0, 2)

        notes = []
        if export_growth is not None or import_growth is not None:
            notes.append(f"Growth calculated from {first_year} to {last_year}.")
        if first_exp == 0:
            notes.append(f"Export base year ({first_year}) value is $0 (N/A).")
        if first_imp == 0:
            notes.append(f"Import base year ({first_year}) value is $0 (N/A).")
        growth_note = " ".join(notes)

    return ProductProfileResponse(
        cmd_code=cmd_code,
        cmd_desc=cmd_desc,
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


@router.get("/trend", response_model=List[ProductYearlyTrend])
def get_product_trend(
    product: Optional[str] = Query(None, description="Commodity code"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    partner: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns year-wise export and import volume trend for the selected commodity.
    """
    if not product or not product.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'product' is required.",
        )

    base_query = get_trade_v2_base_query(
        db,
        product=product.strip(),
        partner=partner,
        start_year=start_year,
        end_year=end_year,
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
            ProductYearlyTrend(
                year=r.year,
                export_value=exp,
                import_value=imp,
                total_value=tot,
                trade_balance=bal,
            )
        )
    return results


@router.get("/top-exporters", response_model=List[ProductTopCountryItem])
def get_product_top_exporters(
    product: Optional[str] = Query(None, description="Commodity code"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    partner: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns top exporting nations for this commodity.
    """
    if not product or not product.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'product' is required.",
        )

    base_query = get_trade_v2_base_query(
        db,
        product=product.strip(),
        partner=partner,
        flow="X",
        start_year=start_year,
        end_year=end_year,
    )

    total_export_sum = base_query.with_entities(func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0)).scalar() or 0.0

    rows = (
        base_query.with_entities(
            ReporterCountry.iso_code.label("reporter_iso"),
            ReporterCountry.country_name.label("reporter_desc"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("trade_value"),
        )
        .group_by(ReporterCountry.iso_code, ReporterCountry.country_name)
        .order_by(func.sum(TradeRecordV2.primary_value).desc())
        .limit(limit)
        .all()
    )

    results = []
    for r in rows:
        val = float(r.trade_value or 0.0)
        pct = (val / total_export_sum * 100.0) if total_export_sum > 0 else 0.0
        results.append(
            ProductTopCountryItem(
                reporter_iso=r.reporter_iso,
                reporter_desc=r.reporter_desc,
                trade_value=val,
                share_percentage=round(pct, 2),
            )
        )
    return results


@router.get("/top-importers", response_model=List[ProductTopCountryItem])
def get_product_top_importers(
    product: Optional[str] = Query(None, description="Commodity code"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    partner: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns top importing nations for this commodity.
    """
    if not product or not product.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'product' is required.",
        )

    base_query = get_trade_v2_base_query(
        db,
        product=product.strip(),
        partner=partner,
        flow="M",
        start_year=start_year,
        end_year=end_year,
    )

    total_import_sum = base_query.with_entities(func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0)).scalar() or 0.0

    rows = (
        base_query.with_entities(
            ReporterCountry.iso_code.label("reporter_iso"),
            ReporterCountry.country_name.label("reporter_desc"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("trade_value"),
        )
        .group_by(ReporterCountry.iso_code, ReporterCountry.country_name)
        .order_by(func.sum(TradeRecordV2.primary_value).desc())
        .limit(limit)
        .all()
    )

    results = []
    for r in rows:
        val = float(r.trade_value or 0.0)
        pct = (val / total_import_sum * 100.0) if total_import_sum > 0 else 0.0
        results.append(
            ProductTopCountryItem(
                reporter_iso=r.reporter_iso,
                reporter_desc=r.reporter_desc,
                trade_value=val,
                share_percentage=round(pct, 2),
            )
        )
    return results
