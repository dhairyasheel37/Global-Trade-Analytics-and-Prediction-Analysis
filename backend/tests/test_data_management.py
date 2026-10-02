"""
Phase 9 Tests — Data Management Admin Endpoints

Each upload test is fully self-contained: it uses a function-scoped
clean_test_rows fixture that wipes refYear=2099 rows before AND after the
test. This guarantees the shared SQLite DB is restored to 3925 rows
immediately after each test, regardless of run order or failure.
"""
import io
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "trade_data.db"
TEST_YEAR = 2099  # Sentinel year never present in the original 2014-2025 dataset


# ── Cleanup fixture ───────────────────────────────────────────────────────────

def _delete_test_rows() -> int:
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute(f"DELETE FROM trade_records WHERE refYear = {TEST_YEAR}")
    n = cur.rowcount
    conn.commit()
    conn.close()
    return n


@pytest.fixture()
def clean_test_rows():
    """Delete test rows before the test starts and again after it ends."""
    _delete_test_rows()
    yield
    _delete_test_rows()


# ── Auth helpers ──────────────────────────────────────────────────────────────

def _login(u: str, p: str) -> str:
    r = client.post("/api/auth/login", json={"username": u, "password": p})
    assert r.status_code == 200
    return r.json()["access_token"]

def _admin_h() -> dict:
    return {"Authorization": f"Bearer {_login('admin', 'Admin@Trade2026!')}"}

def _trader_h() -> dict:
    return {"Authorization": f"Bearer {_login('trader', 'Trader@Trade2026!')}"}


# ── CSV test data ─────────────────────────────────────────────────────────────

_HDR = (
    "refYear,reporterISO,reporterDesc,partnerISO,partnerDesc,"
    "flowCode,flowDesc,cmdCode,cmdDesc,aggrLevel,isLeaf,"
    "qty,netWgt,grossWgt,cifvalue,fobvalue,primaryValue,tradeValue"
)
_NEW1   = f"{TEST_YEAR},TST,TestCountryA,W00,World,X,Export,TOTAL,All Commodities,0,False,,,,,,9999000000.0,9999000000.0"
_NEW2   = f"{TEST_YEAR},TS2,TestCountryB,W00,World,M,Import,TOTAL,All Commodities,0,False,,,,,,8888000000.0,8888000000.0"
_EXIST  = "2014,USA,USA,W00,World,X,Export,TOTAL,All Commodities,0,False,,,,,,1619742863865.0,1619742863865.0"
_BADFL  = f"{TEST_YEAR},TST,TestCountryA,W00,World,Z,BadFlow,TOTAL,All Commodities,0,False,,,,,,1000.0,1000.0"
_BADNUM = f"{TEST_YEAR},TS3,TestCountryC,W00,World,X,Export,TOTAL,All Commodities,0,False,,,,,, not_a_number,0"
_BADYR  = "9999,TST,TestCountryA,W00,World,X,Export,TOTAL,All Commodities,0,False,,,,,,5000.0,5000.0"


def _csv(*rows) -> bytes:
    return "\n".join([_HDR] + list(rows)).encode("utf-8")

def _mixed_csv() -> bytes:
    return _csv(_NEW1, _NEW2, _EXIST, _BADFL, _BADNUM, _BADYR)

def _upload(csv_bytes: bytes, name: str = "test.csv"):
    return client.post(
        "/api/admin/data/upload",
        headers=_admin_h(),
        files={"file": (name, io.BytesIO(csv_bytes), "text/csv")},
    )


# ── Overview Auth ─────────────────────────────────────────────────────────────

def test_overview_requires_auth():
    r = client.get("/api/admin/data/overview")
    assert r.status_code == 401

def test_overview_rejects_user_role():
    r = client.get("/api/admin/data/overview", headers=_trader_h())
    assert r.status_code == 403

def test_overview_returns_200_for_admin():
    r = client.get("/api/admin/data/overview", headers=_admin_h())
    assert r.status_code == 200


# ── Overview Content ──────────────────────────────────────────────────────────

def test_overview_structure_and_values():
    r = client.get("/api/admin/data/overview", headers=_admin_h())
    assert r.status_code == 200
    d = r.json()
    assert d["record_count"] >= 3925
    assert d["column_count"] == 18           # len(ALL_TRACKED_COLUMNS) in data_management.py
    assert d["year_range"]["min"] == 2014
    assert d["year_range"]["max"] >= 2025
    assert d["unique_reporters"] >= 190
    assert d["unique_partners"] >= 1
    assert d["unique_products"] >= 1
    assert d["unique_flows"] == 2
    assert isinstance(d["missing_values"], dict)
    assert d["missing_values"].get("primaryValue", 0) == 0
    qs = d["data_quality_summary"]
    assert qs["health_status"] in ("GOOD", "WARNINGS", "ISSUES")
    assert isinstance(qs["has_duplicates"], bool)


