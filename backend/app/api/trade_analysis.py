import math
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_, or_, asc, desc

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
    TradeAnalysisStatsResponse,
    YearlyTradeData,
    YearlyImportExportData,
    PaginatedTradeRecordsResponse,
    TradeRecordSchema,
    TopPartnerItem,
    TopProductItem,
)

router = APIRouter(prefix="/trade-analysis", tags=["Trade Analysis"])


@router.get("/stats", response_model=TradeAnalysisStatsResponse)
def get_trade_analysis_stats(
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
    Computes detailed statistical breakdown for the filtered trade dataset:
    total, average, min, max, export, import, and trade balance.
    Defaults to World aggregate and TOTAL commodity unless granular filters are applied.
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

    record_count = base_query.count()
    if record_count == 0:
        return TradeAnalysisStatsResponse(
            total_trade_value=0.0,
            average_trade_value=0.0,
            min_trade_value=0.0,
            max_trade_value=0.0,
            record_count=0,
            export_value=0.0,
            import_value=0.0,
            trade_balance=0.0,
            no_data=True,
        )

    # Aggregations
    export_val_expr = func.coalesce(
        func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)),
        0.0,
    )
    import_val_expr = func.coalesce(
        func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)),
        0.0,
    )
    total_val_expr = func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0)
    avg_val_expr = func.coalesce(func.avg(TradeRecordV2.primary_value), 0.0)
    min_val_expr = func.coalesce(func.min(TradeRecordV2.primary_value), 0.0)
    max_val_expr = func.coalesce(func.max(TradeRecordV2.primary_value), 0.0)

    agg_result = base_query.with_entities(
        total_val_expr,
        avg_val_expr,
        min_val_expr,
        max_val_expr,
        export_val_expr,
        import_val_expr,
    ).first()

    total_trade_value = float(agg_result[0] or 0.0)
    average_trade_value = float(agg_result[1] or 0.0)
    min_trade_value = float(agg_result[2] or 0.0)
    max_trade_value = float(agg_result[3] or 0.0)
    export_value = float(agg_result[4] or 0.0)
    import_value = float(agg_result[5] or 0.0)
    trade_balance = export_value - import_value

    return TradeAnalysisStatsResponse(
        total_trade_value=total_trade_value,
        average_trade_value=average_trade_value,
        min_trade_value=min_trade_value,
        max_trade_value=max_trade_value,
        record_count=record_count,
        export_value=export_value,
        import_value=import_value,
        trade_balance=trade_balance,
        no_data=False,
    )


