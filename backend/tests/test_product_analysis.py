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


def test_product_analysis_requires_auth(client):
    """All product analysis endpoints must return 401 when unauthenticated."""
    endpoints = [
        "/api/product-analysis/list",
        "/api/product-analysis/profile?product=TOTAL",
        "/api/product-analysis/trend?product=TOTAL",
        "/api/product-analysis/top-exporters?product=TOTAL",
        "/api/product-analysis/top-importers?product=TOTAL",
    ]
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 401, f"Expected 401 on unauthenticated {ep}"


def test_product_list_endpoint(client, auth_headers):
    """Product list returns distinct products from database (TOTAL + 4 granular HS2 products)."""
    res = client.get("/api/product-analysis/list", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 5
    assert data[0]["cmd_code"] == "TOTAL"
    assert data[0]["cmd_desc"] == "All Commodities"
    assert data[0]["total_records"] == 3925
    codes = [d["cmd_code"] for d in data]
    assert set(["TOTAL", "30", "84", "85", "87"]).issubset(set(codes))


def test_product_profile_missing_product_returns_400(client, auth_headers):
    """Missing or blank product parameter must return 400 Bad Request."""
    res = client.get("/api/product-analysis/profile", headers=auth_headers)
    assert res.status_code == 400

    res_empty = client.get("/api/product-analysis/profile?product=", headers=auth_headers)
    assert res_empty.status_code == 400


def test_product_profile_total(client, auth_headers):
    """Product profile for TOTAL should reflect cumulative global exports and imports."""
    res = client.get("/api/product-analysis/profile?product=TOTAL", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is False
    assert data["cmd_code"] == "TOTAL"
    assert data["total_exports"] > 200_000_000_000_000.0  # > $200 Trillion
    assert data["total_imports"] > 200_000_000_000_000.0  # > $200 Trillion
    assert data["trade_balance"] == pytest.approx(data["total_exports"] - data["total_imports"], rel=1e-5)
    assert data["export_growth"] is not None
    assert data["import_growth"] is not None


def test_product_profile_single_year_growth_is_null(client, auth_headers):
    """When a single year is selected, growth rate should safely return null."""
    res = client.get("/api/product-analysis/profile?product=TOTAL&start_year=2020&end_year=2020", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is False
    assert data["export_growth"] is None
    assert data["import_growth"] is None
    assert "Growth rate requires at least 2 distinct years" in data["growth_note"]


def test_product_trend_endpoint(client, auth_headers):
    """Historical yearly trend for TOTAL across all years."""
    res = client.get("/api/product-analysis/trend?product=TOTAL", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 12
    for item in data:
        assert item["export_value"] > 0
        assert item["import_value"] > 0
        assert item["total_value"] == pytest.approx(item["export_value"] + item["import_value"], rel=1e-5)


def test_product_top_exporters_endpoint(client, auth_headers):
    """Top exporters for TOTAL commodity category."""
    res = client.get("/api/product-analysis/top-exporters?product=TOTAL&limit=10", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 10
    top_isos = [d["reporter_iso"] for d in data]
    assert "CHN" in top_isos or "USA" in top_isos or "DEU" in top_isos
    for i in range(len(data) - 1):
        assert data[i]["trade_value"] >= data[i + 1]["trade_value"]


def test_product_top_importers_endpoint(client, auth_headers):
    """Top importers for TOTAL commodity category."""
    res = client.get("/api/product-analysis/top-importers?product=TOTAL&limit=10", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 10
    top_isos = [d["reporter_iso"] for d in data]
    assert "USA" in top_isos or "CHN" in top_isos or "DEU" in top_isos
    for i in range(len(data) - 1):
        assert data[i]["trade_value"] >= data[i + 1]["trade_value"]
