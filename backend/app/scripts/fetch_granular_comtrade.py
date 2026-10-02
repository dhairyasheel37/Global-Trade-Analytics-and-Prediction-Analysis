"""
Fetch Real Granular UN Comtrade Data Script.
Queries https://comtradeapi.un.org/public/v1/preview/C/A/HS for bilateral trade data:
- Reporters: India, USA, China, Germany
- Partners: USA, China, Germany, UK, Japan
- Commodities: 30, 84, 85, 87 (HS2)
- Years: 2018 - 2024
- Flows: M (Import), X (Export)

Every row saved is strictly traceable to an actual HTTP response from UN Comtrade.
No fabricated, estimated, or interpolated values.
"""
import os
import sys
import time
import json
import csv
import ssl
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, List, Any, Tuple

BASE_DIR = Path(__file__).resolve().parents[3]
OUT_CSV_PATH = BASE_DIR / "data" / "raw" / "granular_trade_data.csv"
OUT_CSV_PATH.parent.mkdir(parents=True, exist_ok=True)

COMMODITY_DESCRIPTIONS = {
    "30": "Pharmaceutical products",
    "84": "Machinery and mechanical appliances",
    "85": "Electrical machinery and equipment",
    "87": "Vehicles and parts thereof",
}

FLOW_DESCRIPTIONS = {
    "M": "Import",
    "X": "Export",
}

def get_ssl_context():
    return ssl.create_default_context()

def get_headers():
    return {
        "User-Agent": "GlobalTradeDataCollector/1.0 (academic-research; Python/urllib)"
    }

def verify_country_metadata() -> Tuple[Dict[str, Dict[str, Any]], Dict[int, Dict[str, Any]]]:
    """
    Fetches partnerAreas.json reference metadata live from UN Comtrade API
    to dynamically verify M49 numeric codes and ISO codes rather than hardcoding.
    """
    url = "https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json"
    print(f"Fetching UN Comtrade country reference metadata from: {url}")
    req = urllib.request.Request(url, headers=get_headers())
    with urllib.request.urlopen(req, timeout=30, context=get_ssl_context()) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        results = data.get("results", [])

    by_iso: Dict[str, Dict[str, Any]] = {}
    by_code: Dict[int, Dict[str, Any]] = {}

    for r in results:
        # We want active codes (entryExpiredDate is None)
        expired = r.get("entryExpiredDate")
        code = r.get("id") or r.get("PartnerCode")
        iso = r.get("PartnerCodeIsoAlpha3")
        name = r.get("text") or r.get("PartnerDesc")
        if code and iso and not expired:
            by_iso[iso] = {"code": int(code), "name": name, "iso": iso}
            by_code[int(code)] = {"code": int(code), "name": name, "iso": iso}

    # Verify our target countries
    target_isos = ["IND", "USA", "CHN", "DEU", "GBR", "JPN"]
    print("\nVerified UN Comtrade M49 Codes:")
    for iso in target_isos:
        info = by_iso.get(iso)
        assert info is not None, f"Could not find active M49 metadata for {iso}"
        print(f"  {iso:<4} -> M49 Code: {info['code']:<4} | Country Name: {info['name']}")

    return by_iso, by_code

