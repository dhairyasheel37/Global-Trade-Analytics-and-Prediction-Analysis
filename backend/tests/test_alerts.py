import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, SessionLocal
from app.models import (
    User,
    BriefingSchedule,
    AlertRule,
    AlertNotification,
    EmailOutboxLog,
)
from app.utils.auth import seed_default_users, create_access_token

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()
    db = SessionLocal()
    seed_default_users(db)
    db.close()


@pytest.fixture
def admin_headers():
    token = create_access_token({"sub": "admin", "role": "ADMIN"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def trader_headers():
    token = create_access_token({"sub": "trader", "role": "USER"})
    return {"Authorization": f"Bearer {token}"}


class TestAlertsAuth:
    """Authentication and role enforcement tests."""

    def test_briefings_endpoint_requires_auth(self):
        res = client.get("/api/alerts/briefings")
        assert res.status_code == 401

    def test_rules_endpoint_requires_auth(self):
        res = client.get("/api/alerts/rules")
        assert res.status_code == 401

    def test_notifications_endpoint_requires_auth(self):
        res = client.get("/api/alerts/notifications")
        assert res.status_code == 401

    def test_outbox_endpoint_requires_auth(self):
        res = client.get("/api/alerts/outbox")
        assert res.status_code == 401

    def test_trader_can_view_summary_stats(self, trader_headers):
        res = client.get("/api/alerts/summary-stats", headers=trader_headers)
        assert res.status_code == 200
        data = res.json()
        assert "active_briefings" in data
        assert "monitored_rules" in data
        assert "unresolved_alerts" in data
        assert "total_outbox_sent" in data


class TestBriefingSchedules:
    """CRUD and on-demand trigger dispatch tests for executive PDF briefings."""

    def test_create_and_list_briefing_schedule(self, admin_headers):
        payload = {
            "name": "Quarterly US Executive Dossier",
            "frequency": "MONTHLY",
            "reporter_iso": "USA",
            "flow_code": "TOTAL",
            "include_prediction": True,
            "forecast_years": 3,
            "recipients": "csuite@trade.corp, exec@whitehouse.gov",
            "is_active": True,
        }
        res = client.post("/api/alerts/briefings", headers=admin_headers, json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["id"] is not None
        assert data["name"] == "Quarterly US Executive Dossier"
        assert data["next_run_at"] is not None

        # List
        res_list = client.get("/api/alerts/briefings", headers=admin_headers)
        assert res_list.status_code == 200
        schedules = res_list.json()
        assert any(s["id"] == data["id"] for s in schedules)

    def test_update_briefing_schedule(self, admin_headers):
        # Create
        create_res = client.post(
            "/api/alerts/briefings",
            headers=admin_headers,
            json={
                "name": "Initial Name",
                "frequency": "DAILY",
                "reporter_iso": "USA",
                "recipients": "test@example.com",
            },
        )
        s_id = create_res.json()["id"]

        # Update
        update_res = client.put(
            f"/api/alerts/briefings/{s_id}",
            headers=admin_headers,
            json={"name": "Updated Briefing Name", "frequency": "WEEKLY"},
        )
        assert update_res.status_code == 200
        assert update_res.json()["name"] == "Updated Briefing Name"
        assert update_res.json()["frequency"] == "WEEKLY"

    def test_trigger_briefing_executes_and_generates_pdf(self, admin_headers):
        """
        Triggering a briefing creates an executive report, renders the PDF,
        and logs the dispatch to EmailOutboxLog.
        """
        create_res = client.post(
            "/api/alerts/briefings",
            headers=admin_headers,
            json={
                "name": "Live Dispatch Briefing Test",
                "frequency": "MONTHLY",
                "reporter_iso": "USA",
                "include_prediction": True,
                "forecast_years": 3,
                "recipients": "analyst@macrotrade.org",
            },
        )
        s_id = create_res.json()["id"]

        # Trigger
        trigger_res = client.post(f"/api/alerts/briefings/{s_id}/trigger", headers=admin_headers)
        assert trigger_res.status_code == 200
        res_data = trigger_res.json()
        assert res_data["success"] is True
        assert "details" in res_data
        outbox = res_data["details"]["outbox"]
        assert outbox["status"] in ("SENT", "SIMULATED_DEV_OUTBOX")
        assert outbox["has_attachment"] is True
        assert outbox["attachment_filename"].endswith(".pdf")


class TestAlertRulesAndEvaluation:
    """Alert rules creation, audit evaluation, and incident resolution."""

    def test_create_and_list_alert_rule(self, admin_headers):
        payload = {
            "title": "US Trade Deficit Expansion > 10% YoY",
            "rule_type": "DEFICIT_EXPANSION_YOY",
            "reporter_iso": "USA",
            "comparison_operator": ">",
            "threshold_value": 10.0,
            "severity": "WARNING",
            "recipients": "risk@treasury.gov",
            "is_active": True,
        }
        res = client.post("/api/alerts/rules", headers=admin_headers, json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["id"] is not None
        assert data["title"] == "US Trade Deficit Expansion > 10% YoY"

    def test_evaluate_rules_detects_breaches_and_creates_notifications(self, trader_headers, admin_headers):
        # Create a rule with low threshold to ensure breach triggers on USA data
        client.post(
            "/api/alerts/rules",
            headers=admin_headers,
            json={
                "title": "USA Deficit Hike Test Rule",
                "rule_type": "DEFICIT_EXPANSION_YOY",
                "reporter_iso": "USA",
                "comparison_operator": ">",
                "threshold_value": 2.0,
                "severity": "CRITICAL",
                "recipients": "alerts@trademonitor.org",
            },
        )

        # Trigger evaluation
        eval_res = client.post("/api/alerts/rules/evaluate", headers=trader_headers)
        assert eval_res.status_code == 200
        data = eval_res.json()
        assert "rules_evaluated" in data
        assert data["rules_evaluated"] >= 1

        # Check notifications list
        notifs_res = client.get("/api/alerts/notifications", headers=trader_headers)
        assert notifs_res.status_code == 200
        notifs = notifs_res.json()
        assert len(notifs) >= 1

        # Verify incident fields
        first_notif = notifs[0]
        assert first_notif["status"] in ("TRIGGERED", "ACKNOWLEDGED", "RESOLVED")
        assert first_notif["severity"] in ("CRITICAL", "WARNING", "INFO")
        assert first_notif["reporter_iso"] != ""
        assert first_notif["message"] != ""

    def test_acknowledge_and_resolve_notification(self, trader_headers, admin_headers):
        # Retrieve active notification
        notifs_res = client.get("/api/alerts/notifications", headers=trader_headers)
        notifs = notifs_res.json()
        if not notifs:
            # Trigger evaluation to generate one
            client.post("/api/alerts/rules/evaluate", headers=trader_headers)
            notifs = client.get("/api/alerts/notifications", headers=trader_headers).json()

        assert len(notifs) >= 1
        n_id = notifs[0]["id"]

        # Acknowledge
        ack_res = client.post(f"/api/alerts/notifications/{n_id}/acknowledge", headers=trader_headers)
        assert ack_res.status_code == 200
        assert ack_res.json()["status"] == "ACKNOWLEDGED"

        # Resolve
        res_res = client.post(f"/api/alerts/notifications/{n_id}/resolve", headers=trader_headers)
        assert res_res.status_code == 200
        assert res_res.json()["status"] == "RESOLVED"
        assert res_res.json()["resolved_at"] is not None


class TestOutboxAndDownloads:
    """Outbox email log retrieval, test-email dispatch, and PDF attachment download."""

    def test_send_test_email(self, trader_headers):
        res = client.post(
            "/api/alerts/test-email",
            headers=trader_headers,
            json={
                "recipient": "tester@domain.com",
                "email_type": "BRIEFING",
                "reporter_iso": "USA",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["outbox_log"]["status"] in ("SENT", "SIMULATED_DEV_OUTBOX")

    def test_outbox_list_and_pdf_download(self, admin_headers):
        # Trigger a briefing to guarantee an attachment exists
        create_res = client.post(
            "/api/alerts/briefings",
            headers=admin_headers,
            json={
                "name": "Download Verification Briefing",
                "frequency": "MONTHLY",
                "reporter_iso": "USA",
                "recipients": "download@test.com",
            },
        )
        s_id = create_res.json()["id"]
        client.post(f"/api/alerts/briefings/{s_id}/trigger", headers=admin_headers)

        # Query Outbox
        outbox_res = client.get("/api/alerts/outbox", headers=admin_headers)
        assert outbox_res.status_code == 200
        logs = outbox_res.json()
        assert len(logs) >= 1

        # Find entry with attachment
        attached_entry = next((e for e in logs if e["has_attachment"]), None)
        assert attached_entry is not None

        # Download PDF
        dl_res = client.get(f"/api/alerts/outbox/{attached_entry['id']}/download-pdf", headers=admin_headers)
        assert dl_res.status_code == 200
        assert dl_res.headers["content-type"] == "application/pdf"
        assert len(dl_res.content) > 1000  # Non-empty PDF

    def test_smtp_config_endpoints(self, trader_headers):
        # 1. GET smtp-config
        get_res = client.get("/api/alerts/smtp-config", headers=trader_headers)
        assert get_res.status_code == 200
        cfg = get_res.json()
        assert "is_configured" in cfg
        assert "mode" in cfg
        assert "port" in cfg

        # 2. POST smtp-config (update config)
        post_res = client.post(
            "/api/alerts/smtp-config",
            headers=trader_headers,
            json={
                "host": "smtp.testserver.local",
                "port": 587,
                "user": "analyst@macrotrade.org",
                "password": "testpassword",
                "from_email": "alerts@macrotrade.org",
                "use_tls": True,
            },
        )
        assert post_res.status_code == 200
        post_data = post_res.json()
        assert post_data["host"] == "smtp.testserver.local"
        assert post_data["is_configured"] is True

        # 3. POST smtp-config/test (attempt test connection)
        test_res = client.post("/api/alerts/smtp-config/test", headers=trader_headers)
        assert test_res.status_code == 200
        assert "success" in test_res.json()
        assert "message" in test_res.json()

        # 4. Clean up / reset to empty host
        client.post(
            "/api/alerts/smtp-config",
            headers=trader_headers,
            json={
                "host": "",
                "port": 587,
                "user": "",
                "password": "",
                "from_email": "briefings@globaltrade.analytics",
                "use_tls": True,
            },
        )
