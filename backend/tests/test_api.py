import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoint(client):
    """Test health endpoint returns 200 and connected database status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert data["database"] == "connected"
    assert "timestamp" in data
    assert data["total_records"] >= 0


def test_data_summary_endpoint(client):
    """Test summary endpoint returns valid dynamic aggregate values matching dataset."""
    response = client.get("/api/data/summary")
    assert response.status_code == 200
    data = response.json()

    assert data["total_records"] == 3925
    assert data["year_range"]["min"] == 2014
    assert data["year_range"]["max"] == 2025

    assert data["unique_counts"]["reporters"] == 190
    assert data["unique_counts"]["partners"] == 1
    assert data["unique_counts"]["products"] == 1
    assert data["unique_counts"]["flows"] == 2

    # Verify missing value counts
    assert data["missing_values"]["qty"] == 543
    assert data["missing_values"]["netWgt"] == 1922
    assert data["missing_values"]["grossWgt"] == 969
    assert data["missing_values"]["cifvalue"] == 1628
    assert data["missing_values"]["fobvalue"] == 1365
    assert data["missing_values"]["primaryValue"] == 0

    assert data["exact_duplicate_count"] == 0
    assert data["negative_value_count"] == 0


def test_data_sample_endpoint(client):
    """Test sample endpoint returns correct count and pagination."""
    # Test default limit
    response = client.get("/api/data/sample?limit=20")
    assert response.status_code == 200
    data = response.json()
    assert data["total_records"] == 3925
    assert data["limit"] == 20
    assert data["offset"] == 0
    assert data["returned_count"] == 20
    assert len(data["records"]) == 20

    # Test record fields
    first_record = data["records"][0]
    assert "refYear" in first_record
    assert "reporterISO" in first_record
    assert "flowCode" in first_record
    assert "primaryValue" in first_record
    assert first_record["primaryValue"] > 0

    # Test pagination
    response_offset = client.get("/api/data/sample?limit=5&offset=5")
    assert response_offset.status_code == 200
    data_offset = response_offset.json()
    assert data_offset["limit"] == 5
    assert data_offset["offset"] == 5
    assert data_offset["returned_count"] == 5
    assert data_offset["records"][0]["id"] == data["records"][5]["id"]


def test_data_sample_limit_validation(client):
    """Test limit validation bounds."""
    # Invalid limit (0 or negative)
    res_low = client.get("/api/data/sample?limit=0")
    assert res_low.status_code == 422

    # Limit exceeding max allowed
    res_high = client.get("/api/data/sample?limit=1000")
    assert res_high.status_code == 422
