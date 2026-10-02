"""
Phase 10: Automated Trade Reports API Endpoint.

Composes data from earlier phases:
- Trade Analysis stats: get_trade_analysis_stats
- Country Analysis profile: get_country_profile
- Product Analysis profile: get_product_profile
- Prediction Engine: run_prediction_logic
- Yearly Import/Export breakdown: get_trade_analysis_import_export

Requires authentication (any logged-in user: ADMIN or USER).
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import (
    ReportGenerateRequest,
    ReportFilters,
    ReportResponse,
)
from app.api.trade_analysis import (
    get_trade_analysis_stats,
    get_trade_analysis_import_export,
)
from app.api.country_analysis import get_country_profile
from app.api.product_analysis import get_product_profile
from app.api.prediction import run_prediction_logic
from app.services.pdf_report_generator import generate_pdf_report
from app.services.excel_report_generator import generate_excel_report
from app.utils.logger import logger

router = APIRouter(prefix="/reports", tags=["Automated Trade Reports"])


@router.post("/generate", response_model=ReportResponse)
def generate_report(
    payload: ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportResponse:
    """
    Generates a structured multi-dimensional analytical trade report based on user filter selections.
    Composes existing analytical modules and ML predictions without duplicating underlying aggregation queries.
    """
    logger.info(
        f"User '{current_user.username}' generating report for reporter='{payload.reporter}', "
        f"flow='{payload.flow}', years={payload.start_year}-{payload.end_year}, "
        f"include_prediction={payload.include_prediction}"
    )

    # 1. Sanitize input filters
    reporter_clean = payload.reporter.strip() if payload.reporter and payload.reporter.strip() else None
    if reporter_clean == "ALL":
        reporter_clean = None

    flow_clean = payload.flow.strip().upper() if payload.flow and payload.flow.strip() else None
    if flow_clean == "ALL":
        flow_clean = None

    filters_used = ReportFilters(
        reporter=reporter_clean,
        flow=flow_clean,
        start_year=payload.start_year,
        end_year=payload.end_year,
        include_prediction=payload.include_prediction,
        forecast_years=payload.forecast_years,
    )

    # 2. Retrieve trade stats using Trade Analysis module logic
    trade_stats = get_trade_analysis_stats(
        reporter=reporter_clean,
        flow=flow_clean,
        start_year=payload.start_year,
        end_year=payload.end_year,
        partner=None,
        product=None,
        db=db,
        current_user=current_user,
    )

    now_iso = datetime.now(timezone.utc).isoformat()

    # 3. If underlying data is empty, return clear no_data response
    if trade_stats.no_data or trade_stats.record_count == 0:
        return ReportResponse(
            report_title="Trade Analysis Report (No Data Available)",
            generated_at=now_iso,
            filters=filters_used,
            no_data=True,
            message="No trade records found matching the specified filters. Please verify country, flow, or year range selections.",
            trade_stats=trade_stats,
            country_profile=None,
            product_profile=None,
            prediction=None,
            yearly_trend=[],
        )

    # 4. Country Analysis profile (if reporter specified)
    country_profile = None
    if reporter_clean:
        try:
            country_profile = get_country_profile(
                reporter=reporter_clean,
                start_year=payload.start_year,
                end_year=payload.end_year,
                db=db,
                current_user=current_user,
            )
        except HTTPException:
            country_profile = None

    # 5. Product Analysis profile (reflecting single-product 'TOTAL' dataset)
    try:
        product_profile = get_product_profile(
            product="TOTAL",
            start_year=payload.start_year,
            end_year=payload.end_year,
            db=db,
            current_user=current_user,
        )
    except HTTPException:
        product_profile = None

    # 6. ML Prediction (if requested and applicable)
    prediction = None
    if payload.include_prediction:
        if reporter_clean:
            pred_flow = flow_clean if flow_clean in ["X", "M", "TOTAL"] else "X"
            forecast_yrs = max(1, min(5, payload.forecast_years or 3))
            try:
                prediction = run_prediction_logic(
                    reporter=reporter_clean,
                    flow=pred_flow,
                    forecast_years=forecast_yrs,
                    start_year=payload.start_year,
                    end_year=payload.end_year,
                    db=db,
                )
            except Exception as e:
                logger.warning(f"Prediction could not be computed for report: {e}")
                prediction = None

    # 7. Yearly trend time-series for visual charts
    yearly_trend = get_trade_analysis_import_export(
        reporter=reporter_clean,
        flow=flow_clean,
        start_year=payload.start_year,
        end_year=payload.end_year,
        partner=None,
        product=None,
        db=db,
        current_user=current_user,
    )

    # 8. Determine dynamic report title
    if country_profile and country_profile.reporter_name:
        report_title = f"{country_profile.reporter_name} Trade & Economic Profile Report"
    elif reporter_clean:
        report_title = f"{reporter_clean} Trade Analysis Report"
    else:
        report_title = "Global Trade & Economic Analysis Summary Report"

    return ReportResponse(
        report_title=report_title,
        generated_at=now_iso,
        filters=filters_used,
        no_data=False,
        message=None,
        trade_stats=trade_stats,
        country_profile=country_profile,
        product_profile=product_profile,
        prediction=prediction,
        yearly_trend=yearly_trend,
    )


@router.post("/export/pdf")
def export_pdf_report(
    payload: ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates an executive-styled PDF briefing report and returns it as a downloadable binary.
    """
    report_data = generate_report(payload=payload, db=db, current_user=current_user)
    pdf_bytes = generate_pdf_report(report_data)
    
    filename_scope = payload.reporter or "Global"
    ts_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"Trade_Report_{filename_scope}_{ts_str}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/export/excel")
def export_excel_report(
    payload: ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates a multi-tab executive Excel financial model workbook (.xlsx) and returns it as a downloadable binary.
    """
    report_data = generate_report(payload=payload, db=db, current_user=current_user)
    excel_bytes = generate_excel_report(report_data)

    filename_scope = payload.reporter or "Global"
    ts_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"Trade_Report_{filename_scope}_{ts_str}.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

