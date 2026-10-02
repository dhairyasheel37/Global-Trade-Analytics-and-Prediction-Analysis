"""
Phase 11 Tests — About Project & Dataset Stats Module
Tests access control, user/admin accessibility, and live dynamic figures matching DB.
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


class TestAboutDatasetStats:
    def test_about_requires_auth(self):
        """Unauthenticated requests must return 401."""
        res = client.get("/api/about/dataset-stats")
        assert res.status_code == 401
        assert "token" in res.json()["detail"].lower()

    def test_about_allowed_for_trader_user_role(self, trader_headers):
        """Standard USER role can access dataset stats."""
        res = client.get("/api/about/dataset-stats", headers=trader_headers)
        assert res.status_code == 200
        data = res.json()
        assert "total_records" in data
        assert "year_range" in data
        assert "reporter_count" in data

    def test_about_allowed_for_admin_role(self, admin_headers):
        """ADMIN role can access dataset stats."""
        res = client.get("/api/about/dataset-stats", headers=admin_headers)
        assert res.status_code == 200

    def test_about_dataset_stats_matches_db_reality(self, trader_headers):
        """Dynamic values must match database reality."""
        res = client.get("/api/about/dataset-stats", headers=trader_headers)
        assert res.status_code == 200
        data = res.json()

        assert data["total_records"] == 3925
        assert data["year_range"]["start_year"] == 2014
        assert data["year_range"]["end_year"] == 2025
        assert data["reporter_count"] == 190
        assert data["flow_count"] == 2
        assert data["product_count"] == 1
        assert data["partner_count"] == 1
