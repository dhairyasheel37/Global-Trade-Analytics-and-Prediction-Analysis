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


def test_comparison_requires_auth(client):
    """Country comparison endpoint must return 401 when unauthenticated."""
    res = client.get("/api/country-comparison?countryA=IND&countryB=USA")
    assert res.status_code == 401


def test_comparison_missing_parameters_returns_400(client, auth_headers):
    """Missing or empty countryA or countryB must return 400 Bad Request."""
    res = client.get("/api/country-comparison", headers=auth_headers)
    assert res.status_code == 422 or res.status_code == 400

    res_empty_a = client.get("/api/country-comparison?countryA=&countryB=USA", headers=auth_headers)
    assert res_empty_a.status_code == 400

    res_empty_b = client.get("/api/country-comparison?countryA=IND&countryB=", headers=auth_headers)
    assert res_empty_b.status_code == 400


def test_same_country_selected_twice_returns_400(client, auth_headers):
    """Same country selected twice must return 400 Bad Request with clear message."""
    res = client.get("/api/country-comparison?countryA=IND&countryB=IND", headers=auth_headers)
    assert res.status_code == 400
    assert "different countries" in res.json()["detail"]

    # Also test case-insensitive / ISO vs Name for same country
    res_case = client.get("/api/country-comparison?countryA=ind&countryB=IND", headers=auth_headers)
    assert res_case.status_code == 400

    res_name = client.get("/api/country-comparison?countryA=IND&countryB=India", headers=auth_headers)
    assert res_name.status_code == 400


def test_invalid_country_returns_404(client, auth_headers):
    """Unknown country code/name must return 404 Not Found."""
    res = client.get("/api/country-comparison?countryA=XYZ999&countryB=USA", headers=auth_headers)
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_comparison_ind_vs_usa(client, auth_headers):
    """
    Macroeconomic head-to-head comparison between India and USA.
    """
    res = client.get("/api/country-comparison?countryA=IND&countryB=USA", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    # Country A (IND)
    assert data["countryA"]["iso"] == "IND"
    assert data["countryA"]["exports"] > 0
    assert data["countryA"]["imports"] > 0
    assert data["countryA"]["totalTrade"] > 0
    assert len(data["countryA"]["yearly"]) > 0

    # Country B (USA)
    assert data["countryB"]["iso"] == "USA"
    assert data["countryB"]["exports"] > 0
    assert data["countryB"]["imports"] > 0
    assert data["countryB"]["totalTrade"] > 0
    assert len(data["countryB"]["yearly"]) > 0

    # Difference metrics (Country A - Country B)
    diff = data["difference"]
    assert diff["direction"] == "Country A - Country B"
    assert round(diff["exportsDiff"], 2) == round(data["countryA"]["exports"] - data["countryB"]["exports"], 2)
    assert round(diff["importsDiff"], 2) == round(data["countryA"]["imports"] - data["countryB"]["imports"], 2)
    assert round(diff["totalTradeDiff"], 2) == round(data["countryA"]["totalTrade"] - data["countryB"]["totalTrade"], 2)
    assert round(diff["tradeBalanceDiff"], 2) == round(data["countryA"]["tradeBalance"] - data["countryB"]["tradeBalance"], 2)


def test_comparison_chn_vs_deu(client, auth_headers):
    """
    Macroeconomic comparison between China and Germany.
    """
    res = client.get("/api/country-comparison?countryA=CHN&countryB=DEU", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["countryA"]["iso"] == "CHN"
    assert data["countryA"]["totalTrade"] > 0
    assert data["countryB"]["iso"] == "DEU"
    assert data["countryB"]["totalTrade"] > 0
    assert len(data["countryA"]["yearly"]) > 0
    assert len(data["countryB"]["yearly"]) > 0


def test_comparison_ind_vs_bra(client, auth_headers):
    """
    Macroeconomic comparison between India and Brazil across pure baseline dataset.
    """
    res = client.get("/api/country-comparison?countryA=IND&countryB=BRA", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["countryA"]["iso"] == "IND"
    assert data["countryA"]["totalTrade"] > 0
    assert data["countryB"]["iso"] == "BRA"
    assert data["countryB"]["totalTrade"] > 0
    assert len(data["countryA"]["yearly"]) > 0
    assert len(data["countryB"]["yearly"]) > 0


def test_comparison_bra_vs_fra(client, auth_headers):
    """
    Macroeconomic comparison between Brazil and France.
    """
    res = client.get("/api/country-comparison?countryA=BRA&countryB=FRA", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["countryA"]["iso"] == "BRA"
    assert data["countryA"]["totalTrade"] > 0
    assert data["countryB"]["iso"] == "FRA"
    assert data["countryB"]["totalTrade"] > 0
    assert len(data["countryA"]["yearly"]) > 0
    assert len(data["countryB"]["yearly"]) > 0


def test_swap_symmetry(client, auth_headers):
    """
    Country swap (A <-> B) inverts difference metrics exactly.
    """
    res_ab = client.get("/api/country-comparison?countryA=IND&countryB=USA", headers=auth_headers)
    res_ba = client.get("/api/country-comparison?countryA=USA&countryB=IND", headers=auth_headers)
    assert res_ab.status_code == 200
    assert res_ba.status_code == 200

    ab = res_ab.json()
    ba = res_ba.json()

    # Country objects swap
    assert ab["countryA"]["iso"] == ba["countryB"]["iso"]
    assert ab["countryB"]["iso"] == ba["countryA"]["iso"]

    # Difference signs invert
    assert round(ab["difference"]["exportsDiff"] + ba["difference"]["exportsDiff"], 1) == 0.0
    assert round(ab["difference"]["importsDiff"] + ba["difference"]["importsDiff"], 1) == 0.0
    assert round(ab["difference"]["totalTradeDiff"] + ba["difference"]["totalTradeDiff"], 1) == 0.0
    assert round(ab["difference"]["tradeBalanceDiff"] + ba["difference"]["tradeBalanceDiff"], 1) == 0.0


def test_year_range_filtering(client, auth_headers):
    """Comparison respects start_year and end_year filters."""
    res_full = client.get("/api/country-comparison?countryA=IND&countryB=USA", headers=auth_headers)
    res_filt = client.get("/api/country-comparison?countryA=IND&countryB=USA&start_year=2020&end_year=2023", headers=auth_headers)
    assert res_full.status_code == 200
    assert res_filt.status_code == 200

    full_trade_a = res_full.json()["countryA"]["totalTrade"]
    filt_trade_a = res_filt.json()["countryA"]["totalTrade"]
    assert filt_trade_a < full_trade_a
    assert len(res_filt.json()["countryA"]["yearly"]) <= 4
