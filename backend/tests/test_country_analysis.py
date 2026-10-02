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


def test_country_analysis_requires_auth(client):
    """All country analysis endpoints must return 401 when unauthenticated."""
    endpoints = [
        "/api/country-analysis/profile?reporter=USA",
        "/api/country-analysis/trend?reporter=USA",
        "/api/country-analysis/top-partners?reporter=USA",
        "/api/country-analysis/top-products?reporter=USA",
    ]
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 401, f"Expected 401 on unauthenticated {ep}"


def test_country_profile_missing_reporter_returns_400(client, auth_headers):
    """Missing or blank reporter parameter must return 400 Bad Request."""
    res = client.get("/api/country-analysis/profile", headers=auth_headers)
    assert res.status_code == 400

    res_empty = client.get("/api/country-analysis/profile?reporter=", headers=auth_headers)
    assert res_empty.status_code == 400


def test_country_profile_usa(client, auth_headers):
    """Verify USA country profile across full year range."""
    res = client.get("/api/country-analysis/profile?reporter=USA", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is False
    assert data["reporter_iso"] == "USA"
    assert data["total_exports"] > 20_000_000_000_000.0  # > $20 Trillion
    assert data["total_imports"] > 30_000_000_000_000.0  # > $30 Trillion
    assert data["trade_balance"] == pytest.approx(data["total_exports"] - data["total_imports"], rel=1e-5)
    assert data["trade_balance_status"] == "Trade Deficit"
    assert data["export_growth"] is not None
    assert data["import_growth"] is not None
    assert "Growth calculated from 2014 to 2025" in data["growth_note"]


def test_country_profile_china(client, auth_headers):
    """Verify China country profile (Trade Surplus)."""
    res = client.get("/api/country-analysis/profile?reporter=CHN", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is False
    assert data["reporter_iso"] == "CHN"
    assert data["total_exports"] > data["total_imports"]
    assert data["trade_balance_status"] == "Trade Surplus"
    assert data["trade_balance"] > 0
    assert data["export_growth"] is not None
    assert data["import_growth"] is not None


def test_country_profile_germany(client, auth_headers):
    """Verify Germany country profile (Trade Surplus)."""
    res = client.get("/api/country-analysis/profile?reporter=DEU", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is False
    assert data["reporter_iso"] == "DEU"
    assert data["total_exports"] > data["total_imports"]
    assert data["trade_balance_status"] == "Trade Surplus"


def test_country_profile_single_year_growth_is_null(client, auth_headers):
    """When a single year is selected, growth rate should safely return null."""
    res = client.get("/api/country-analysis/profile?reporter=USA&start_year=2020&end_year=2020", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is False
    assert data["export_growth"] is None
    assert data["import_growth"] is None
    assert "Growth rate requires at least 2 distinct years" in data["growth_note"]


def test_country_profile_unknown_reporter_returns_no_data(client, auth_headers):
    """Non-existent reporter returns no_data: true rather than failing."""
    res = client.get("/api/country-analysis/profile?reporter=NONEXISTENT", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is True
    assert data["total_trade_value"] == 0.0
    assert data["trade_balance"] == 0.0


def test_country_trend_endpoint(client, auth_headers):
    """Multi-series year-wise trend for a country."""
    res = client.get("/api/country-analysis/trend?reporter=USA", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 12
    for item in data:
        assert item["export_value"] > 0
        assert item["import_value"] > 0
        assert item["total_value"] == pytest.approx(item["export_value"] + item["import_value"], rel=1e-5)
        assert item["trade_balance"] == pytest.approx(item["export_value"] - item["import_value"], rel=1e-5)


def test_country_top_partners_endpoint(client, auth_headers):
    """Top partners queries database directly (returns 1 row World with current data)."""
    res = client.get("/api/country-analysis/top-partners?reporter=USA", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 1
    assert data[0]["partner_iso"] == "W00"
    assert "World" in data[0]["partner_desc"]
    assert data[0]["share_percentage"] == 100.0


def test_country_top_products_endpoint(client, auth_headers):
    """Top products queries database directly (returns 1 row TOTAL with current data)."""
    res = client.get("/api/country-analysis/top-products?reporter=USA", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 1
    assert data[0]["cmd_code"] == "TOTAL"
    assert data[0]["share_percentage"] == 100.0
