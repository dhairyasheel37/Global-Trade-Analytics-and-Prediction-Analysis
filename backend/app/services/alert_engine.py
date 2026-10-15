from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    AlertRule,
    AlertNotification,
    TradeRecordV2,
    Country,
    Product,
)
from .email_service import email_service
from ..utils.logger import logger


def get_country_annual_summary(db: Session, reporter_iso: str) -> Dict[int, Dict[str, float]]:
    """
    Returns annual total merchandise trade metrics (exports, imports, balance, deficit)
    for a given country ISO code across all available historical years.
    """
    query = (
        db.query(
            TradeRecordV2.year,
            TradeRecordV2.flow_code,
            func.sum(TradeRecordV2.primary_value).label("total_val"),
        )
        .join(Country, TradeRecordV2.reporter_id == Country.country_id)
        .join(Product, TradeRecordV2.product_id == Product.product_id)
        .filter(
            Country.iso_code == reporter_iso,
            Product.product_code == "TOTAL",
        )
        .group_by(TradeRecordV2.year, TradeRecordV2.flow_code)
        .order_by(TradeRecordV2.year)
    )

    yearly_data: Dict[int, Dict[str, float]] = {}
    for year, flow, total_val in query.all():
        if year not in yearly_data:
            yearly_data[year] = {"exports": 0.0, "imports": 0.0, "balance": 0.0, "deficit": 0.0}
        if flow == "X":
            yearly_data[year]["exports"] = float(total_val)
        elif flow == "M":
            yearly_data[year]["imports"] = float(total_val)

    # Compute net balance & deficit
    for yr, d in yearly_data.items():
        bal = d["exports"] - d["imports"]
        d["balance"] = bal
        d["deficit"] = max(0.0, -bal)

    return yearly_data


def get_all_tracked_reporters(db: Session) -> List[Tuple[str, str]]:
    """Returns list of (iso_code, country_name) for countries with trade records."""
    rows = (
        db.query(Country.iso_code, Country.country_name)
        .join(TradeRecordV2, TradeRecordV2.reporter_id == Country.country_id)
        .group_by(Country.iso_code, Country.country_name)
        .all()
    )
    return [(r[0], r[1]) for r in rows if r[0] != "W00"]


