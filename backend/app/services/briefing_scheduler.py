import os
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session
from ..models import BriefingSchedule, User
from ..schemas import ReportGenerateRequest
from ..api.reports import generate_report
from .pdf_report_generator import generate_pdf_report
from .email_service import email_service
from ..utils.logger import logger


def compute_next_run(frequency: str, from_dt: Optional[datetime] = None) -> datetime:
    """Calculates the next scheduled run timestamp based on frequency."""
    base = from_dt or datetime.now(timezone.utc)
    freq = (frequency or "MONTHLY").upper()

    if freq == "DAILY":
        return base + timedelta(days=1)
    elif freq == "WEEKLY":
        return base + timedelta(weeks=1)
    elif freq == "MONTHLY":
        return base + timedelta(days=30)
    elif freq == "ON_SYNC":
        return base + timedelta(days=1)
    return base + timedelta(days=30)


def execute_briefing_dispatch(db: Session, schedule_id: int) -> Dict[str, Any]:
    """
    Executes a scheduled executive briefing:
    1. Compiles ReportResponse using existing reporting architecture.
    2. Renders high-resolution executive PDF dossier via ReportLab.
    3. Composes branded executive HTML email.
    4. Dispatches email (live SMTP or In-App Dev Outbox) with attached PDF.
    5. Updates last_run_at and next_run_at timestamps on the schedule.
    """
    schedule = db.query(BriefingSchedule).filter(BriefingSchedule.id == schedule_id).first()
    if not schedule:
        raise ValueError(f"Briefing schedule #{schedule_id} not found.")

    logger.info(f"Executing briefing schedule #{schedule.id}: '{schedule.name}' for {schedule.recipients}")

    # Build report payload
    payload = ReportGenerateRequest(
        reporter=schedule.reporter_iso if schedule.reporter_iso != "ALL" else None,
        flow=schedule.flow_code if schedule.flow_code != "TOTAL" else None,
        start_year=None,
        end_year=None,
        include_prediction=schedule.include_prediction,
        forecast_years=schedule.forecast_years,
    )

    # System worker user context
    system_user = User(
        id=0,
        username="system_briefing_worker",
        role="ADMIN",
        hashed_password="",
    )

    # 1. Generate ReportResponse
    report_data = generate_report(payload=payload, db=db, current_user=system_user)

    # 2. Render PDF bytes
    pdf_bytes = generate_pdf_report(report_data)

    # 3. Create attachment filename
    date_stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    reporter_tag = schedule.reporter_iso or "Global"
    filename = f"Executive_Briefing_{reporter_tag}_{date_stamp}.pdf"

    # 4. Extract key stats for HTML summary
    exp_val = report_data.trade_stats.export_value if report_data.trade_stats else 0.0
    imp_val = report_data.trade_stats.import_value if report_data.trade_stats else 0.0
    bal_val = report_data.trade_stats.trade_balance if report_data.trade_stats else 0.0

    best_model_name = "Econometric Suite"
    if report_data.prediction and report_data.prediction.models:
        best_key = report_data.prediction.best_model
        if best_key in report_data.prediction.models:
            best_model_name = report_data.prediction.models[best_key].display_name

    stats = {
        "total_exports": f"${exp_val:,.2f}",
        "total_imports": f"${imp_val:,.2f}",
        "trade_balance": f"${bal_val:,.2f}",
        "balance_status": "Trade Surplus" if bal_val >= 0 else "Trade Deficit",
        "forecast_horizon": f"{schedule.forecast_years} Years (2026–{2025 + schedule.forecast_years})",
        "best_model": best_model_name,
    }

    headline = (
        f"Automated executive trade intelligence briefing for {reporter_tag}. "
        f"Analyzed {report_data.trade_stats.record_count if report_data.trade_stats else 0} trade flow observations. "
        f"Trade position stands at {stats['balance_status']} of {stats['trade_balance']}."
    )

    html = email_service.compose_briefing_html(
        briefing_name=schedule.name,
        reporter_name=report_data.country_profile.reporter_name if report_data.country_profile else "Global Macro Aggregate",
        headline=headline,
        stats=stats,
        has_forecast=schedule.include_prediction,
    )

    # 5. Dispatch email
    outbox_record = email_service.dispatch_email(
        db=db,
        recipients=schedule.recipients,
        subject=f"[Executive Briefing] {schedule.name} - {reporter_tag}",
        html_content=html,
        email_type="BRIEFING",
        pdf_bytes=pdf_bytes,
        filename=filename,
    )

    # 6. Update schedule run times
    now = datetime.now(timezone.utc)
    schedule.last_run_at = now
    schedule.next_run_at = compute_next_run(schedule.frequency, now)
    db.commit()
    db.refresh(schedule)

    logger.info(f"Briefing schedule #{schedule.id} completed successfully. Status: {outbox_record['status']}")

    return {
        "schedule": schedule.to_dict(),
        "outbox": outbox_record,
    }
