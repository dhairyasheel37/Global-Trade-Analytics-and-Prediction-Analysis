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


def test_trade_analysis_requires_auth(client):
    """All trade analysis endpoints must return 401 when unauthenticated."""
    endpoints = [
        "/api/trade-analysis/stats",
        "/api/trade-analysis/trend",
        "/api/trade-analysis/import-export",
        "/api/trade-analysis/records",
    ]
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 401, f"Expected 401 on unauthenticated {ep}"


def test_trade_analysis_stats_unfiltered(client, auth_headers):
    """Unfiltered stats must agree mathematically with Phase 3 dashboard KPIs."""
    res_stats = client.get("/api/trade-analysis/stats", headers=auth_headers)
    assert res_stats.status_code == 200
    data = res_stats.json()

    assert data["no_data"] is False
    assert data["record_count"] == 3925
    assert data["total_trade_value"] > 400_000_000_000_000.0
    assert data["export_value"] > 0
    assert data["import_value"] > 0
    assert data["trade_balance"] == pytest.approx(data["export_value"] - data["import_value"], rel=1e-5)
    assert data["average_trade_value"] == pytest.approx(data["total_trade_value"] / data["record_count"], rel=1e-5)
    assert data["min_trade_value"] > 0
    assert data["max_trade_value"] >= data["average_trade_value"]

    # Verify cross-phase consistency with Phase 3 KPIs
    res_kpis = client.get("/api/dashboard/kpis", headers=auth_headers)
    kpis = res_kpis.json()
    assert data["total_trade_value"] == pytest.approx(kpis["total_trade_value"], rel=1e-5)
    assert data["export_value"] == pytest.approx(kpis["total_export"], rel=1e-5)
    assert data["import_value"] == pytest.approx(kpis["total_import"], rel=1e-5)
    assert data["trade_balance"] == pytest.approx(kpis["trade_balance"], rel=1e-5)