def evaluate_single_country_rule(
    db: Session,
    rule: AlertRule,
    reporter_iso: str,
    country_name: str,
) -> Optional[AlertNotification]:
    """
    Evaluates an alert rule against a single country's most recent trade performance.
    Returns newly created AlertNotification if breached and not previously triggered.
    """
    summary = get_country_annual_summary(db, reporter_iso)
    years = sorted(summary.keys())
    if len(years) < 2:
        return None

    # Focus on the two most recent recorded years (e.g. 2024 and 2025 or 2023 and 2024)
    curr_yr = years[-1]
    prev_yr = years[-2]

    curr_stats = summary[curr_yr]
    prev_stats = summary[prev_yr]

    triggered = False
    message = ""
    observed_val = 0.0
    baseline_val = 0.0
    delta_pct = 0.0

    rule_type = rule.rule_type.upper()
    thresh = float(rule.threshold_value)
    op = rule.comparison_operator or ">"

    # 1. Deficit Expansion YoY: "Notify if country deficit expands by more than X% YoY"
    if rule_type == "DEFICIT_EXPANSION_YOY":
        baseline_val = prev_stats["deficit"]
        observed_val = curr_stats["deficit"]

        if baseline_val > 0:
            delta_pct = ((observed_val - baseline_val) / baseline_val) * 100.0
        elif observed_val > 0:
            delta_pct = 100.0  # From 0 to positive deficit
        else:
            delta_pct = 0.0

        if op == ">" and delta_pct > thresh:
            triggered = True
        elif op == ">=" and delta_pct >= thresh:
            triggered = True

        message = (
            f"{country_name} ({reporter_iso}) trade deficit expanded by {delta_pct:+.1f}% YoY "
            f"(from ${baseline_val / 1e9:,.2f}B in {prev_yr} to ${observed_val / 1e9:,.2f}B in {curr_yr}), "
            f"breaching the alert threshold of {op} {thresh:.1f}%."
        )

    # 2. Export Contraction YoY: "Notify if exports drop by more than X% YoY"
    elif rule_type == "EXPORT_CONTRACTION_YOY":
        baseline_val = prev_stats["exports"]
        observed_val = curr_stats["exports"]

        if baseline_val > 0:
            delta_pct = ((observed_val - baseline_val) / baseline_val) * 100.0
        else:
            delta_pct = 0.0

        # Note: drop means negative delta, e.g. -15% is a 15% drop
        drop_pct = abs(delta_pct) if delta_pct < 0 else 0.0
        if delta_pct < 0 and drop_pct >= thresh:
            triggered = True

        message = (
            f"{country_name} ({reporter_iso}) merchandise exports contracted by {abs(delta_pct):.1f}% YoY "
            f"(from ${baseline_val / 1e9:,.2f}B in {prev_yr} to ${observed_val / 1e9:,.2f}B in {curr_yr}), "
            f"exceeding the maximum allowed contraction threshold of {thresh:.1f}%."
        )

    # 3. Import Surge YoY: "Notify if imports surge by more than X% YoY"
    elif rule_type == "IMPORT_SURGE_YOY":
        baseline_val = prev_stats["imports"]
        observed_val = curr_stats["imports"]

        if baseline_val > 0:
            delta_pct = ((observed_val - baseline_val) / baseline_val) * 100.0
        else:
            delta_pct = 0.0

        if delta_pct >= thresh:
            triggered = True

        message = (
            f"{country_name} ({reporter_iso}) merchandise imports surged by {delta_pct:+.1f}% YoY "
            f"(from ${baseline_val / 1e9:,.2f}B in {prev_yr} to ${observed_val / 1e9:,.2f}B in {curr_yr}), "
            f"exceeding the surge threshold of {thresh:.1f}%."
        )

    # 4. Balance Reversal: "Notify if country flips from net surplus to net deficit"
    elif rule_type == "BALANCE_REVERSAL":
        baseline_val = prev_stats["balance"]
        observed_val = curr_stats["balance"]

        # Reversal: Prior was surplus (>= 0), Current is deficit (< 0)
        if baseline_val >= 0 and observed_val < 0:
            triggered = True
            delta_pct = -100.0
            message = (
                f"{country_name} ({reporter_iso}) experienced a structural Trade Balance Reversal, "
                f"flipping from a net surplus of +${baseline_val / 1e9:,.2f}B in {prev_yr} "
                f"into a net trade deficit of -${abs(observed_val) / 1e9:,.2f}B in {curr_yr}."
            )

    if not triggered:
        return None

    # Check for duplicate active alert to prevent spam
    existing = (
        db.query(AlertNotification)
        .filter(
            AlertNotification.rule_id == rule.id,
            AlertNotification.reporter_iso == reporter_iso,
            AlertNotification.status.in_(["TRIGGERED", "ACKNOWLEDGED"]),
        )
        .first()
    )
    if existing:
        logger.info(f"Alert already active for rule #{rule.id} ({reporter_iso}); skipping duplicate.")
        return None

    # Create new AlertNotification record
    notification = AlertNotification(
        rule_id=rule.id,
        reporter_iso=reporter_iso,
        severity=rule.severity,
        title=rule.title,
        message=message,
        observed_value=observed_val,
        baseline_value=baseline_val,
        delta_pct=round(delta_pct, 2),
        status="TRIGGERED",
        triggered_at=datetime.now(timezone.utc),
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    logger.warning(f"ALERT TRIGGERED: {rule.title} - {message}")

    # Dispatch email if recipients configured on the rule
    if rule.recipients:
        try:
            html = email_service.compose_alert_html(
                alert_title=rule.title,
                severity=rule.severity,
                reporter_name=country_name,
                message=message,
                observed_value=observed_val,
                baseline_value=baseline_val,
                delta_pct=delta_pct,
                threshold_value=thresh,
            )
            email_service.dispatch_email(
                db=db,
                recipients=rule.recipients,
                subject=f"[{rule.severity} ALERT] {rule.title} - {reporter_iso}",
                html_content=html,
                email_type="ALERT",
            )
        except Exception as e:
            logger.error(f"Failed to dispatch email for alert #{notification.id}: {e}")

    return notification


def evaluate_all_rules(db: Session) -> Dict[str, Any]:
    """
    Scans all active AlertRules in database and evaluates them against latest trade observations.
    Returns audit statistics and list of newly triggered notifications.
    """
    active_rules = db.query(AlertRule).filter(AlertRule.is_active == True).all()
    all_reporters = get_all_tracked_reporters(db)
    reporter_dict = {r[0]: r[1] for r in all_reporters}

    newly_triggered: List[Dict[str, Any]] = []

    for rule in active_rules:
        if rule.reporter_iso and rule.reporter_iso != "ALL":
            target_list = [(rule.reporter_iso, reporter_dict.get(rule.reporter_iso, rule.reporter_iso))]
        else:
            target_list = all_reporters

        for r_iso, r_name in target_list:
            res = evaluate_single_country_rule(db, rule, r_iso, r_name)
            if res:
                newly_triggered.append(res.to_dict())

    return {
        "rules_evaluated": len(active_rules),
        "alerts_triggered_count": len(newly_triggered),
        "triggered_alerts": newly_triggered,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }
