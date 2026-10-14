"""
Tests for UN Comtrade Live Data Sync Engine and Scheduler.
Covers authentication, authorization, normalization, deduplication,
configuration updates, and audit logging.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import DataSyncLog, TradeRecordV2, TradeRecord, Country, Product
from app.services.comtrade_client import ComtradeAPIClient
from app.services.sync_service import sync_service

client = TestClient(app)


@pytest.fixture
def admin_token():
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@Trade2026!"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture
def user_token():
    resp = client.post("/api/auth/login", json={"username": "trader", "password": "Trader@Trade2026!"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def test_sync_status_requires_auth():
    """Unauthenticated access should return 401."""
    resp = client.get("/api/admin/data/sync/status")
    assert resp.status_code == 401


def test_sync_status_requires_admin(user_token):
    """Non-admin user access should return 403."""
    headers = {"Authorization": f"Bearer {user_token}"}
    resp = client.get("/api/admin/data/sync/status", headers=headers)
    assert resp.status_code == 403


def test_sync_status_admin_success(admin_token):
    """Admin access returns valid sync status and logs."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = client.get("/api/admin/data/sync/status", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "is_running" in data
    assert "status" in data
    assert "scheduler_enabled" in data
    assert "sync_interval_hours" in data
    assert "recent_logs" in data
    assert isinstance(data["recent_logs"], list)


def test_sync_config_update(admin_token):
    """Admin can toggle scheduler and adjust interval hours."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {"scheduler_enabled": False, "sync_interval_hours": 12}
    resp = client.post("/api/admin/data/sync/config", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["scheduler_enabled"] is False
    assert data["sync_interval_hours"] == 12

    # Re-enable scheduler
    payload2 = {"scheduler_enabled": True, "sync_interval_hours": 24}
    resp2 = client.post("/api/admin/data/sync/config", json=payload2, headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["scheduler_enabled"] is True


def test_comtrade_client_normalization():
    """Verifies ComtradeAPIClient correctly normalizes raw JSON payloads."""
    client_instance = ComtradeAPIClient()
    raw = {
        "period": 2024,
        "reporterISO": "IND",
        "reporterDesc": "India",
        "partnerISO": "USA",
        "partnerDesc": "USA",
        "flowCode": "M",
        "cmdCode": "30",
        "primaryValue": 1234567.89,
        "cifvalue": 1234500.0,
        "fobvalue": 1200000.0,
        "qty": 500.0,
        "netWgt": 450.0,
    }
    norm = client_instance.normalize_record(raw)
    assert norm is not None
    assert norm["refYear"] == 2024
    assert norm["reporterISO"] == "IND"
    assert norm["partnerISO"] == "USA"
    assert norm["flowCode"] == "M"
    assert norm["flowDesc"] == "Import"
    assert norm["cmdCode"] == "30"
    assert norm["primaryValue"] == 1234567.89
    assert norm["source"] == "UN_COMTRADE_API_V1"


def test_sync_service_ingest_and_deduplication():
    """
    Verifies that ingest_records inserts new rows and cleanly
    skips duplicate rows on subsequent ingestion.
    """
    db = SessionLocal()
    log1_id = None
    log2_id = None
    try:
        sample_records = [
            {
                "refYear": 2098,  # Future test year
                "reporterISO": "IND",
                "reporterDesc": "India",
                "partnerISO": "W00",
                "partnerDesc": "World",
                "flowCode": "X",
                "flowDesc": "Export",
                "cmdCode": "TOTAL",
                "cmdDesc": "All Commodities",
                "primaryValue": 99999999.0,
            }
        ]

        # First ingestion -> Should insert 1 record
        log1 = sync_service.ingest_records(db, sample_records, sync_type="API_PULL")
        log1_id = log1.id
        assert log1.status == "SUCCESS"
        assert log1.records_inserted == 1
        assert log1.records_skipped == 0

        # Second ingestion with identical key -> Should skip (deduplicate)
        log2 = sync_service.ingest_records(db, sample_records, sync_type="API_PULL")
        log2_id = log2.id
        assert log2.status == "SUCCESS"
        assert log2.records_inserted == 0
        assert log2.records_skipped == 1

    finally:
        # Cleanup test records guaranteed
        rep = db.query(Country).filter(Country.iso_code == "IND").first()
        part = db.query(Country).filter(Country.iso_code == "W00").first()
        prod = db.query(Product).filter(Product.product_code == "TOTAL").first()
        if rep and part and prod:
            db.query(TradeRecordV2).filter(
                TradeRecordV2.year == 2098,
                TradeRecordV2.reporter_id == rep.country_id,
                TradeRecordV2.partner_id == part.country_id,
                TradeRecordV2.product_id == prod.product_id,
                TradeRecordV2.flow_code == "X",
            ).delete()
        db.query(TradeRecord).filter(TradeRecord.refYear == 2098).delete()
        if log1_id:
            db.query(DataSyncLog).filter(DataSyncLog.id == log1_id).delete()
        if log2_id:
            db.query(DataSyncLog).filter(DataSyncLog.id == log2_id).delete()
        db.commit()
        db.close()


@patch.object(ComtradeAPIClient, "fetch_trade_data", new_callable=AsyncMock)
def test_sync_trigger_endpoint_with_mock(mock_fetch, admin_token):
    """
    Tests POST /api/admin/data/sync/trigger with mocked ComtradeAPIClient.
    """
    mock_fetch.return_value = [
        {
            "refYear": 2099,
            "reporterISO": "DEU",
            "reporterDesc": "Germany",
            "partnerISO": "W00",
            "partnerDesc": "World",
            "flowCode": "M",
            "flowDesc": "Import",
            "cmdCode": "TOTAL",
            "cmdDesc": "All Commodities",
            "primaryValue": 55555555.0,
        }
    ]

    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {"reporters": ["DEU"], "years": [2099]}
    resp = client.post("/api/admin/data/sync/trigger", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "Sync completed successfully" in data["message"]

    # Guaranteed clean up test row
    db = SessionLocal()
    try:
        rep = db.query(Country).filter(Country.iso_code == "DEU").first()
        part = db.query(Country).filter(Country.iso_code == "W00").first()
        prod = db.query(Product).filter(Product.product_code == "TOTAL").first()
        if rep and part and prod:
            db.query(TradeRecordV2).filter(
                TradeRecordV2.year == 2099,
                TradeRecordV2.reporter_id == rep.country_id,
                TradeRecordV2.partner_id == part.country_id,
                TradeRecordV2.product_id == prod.product_id,
                TradeRecordV2.flow_code == "M",
            ).delete()
        db.query(TradeRecord).filter(TradeRecord.refYear == 2099).delete()
        if data.get("log_id"):
            db.query(DataSyncLog).filter(DataSyncLog.id == data["log_id"]).delete()
        db.commit()
    finally:
        db.close()

