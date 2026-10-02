import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, SessionLocal
from app.utils.auth import seed_default_users

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()
    db = SessionLocal()
    seed_default_users(db)
    db.close()

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_headers(client):
    res = client.post("/api/auth/login", json={"username": "trader", "password": "Trader@Trade2026!"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_trade_balance_requires_auth(client):
    """All trade balance endpoints must return 401 when unauthenticated."""
    endpoints = [
        "/api/trade-balance/summary",
        "/api/trade-balance/by-year",
        "/api/trade-balance/compare-countries?reporters=USA,CHN",
    ]
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 401, f"Expected 401 on unauthenticated {ep}"


def test_trade_balance_summary_global_matches_phase3(client, auth_headers):
    """Unfiltered global trade balance summary must match Phase 3 dashboard KPIs exactly."""
    res_summary = client.get("/api/trade-balance/summary", headers=auth_headers)
    assert res_summary.status_code == 200
    summary_data = res_summary.json()

    res_kpi = client.get("/api/dashboard/kpis", headers=auth_headers)
    assert res_kpi.status_code == 200
    kpi_data = res_kpi.json()

    assert summary_data["no_data"] is False
    assert summary_data["reporter"] == "GLOBAL"
    assert summary_data["total_export"] == pytest.approx(kpi_data["total_export"], rel=1e-5)
    assert summary_data["total_import"] == pytest.approx(kpi_data["total_import"], rel=1e-5)
    assert summary_data["trade_balance"] == pytest.approx(kpi_data["trade_balance"], rel=1e-5)
    assert summary_data["trade_balance_status"] == kpi_data["trade_balance_status"]
    assert summary_data["start_year"] == 2014
    assert summary_data["end_year"] == 2025


def test_trade_balance_summary_single_country_matches_phase5(client, auth_headers):
    """Single reporter trade balance summary must match Phase 5 Country Analysis profile."""
    res_bal_usa = client.get("/api/trade-balance/summary?reporter=USA", headers=auth_headers)
    assert res_bal_usa.status_code == 200
    bal_usa = res_bal_usa.json()

    res_prof_usa = client.get("/api/country-analysis/profile?reporter=USA", headers=auth_headers)
    assert res_prof_usa.status_code == 200
    prof_usa = res_prof_usa.json()

    assert bal_usa["reporter"] == "USA"
    assert bal_usa["total_export"] == pytest.approx(prof_usa["total_exports"], rel=1e-5)
    assert bal_usa["total_import"] == pytest.approx(prof_usa["total_imports"], rel=1e-5)
    assert bal_usa["trade_balance"] == pytest.approx(prof_usa["trade_balance"], rel=1e-5)
    assert bal_usa["trade_balance_status"] == prof_usa["trade_balance_status"]


def test_trade_balance_summary_invalid_reporter_returns_400(client, auth_headers):
    """Invalid/non-existent reporter must return 400 Bad Request."""
    res = client.get("/api/trade-balance/summary?reporter=NONEXISTENT_XYZ", headers=auth_headers)
    assert res.status_code == 400
    assert "Invalid or unknown reporter" in res.json()["detail"]


def test_trade_balance_by_year_global(client, auth_headers):
    """Annual trade balance time-series globally."""
    res = client.get("/api/trade-balance/by-year", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 12
    for item in data:
        assert item["export_value"] > 0
        assert item["import_value"] > 0
        assert item["trade_balance"] == pytest.approx(item["export_value"] - item["import_value"], rel=1e-5)
        assert item["status"] in ["Trade Surplus", "Trade Deficit", "Balanced Trade"]


def test_trade_balance_compare_countries_valid_range(client, auth_headers):
    """Multi-country comparison for 3 nations (USA, CHN, DEU)."""
    res = client.get("/api/trade-balance/compare-countries?reporters=USA,CHN,DEU", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 3
    isos = [d["reporter_iso"] for d in data]
    assert isos == ["USA", "CHN", "DEU"]

    # Verify status assignments
    lookup = {d["reporter_iso"]: d for d in data}
    assert lookup["USA"]["status"] == "Trade Deficit"
    assert lookup["USA"]["trade_balance"] < 0
    assert lookup["CHN"]["status"] == "Trade Surplus"
    assert lookup["CHN"]["trade_balance"] > 0
    assert lookup["DEU"]["status"] == "Trade Surplus"
    assert lookup["DEU"]["trade_balance"] > 0


def test_trade_balance_compare_countries_too_few_returns_400(client, auth_headers):
    """Requests with < 2 countries return 400."""
    res_one = client.get("/api/trade-balance/compare-countries?reporters=USA", headers=auth_headers)
    assert res_one.status_code == 400
    assert res_one.json()["detail"] == "Select at least 2 countries to compare."

    res_empty = client.get("/api/trade-balance/compare-countries?reporters=", headers=auth_headers)
    assert res_empty.status_code == 400


def test_trade_balance_compare_countries_too_many_returns_400(client, auth_headers):
    """Requests with > 5 countries return 400."""
    res_six = client.get("/api/trade-balance/compare-countries?reporters=USA,CHN,DEU,JPN,FRA,GBR", headers=auth_headers)
    assert res_six.status_code == 400
    assert res_six.json()["detail"] == "Maximum 5 countries for comparison."
