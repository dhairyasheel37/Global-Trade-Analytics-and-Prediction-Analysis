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


def test_dashboard_endpoints_require_auth(client):
    """All dashboard endpoints must return 401 when accessed without authentication."""
    endpoints = [
        "/api/dashboard/kpis",
        "/api/dashboard/trade-by-year",
        "/api/dashboard/import-export-by-year",
        "/api/dashboard/top-reporters",
        "/api/dashboard/flow-distribution",
        "/api/dashboard/trade-balance-by-year",
        "/api/dashboard/filter-options",
    ]
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 401, f"Expected 401 on unauthenticated {ep}"


def test_dashboard_kpis_unfiltered(client, auth_headers):
    """Unfiltered KPIs must match live database calculations."""
    res = client.get("/api/dashboard/kpis", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is False
    assert data["num_records"] == 3925
    assert data["num_countries"] == 190
    assert data["total_trade_value"] > 400_000_000_000_000.0  # > $400 Trillion
    assert data["total_export"] > 0
    assert data["total_import"] > 0
    assert data["trade_balance"] == data["total_export"] - data["total_import"]
    assert data["trade_balance_status"] in ["Trade Surplus", "Trade Deficit", "Balanced Trade"]


def test_dashboard_kpis_with_filters(client, auth_headers):
    """Applying reporter and year range filters must compute accurate filtered sub-totals."""
    res = client.get(
        "/api/dashboard/kpis?reporter=USA&start_year=2020&end_year=2024",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is False
    assert data["num_countries"] == 1
    # 5 years (2020..2024) * 2 flows (M, X) = 10 records
    assert data["num_records"] == 10
    assert data["total_trade_value"] > 0


def test_dashboard_kpis_impossible_filter(client, auth_headers):
    """Impossible filters must return no_data: true and zeros rather than failing."""
    res = client.get(
        "/api/dashboard/kpis?start_year=2090&end_year=2099",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is True
    assert data["num_records"] == 0
    assert data["num_countries"] == 0
    assert data["total_trade_value"] == 0.0
    assert data["total_export"] == 0.0
    assert data["total_import"] == 0.0
    assert data["trade_balance"] == 0.0
    assert data["trade_balance_status"] == "Balanced Trade"


def test_trade_by_year_endpoint(client, auth_headers):
    """Yearly trade trends should return data for all 12 years."""
    res = client.get("/api/dashboard/trade-by-year", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 12
    years = [item["year"] for item in data]
    assert years == list(range(2014, 2026))
    for item in data:
        assert item["total_trade_value"] > 0


def test_import_export_by_year_endpoint(client, auth_headers):
    """Grouped import vs export trend by year."""
    res = client.get("/api/dashboard/import-export-by-year", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 12
    for item in data:
        assert item["import_value"] > 0
        assert item["export_value"] > 0
        assert item["total_value"] == pytest.approx(item["import_value"] + item["export_value"], rel=1e-5)


def test_top_reporters_endpoint(client, auth_headers):
    """Top reporters ranked by total trade volume."""
    res = client.get("/api/dashboard/top-reporters?limit=10", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 10
    top_iso = [item["reporter_iso"] for item in data]
    # Major trade economies must appear in the top list
    assert "CHN" in top_iso or "USA" in top_iso or "DEU" in top_iso

    # Values must be descending
    for i in range(len(data) - 1):
        assert data[i]["total_value"] >= data[i + 1]["total_value"]


def test_flow_distribution_endpoint(client, auth_headers):
    """Donut chart flow distribution between Imports and Exports."""
    res = client.get("/api/dashboard/flow-distribution", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 2
    flows = {item["flow_code"]: item for item in data}
    assert "M" in flows and "X" in flows
    assert round(flows["M"]["percentage"] + flows["X"]["percentage"]) == 100


def test_trade_balance_by_year_endpoint(client, auth_headers):
    """Trade balance per year calculation and status."""
    res = client.get("/api/dashboard/trade-balance-by-year", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 12
    for item in data:
        assert item["trade_balance"] == pytest.approx(item["export_value"] - item["import_value"], rel=1e-5)
        if item["trade_balance"] > 0:
            assert item["status"] == "Trade Surplus"
        elif item["trade_balance"] < 0:
            assert item["status"] == "Trade Deficit"
        else:
            assert item["status"] == "Balanced Trade"


def test_filter_options_endpoint(client, auth_headers):
    """Filter options must return 190 reporters, 12 years, and 2 flows."""
    res = client.get("/api/dashboard/filter-options", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data["reporters"]) == 190
    assert len(data["years"]) == 12
    assert data["years"] == list(range(2014, 2026))
    assert len(data["flows"]) == 2
    flow_codes = [f["code"] for f in data["flows"]]
    assert "M" in flow_codes and "X" in flow_codes
