import os
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    User,
    BriefingSchedule,
    AlertRule,
    AlertNotification,
    EmailOutboxLog,
)
from ..schemas import (
    BriefingScheduleCreate,
    BriefingScheduleUpdate,
    BriefingScheduleResponse,
    AlertRuleCreate,
    AlertRuleUpdate,
    AlertRuleResponse,
    AlertNotificationResponse,
    EmailOutboxResponse,
    TestEmailRequest,
    AlertsSummaryStats,
    SmtpConfigResponse,
    SmtpConfigUpdate,
)
from ..config import update_smtp_config
from ..dependencies import get_current_user
from ..services.email_service import email_service
from ..services.alert_engine import evaluate_all_rules
from ..services.briefing_scheduler import execute_briefing_dispatch, compute_next_run
from ..utils.logger import logger

router = APIRouter(prefix="/alerts", tags=["Automated Briefings & Alerts"])


# --- Summary Stats ---
@router.get("/summary-stats", response_model=AlertsSummaryStats)
def get_alerts_summary_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns high-level KPI counts for the Alerts & Briefings dashboard."""
    active_briefings = db.query(BriefingSchedule).filter(BriefingSchedule.is_active == True).count()
    monitored_rules = db.query(AlertRule).filter(AlertRule.is_active == True).count()
    unresolved_alerts = (
        db.query(AlertNotification)
        .filter(AlertNotification.status.in_(["TRIGGERED", "ACKNOWLEDGED"]))
        .count()
    )
    total_outbox_sent = db.query(EmailOutboxLog).count()

    return AlertsSummaryStats(
        active_briefings=active_briefings,
        monitored_rules=monitored_rules,
        unresolved_alerts=unresolved_alerts,
        total_outbox_sent=total_outbox_sent,
    )


# --- Briefing Schedules Endpoints ---
@router.get("/briefings", response_model=List[BriefingScheduleResponse])
def list_briefing_schedules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists all configured recurring briefing subscriptions."""
    schedules = db.query(BriefingSchedule).order_by(BriefingSchedule.created_at.desc()).all()
    return [BriefingScheduleResponse(**s.to_dict()) for s in schedules]


