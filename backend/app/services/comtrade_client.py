"""
Asynchronous UN Comtrade v1 REST API Client.
Interfaces with official UN Comtrade endpoints with rate limiting,
exponential backoff, reference metadata resolution, and data normalization.
"""
from __future__ import annotations

import os
import asyncio
import logging
from typing import Dict, List, Any, Optional, Tuple
import httpx

from app.utils.logger import logger

# UN Comtrade API endpoints
COMTRADE_PREVIEW_URL = "https://comtradeapi.un.org/public/v1/preview/C/A/HS"
COMTRADE_AUTH_URL = "https://comtradeapi.un.org/data/v1/get/C/A/HS"
COMTRADE_PARTNER_AREAS_URL = "https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json"

DEFAULT_HEADERS = {
    "User-Agent": "GlobalTradeAnalytics/1.0 (academic-research; Python/httpx)"
}

COMMODITY_DESCRIPTIONS = {
    "TOTAL": "All Commodities",
    "30": "Pharmaceutical products",
    "84": "Machinery and mechanical appliances",
    "85": "Electrical machinery and equipment",
    "87": "Vehicles and parts thereof",
}

FLOW_DESCRIPTIONS = {
    "M": "Import",
    "X": "Export",
}


class ComtradeAPIClient:
    """
    Client for querying UN Comtrade v1 REST API.
    Handles rate-limiting, error retries, and data normalization.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("UN_COMTRADE_API_KEY")
        self.is_authenticated = bool(self.api_key)
        self.base_url = COMTRADE_AUTH_URL if self.is_authenticated else COMTRADE_PREVIEW_URL
        
        # Unauthenticated preview endpoint enforces ~1 req/sec rate limit
        self.min_request_interval = 0.2 if self.is_authenticated else 1.2
        self._last_request_time = 0.0

        # Cached reference metadata
        self._m49_to_iso: Dict[int, str] = {}
        self._iso_to_m49: Dict[str, int] = {}
        self._country_names: Dict[str, str] = {}

    def _get_headers(self) -> Dict[str, str]:
        headers = dict(DEFAULT_HEADERS)
        if self.api_key:
            headers["Ocp-Apim-Subscription-Key"] = self.api_key
        return headers

    async def _rate_limit_throttle(self) -> None:
        """Enforces safe delay between outgoing requests to comply with UN API limits."""
        now = asyncio.get_event_loop().time()
        elapsed = now - self._last_request_time
        if elapsed < self.min_request_interval:
            wait_time = self.min_request_interval - elapsed
            await asyncio.sleep(wait_time)
        self._last_request_time = asyncio.get_event_loop().time()

    async def fetch_reference_metadata(self) -> Dict[str, Any]:
        """
        Fetches and caches partnerAreas.json reference metadata from UN Comtrade.
        Maps M49 numeric codes to ISO3 strings.
        """
        if self._m49_to_iso:
            return {"cached": True, "total_countries": len(self._m49_to_iso)}

        logger.info(f"Fetching UN Comtrade country reference metadata from {COMTRADE_PARTNER_AREAS_URL}...")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(COMTRADE_PARTNER_AREAS_URL, headers=DEFAULT_HEADERS)
                resp.raise_for_status()
                data = resp.json()
                results = data.get("results", [])

                for r in results:
                    code_val = r.get("id") or r.get("PartnerCode")
                    iso_val = r.get("PartnerCodeIsoAlpha3")
                    name_val = r.get("text") or r.get("PartnerDesc")
                    expired = r.get("entryExpiredDate")

                    if code_val is not None and iso_val and not expired:
                        try:
                            code_int = int(code_val)
                            iso_str = str(iso_val).strip().upper()
                            self._m49_to_iso[code_int] = iso_str
                            self._iso_to_m49[iso_str] = code_int
                            self._country_names[iso_str] = str(name_val).strip()
                        except (ValueError, TypeError):
                            continue

                logger.info(f"Loaded {len(self._m49_to_iso)} country M49-ISO mappings from UN Comtrade.")
                return {"cached": False, "total_countries": len(self._m49_to_iso)}
        except Exception as e:
            logger.warning(f"Could not fetch online metadata ({e}). Using built-in fallback mapping.")
            self._load_fallback_mappings()
            return {"cached": False, "total_countries": len(self._m49_to_iso), "fallback": True}

    def _load_fallback_mappings(self) -> None:
        """Fallback M49 to ISO3 mappings for standard major economies."""
        fallback = {
            699: ("IND", "India"),
            842: ("USA", "USA"),
            156: ("CHN", "China"),
            276: ("DEU", "Germany"),
            826: ("GBR", "United Kingdom"),
            392: ("JPN", "Japan"),
            76: ("BRA", "Brazil"),
            251: ("FRA", "France"),
            0: ("W00", "World"),
        }
        for code, (iso, name) in fallback.items():
            self._m49_to_iso[code] = iso
            self._iso_to_m49[iso] = code
            self._country_names[iso] = name

    def get_iso_from_code(self, code: int) -> str:
        """Converts M49 integer code to ISO3 string."""
        if not self._m49_to_iso:
            self._load_fallback_mappings()
        return self._m49_to_iso.get(code, f"C{code}")

    def get_code_from_iso(self, iso: str) -> Optional[int]:
        """Converts ISO3 string to M49 integer code."""
        if not self._iso_to_m49:
            self._load_fallback_mappings()
        return self._iso_to_m49.get(iso.upper())

    async def fetch_trade_data(
        self,
        reporter_codes: List[str],
        partner_codes: Optional[List[str]] = None,
        years: Optional[List[int]] = None,
        flows: Optional[List[str]] = None,
        cmd_codes: Optional[List[str]] = None,
        max_retries: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Executes a targeted data fetch against the UN Comtrade v1 API.
        Returns a list of normalized trade records.
        """
        await self.fetch_reference_metadata()

        partner_codes = partner_codes or ["0"]  # 0 = World
        years = years or [2024]
        flows = flows or ["M", "X"]
        cmd_codes = cmd_codes or ["TOTAL"]

        all_records: List[Dict[str, Any]] = []

        # Convert ISOs to numeric M49 codes where possible
        m49_reporters = [str(self.get_code_from_iso(r) or r) for r in reporter_codes]
        m49_partners = [str(self.get_code_from_iso(p) or p) for p in partner_codes]

        params = {
            "reporterCode": ",".join(m49_reporters),
            "partnerCode": ",".join(m49_partners),
            "period": ",".join(str(y) for y in years),
            "cmdCode": ",".join(cmd_codes),
            "flowCode": ",".join(flows),
        }

        logger.info(f"Querying UN Comtrade API ({self.base_url}) with params: {params}")

        for attempt in range(1, max_retries + 1):
            await self._rate_limit_throttle()
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    resp = await client.get(
                        self.base_url,
                        params=params,
                        headers=self._get_headers(),
                    )

                    if resp.status_code == 429:
                        wait = 2 ** attempt
                        logger.warning(f"UN Comtrade API Rate limited (429). Backing off for {wait}s...")
                        await asyncio.sleep(wait)
                        continue

                    resp.raise_for_status()
                    data = resp.json()
                    raw_data = data.get("data", [])

                    logger.info(f"Received {len(raw_data)} raw records from UN Comtrade API.")
                    for item in raw_data:
                        norm = self.normalize_record(item)
                        if norm:
                            all_records.append(norm)

                    return all_records

            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error querying UN Comtrade: {e.response.status_code} - {e.response.text}")
                if attempt == max_retries:
                    raise
                await asyncio.sleep(1.5 * attempt)
            except Exception as e:
                logger.error(f"Network error querying UN Comtrade: {e}")
                if attempt == max_retries:
                    raise
                await asyncio.sleep(1.5 * attempt)

        return all_records

    def normalize_record(self, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Normalizes a single raw record from UN Comtrade v1 JSON into
        internal trade data format with dual schema compatibility.
        """
        try:
            year = int(raw.get("period") or raw.get("refYear"))
            
            # Resolve reporter ISO & Name
            rep_code = raw.get("reporterCode")
            rep_iso = raw.get("reporterISO") or (self.get_iso_from_code(int(rep_code)) if rep_code else "UNK")
            rep_desc = raw.get("reporterDesc") or self._country_names.get(rep_iso, rep_iso)

            # Resolve partner ISO & Name
            part_code = raw.get("partnerCode")
            part_iso = raw.get("partnerISO") or (self.get_iso_from_code(int(part_code)) if part_code is not None else "W00")
            part_desc = raw.get("partnerDesc") or self._country_names.get(part_iso, "World" if part_iso == "W00" else part_iso)

            # Flow
            flow_code = str(raw.get("flowCode") or "").upper().strip()
            if flow_code not in ("M", "X"):
                # Sometimes UN Comtrade uses numeric flow codes (e.g., 1=Import, 2=Export)
                flow_map = {"1": "M", "2": "X", "M": "M", "X": "X"}
                flow_code = flow_map.get(flow_code, "M")
            flow_desc = FLOW_DESCRIPTIONS.get(flow_code, "Import" if flow_code == "M" else "Export")

            # Commodity
            cmd_code = str(raw.get("cmdCode") or "TOTAL").strip()
            cmd_desc = raw.get("cmdDesc") or COMMODITY_DESCRIPTIONS.get(cmd_code, f"Commodity {cmd_code}")

            # Trade values
            primary_val = float(raw.get("primaryValue") or raw.get("tradeValue") or 0.0)
            cif_val = float(raw["cifvalue"]) if raw.get("cifvalue") is not None else None
            fob_val = float(raw["fobvalue"]) if raw.get("fobvalue") is not None else None
            qty = float(raw["qty"]) if raw.get("qty") is not None else None
            net_wgt = float(raw["netWgt"]) if raw.get("netWgt") is not None else None
            gross_wgt = float(raw["grossWgt"]) if raw.get("grossWgt") is not None else None

            return {
                "refYear": year,
                "reporterISO": rep_iso,
                "reporterDesc": rep_desc,
                "partnerISO": part_iso,
                "partnerDesc": part_desc,
                "flowCode": flow_code,
                "flowDesc": flow_desc,
                "cmdCode": cmd_code,
                "cmdDesc": cmd_desc,
                "primaryValue": primary_val,
                "cifvalue": cif_val,
                "fobvalue": fob_val,
                "qty": qty,
                "netWgt": net_wgt,
                "grossWgt": gross_wgt,
                "source": "UN_COMTRADE_API_V1",
            }
        except Exception as e:
            logger.warning(f"Skipping malformed raw record: {raw}. Reason: {e}")
            return None
