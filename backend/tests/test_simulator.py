"""
Unit and Integration Tests for Scenario Simulator & Tariff Impact Engine.
Validates econometric formulas, tariff shocks, trade liberalization,
revenue calculation bounds, flow diversions, and API endpoints.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.services.simulation_engine import simulation_engine
from app.schemas import SimulationRequest

client = TestClient(app)


@pytest.fixture
def auth_headers():
    resp = client.post("/api/auth/login", json={"username": "trader", "password": "Trader@Trade2026!"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_simulator_requires_auth():
    """Unauthenticated calls should return 401 Unauthorized."""
    resp = client.get("/api/simulator/presets")
    assert resp.status_code == 401

    resp_run = client.post("/api/simulator/run", json={"reporter_iso": "USA", "tariff_pct": 10.0})
    assert resp_run.status_code == 401


def test_simulator_presets_endpoint(auth_headers):
    """Verifies retrieval of curated geopolitical policy presets."""
    resp = client.get("/api/simulator/presets", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 4

    preset_ids = [p["id"] for p in data]
    assert "us_china_tariff_25" in preset_ids
    assert "global_tech_slump" in preset_ids
    assert "eu_cbam_tariff" in preset_ids
    assert "india_us_deal" in preset_ids

    # Validate structure of the first preset
    first = data[0]
    assert "title" in first
    assert "badge" in first
    assert "tariff_pct" in first
    assert "suggested_elasticity" in first


def test_simulator_elasticities_endpoint(auth_headers):
    """Verifies retrieval of standard sector price elasticities."""
    resp = client.get("/api/simulator/elasticities", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 5

    codes = [e["product_code"] for e in data]
    assert "TOTAL" in codes
    assert "30" in codes
    assert "84" in codes
    assert "85" in codes
    assert "87" in codes

    # Total should have -1.20 default elasticity
    total_item = next(e for e in data if e["product_code"] == "TOTAL")
    assert total_item["default_elasticity"] == -1.20
    assert total_item["substitution_elasticity"] > 0


def test_simulation_run_tariff_shock(auth_headers):
    """
    Tests simulation of a positive tariff hike (e.g. +25% on electronics).
    Expectations:
    - Imports contract (simulated < baseline)
    - Tariff revenue is positive
    - Trade balance delta is positive (deficit contracts)
    """
    payload = {
        "reporter_iso": "USA",
        "partner_iso": "CHN",
        "product_code": "85",
        "tariff_pct": 25.0,
        "demand_shock_pct": 0.0,
        "price_elasticity": -1.50,
        "diversion_rate": 0.40,
        "projection_horizon_years": 3,
    }
    resp = client.post("/api/simulator/run", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    result = resp.json()

    baseline = result["baseline"]
    shock = result["shock_impact"]

    assert baseline["reporter_iso"] == "USA"
    assert baseline["product_code"] == "85"
    assert baseline["baseline_imports"] > 0

    # Contraction in imports
    assert shock["simulated_imports"] < baseline["baseline_imports"]
    assert shock["import_delta_pct"] < 0
    assert shock["import_delta_value"] < 0

    # Customs revenue generated
    assert shock["annual_tariff_revenue"] > 0
    expected_rev = 0.25 * shock["simulated_imports"]
    assert pytest.approx(shock["annual_tariff_revenue"], rel=1e-3) == expected_rev

    # Trade balance improvement
    assert shock["trade_balance_delta"] > 0

    # Trade volume lost and diverted
    assert shock["trade_volume_lost"] > 0
    assert shock["total_diverted_volume"] > 0
    assert pytest.approx(shock["total_diverted_volume"], rel=1e-3) == shock["trade_volume_lost"] * 0.40

    # Executive summary
    summary = result["executive_summary"]
    assert "headline" in summary
    assert len(summary["key_findings"]) >= 2


def test_simulation_run_zero_shock(auth_headers):
    """
    Tests that a 0% tariff and 0% demand shock leaves imports and trade balance unchanged,
    with zero tariff revenue.
    """
    payload = {
        "reporter_iso": "USA",
        "partner_iso": "W00",
        "product_code": "TOTAL",
        "tariff_pct": 0.0,
        "demand_shock_pct": 0.0,
    }
    resp = client.post("/api/simulator/run", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    result = resp.json()

    baseline = result["baseline"]
    shock = result["shock_impact"]

    assert pytest.approx(shock["simulated_imports"], rel=1e-4) == baseline["baseline_imports"]
    assert shock["annual_tariff_revenue"] == 0.0
    assert pytest.approx(shock["import_delta_pct"], abs=1e-3) == 0.0
    assert shock["trade_volume_lost"] == 0.0


def test_simulation_run_trade_liberalization(auth_headers):
    """
    Tests negative tariff (tariff cut / liberalization).
    Expectations:
    - Imports expand (simulated > baseline)
    - Tariff revenue is 0.0 (no duties collected)
    """
    payload = {
        "reporter_iso": "IND",
        "partner_iso": "USA",
        "product_code": "30",
        "tariff_pct": -10.0,
        "demand_shock_pct": 0.0,
        "price_elasticity": -0.65,
    }
    resp = client.post("/api/simulator/run", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    result = resp.json()

    baseline = result["baseline"]
    shock = result["shock_impact"]

    assert shock["simulated_imports"] > baseline["baseline_imports"]
    assert shock["import_delta_pct"] > 0
    assert shock["annual_tariff_revenue"] == 0.0


def test_simulation_run_prohibitive_tariff_boundary(auth_headers):
    """
    Tests extreme boundary condition (100% tariff).
    Must not crash, must not produce negative trade values.
    """
    payload = {
        "reporter_iso": "DEU",
        "partner_iso": "W00",
        "product_code": "84",
        "tariff_pct": 100.0,
        "demand_shock_pct": -20.0,
    }
    resp = client.post("/api/simulator/run", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    result = resp.json()

    shock = result["shock_impact"]
    assert shock["simulated_imports"] >= 0.0
    assert shock["trade_volume_lost"] > 0.0
    assert shock["annual_tariff_revenue"] > 0.0


def test_simulation_trajectory_and_sensitivity_curves(auth_headers):
    """
    Verifies multi-year trajectory has both historical and projection points,
    and sensitivity curve contains all expected tariff tiers.
    """
    payload = {
        "reporter_iso": "USA",
        "partner_iso": "CHN",
        "product_code": "TOTAL",
        "tariff_pct": 15.0,
        "projection_horizon_years": 4,
    }
    resp = client.post("/api/simulator/run", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    result = resp.json()

    # Trajectory
    trajectory = result["trajectory"]
    assert len(trajectory) >= 5
    hist_points = [p for p in trajectory if not p["is_projection"]]
    proj_points = [p for p in trajectory if p["is_projection"]]
    assert len(hist_points) > 0
    assert len(proj_points) == 4

    # Sensitivity curve
    curve = result["sensitivity_curve"]
    assert len(curve) == 9  # [0, 5, 10, 15, 20, 25, 30, 40, 50]
    tariffs = [c["tariff_pct"] for c in curve]
    assert 0.0 in tariffs
    assert 25.0 in tariffs
    assert 50.0 in tariffs
    # At 0% tariff, revenue must be 0
    assert curve[0]["tariff_revenue"] == 0.0