@router.post("/briefings", response_model=BriefingScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_briefing_schedule(
    payload: BriefingScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a new automated executive PDF briefing subscription."""
    now = datetime.now(timezone.utc)
    schedule = BriefingSchedule(
        name=payload.name,
        frequency=payload.frequency,
        reporter_iso=payload.reporter_iso if payload.reporter_iso != "ALL" else None,
        flow_code=payload.flow_code or "TOTAL",
        include_prediction=payload.include_prediction,
        forecast_years=payload.forecast_years,
        recipients=payload.recipients,
        is_active=payload.is_active,
        next_run_at=compute_next_run(payload.frequency, now),
        created_at=now,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    logger.info(f"User '{current_user.username}' created briefing schedule #{schedule.id}: '{schedule.name}'")
    return BriefingScheduleResponse(**schedule.to_dict())


@router.put("/briefings/{schedule_id}", response_model=BriefingScheduleResponse)
def update_briefing_schedule(
    schedule_id: int,
    payload: BriefingScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Updates an existing briefing schedule or toggles active status."""
    schedule = db.query(BriefingSchedule).filter(BriefingSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Briefing schedule not found.")

    if payload.name is not None:
        schedule.name = payload.name
    if payload.frequency is not None:
        schedule.frequency = payload.frequency
        schedule.next_run_at = compute_next_run(payload.frequency, schedule.last_run_at)
    if payload.reporter_iso is not None:
        schedule.reporter_iso = payload.reporter_iso if payload.reporter_iso != "ALL" else None
    if payload.flow_code is not None:
        schedule.flow_code = payload.flow_code
    if payload.include_prediction is not None:
        schedule.include_prediction = payload.include_prediction
    if payload.forecast_years is not None:
        schedule.forecast_years = payload.forecast_years
    if payload.recipients is not None:
        schedule.recipients = payload.recipients
    if payload.is_active is not None:
        schedule.is_active = payload.is_active

    db.commit()
    db.refresh(schedule)
    return BriefingScheduleResponse(**schedule.to_dict())


@router.delete("/briefings/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_briefing_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes a briefing schedule."""
    schedule = db.query(BriefingSchedule).filter(BriefingSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Briefing schedule not found.")

    db.delete(schedule)
    db.commit()
    return None


@router.post("/briefings/{schedule_id}/trigger")
def trigger_briefing_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Triggers an immediate on-demand execution and dispatch of the specified briefing."""
    try:
        result = execute_briefing_dispatch(db, schedule_id)
        return {
            "success": True,
            "message": f"Briefing triggered successfully. Dispatch status: {result['outbox']['status']}.",
            "details": result,
        }
    except Exception as e:
        logger.error(f"Failed to trigger briefing #{schedule_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Alert Rules Endpoints ---
@router.get("/rules", response_model=List[AlertRuleResponse])
def list_alert_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists all configured trade anomaly and risk alert rules."""
    rules = db.query(AlertRule).order_by(AlertRule.created_at.desc()).all()
    return [AlertRuleResponse(**r.to_dict()) for r in rules]


@router.post("/rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
def create_alert_rule(
    payload: AlertRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a new alert threshold rule (e.g. Deficit Expansion > 20% YoY)."""
    rule = AlertRule(
        title=payload.title,
        rule_type=payload.rule_type,
        reporter_iso=payload.reporter_iso,
        comparison_operator=payload.comparison_operator,
        threshold_value=payload.threshold_value,
        severity=payload.severity,
        recipients=payload.recipients,
        is_active=payload.is_active,
        created_at=datetime.now(timezone.utc),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    logger.info(f"User '{current_user.username}' created alert rule #{rule.id}: '{rule.title}'")
    return AlertRuleResponse(**rule.to_dict())


@router.put("/rules/{rule_id}", response_model=AlertRuleResponse)
def update_alert_rule(
    rule_id: int,
    payload: AlertRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Updates an alert rule or toggles its active state."""
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found.")

    if payload.title is not None:
        rule.title = payload.title
    if payload.rule_type is not None:
        rule.rule_type = payload.rule_type
    if payload.reporter_iso is not None:
        rule.reporter_iso = payload.reporter_iso
    if payload.comparison_operator is not None:
        rule.comparison_operator = payload.comparison_operator
    if payload.threshold_value is not None:
        rule.threshold_value = payload.threshold_value
    if payload.severity is not None:
        rule.severity = payload.severity
    if payload.recipients is not None:
        rule.recipients = payload.recipients
    if payload.is_active is not None:
        rule.is_active = payload.is_active

    db.commit()
    db.refresh(rule)
    return AlertRuleResponse(**rule.to_dict())


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes an alert rule."""
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found.")

    db.delete(rule)
    db.commit()
    return None


@router.post("/rules/evaluate")
def evaluate_rules_now(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Audits all active alert rules against latest historical trade records in real time.
    Returns audit statistics and any newly triggered notifications.
    """
    try:
        audit_res = evaluate_all_rules(db)
        return audit_res
    except Exception as e:
        logger.error(f"Rule evaluation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Notifications Endpoints ---
@router.get("/notifications", response_model=List[AlertNotificationResponse])
def list_alert_notifications(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity_filter: Optional[str] = Query(None, alias="severity"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves triggered alert notifications with optional status and severity filtering."""
    q = db.query(AlertNotification).order_by(AlertNotification.triggered_at.desc())

    if status_filter:
        q = q.filter(AlertNotification.status == status_filter.upper())
    if severity_filter:
        q = q.filter(AlertNotification.severity == severity_filter.upper())

    results = q.limit(100).all()
    return [AlertNotificationResponse(**n.to_dict()) for n in results]


@router.post("/notifications/{notification_id}/resolve", response_model=AlertNotificationResponse)
def resolve_alert_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marks an alert notification as RESOLVED."""
    notif = db.query(AlertNotification).filter(AlertNotification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Alert notification not found.")

    notif.status = "RESOLVED"
    notif.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notif)
    return AlertNotificationResponse(**notif.to_dict())


@router.post("/notifications/{notification_id}/acknowledge", response_model=AlertNotificationResponse)
def acknowledge_alert_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marks an alert notification as ACKNOWLEDGED."""
    notif = db.query(AlertNotification).filter(AlertNotification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Alert notification not found.")

    notif.status = "ACKNOWLEDGED"
    db.commit()
    db.refresh(notif)
    return AlertNotificationResponse(**notif.to_dict())


# --- Outbox & Email Logs ---
@router.get("/outbox", response_model=List[EmailOutboxResponse])
def list_outbox_emails(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves chronological audit log of all dispatched briefing and alert emails."""
    logs = db.query(EmailOutboxLog).order_by(EmailOutboxLog.sent_at.desc()).limit(limit).all()
    return [EmailOutboxResponse(**l.to_dict()) for l in logs]


@router.get("/outbox/{outbox_id}/download-pdf")
def download_outbox_briefing_pdf(
    outbox_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Downloads the exact PDF dossier attached to a dispatched executive briefing email."""
    log_entry = db.query(EmailOutboxLog).filter(EmailOutboxLog.id == outbox_id).first()
    if not log_entry or not log_entry.has_attachment or not log_entry.attachment_path:
        raise HTTPException(status_code=404, detail="Attachment not found for this email.")

    if not os.path.exists(log_entry.attachment_path):
        raise HTTPException(status_code=404, detail="Attachment file no longer exists on disk.")

    return FileResponse(
        path=log_entry.attachment_path,
        media_type="application/pdf",
        filename=log_entry.attachment_filename or "Executive_Briefing.pdf",
    )


def mask_email(email_str: str) -> str:
    if not email_str:
        return ""
    if "@" in email_str:
        parts = email_str.split("@")
        name = parts[0]
        masked = name[:2] + "***" if len(name) > 2 else name + "***"
        return f"{masked}@{parts[1]}"
    return email_str[:2] + "***"


# --- SMTP Configuration & Health Check ---
@router.get("/smtp-config", response_model=SmtpConfigResponse)
def get_smtp_status(current_user: User = Depends(get_current_user)):
    """Returns the current SMTP setup status and configuration parameters."""
    cfg = email_service.config
    return SmtpConfigResponse(
        is_configured=cfg["is_configured"],
        mode="LIVE_SMTP" if cfg["is_configured"] else "SIMULATED_DEV_OUTBOX",
        host=cfg["host"],
        port=cfg["port"],
        user_masked=mask_email(cfg["user"]),
        from_email=cfg["from_email"],
        use_tls=cfg["use_tls"],
    )


@router.post("/smtp-config")
def set_smtp_configuration(
    payload: SmtpConfigUpdate,
    current_user: User = Depends(get_current_user),
):
    """Updates and persists SMTP credentials in environment and .env."""
    update_smtp_config(
        host=payload.host,
        port=payload.port,
        user=payload.user,
        password=payload.password,
        from_email=payload.from_email,
        use_tls=payload.use_tls,
    )
    # Test connection right after saving
    test_res = email_service.test_smtp_connection()
    return {
        "success": test_res["success"],
        "message": f"SMTP credentials saved. Connection test: {test_res['message']}",
        "is_configured": email_service.is_configured,
        "mode": "LIVE_SMTP" if email_service.is_configured else "SIMULATED_DEV_OUTBOX",
        "host": payload.host,
        "port": payload.port,
        "user_masked": mask_email(payload.user),
        "from_email": payload.from_email,
        "use_tls": payload.use_tls,
    }


@router.post("/smtp-config/test")
def test_smtp_server(current_user: User = Depends(get_current_user)):
    """Tests current SMTP connection credentials without dispatching an email."""
    return email_service.test_smtp_connection()


@router.post("/test-email")
def send_test_email(
    payload: TestEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sends a sample test briefing or test alert to verify recipient delivery configuration."""
    if payload.email_type.upper() == "ALERT":
        html = email_service.compose_alert_html(
            alert_title="Sample Test Alert: Deficit Expansion Test",
            severity="WARNING",
            reporter_name=f"{payload.reporter_iso or 'USA'} Test Country",
            message=f"This is an automated test alert verifying threshold monitoring for {payload.reporter_iso or 'USA'}.",
            observed_value=1250000000000.0,
            baseline_value=1000000000000.0,
            delta_pct=25.0,
            threshold_value=20.0,
        )
        res = email_service.dispatch_email(
            db=db,
            recipients=payload.recipient,
            subject=f"[TEST ALERT] Deficit Shift Test - {payload.reporter_iso or 'USA'}",
            html_content=html,
            email_type="TEST",
        )
    else:
        stats = {
            "total_exports": "$2.06 T",
            "total_imports": "$3.36 T",
            "trade_balance": "-$1.29 T",
            "balance_status": "Trade Deficit",
            "forecast_horizon": "3 Years (2026–2028)",
            "best_model": "ARIMA(0, 1, 0)",
        }
        html = email_service.compose_briefing_html(
            briefing_name="Sample Test Executive Briefing",
            reporter_name=f"{payload.reporter_iso or 'USA'} Macro Overview",
            headline="Sample test executive trade briefing verifying email distribution and formatting.",
            stats=stats,
            has_forecast=True,
        )
        res = email_service.dispatch_email(
            db=db,
            recipients=payload.recipient,
            subject=f"[TEST BRIEFING] Sample Executive Briefing - {payload.reporter_iso or 'USA'}",
            html_content=html,
            email_type="TEST",
        )

    if res["status"] == "SENT":
        message = f"Live email successfully delivered via SMTP ({email_service.host}) to {payload.recipient}!"
        is_success = True
    elif res["status"] == "FAILED":
        message = f"SMTP delivery failed: {res.get('error_message')}. Saved to In-App Outbox."
        is_success = False
    else:
        message = f"SMTP not configured (Simulation Mode). Email logged to In-App Outbox tab for {payload.recipient}."
        is_success = True

    return {
        "success": is_success,
        "message": message,
        "outbox_log": res,
    }