def test_trade_analysis_stats_filtered_single_reporter(client, auth_headers):
    """Filtered stats for a single reporter (e.g. USA across full year range)."""
    res = client.get("/api/trade-analysis/stats?reporter=USA", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is False
    assert data["record_count"] == 24  # 12 years * 2 flows
    assert data["total_trade_value"] > 0
    assert data["export_value"] > 0
    assert data["import_value"] > 0


def test_trade_analysis_stats_impossible_filter(client, auth_headers):
    """Impossible filters return zeros and no_data: true without failing."""
    res = client.get("/api/trade-analysis/stats?start_year=2099", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is True
    assert data["record_count"] == 0
    assert data["total_trade_value"] == 0.0
    assert data["average_trade_value"] == 0.0
    assert data["export_value"] == 0.0
    assert data["import_value"] == 0.0
    assert data["trade_balance"] == 0.0


def test_trade_analysis_trend_endpoint(client, auth_headers):
    """Yearly historical trend endpoint for filtered views."""
    res = client.get("/api/trade-analysis/trend?reporter=DEU", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) == 12
    years = [item["year"] for item in data]
    assert years == list(range(2014, 2026))


def test_trade_analysis_import_export_endpoint(client, auth_headers):
    """Grouped import vs export trend endpoint."""
    res = client.get("/api/trade-analysis/import-export?reporter=CHN", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data) > 0
    for item in data:
        assert item["import_value"] > 0
        assert item["export_value"] > 0
        assert item["total_value"] == pytest.approx(item["import_value"] + item["export_value"], rel=1e-5)


def test_trade_analysis_records_pagination(client, auth_headers):
    """Test server-side pagination (page and page_size)."""
    res_page1 = client.get("/api/trade-analysis/records?page=1&page_size=10", headers=auth_headers)
    assert res_page1.status_code == 200
    data1 = res_page1.json()

    assert data1["total_count"] == 3925
    assert data1["page"] == 1
    assert data1["page_size"] == 10
    assert data1["total_pages"] == 393
    assert len(data1["records"]) == 10

    res_page2 = client.get("/api/trade-analysis/records?page=2&page_size=10", headers=auth_headers)
    assert res_page2.status_code == 200
    data2 = res_page2.json()

    assert data2["page"] == 2
    assert len(data2["records"]) == 10
    # Page 1 and Page 2 records must be distinct
    assert data1["records"][0]["id"] != data2["records"][0]["id"]


def test_trade_analysis_records_sorting(client, auth_headers):
    """Test server-side column sorting (sort_by and sort_order)."""
    # Sort descending by primaryValue
    res_desc = client.get("/api/trade-analysis/records?sort_by=primaryValue&sort_order=desc&page_size=10", headers=auth_headers)
    assert res_desc.status_code == 200
    records_desc = res_desc.json()["records"]
    assert records_desc[0]["primaryValue"] >= records_desc[-1]["primaryValue"]

    # Sort ascending by primaryValue
    res_asc = client.get("/api/trade-analysis/records?sort_by=primaryValue&sort_order=asc&page_size=10", headers=auth_headers)
    assert res_asc.status_code == 200
    records_asc = res_asc.json()["records"]
    assert records_asc[0]["primaryValue"] <= records_asc[-1]["primaryValue"]
    assert records_desc[0]["primaryValue"] > records_asc[0]["primaryValue"]


def test_trade_analysis_records_search(client, auth_headers):
    """Test server-side text search by country name or ISO."""
    res = client.get("/api/trade-analysis/records?search=Germany", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_count"] == 24  # 12 years * 2 flows for Germany
    for r in data["records"]:
        assert "germany" in r["reporterDesc"].lower() or r["reporterISO"] == "DEU"


def test_trade_analysis_stats_filtered_partner_granular(client, auth_headers):
    """Granular partner drill-down returns verified records when granular data is present."""
    res = client.get("/api/trade-analysis/stats?reporter=IND&partner=USA", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is False
    assert data["record_count"] > 0
    assert data["total_trade_value"] > 0


def test_trade_analysis_stats_filtered_product_granular(client, auth_headers):
    """Granular product drill-down returns verified records for HS 30."""
    res = client.get("/api/trade-analysis/stats?reporter=IND&product=30", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is False
    assert data["record_count"] > 0
    assert data["total_trade_value"] > 0


def test_trade_analysis_stats_filtered_partner_and_product(client, auth_headers):
    """Combined partner + product filter yields verified $50,946,581,137.04 figure."""
    res = client.get("/api/trade-analysis/stats?reporter=IND&partner=USA&product=30", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["no_data"] is False
    assert data["record_count"] == 14
    assert data["total_trade_value"] == pytest.approx(50946581137.04, rel=1e-4)


def test_trade_analysis_partners_ranking_endpoint(client, auth_headers):
    """Ranked partner economies endpoint returns filtered partner list."""
    res = client.get("/api/trade-analysis/partners?reporter=IND&partner=USA", headers=auth_headers)
    assert res.status_code == 200
    partners = res.json()

    assert len(partners) >= 1
    assert partners[0]["partner_iso"] == "USA"


def test_trade_analysis_products_ranking_endpoint(client, auth_headers):
    """Ranked product categories endpoint returns 4 granular HS chapters."""
    res = client.get("/api/trade-analysis/products?reporter=IND&partner=USA", headers=auth_headers)
    assert res.status_code == 200
    products = res.json()

    assert len(products) == 4
    codes = [p["cmd_code"] for p in products]
    assert set(["30", "84", "85", "87"]).issubset(set(codes))


def test_trade_analysis_records_sorting_partner_and_commodity(client, auth_headers):
    """Test server-side column sorting on partnerISO and cmdCode."""
    res_part = client.get("/api/trade-analysis/records?sort_by=partnerISO&sort_order=asc&page_size=5", headers=auth_headers)
    assert res_part.status_code == 200
    records_part = res_part.json()["records"]
    assert len(records_part) == 5

    res_cmd = client.get("/api/trade-analysis/records?sort_by=cmdCode&sort_order=desc&page_size=5", headers=auth_headers)
    assert res_cmd.status_code == 200
    records_cmd = res_cmd.json()["records"]
    assert len(records_cmd) == 5