def main():
    print("=" * 80)
    print("REAL GRANULAR UN COMTRADE DATA ACQUISITION")
    print("=" * 80)

    by_iso, by_code = verify_country_metadata()

    reporters = ["IND", "USA", "CHN", "DEU"]
    partners = ["USA", "CHN", "DEU", "GBR", "JPN"]
    years = [2018, 2019, 2020, 2021, 2022, 2023, 2024]
    commodities_param = "30,84,85,87"
    flows_param = "M,X"

    # Build country pairs (skip reporter == partner)
    country_pairs = []
    for rep in reporters:
        for part in partners:
            if rep != part:
                country_pairs.append((rep, part))

    total_calls_planned = len(country_pairs) * len(years)
    print(f"\nPlanned Data Acquisition Scope:")
    print(f"  Reporters ({len(reporters)}):  {', '.join(reporters)}")
    print(f"  Partners ({len(partners)}):   {', '.join(partners)}")
    print(f"  Valid Pairs:     {len(country_pairs)} bilateral dyads")
    print(f"  Years ({len(years)}):        {years[0]} - {years[-1]}")
    print(f"  Commodities:     {commodities_param} (HS2)")
    print(f"  Flows:           {flows_param} (Import, Export)")
    print(f"  Total API Calls: {total_calls_planned}")

    calls_attempted = 0
    calls_succeeded = 0
    calls_skipped_or_failed = 0
    records_collected: List[Dict[str, Any]] = []

    first_test_call_raw_json = None

    print("\nStarting execution loop...")
    start_time = time.time()

    for idx, (rep_iso, part_iso) in enumerate(country_pairs, 1):
        rep_info = by_iso[rep_iso]
        part_info = by_iso[part_iso]
        rep_code = rep_info["code"]
        part_code = part_info["code"]

        for year in years:
            calls_attempted += 1
            url = (
                f"https://comtradeapi.un.org/public/v1/preview/C/A/HS"
                f"?reporterCode={rep_code}&partnerCode={part_code}&period={year}"
                f"&flowCode={flows_param}&cmdCode={commodities_param}"
                f"&partner2Code=0&motCode=0&customsCode=C00"
            )

            max_retries = 3
            success = False

            for attempt in range(max_retries):
                try:
                    req = urllib.request.Request(url, headers=get_headers())
                    with urllib.request.urlopen(req, timeout=25, context=get_ssl_context()) as resp:
                        raw_bytes = resp.read()
                        res_json = json.loads(raw_bytes.decode("utf-8"))

                        # Capture the very first successful raw JSON body
                        if first_test_call_raw_json is None and res_json.get("data"):
                            first_test_call_raw_json = json.dumps(res_json, indent=2)

                        data_list = res_json.get("data", [])
                        if data_list:
                            calls_succeeded += 1
                            for item in data_list:
                                primary_val = item.get("primaryValue")
                                if primary_val is not None:
                                    cmd = str(item.get("cmdCode")).strip()
                                    flow = str(item.get("flowCode")).strip().upper()
                                    record = {
                                        "refYear": int(item.get("refYear")),
                                        "reporterISO": rep_iso,
                                        "reporterDesc": rep_info["name"],
                                        "partnerISO": part_iso,
                                        "partnerDesc": part_info["name"],
                                        "flowCode": flow,
                                        "flowDesc": FLOW_DESCRIPTIONS.get(flow, flow),
                                        "cmdCode": cmd,
                                        "cmdDesc": COMMODITY_DESCRIPTIONS.get(cmd, f"HS Chapter {cmd}"),
                                        "primaryValue": float(primary_val),
                                    }
                                    records_collected.append(record)
                        else:
                            # 0 records returned (e.g. unpublished year)
                            calls_succeeded += 1  # HTTP 200 succeeded, but 0 records published

                        success = True
                        break

                except urllib.error.HTTPError as he:
                    if he.code == 429:
                        # Rate limit: back off
                        wait_sec = 4 * (attempt + 1)
                        print(f"  [429 Rate Limit] Backing off for {wait_sec}s...")
                        time.sleep(wait_sec)
                    else:
                        print(f"  [HTTP Error {he.code}] on {rep_iso}->{part_iso} ({year}): {he.reason}")
                        break
                except Exception as e:
                    print(f"  [Request Error] on {rep_iso}->{part_iso} ({year}): {type(e).__name__} - {e}")
                    time.sleep(2)

            if not success:
                calls_skipped_or_failed += 1

            if calls_attempted % 10 == 0 or calls_attempted == total_calls_planned:
                elapsed = time.time() - start_time
                print(
                    f"Progress: [{calls_attempted}/{total_calls_planned}] "
                    f"({calls_attempted/total_calls_planned*100:.1f}%) | "
                    f"Succeeded: {calls_succeeded} | Failed/Skipped: {calls_skipped_or_failed} | "
                    f"Records: {len(records_collected)} | Elapsed: {elapsed:.1f}s"
                )

            # Respectful polite interval
            time.sleep(1.2)

    total_time = time.time() - start_time
    print(f"\nData Acquisition Completed in {total_time:.1f}s")
    print(f"  Calls Attempted:          {calls_attempted}")
    print(f"  Calls Succeeded:          {calls_succeeded}")
    print(f"  Calls Failed/Skipped:     {calls_skipped_or_failed}")
    print(f"  Total Records Collected:  {len(records_collected)}")

    # Write to CSV
    fieldnames = [
        "refYear",
        "reporterISO",
        "reporterDesc",
        "partnerISO",
        "partnerDesc",
        "flowCode",
        "flowDesc",
        "cmdCode",
        "cmdDesc",
        "primaryValue",
    ]

    with open(OUT_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records_collected)

    print(f"\nSaved CSV to: {OUT_CSV_PATH}")
    file_size = OUT_CSV_PATH.stat().st_size
    print(f"File Size: {file_size:,} bytes")

    # Save first raw JSON for report
    raw_json_path = BASE_DIR / "data" / "raw" / "first_test_call_raw.json"
    if first_test_call_raw_json:
        with open(raw_json_path, "w", encoding="utf-8") as f:
            f.write(first_test_call_raw_json)

    # Verification checks on final file
    unique_partners_collected = set(r["partnerISO"] for r in records_collected)
    unique_commodities_collected = set(r["cmdCode"] for r in records_collected)
    unique_reporters_collected = set(r["reporterISO"] for r in records_collected)
    unique_years_collected = set(r["refYear"] for r in records_collected)

    print("\nIntegrity Verification on Output Dataset:")
    print(f"  Total CSV Rows:                 {len(records_collected)}")
    print(f"  Distinct Reporters ({len(unique_reporters_collected)}):        {sorted(list(unique_reporters_collected))}")
    print(f"  Distinct Partners ({len(unique_partners_collected)}):         {sorted(list(unique_partners_collected))}")
    print(f"  Distinct Commodities ({len(unique_commodities_collected)}):      {sorted(list(unique_commodities_collected))}")
    print(f"  Distinct Years ({len(unique_years_collected)}):            {sorted(list(unique_years_collected))}")

    assert len(unique_partners_collected) > 1, "Must have >1 partner"
    assert len(unique_commodities_collected) > 1, "Must have >1 commodity"
    assert all(r["primaryValue"] > 0 for r in records_collected), "All primaryValues must be positive"

    print("\n>>> DATA ACQUISITION TASK SUCCESS: ALL CRITERIA MET.")

if __name__ == "__main__":
    main()
