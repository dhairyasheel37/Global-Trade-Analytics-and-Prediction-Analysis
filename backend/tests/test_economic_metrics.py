"""
Phase 14 Tests — Economic Metrics & Specialized Trade Indices
Tests the API endpoints under /api/economic-metrics:
- GET /api/economic-metrics/indices
- GET /api/economic-metrics/heatmap
- GET /api/economic-metrics/correlation-matrix
- GET /api/economic-metrics/bilateral-matrix
Validates auth enforcement, mathematical invariants (TBI bounds, GLI symmetry,
HHI formula, market share normalization, correlation matrix properties).
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


class TestEconomicMetricsAuth:
    def test_indices_requires_auth(self):
        res = client.get("/api/economic-metrics/indices")
        assert res.status_code == 401

    def test_heatmap_requires_auth(self):
        res = client.get("/api/economic-metrics/heatmap")
        assert res.status_code == 401

    def test_correlation_matrix_requires_auth(self):
        res = client.get("/api/economic-metrics/correlation-matrix")
        assert res.status_code == 401

    def test_bilateral_matrix_requires_auth(self):
        res = client.get("/api/economic-metrics/bilateral-matrix")
        assert res.status_code == 401


class TestEconomicIndicesCalculations:
    def test_indices_full_timeline(self, trader_headers):
        """
        Tests cumulative economic indices across all 190 nations:
        - 190 countries returned
        - Sum of export market shares equals ~100%
        - For every country, -100 <= TBI <= 100
        - For every country, 0 <= GLI <= 1
        - Mathematical invariant: GLI == 1 - |TBI|/100
        - HHI is positive and validly classified
        """
        res = client.get("/api/economic-metrics/indices", headers=trader_headers)
        assert res.status_code == 200
        data = res.json()

        assert data["countries_count"] == 190
        assert data["total_global_exports"] > 1e12
        assert data["total_global_imports"] > 1e12
        assert data["hhi_export_concentration"] > 0
        assert data["hhi_status"] in [
            "Unconcentrated / Competitive",
            "Moderately Concentrated",
            "Highly Concentrated",
        ]

        indices = data["indices"]
        assert len(indices) == 190

        # Market share sum check
        total_exp_share = sum(item["export_market_share"] for item in indices)
        assert total_exp_share == pytest.approx(100.0, abs=0.5)

        total_imp_share = sum(item["import_market_share"] for item in indices)
        assert total_imp_share == pytest.approx(100.0, abs=0.5)

        # Invariant checks for all countries
        for item in indices:
            tbi = item["tbi"]
            gli = item["gli"]
            rta = item["rta"]

            # TBI range [-100, +100]
            assert -100.0 <= tbi <= 100.0, f"TBI out of bounds for {item['reporter_iso']}: {tbi}"

            # GLI range [0.0, 1.0]
            assert 0.0 <= gli <= 1.0, f"GLI out of bounds for {item['reporter_iso']}: {gli}"

            # Mathematical symmetry invariant: GLI = 1 - |TBI|/100
            expected_gli = 1.0 - (abs(tbi) / 100.0)
            assert gli == pytest.approx(expected_gli, abs=1e-2)

            # RTA non-negative
            assert rta >= 0.0

    def test_indices_single_year(self, trader_headers):
        """Tests indices for a specific year (2022)."""
        res = client.get("/api/economic-metrics/indices?year=2022", headers=trader_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["year_label"] == "Year 2022"
        assert len(data["indices"]) >= 150
        assert data["countries_count"] == len(data["indices"])


class TestHeatmapMatrix:
    def test_heatmap_tbi_top10(self, trader_headers):
        """Top 10 TBI heatmap returns 10 countries with cells for each year."""
        res = client.get("/api/economic-metrics/heatmap?metric=tbi&preset=top10", headers=trader_headers)
        assert res.status_code == 200
        data = res.json()

        assert data["metric"] == "tbi"
        assert data["color_scale_type"] == "diverging"
        assert len(data["years"]) >= 10
        assert len(data["countries"]) == 10

        # Each country must have cells matching len(years)
        for crow in data["countries"]:
            assert len(crow["cells"]) == len(data["years"])
            for cell in crow["cells"]:
                assert -100.0 <= cell["value"] <= 100.0

    def test_heatmap_metric_channels(self, trader_headers):
        """Tests various metric channels: rta, export_share, trade_balance, growth_rate."""
        for m in ["rta", "export_share", "trade_balance", "growth_rate"]:
            res = client.get(f"/api/economic-metrics/heatmap?metric={m}&preset=top10", headers=trader_headers)
            assert res.status_code == 200
            data = res.json()
            assert data["metric"] == m
            assert len(data["countries"]) == 10

    def test_heatmap_invalid_metric_returns_400(self, trader_headers):
        res = client.get("/api/economic-metrics/heatmap?metric=invalid_channel", headers=trader_headers)
        assert res.status_code == 400


class TestCorrelationMatrix:
    def test_correlation_matrix_properties(self, admin_headers):
        """
        Tests Pearson correlation matrix:
        - Matrix size is K x K
        - Diagonal elements r[i][i] == 1.0
        - Matrix is symmetric r[i][j] == r[j][i]
        - All values in [-1.0, 1.0]
        """
        res = client.get("/api/economic-metrics/correlation-matrix?preset=top10", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()

        countries = data["countries"]
        matrix = data["matrix"]
        k = len(countries)
        assert k == 10
        assert len(matrix) == k

        for i in range(k):
            assert len(matrix[i]) == k
            # Diagonal element must be 1.0
            assert matrix[i][i] == pytest.approx(1.0, abs=1e-3)

            for j in range(k):
                val = matrix[i][j]
                assert -1.0 <= val <= 1.0
                # Symmetry
                assert matrix[i][j] == pytest.approx(matrix[j][i], abs=1e-3)


class TestBilateralMatrix:
    def test_bilateral_matrix_properties(self, trader_headers):
        """
        Tests bilateral comparative matrix:
        - Diagonal gap is 0.0 (Bal_A - Bal_A = 0)
        - Antisymmetry: Gap(A, B) == -Gap(B, A)
        - Pairs list populated
        """
        res = client.get("/api/economic-metrics/bilateral-matrix?countries=USA,CHN,DEU,IND", headers=trader_headers)
        assert res.status_code == 200
        data = res.json()

        countries = data["countries"]
        matrix = data["matrix"]
        k = len(countries)
        assert k == 4

        for i in range(k):
            assert matrix[i][i] == pytest.approx(0.0, abs=1e-2)
            for j in range(k):
                assert matrix[i][j] == pytest.approx(-matrix[j][i], abs=1e-2)

        # 4 * 3 = 12 non-diagonal pairs
        assert len(data["pairs"]) == 12