# ── Upload Auth ───────────────────────────────────────────────────────────────

def test_upload_requires_auth():
    r = client.post(
        "/api/admin/data/upload",
        files={"file": ("test.csv", io.BytesIO(_csv(_NEW1)), "text/csv")},
    )
    assert r.status_code == 401

def test_upload_rejects_user_role():
    r = client.post(
        "/api/admin/data/upload",
        headers=_trader_h(),
        files={"file": ("test.csv", io.BytesIO(_csv(_NEW1)), "text/csv")},
    )
    assert r.status_code == 403


# ── Upload Validation ─────────────────────────────────────────────────────────

def test_rejects_non_csv_file():
    r = client.post(
        "/api/admin/data/upload",
        headers=_admin_h(),
        files={"file": ("data.xlsx", io.BytesIO(b"fake"), "application/vnd.ms-excel")},
    )
    assert r.status_code == 400
    assert "csv" in r.json()["detail"].lower()

def test_rejects_missing_required_columns():
    bad_csv = b"refYear,reporterISO\n2099,TST\n"
    r = client.post(
        "/api/admin/data/upload",
        headers=_admin_h(),
        files={"file": ("bad.csv", io.BytesIO(bad_csv), "text/csv")},
    )
    assert r.status_code == 400
    assert "missing required columns" in r.json()["detail"].lower()


# ── Upload Behavior: mixed CSV (first upload) ─────────────────────────────────

def test_upload_mixed_csv_counts(clean_test_rows):
    """
    6-row CSV: 2 valid new + 1 existing duplicate + 3 invalid rows.
    Expected: 2 inserted, 1 skipped, 3 rejected.
    The clean_test_rows fixture guarantees no 2099 rows exist before this test.
    """
    r = _upload(_mixed_csv(), "mixed_test.csv")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["records_read"] == 6
    assert d["new_records_inserted"] == 2
    assert d["existing_records_skipped"] == 1
    assert d["invalid_records_rejected"] == 3
    assert d["success"] is True
    assert len(d["rejection_details"]) >= 1   # at least 1 rejection reason


def test_upload_rejection_details_populated(clean_test_rows):
    """Rejection details list must have one entry per distinct rejection reason."""
    r = _upload(_mixed_csv(), "mixed_test.csv")
    assert r.status_code == 200
    details = r.json()["rejection_details"]
    # We have 3 distinct invalid rows → 3 distinct reason entries
    assert len(details) == 3
    reasons = [d["reason"] for d in details]
    assert any("invalid_flow_code" in rr for rr in reasons)
    assert any("non_numeric_primaryValue" in rr for rr in reasons)
    assert any("invalid_year" in rr for rr in reasons)


def test_upload_db_rows_inserted_correctly(clean_test_rows):
    """After upload, exactly 2 rows with refYear=TEST_YEAR must exist."""
    _upload(_mixed_csv(), "mixed_test.csv")
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute(f"SELECT reporterISO, flowCode FROM trade_records WHERE refYear={TEST_YEAR} ORDER BY reporterISO")
    rows = cur.fetchone(), cur.fetchone()  # exactly 2 expected
    remaining = cur.fetchone()
    conn.close()
    assert rows[0] is not None and rows[1] is not None
    assert remaining is None   # exactly 2, not 3+
    isos = {rows[0][0], rows[1][0]}
    assert isos == {"TS2", "TST"}


def test_upload_does_not_touch_existing_rows(clean_test_rows):
    """The USA/2014/X row must remain exactly 1 after upload (not duplicated or modified)."""
    _upload(_mixed_csv(), "mixed_test.csv")
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM trade_records WHERE reporterISO='USA' AND refYear=2014 AND flowCode='X'")
    count = cur.fetchone()[0]
    conn.close()
    assert count == 1


# ── Upload Behavior: idempotency (re-upload = all skipped) ───────────────────

