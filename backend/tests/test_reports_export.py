"""
Phase 13 Tests — Executive PDF and Excel Reports Export
Tests the binary export endpoints:
- POST /api/reports/export/pdf
- POST /api/reports/export/excel
Validates auth enforcement, HTTP headers, magic byte signatures,
file sizes, zip contents for xlsx, and multi-filter permutations.
"""
import io
import zipfile
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


class TestExportAuth:
    def test_pdf_export_requires_auth(self):
        """Unauthenticated PDF export request must return 401."""
        res = client.post("/api/reports/export/pdf", json={})
        assert res.status_code == 401
        assert "token" in res.json()["detail"].lower()

    def test_excel_export_requires_auth(self):
        """Unauthenticated Excel export request must return 401."""
        res = client.post("/api/reports/export/excel", json={})
        assert res.status_code == 401
        assert "token" in res.json()["detail"].lower()


class TestPdfExport:
    def test_pdf_export_global_summary(self, trader_headers):
        """
        Global overview PDF export should return:
        - 200 OK
        - Content-Type: application/pdf
        - Content-Disposition with filename Trade_Report_Global_*.pdf
        - Valid PDF header bytes (%PDF-)
        - Document size > 4 KB
        """
        payload = {
            "reporter": None,
            "flow": None,
            "start_year": 2018,
            "end_year": 2024,
            "include_prediction": False,
        }
        res = client.post("/api/reports/export/pdf", headers=trader_headers, json=payload)
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert "attachment" in res.headers["content-disposition"]
        assert "Trade_Report_Global_" in res.headers["content-disposition"]
        assert res.headers["content-disposition"].endswith('.pdf"')

        content = res.content
        assert len(content) > 4000, f"Expected PDF > 4KB, got {len(content)} bytes"
        assert content.startswith(b"%PDF-"), "File header does not match %PDF- magic signature"

    def test_pdf_export_country_with_prediction(self, trader_headers):
        """
        Country-specific (USA) PDF export with ML predictions:
        - Contains KPI tiles, historical annual tables, and predictive projection tables
        - File size > 5 KB
        """
        payload = {
            "reporter": "USA",
            "flow": None,
            "start_year": None,
            "end_year": None,
            "include_prediction": True,
            "forecast_years": 3,
        }
        res = client.post("/api/reports/export/pdf", headers=trader_headers, json=payload)
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert "Trade_Report_USA_" in res.headers["content-disposition"]

        content = res.content
        assert len(content) > 5000, f"Expected PDF with ML projections > 5KB, got {len(content)} bytes"
        assert content.startswith(b"%PDF-")


class TestExcelExport:
    def test_excel_export_global_summary(self, trader_headers):
        """
        Global overview Excel export:
        - 200 OK
        - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
        - Content-Disposition filename Trade_Report_Global_*.xlsx
        - Valid OpenXML ZIP magic signature (PK\\x03\\x04)
        - Contains standard sheets
        """
        payload = {
            "reporter": None,
            "flow": None,
            "start_year": 2018,
            "end_year": 2024,
            "include_prediction": False,
        }
        res = client.post("/api/reports/export/excel", headers=trader_headers, json=payload)
        assert res.status_code == 200
        assert "spreadsheetml.sheet" in res.headers["content-type"]
        assert "Trade_Report_Global_" in res.headers["content-disposition"]
        assert res.headers["content-disposition"].endswith('.xlsx"')

        content = res.content
        assert len(content) > 5000, f"Expected Excel > 5KB, got {len(content)} bytes"
        assert content.startswith(b"PK\x03\x04"), "Excel file missing OpenXML PK zip signature"

        # Verify workbook archive structure
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            namelist = zf.namelist()
            assert "xl/workbook.xml" in namelist
            assert "xl/styles.xml" in namelist
            assert "xl/worksheets/sheet1.xml" in namelist

    def test_excel_export_country_with_prediction(self, admin_headers):
        """
        Admin exporting country-specific (USA) workbook with ML projections:
        - Contains 4 tabs: Executive Summary, Historical Trajectory, ML Outlook, Methodology
        - Document size > 8 KB
        """
        payload = {
            "reporter": "USA",
            "flow": "X",
            "start_year": None,
            "end_year": None,
            "include_prediction": True,
            "forecast_years": 3,
        }
        res = client.post("/api/reports/export/excel", headers=admin_headers, json=payload)
        assert res.status_code == 200
        assert "spreadsheetml.sheet" in res.headers["content-type"]
        assert "Trade_Report_USA_" in res.headers["content-disposition"]

        content = res.content
        assert len(content) > 8000
        assert content.startswith(b"PK\x03\x04")

        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            namelist = zf.namelist()
            # 4 sheets expected
            sheets = [name for name in namelist if name.startswith("xl/worksheets/sheet")]
            assert len(sheets) == 4, f"Expected 4 sheets in workbook with ML, found: {sheets}"