@router.get("/trend", response_model=List[YearlyTradeData])
def get_trade_analysis_trend(
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
    Returns year-wise historical trade trend for the filtered drill-down view.
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


@router.get("/import-export", response_model=List[YearlyImportExportData])
def get_trade_analysis_import_export(
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
    Returns year-wise import vs export breakdown for the filtered drill-down view.
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


@router.get("/records", response_model=PaginatedTradeRecordsResponse)
def get_trade_analysis_records(
    reporter: Optional[str] = Query(None),
    flow: Optional[str] = Query(None),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    partner: Optional[str] = Query(None),
    product: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search term for country name or ISO"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(25, ge=1, le=100, description="Records per page"),
    sort_by: str = Query("refYear", description="Column to sort by"),
    sort_order: str = Query("desc", description="Sort order: 'asc' or 'desc'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns server-side paginated, sorted, and searchable raw trade records.
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

    if search and search.strip():
        term = f"%{search.strip()}%"
        base_query = base_query.filter(
            or_(
                ReporterCountry.country_name.ilike(term),
                ReporterCountry.iso_code.ilike(term),
                PartnerCountry.country_name.ilike(term),
                PartnerCountry.iso_code.ilike(term),
                ProductEntity.product_name.ilike(term),
                ProductEntity.product_code.ilike(term),
            )
        )

    total_count = base_query.count()
    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1

    column_mapping = {
        "id": TradeRecordV2.id,
        "refYear": TradeRecordV2.year,
        "reporterISO": ReporterCountry.iso_code,
        "reporterDesc": ReporterCountry.country_name,
        "flowCode": TradeRecordV2.flow_code,
        "flowDesc": TradeRecordV2.flow_name,
        "partnerISO": PartnerCountry.iso_code,
        "partnerDesc": PartnerCountry.country_name,
        "cmdCode": ProductEntity.product_code,
        "cmdDesc": ProductEntity.product_name,
        "primaryValue": TradeRecordV2.primary_value,
        "cifvalue": TradeRecordV2.cif_value,
        "fobvalue": TradeRecordV2.fob_value,
        "qty": TradeRecordV2.quantity,
    }

    sort_col = column_mapping.get(sort_by, TradeRecordV2.year)
    order_func = desc if sort_order.lower() == "desc" else asc

    offset = (page - 1) * page_size
    records = (
        base_query.with_entities(
            TradeRecordV2.id,
            TradeRecordV2.year,
            ReporterCountry.iso_code.label("reporterISO"),
            ReporterCountry.country_name.label("reporterDesc"),
            TradeRecordV2.flow_code.label("flowCode"),
            TradeRecordV2.flow_name.label("flowDesc"),
            PartnerCountry.iso_code.label("partnerISO"),
            PartnerCountry.country_name.label("partnerDesc"),
            ProductEntity.product_code.label("cmdCode"),
            ProductEntity.product_name.label("cmdDesc"),
            TradeRecordV2.primary_value.label("primaryValue"),
            TradeRecordV2.cif_value.label("cifvalue"),
            TradeRecordV2.fob_value.label("fobvalue"),
            TradeRecordV2.quantity.label("qty"),
            TradeRecordV2.created_at.label("createdAt"),
        )
        .order_by(order_func(sort_col), desc(TradeRecordV2.id))
        .offset(offset)
        .limit(page_size)
        .all()
    )

    record_schemas = [
        TradeRecordSchema(
            id=r.id,
            refYear=r.year,
            reporterISO=r.reporterISO,
            reporterDesc=r.reporterDesc,
            flowCode=r.flowCode,
            flowDesc=r.flowDesc or ("Import" if r.flowCode == "M" else "Export"),
            partnerISO=r.partnerISO,
            partnerDesc=r.partnerDesc,
            cmdCode=r.cmdCode,
            cmdDesc=r.cmdDesc,
            primaryValue=float(r.primaryValue or 0.0),
            cifvalue=float(r.cifvalue) if r.cifvalue is not None else None,
            fobvalue=float(r.fobvalue) if r.fobvalue is not None else None,
            qty=float(r.qty) if r.qty is not None else None,
            createdAt=r.createdAt.isoformat() if r.createdAt else None,
        )
        for r in records
    ]

    return PaginatedTradeRecordsResponse(
        records=record_schemas,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/partners", response_model=List[TopPartnerItem])
def get_trade_analysis_partners(
    reporter: Optional[str] = Query(None, description="Reporter ISO or Country Name"),
    flow: Optional[str] = Query(None, description="Flow Code ('M' or 'X')"),
    start_year: Optional[int] = Query(None, description="Start year filter"),
    end_year: Optional[int] = Query(None, description="End year filter"),
    partner: Optional[str] = Query(None, description="Partner ISO"),
    product: Optional[str] = Query(None, description="Product code"),
    limit: Optional[int] = Query(10, ge=1, le=100, description="Max partner items to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns ranked partner economies for the current filtered slice.
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
            PartnerCountry.iso_code.label("partner_iso"),
            PartnerCountry.country_name.label("partner_desc"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("trade_value"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("export_val"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("import_val"),
        )
        .group_by(PartnerCountry.iso_code, PartnerCountry.country_name)
        .order_by(func.sum(TradeRecordV2.primary_value).desc())
        .limit(limit)
        .all()
    )

    total_trade = sum(float(r.trade_value or 0.0) for r in rows)
    results = []
    for r in rows:
        val = float(r.trade_value or 0.0)
        pct = (val / total_trade * 100.0) if total_trade > 0 else 0.0
        results.append(
            TopPartnerItem(
                partner_iso=r.partner_iso,
                partner_desc=r.partner_desc,
                trade_value=val,
                export_value=float(r.export_val or 0.0),
                import_value=float(r.import_val or 0.0),
                share_percentage=round(pct, 2),
            )
        )
    return results


@router.get("/products", response_model=List[TopProductItem])
def get_trade_analysis_products(
    reporter: Optional[str] = Query(None, description="Reporter ISO or Country Name"),
    flow: Optional[str] = Query(None, description="Flow Code ('M' or 'X')"),
    start_year: Optional[int] = Query(None, description="Start year filter"),
    end_year: Optional[int] = Query(None, description="End year filter"),
    partner: Optional[str] = Query(None, description="Partner ISO"),
    product: Optional[str] = Query(None, description="Product code"),
    limit: Optional[int] = Query(10, ge=1, le=100, description="Max product items to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns ranked product categories for the current filtered slice.
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
            ProductEntity.product_code.label("cmd_code"),
            ProductEntity.product_name.label("cmd_desc"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("trade_value"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("export_val"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("import_val"),
        )
        .group_by(ProductEntity.product_code, ProductEntity.product_name)
        .order_by(func.sum(TradeRecordV2.primary_value).desc())
        .limit(limit)
        .all()
    )

    total_trade = sum(float(r.trade_value or 0.0) for r in rows)
    results = []
    for r in rows:
        val = float(r.trade_value or 0.0)
        pct = (val / total_trade * 100.0) if total_trade > 0 else 0.0
        results.append(
            TopProductItem(
                cmd_code=r.cmd_code,
                cmd_desc=r.cmd_desc,
                trade_value=val,
                export_value=float(r.export_val or 0.0),
                import_value=float(r.import_val or 0.0),
                share_percentage=round(pct, 2),
            )
        )
    return results