def test_reupload_yields_zero_new_inserts(clean_test_rows):
    """
    Upload the mixed CSV once (inserts 2 rows), then upload the same file again.
    Second upload must produce 0 new inserts — the 2 new rows are now existing.
    """
    headers = _admin_h()

    # First upload
    r1 = client.post("/api/admin/data/upload", headers=headers,
                     files={"file": ("mixed.csv", io.BytesIO(_mixed_csv()), "text/csv")})
    assert r1.status_code == 200
    assert r1.json()["new_records_inserted"] == 2

    # Second upload (same file)
    r2 = client.post("/api/admin/data/upload", headers=headers,
                     files={"file": ("mixed.csv", io.BytesIO(_mixed_csv()), "text/csv")})
    assert r2.status_code == 200
    d = r2.json()
    assert d["new_records_inserted"] == 0, (
        f"Expected 0 new inserts on re-upload, got {d['new_records_inserted']}"
    )
    assert d["existing_records_skipped"] == 3   # 2 prev-new + 1 original existing
    assert d["invalid_records_rejected"] == 3


# ── Strict Metric-Selection Rules Verification ────────────────────────────────

def test_overview_strict_metric_rules():
    r = client.get("/api/admin/data/overview", headers=_admin_h())
    assert r.status_code == 200
    d = r.json()

    # Rule 1: Total Active Records = 4,877 (3,925 baseline + 952 granular)
    assert d["total_active_records"] == 4877
    assert d["record_count"] == 4877

    # Rule 2: Baseline Records = 3,925
    assert d["baseline_records"] == 3925

    # Rule 3: Granular Bilateral Records = 952 (partner != W00 AND product != TOTAL)
    assert d["granular_bilateral_records"] == 952

    # Rule 4 & 5 & 6: Reporters = 190 (4 granular + 186 aggregate-only)
    assert d["unique_reporters"] == 190
    assert d["granular_reporter_count"] == 4
    assert sorted(d["granular_reporters"]) == ["China", "Germany", "India", "USA"]
    assert d["aggregate_only_reporter_count"] == 186

    # Rule 7: Trade Flows = 2
    assert d["unique_flows"] == 2

    # Rule 8: Granular Partners = 5 (excluding World/W00)
    assert d["granular_partner_count"] == 5

    # Rule 9 & 10: Granular Products = 4 (excluding TOTAL)
    assert d["granular_product_count"] == 4

    # Rule 12: Year Range = 2014–2025
    assert d["year_range"]["min"] == 2014
    assert d["year_range"]["max"] == 2025

    # Rule 13 & 14 & 15: Missing values and active-dataset cell math
    assert d["total_active_cells"] == 87786  # 4,877 * 18
    assert d["missing_values"]["qty"] == 543
    assert d["missing_values"]["netWgt"] == 1922
    assert d["missing_values"]["grossWgt"] == 969
    assert d["missing_values"]["cifvalue"] == 1628
    assert d["missing_values"]["fobvalue"] == 1365
    assert d["missing_values"]["primaryValue"] == 0

    qs = d["data_quality_summary"]
    assert qs["total_missing_cells"] == 6427
    assert qs["columns_with_missing"] == 5
    assert qs["critical_missing_cells"] == 0
    assert qs["optional_missing_cells"] == 6427
    assert qs["total_active_cells"] == 87786
    # missing_cell_percentage: 6,427 / 87,786 * 100 ≈ 7.32%
    assert abs(qs["missing_cell_percentage"] - 7.32) < 0.1
    assert qs["health_status"] == "WARNINGS"
    assert qs["health_label"] == "Partial Missing Data"

    # Rule 16: Composite key duplicates = 0
    assert d["duplicate_record_count"] == 0
    assert qs["has_duplicates"] is False
    assert qs["duplicate_count"] == 0

    # Rule 17: Separation of Critical and Optional fields
    critical_cols = {x["column"]: x for x in d["critical_missing_details"]}
    assert "primaryValue" in critical_cols
    assert critical_cols["primaryValue"]["is_critical"] is True
    assert critical_cols["primaryValue"]["missing_count"] == 0

    optional_cols = {x["column"]: x for x in d["optional_missing_details"]}
    assert "primaryValue" not in optional_cols  # primaryValue must NOT be in optional table
    assert set(optional_cols.keys()) == {"qty", "netWgt", "grossWgt", "cifvalue", "fobvalue"}
    assert all(x["is_critical"] is False for x in optional_cols.values())
    assert optional_cols["qty"]["missing_count"] == 543
    assert optional_cols["netWgt"]["missing_count"] == 1922
    assert optional_cols["grossWgt"]["missing_count"] == 969
    assert optional_cols["cifvalue"]["missing_count"] == 1628
    assert optional_cols["fobvalue"]["missing_count"] == 1365

