"""
Phase 10 Tests — Automated Trade Reports Module
Tests report generation, auth enforcement, composability with earlier phases,
verbatim warning/disclaimer checks, and empty filter handling.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _login(username: str, password: str) -> str:
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def trader_headers():
    return {"Authorization": f"Bearer {_login('trader', 'Trader@Trade2026!')}"}


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login('admin', 'Admin@Trade2026!')}"}


class TestReportAuth:
    def test_generate_requires_auth(self):
        """Unauthenticated requests must return 401."""
        res = client.post("/api/reports/generate", json={})
        assert res.status_code == 401
        assert "token" in res.json()["detail"].lower()

    def test_generate_allowed_for_trader_role(self, trader_headers):
        """Standard USER role has access to reports generation."""
        res = client.post("/api/reports/generate", headers=trader_headers, json={"include_prediction": False})
        assert res.status_code == 200

    def test_generate_allowed_for_admin_role(self, admin_headers):
        """ADMIN role has access to reports generation."""
        res = client.post("/api/reports/generate", headers=admin_headers, json={"include_prediction": False})
        assert res.status_code == 200


class TestReportComposition:
    def test_usa_report_matches_country_profile_and_includes_prediction(self, trader_headers):
        """
        USA report with include_prediction=True:
        1. Trade stats exactly match country-analysis/profile?reporter=USA
        2. Prediction contains verbatim low_confidence_warning and reliability_note
        """
        # Call standalone country profile endpoint
        res_cp = client.get("/api/country-analysis/profile?reporter=USA", headers=trader_headers)
        assert res_cp.status_code == 200
        data_cp = res_cp.json()

        # Call reports generate endpoint
        res_rep = client.post(
            "/api/reports/generate",
            headers=trader_headers,
            json={
                "reporter": "USA",
                "include_prediction": True,
                "forecast_years": 3,
            },
        )
        assert res_rep.status_code == 200
        report = res_rep.json()

        assert report["no_data"] is False
        assert report["report_title"] == "USA Trade & Economic Profile Report"

        # Verify trade stats match standalone country profile
        ts = report["trade_stats"]
        assert ts["export_value"] == pytest.approx(data_cp["total_exports"], rel=1e-5)
        assert ts["import_value"] == pytest.approx(data_cp["total_imports"], rel=1e-5)
        assert ts["total_trade_value"] == pytest.approx(data_cp["total_trade_value"], rel=1e-5)
        assert ts["trade_balance"] == pytest.approx(data_cp["trade_balance"], rel=1e-5)

        # Verify country info is present
        assert report["country_profile"] is not None
        assert report["country_profile"]["reporter_iso"] == "USA"

        # Verify product info is present
        assert report["product_profile"] is not None
        assert report["product_profile"]["cmd_code"] == "TOTAL"

        # Verify prediction is present
        pred = report["prediction"]
        assert pred is not None
        assert pred["success"] is True
        assert pred["best_model"] in ("arima", "random_forest", "linear_regression", "holt_winters")
        assert pred["best_model"] in pred["models"]
        assert len(pred["historical_series"]) >= 8

        # Verbatim warning check
        expected_warning = "Low-confidence model performance: the selected model performed worse than a simple historical-mean baseline on the test data."
        assert pred["low_confidence_warning"] == expected_warning

        # Verbatim reliability note check
        expected_disclaimer = "Models are evaluated on a chronological split of annual observations. Projections represent statistical extrapolations with 95% confidence bands and should be interpreted alongside domain macroeconomic context."
        assert pred["reliability_note"] == expected_disclaimer

    def test_global_report_without_prediction(self, trader_headers):
        """
        Global report (no reporter) with include_prediction=False:
        1. Matches global total trade value
        2. Country profile is None
        3. Prediction is None
        """
        res_rep = client.post(
            "/api/reports/generate",
            headers=trader_headers,
            json={"include_prediction": False},
        )
        assert res_rep.status_code == 200
        report = res_rep.json()

        assert report["no_data"] is False
        assert report["report_title"] == "Global Trade & Economic Analysis Summary Report"
        assert report["country_profile"] is None
        assert report["prediction"] is None

        # Verify trade stats match global total
        ts = report["trade_stats"]
        assert ts["total_trade_value"] == pytest.approx(467518746644960.06, rel=1e-5)
        assert ts["export_value"] == pytest.approx(231057802142598.3, rel=1e-5)
        assert ts["import_value"] == pytest.approx(236460944502361.72, rel=1e-5)

        # Product profile is present
        assert report["product_profile"] is not None
        assert report["product_profile"]["cmd_code"] == "TOTAL"

    def test_report_empty_filter_returns_clear_no_data(self, trader_headers):
        """
        Filters yielding 0 records (e.g. start_year=2099) must return no_data=True
        with a descriptive message rather than a broken object.
        """
        res_rep = client.post(
            "/api/reports/generate",
            headers=trader_headers,
            json={
                "reporter": "USA",
                "start_year": 2099,
                "include_prediction": False,
            },
        )
        assert res_rep.status_code == 200
        report = res_rep.json()

        assert report["no_data"] is True
        assert report["message"] is not None
        assert "no trade records found" in report["message"].lower()
        assert report["prediction"] is None
