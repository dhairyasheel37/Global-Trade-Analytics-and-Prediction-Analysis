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


def test_map_requires_auth(client):
    """Map endpoint must return 401 when unauthenticated."""
    res = client.get("/api/map/countries")
    assert res.status_code == 401


def test_map_countries_unfiltered(client, auth_headers):
    """
    Unfiltered map endpoint returns all 190 countries, flags exactly 4 granular reporters,
    and matches dashboard KPIs mathematically.
    """
    res = client.get("/api/map/countries", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    summary = data["summary"]
    assert summary["countries_with_data"] == 190
    assert summary["granular_countries_count"] == 4
    assert summary["total_global_trade"] > 400_000_000_000_000.0
    assert summary["total_global_exports"] > 0
    assert summary["total_global_imports"] > 0
    assert summary["global_trade_balance"] == pytest.approx(
        summary["total_global_exports"] - summary["total_global_imports"], rel=1e-5
    )

    # Check available years
    assert len(data["available_years"]) == 12
    assert data["available_years"] == list(range(2014, 2026))

    # Verify granular flags (4 granular, 186 macro-only)
    countries = data["countries"]
    assert len(countries) == 190

    by_iso = {c["iso_code"]: c for c in countries}
    granular_isos = ["IND", "USA", "CHN", "DEU"]
    macro_only_isos = ["BRA", "FRA", "JPN", "GBR", "CAN", "AUS"]

    for iso in granular_isos:
        assert iso in by_iso, f"{iso} not found in map data"
        assert by_iso[iso]["has_granular_data"] is True, f"{iso} should have has_granular_data=True"

    for iso in macro_only_isos:
        assert iso in by_iso, f"{iso} not found in map data"
        assert by_iso[iso]["has_granular_data"] is False, f"{iso} should have has_granular_data=False"

    # Math parity with Phase 3 Dashboard KPIs
    res_kpi = client.get("/api/dashboard/kpis", headers=auth_headers)
    assert res_kpi.status_code == 200
    kpis = res_kpi.json()

    assert summary["total_global_trade"] == pytest.approx(kpis["total_trade_value"], rel=1e-5)
    assert summary["total_global_exports"] == pytest.approx(kpis["total_export"], rel=1e-5)
    assert summary["total_global_imports"] == pytest.approx(kpis["total_import"], rel=1e-5)
    assert summary["global_trade_balance"] == pytest.approx(kpis["trade_balance"], rel=1e-5)


def test_map_countries_year_filter(client, auth_headers):
    """Map query respects year filter (e.g. 2024)."""
    res_2024 = client.get("/api/map/countries?year=2024", headers=auth_headers)
    assert res_2024.status_code == 200
    data_2024 = res_2024.json()

    assert data_2024["year"] == 2024
    assert len(data_2024["countries"]) == 190
    assert data_2024["summary"]["countries_with_data"] == 139

    # Cross check with dashboard KPIs for 2024
    res_kpi_2024 = client.get("/api/dashboard/kpis?start_year=2024&end_year=2024", headers=auth_headers)
    assert res_kpi_2024.status_code == 200
    kpi_2024 = res_kpi_2024.json()

    assert data_2024["summary"]["total_global_trade"] == pytest.approx(kpi_2024["total_trade_value"], rel=1e-5)
    assert data_2024["summary"]["total_global_exports"] == pytest.approx(kpi_2024["total_export"], rel=1e-5)
    assert data_2024["summary"]["total_global_imports"] == pytest.approx(kpi_2024["total_import"], rel=1e-5)


def test_map_trade_balance_calculation(client, auth_headers):
    """Verify arithmetic trade balance calculation and status for all countries."""
    res = client.get("/api/map/countries?year=2023", headers=auth_headers)
    assert res.status_code == 200
    countries = res.json()["countries"]

    for c in countries:
        expected_bal = c["exports"] - c["imports"]
        assert c["trade_balance"] == pytest.approx(expected_bal, rel=1e-5)

        if c["total_trade"] == 0:
            assert c["trade_balance_status"] == "No Data"
        elif expected_bal > 0.01:
            assert c["trade_balance_status"] == "Trade Surplus"
        elif expected_bal < -0.01:
            assert c["trade_balance_status"] == "Trade Deficit"
        else:
            assert c["trade_balance_status"] == "Balanced Trade"
