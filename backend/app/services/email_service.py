import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session
from ..models import EmailOutboxLog
from ..config import DB_PATH, get_smtp_config
from ..utils.logger import logger

# Directory for storing generated briefing PDFs locally
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BRIEFINGS_DIR = os.path.join(BASE_DIR, "data", "briefings")
os.makedirs(BRIEFINGS_DIR, exist_ok=True)


class EmailService:
    """
    Enterprise Email Dispatcher supporting live SMTP and Development In-App Outbox.
    Logs all dispatches and stores generated executive briefing attachments.
    """

    @property
    def config(self) -> Dict[str, Any]:
        return get_smtp_config()

    @property
    def host(self) -> str:
        return self.config["host"]

    @property
    def port(self) -> int:
        return self.config["port"]

    @property
    def user(self) -> str:
        return self.config["user"]

    @property
    def password(self) -> str:
        return self.config["password"]

    @property
    def from_email(self) -> str:
        return self.config["from_email"]

    @property
    def use_tls(self) -> bool:
        return self.config["use_tls"]

    @property
    def is_configured(self) -> bool:
        return self.config["is_configured"]

    def test_smtp_connection(self) -> Dict[str, Any]:
        """Tests the configured SMTP server connection."""
        if not self.is_configured:
            return {
                "success": False,
                "message": "SMTP host is not configured. Real emails cannot be sent.",
            }
        try:
            server = smtplib.SMTP(self.host, self.port, timeout=10)
            if self.use_tls:
                server.starttls()
            if self.user and self.password:
                server.login(self.user, self.password)
            server.quit()
            return {
                "success": True,
                "message": f"Successfully connected to SMTP server ({self.host}:{self.port})!",
            }
        except Exception as e:
            logger.error(f"SMTP connection test failed: {e}")
            return {
                "success": False,
                "message": f"SMTP connection error: {str(e)}",
            }

    def compose_briefing_html(
        self,
        briefing_name: str,
        reporter_name: str,
        headline: str,
        stats: Dict[str, Any],
        has_forecast: bool = True,
    ) -> str:
        """Composes a responsive executive HTML briefing email template."""
        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #f8fafc; margin: 0; padding: 24px; }}
    .container {{ max-width: 650px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 28px; }}
    .header {{ border-bottom: 1px solid #1f2937; padding-bottom: 16px; margin-bottom: 20px; }}
    .badge {{ display: inline-block; background-color: rgba(168, 85, 247, 0.15); border: 1px solid #a855f7; color: #c084fc; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em; }}
    .title {{ font-size: 22px; font-weight: 700; color: #ffffff; margin: 12px 0 4px 0; }}
    .subtitle {{ font-size: 13px; color: #94a3b8; margin: 0; }}
    .kpi-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0; }}
    .kpi-card {{ background-color: #0b1120; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; }}
    .kpi-label {{ font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }}
    .kpi-val {{ font-size: 18px; font-weight: 700; color: #ffffff; }}
    .kpi-sub {{ font-size: 11px; color: #34d399; margin-top: 4px; }}
    .headline-box {{ background-color: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 13px; color: #cbd5e1; line-height: 1.5; }}
    .attachment-box {{ background-color: #0b1120; border: 1px dashed #334155; border-radius: 8px; padding: 14px; text-align: center; margin: 24px 0; }}
    .footer {{ border-top: 1px solid #1f2937; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">Executive Trade Briefing</span>
      <h1 class="title">{briefing_name}</h1>
      <p class="subtitle">Focus Territory: {reporter_name} &bull; Generated: {datetime.now(timezone.utc).strftime('%B %d, %Y')}</p>
    </div>

    <div class="headline-box">
      <strong>Executive Summary:</strong> {headline}
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Export Turnover</div>
        <div class="kpi-val">{stats.get('total_exports', '$0.00')}</div>
        <div class="kpi-sub">Outbound Merchandise</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Import Inflow</div>
        <div class="kpi-val">{stats.get('total_imports', '$0.00')}</div>
        <div class="kpi-sub">Inbound Merchandise</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Net Trade Balance</div>
        <div class="kpi-val">{stats.get('trade_balance', '$0.00')}</div>
        <div class="kpi-sub">{stats.get('balance_status', 'Equilibrium')}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Forecasting Horizon</div>
        <div class="kpi-val">{stats.get('forecast_horizon', '3 Years')}</div>
        <div class="kpi-sub">{stats.get('best_model', 'Econometric Suite')}</div>
      </div>
    </div>

    <div class="attachment-box">
      <p style="margin: 0 0 6px 0; color: #f8fafc; font-weight: 600; font-size: 13px;">📎 Executive PDF Dossier Attached</p>
      <span style="font-size: 12px; color: #94a3b8;">Review the attached multi-page PDF briefing for detailed country partner distributions and predictive projections.</span>
    </div>

    <div class="footer">
      Automated Macroeconomic Intelligence &bull; Global Trade Analytics Platform &bull; Unsubscribe or configure alert thresholds in portal.
    </div>
  </div>
</body>
</html>"""

    def compose_alert_html(
        self,
        alert_title: str,
        severity: str,
        reporter_name: str,
        message: str,
        observed_value: float,
        baseline_value: float,
        delta_pct: float,
        threshold_value: float,
    ) -> str:
        """Composes an alert notification HTML email."""
        badge_color = "#ef4444" if severity == "CRITICAL" else "#f59e0b" if severity == "WARNING" else "#3b82f6"
        badge_bg = "rgba(239, 68, 68, 0.15)" if severity == "CRITICAL" else "rgba(245, 158, 11, 0.15)" if severity == "WARNING" else "rgba(59, 130, 246, 0.15)"

        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #f8fafc; margin: 0; padding: 24px; }}
    .container {{ max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 24px; }}
    .header {{ border-bottom: 1px solid #1f2937; padding-bottom: 14px; margin-bottom: 18px; }}
    .badge {{ display: inline-block; background-color: {badge_bg}; border: 1px solid {badge_color}; color: {badge_color}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }}
    .title {{ font-size: 20px; font-weight: 700; color: #ffffff; margin: 10px 0 4px 0; }}
    .alert-box {{ background-color: {badge_bg}; border: 1px solid {badge_color}; border-radius: 8px; padding: 14px; margin: 18px 0; font-size: 13px; color: #ffffff; line-height: 1.5; }}
    .metric-table {{ width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0; }}
    .metric-table td {{ padding: 8px 10px; border-bottom: 1px solid #1e293b; }}
    .metric-table td:first-child {{ color: #94a3b8; }}
    .metric-table td:last-child {{ text-align: right; font-weight: 700; color: #ffffff; }}
    .footer {{ border-top: 1px solid #1f2937; padding-top: 14px; font-size: 11px; color: #64748b; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">{severity} Trade Alert</span>
      <h1 class="title">{alert_title}</h1>
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">Monitored Country: {reporter_name} &bull; Triggered: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</p>
    </div>

    <div class="alert-box">
      <strong>Alert Summary:</strong> {message}
    </div>

    <table class="metric-table">
      <tr>
        <td>Configured Breach Threshold</td>
        <td>{threshold_value:+.1f}%</td>
      </tr>
      <tr>
        <td>Observed Shift (YoY)</td>
        <td style="color: {badge_color};">{delta_pct:+.2f}%</td>
      </tr>
      <tr>
        <td>Current Period Value</td>
        <td>${observed_value:,.2f}</td>
      </tr>
      <tr>
        <td>Prior Baseline Period Value</td>
        <td>${baseline_value:,.2f}</td>
      </tr>
    </table>

    <div class="footer">
      Automated Threshold Engine &bull; Global Trade Analytics Platform &bull; Investigate details in the Alerts Portal.
    </div>
  </div>
</body>
</html>"""

    def dispatch_email(
        self,
        db: Session,
        recipients: str,
        subject: str,
        html_content: str,
        email_type: str = "BRIEFING",
        pdf_bytes: Optional[bytes] = None,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Dispatches email via live SMTP if configured, or logs to Development Outbox.
        Persists attached PDF file to data/briefings/ and records audit log in database.
        """
        status = "SIMULATED_DEV_OUTBOX"
        error_msg = None
        saved_attachment_path = None

        # 1. Save PDF attachment to local storage if present
        if pdf_bytes and filename:
            try:
                # Sanitize filename
                safe_name = filename.replace(" ", "_").replace("/", "_")
                saved_attachment_path = os.path.join(BRIEFINGS_DIR, safe_name)
                with open(saved_attachment_path, "wb") as f:
                    f.write(pdf_bytes)
                logger.info(f"Briefing PDF saved to local storage: {saved_attachment_path}")
            except Exception as e:
                logger.error(f"Failed to save briefing PDF to disk: {e}")

        # 2. Attempt Live SMTP if configured
        if self.is_configured:
            try:
                msg = MIMEMultipart("mixed")
                msg["Subject"] = subject
                msg["From"] = self.from_email
                msg["To"] = recipients

                # HTML body
                body_part = MIMEText(html_content, "html", "utf-8")
                msg.attach(body_part)

                # PDF attachment
                if pdf_bytes and filename:
                    pdf_part = MIMEApplication(pdf_bytes, _subtype="pdf")
                    pdf_part.add_header("Content-Disposition", "attachment", filename=filename)
                    msg.attach(pdf_part)

                # Send
                server = smtplib.SMTP(self.host, self.port, timeout=10)
                if self.use_tls:
                    server.starttls()
                if self.user and self.password:
                    server.login(self.user, self.password)

                recipient_list = [r.strip() for r in recipients.split(",") if r.strip()]
                server.sendmail(self.from_email, recipient_list, msg.as_string())
                server.quit()
                status = "SENT"
                logger.info(f"Email successfully delivered via SMTP to: {recipients}")
            except Exception as e:
                logger.warning(f"SMTP delivery failed: {e}")
                status = "FAILED" if email_type == "TEST" else "SIMULATED_DEV_OUTBOX"
                error_msg = f"SMTP dispatch error: {str(e)}"
        else:
            status = "SIMULATED_DEV_OUTBOX"
            error_msg = "SMTP not configured. Email saved to Development Outbox."
            logger.info(f"SMTP not configured. Email logged to Development Outbox: '{subject}' -> {recipients}")

        # 3. Record in EmailOutboxLog
        log_entry = EmailOutboxLog(
            email_type=email_type,
            subject=subject,
            recipients=recipients,
            status=status,
            has_attachment=bool(pdf_bytes),
            attachment_filename=filename if pdf_bytes else None,
            attachment_path=saved_attachment_path,
            error_message=error_msg,
            sent_at=datetime.now(timezone.utc),
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)

        return log_entry.to_dict()


# Global Singleton Instance
email_service = EmailService()
