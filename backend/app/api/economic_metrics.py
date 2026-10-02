"""
Phase 14: Economic Metrics & Specialized Trade Indices API.
Provides:
- Lafay Trade Balance Index (TBI)
- Revealed Trade Advantage (RTA / Macro Balassa)
- Grubel-Lloyd Trade Overlap Index (GLI)
- Global Market Shares (EMS, IMS) & Openness
- Hirschman-Herfindahl Global Concentration Index (HHI)
- Multi-Year Country x Year Heatmap matrices
- Cross-Country Trade Cycle Pearson Correlation matrices
- Bilateral & Comparative merchandise interaction matrices
"""
import math
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, TradeRecordV2, Country, Product
from app.schemas import (
    ReporterOption,
    CountryEconomicIndices,
    GlobalEconomicMetricsResponse,
    HeatmapCell,
    HeatmapCountryRow,
    HeatmapMatrixResponse,
    CorrelationMatrixResponse,
    BilateralDirectedFlow,
    BilateralMatrixResponse,
)
from app.utils.logger import logger

router = APIRouter(prefix="/economic-metrics", tags=["Economic Metrics & Specialized Indices"])

# Standard Economic Country Group Presets
G20_COUNTRIES = ["USA", "CHN", "DEU", "JPN", "GBR", "FRA", "IND", "ITA", "BRA", "CAN", "KOR", "RUS", "AUS", "MEX", "IDN", "SAU", "TUR", "ARG", "ZAF"]
BRICS_COUNTRIES = ["BRA", "RUS", "IND", "CHN", "ZAF", "EGY", "ETH", "IRN", "ARE"]


def _get_preset_countries(preset: str, db: Session, limit: int = 10) -> List[str]:
    """Helper to resolve country presets."""
    preset = preset.lower().strip()
    if preset == "g20":
        return G20_COUNTRIES
    elif preset == "brics":
        return BRICS_COUNTRIES
    elif preset in ["top10", "top25", "all"]:
        top_limit = 10 if preset == "top10" else (25 if preset == "top25" else 190)
        rows = (
            db.query(Country.iso_code)
            .join(TradeRecordV2, TradeRecordV2.reporter_id == Country.country_id)
            .group_by(Country.iso_code)
            .order_by(func.sum(TradeRecordV2.primary_value).desc())
            .limit(top_limit)
            .all()
        )
        return [r[0] for r in rows]
    else:
        # Default top 10
        rows = (
            db.query(Country.iso_code)
            .join(TradeRecordV2, TradeRecordV2.reporter_id == Country.country_id)
            .group_by(Country.iso_code)
            .order_by(func.sum(TradeRecordV2.primary_value).desc())
            .limit(limit)
            .all()
        )
        return [r[0] for r in rows]


@router.get("/indices", response_model=GlobalEconomicMetricsResponse)
def get_economic_indices(
    year: Optional[int] = Query(None, description="Specific year (2014-2025). If omitted, aggregates across full historical timeline."),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Computes formalized international trade economic indices across all 190 sovereign nations:
    - Lafay Trade Balance Index (TBI) in [-100, +100]
    - Revealed Trade Advantage (RTA / Macro Balassa)
    - Grubel-Lloyd Macro Trade Overlap Index (GLI) in [0, 1]
    - Global Export & Import Market Share (%)
    - Hirschman-Herfindahl Index (HHI) for Global Export Concentration
    """
    query = (
        db.query(
            Country.iso_code.label("iso_code"),
            Country.country_name.label("country_name"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("export_value"),
            func.coalesce(
                func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)),
                0.0,
            ).label("import_value"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("total_trade_value"),
        )
        .join(Country, TradeRecordV2.reporter_id == Country.country_id)
        .group_by(Country.iso_code, Country.country_name)
    )

    if year is not None:
        query = query.filter(TradeRecordV2.year == year)
        year_label = f"Year {year}"
    else:
        if start_year is not None:
            query = query.filter(TradeRecordV2.year >= start_year)
        if end_year is not None:
            query = query.filter(TradeRecordV2.year <= end_year)
        s_str = str(start_year) if start_year else "2014"
        e_str = str(end_year) if end_year else "2025"
        year_label = f"{s_str}–{e_str}"

    raw_rows = query.all()
    if not raw_rows:
        return GlobalEconomicMetricsResponse(
            year_label=year_label,
            total_global_exports=0.0,
            total_global_imports=0.0,
            total_global_trade=0.0,
            hhi_export_concentration=0.0,
            hhi_status="Unconcentrated / Competitive",
            top_exporter_iso="N/A",
            top_exporter_name="N/A",
            top_exporter_share=0.0,
            mean_global_tbi=0.0,
            countries_count=0,
            indices=[],
        )

    tot_global_exports = sum(float(r.export_value or 0.0) for r in raw_rows)
    tot_global_imports = sum(float(r.import_value or 0.0) for r in raw_rows)
    tot_global_trade = tot_global_exports + tot_global_imports

    # Sort raw rows by total trade value descending
    sorted_rows = sorted(raw_rows, key=lambda x: float(x.total_trade_value or 0.0), reverse=True)

    calculated_indices: List[CountryEconomicIndices] = []
    hhi_sum = 0.0
    tbi_sum = 0.0

    for rank, r in enumerate(sorted_rows, start=1):
        exp = float(r.export_value or 0.0)
        imp = float(r.import_value or 0.0)
        tot = exp + imp
        bal = exp - imp

        # 1. Lafay Trade Balance Index (TBI) in [-100, +100]
        tbi = ((bal / tot) * 100.0) if tot > 0 else 0.0
        tbi_sum += tbi

        # 2. Market shares
        exp_share = (exp / tot_global_exports * 100.0) if tot_global_exports > 0 else 0.0
        imp_share = (imp / tot_global_imports * 100.0) if tot_global_imports > 0 else 0.0
        openness = (tot / tot_global_trade * 100.0) if tot_global_trade > 0 else 0.0

        # Accumulate HHI
        hhi_sum += (exp_share ** 2)

        # 3. Revealed Trade Advantage (RTA / Macro Balassa)
        if imp > 0 and tot_global_exports > 0 and tot_global_imports > 0:
            world_exp_ratio = exp / tot_global_exports
            world_imp_ratio = imp / tot_global_imports
            rta = (world_exp_ratio / world_imp_ratio) if world_imp_ratio > 0 else 99.9
        else:
            rta = 1.0 if exp == 0 else 99.9

        # Cap RTA for clean presentation
        rta_clean = min(99.9, max(0.0, rta))

        # 4. Grubel-Lloyd Macro Trade Overlap Index (GLI) in [0.0, 1.0]
        gli = (1.0 - (abs(bal) / tot)) if tot > 0 else 0.0
        gli_clean = max(0.0, min(1.0, gli))

        calculated_indices.append(
            CountryEconomicIndices(
                reporter_iso=r.iso_code,
                reporter_name=r.country_name,
                export_value=exp,
                import_value=imp,
                total_trade_value=tot,
                trade_balance=bal,
                tbi=round(tbi, 2),
                rta=round(rta_clean, 3),
                gli=round(gli_clean, 3),
                export_market_share=round(exp_share, 3),
                import_market_share=round(imp_share, 3),
                trade_openness_share=round(openness, 3),
                rank_by_volume=rank,
            )
        )

    # Top exporter details
    top_exporter = max(calculated_indices, key=lambda x: x.export_value) if calculated_indices else None
    top_exp_iso = top_exporter.reporter_iso if top_exporter else "N/A"
    top_exp_name = top_exporter.reporter_name if top_exporter else "N/A"
    top_exp_share = top_exporter.export_market_share if top_exporter else 0.0

    # HHI status determination
    if hhi_sum < 1000:
        hhi_status = "Unconcentrated / Competitive"
    elif hhi_sum <= 1800:
        hhi_status = "Moderately Concentrated"
    else:
        hhi_status = "Highly Concentrated"

    mean_tbi = (tbi_sum / len(calculated_indices)) if calculated_indices else 0.0

    return GlobalEconomicMetricsResponse(
        year_label=year_label,
        total_global_exports=round(tot_global_exports, 2),
        total_global_imports=round(tot_global_imports, 2),
        total_global_trade=round(tot_global_trade, 2),
        hhi_export_concentration=round(hhi_sum, 2),
        hhi_status=hhi_status,
        top_exporter_iso=top_exp_iso,
        top_exporter_name=top_exp_name,
        top_exporter_share=round(top_exp_share, 2),
        mean_global_tbi=round(mean_tbi, 2),
        countries_count=len(calculated_indices),
        indices=calculated_indices,
    )


@router.get("/heatmap", response_model=HeatmapMatrixResponse)
def get_heatmap_matrix(
    metric: str = Query("tbi", description="Metric channel: 'tbi' (Trade Balance Index), 'rta' (Revealed Trade Advantage), 'export_share' (Export Market Share %), 'trade_balance' (Net Trade Balance $), 'growth_rate' (Annual YoY Growth %)"),
    preset: str = Query("top10", description="Country preset: 'top10', 'top25', 'g20', 'brics', 'all'"),
    countries: Optional[str] = Query(None, description="Comma-separated ISO-3 codes to override preset"),
    start_year: Optional[int] = Query(2014),
    end_year: Optional[int] = Query(2025),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Constructs a 2D matrix (Countries x Years) with normalized color bounds and metadata
    for the interactive Economic Heatmap visualization.
    """
    metric = metric.lower().strip()
    valid_metrics = ["tbi", "rta", "export_share", "trade_balance", "growth_rate"]
    if metric not in valid_metrics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid metric '{metric}'. Supported metrics: {', '.join(valid_metrics)}",
        )

    # 1. Resolve Target Countries
    if countries and countries.strip():
        target_isos = [c.strip().upper() for c in countries.split(",") if c.strip()]
    else:
        target_isos = _get_preset_countries(preset=preset, db=db, limit=10)

    if not target_isos:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid countries resolved for heatmap.")

    s_yr = start_year or 2014
    e_yr = end_year or 2025

    # 2. Get available years in range
    years_db = (
        db.query(TradeRecordV2.year)
        .filter(TradeRecordV2.year >= s_yr, TradeRecordV2.year <= e_yr)
        .distinct()
        .order_by(TradeRecordV2.year.asc())
        .all()
    )
    years = [y[0] for y in years_db]
    if not years:
        years = list(range(s_yr, e_yr + 1))

    # 3. Global annual totals (for market share & RTA computation)
    global_annual = (
        db.query(
            TradeRecordV2.year.label("year"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("tot_exp"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("tot_imp"),
        )
        .filter(TradeRecordV2.year.in_(years))
        .group_by(TradeRecordV2.year)
        .all()
    )
    global_exp_map = {r.year: float(r.tot_exp or 0.0) for r in global_annual}
    global_imp_map = {r.year: float(r.tot_imp or 0.0) for r in global_annual}

    # 4. Country annual flows
    country_annual = (
        db.query(
            Country.iso_code.label("iso"),
            Country.country_name.label("name"),
            TradeRecordV2.year.label("year"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("exp"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("imp"),
        )
        .join(Country, TradeRecordV2.reporter_id == Country.country_id)
        .filter(Country.iso_code.in_(target_isos))
        .filter(TradeRecordV2.year.in_(years))
        .group_by(Country.iso_code, Country.country_name, TradeRecordV2.year)
        .all()
    )

    # Data structure: data_map[iso][year] = (exp, imp)
    data_map: Dict[str, Dict[int, tuple]] = {iso: {} for iso in target_isos}
    name_map: Dict[str, str] = {}
    for r in country_annual:
        data_map[r.iso][r.year] = (float(r.exp or 0.0), float(r.imp or 0.0))
        name_map[r.iso] = r.name

    # If any target country name is missing, look up in countries table
    missing_names = [iso for iso in target_isos if iso not in name_map]
    if missing_names:
        c_rows = db.query(Country.iso_code, Country.country_name).filter(Country.iso_code.in_(missing_names)).all()
        for iso, name in c_rows:
            name_map[iso] = name

    # 5. Metadata and color scale configs
    configs = {
        "tbi": {
            "title": "Lafay Trade Balance Index (TBI)",
            "desc": "Normalized scale-invariant trade balance index ranging from -100 (100% net deficit) to +100 (100% net surplus).",
            "scale": "diverging",
            "unit": "index (-100 to +100)",
            "neutral": 0.0,
        },
        "rta": {
            "title": "Revealed Trade Advantage (RTA)",
            "desc": "Ratio of national export share to import absorption. >1.0 represents structural macroeconomic comparative advantage.",
            "scale": "diverging",
            "unit": "ratio (1.0 = baseline)",
            "neutral": 1.0,
        },
        "export_share": {
            "title": "Global Export Market Share (%)",
            "desc": "National outbound merchandise exports expressed as a percentage of total worldwide merchandise trade.",
            "scale": "sequential",
            "unit": "% share",
            "neutral": 0.0,
        },
        "trade_balance": {
            "title": "Net Merchandise Trade Balance (USD)",
            "desc": "Annual net trade balance (Exports - Imports) in United States Dollars.",
            "scale": "diverging",
            "unit": "USD ($)",
            "neutral": 0.0,
        },
        "growth_rate": {
            "title": "Annual Trade Growth Rate (YoY %)",
            "desc": "Year-over-year percentage change in total bilateral merchandise turnover.",
            "scale": "diverging",
            "unit": "% YoY",
            "neutral": 0.0,
        },
    }
    cfg = configs[metric]

    # 6. Calculate matrix cells
    country_rows: List[HeatmapCountryRow] = []
    all_values: List[float] = []

    for iso in target_isos:
        c_name = name_map.get(iso, iso)
        cells: List[HeatmapCell] = []
        c_tot_vol = 0.0
        prev_vol: Optional[float] = None

        for yr in years:
            exp, imp = data_map.get(iso, {}).get(yr, (0.0, 0.0))
            tot = exp + imp
            bal = exp - imp
            c_tot_vol += tot

            # Metric computation
            if metric == "tbi":
                val = ((bal / tot) * 100.0) if tot > 0 else 0.0
                disp = f"{val:+.1f}"
            elif metric == "rta":
                g_exp = global_exp_map.get(yr, 1.0)
                g_imp = global_imp_map.get(yr, 1.0)
                if imp > 0 and g_exp > 0 and g_imp > 0:
                    val = (exp / g_exp) / (imp / g_imp)
                else:
                    val = 1.0 if exp == 0 else 10.0
                val = min(10.0, max(0.0, val))
                disp = f"{val:.2f}x"
            elif metric == "export_share":
                g_exp = global_exp_map.get(yr, 1.0)
                val = (exp / g_exp * 100.0) if g_exp > 0 else 0.0
                disp = f"{val:.2f}%"
            elif metric == "trade_balance":
                val = bal
                if abs(val) >= 1e12:
                    disp = f"${val/1e12:+.2f}T"
                elif abs(val) >= 1e9:
                    disp = f"${val/1e9:+.2f}B"
                elif abs(val) >= 1e6:
                    disp = f"${val/1e6:+.1f}M"
                else:
                    disp = f"${val:,.0f}"
            elif metric == "growth_rate":
                if prev_vol is not None and prev_vol > 0:
                    val = ((tot - prev_vol) / prev_vol) * 100.0
                    disp = f"{val:+.1f}%"
                else:
                    val = 0.0
                    disp = "N/A"
                prev_vol = tot
            else:
                val = 0.0
                disp = "0"

            all_values.append(val)
            cells.append(
                HeatmapCell(
                    country_iso=iso,
                    country_name=c_name,
                    year=yr,
                    value=round(val, 3),
                    display_value=disp,
                    export_val=round(exp, 2),
                    import_val=round(imp, 2),
                    balance_val=round(bal, 2),
                )
            )

        avg_v = (sum(c.value for c in cells) / len(cells)) if cells else 0.0
        lat_v = cells[-1].value if cells else 0.0

        country_rows.append(
            HeatmapCountryRow(
                country_iso=iso,
                country_name=c_name,
                avg_value=round(avg_v, 3),
                latest_value=round(lat_v, 3),
                total_volume=round(c_tot_vol, 2),
                cells=cells,
            )
        )

    # Sort country rows by total volume descending
    country_rows.sort(key=lambda x: x.total_volume, reverse=True)

    min_v = min(all_values) if all_values else 0.0
    max_v = max(all_values) if all_values else 100.0

    return HeatmapMatrixResponse(
        metric=metric,
        metric_title=cfg["title"],
        metric_description=cfg["desc"],
        color_scale_type=cfg["scale"],
        unit=cfg["unit"],
        years=years,
        min_value=round(min_v, 3),
        max_value=round(max_v, 3),
        neutral_value=cfg["neutral"],
        countries=country_rows,
    )


@router.get("/correlation-matrix", response_model=CorrelationMatrixResponse)
def get_correlation_matrix(
    metric: str = Query("trade_balance", description="Series to correlate: 'trade_balance', 'total_trade', 'exports', 'imports'"),
    preset: str = Query("top10", description="Country preset: 'top10', 'top15', 'g20', 'brics'"),
    countries: Optional[str] = Query(None, description="Comma-separated ISO codes (up to 15 recommended)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Computes a K x K symmetric Pearson correlation matrix between annual trade series (2014-2025)
    to reveal economic synchronization, co-movement, and counter-cyclical trade relationships.
    """
    metric = metric.lower().strip()
    valid_metrics = ["trade_balance", "total_trade", "exports", "imports"]
    if metric not in valid_metrics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid correlation metric '{metric}'. Supported: {', '.join(valid_metrics)}",
        )

    if countries and countries.strip():
        target_isos = [c.strip().upper() for c in countries.split(",") if c.strip()][:20]
    else:
        limit = 15 if preset == "top15" else 10
        target_isos = _get_preset_countries(preset=preset, db=db, limit=limit)

    # Get country details
    c_info = db.query(Country.iso_code, Country.country_name).filter(Country.iso_code.in_(target_isos)).all()
    name_lookup = {r[0]: r[1] for r in c_info}
    ordered_reporters = [ReporterOption(iso=iso, desc=name_lookup.get(iso, iso)) for iso in target_isos if iso in name_lookup]

    # Fetch annual series for each country
    rows = (
        db.query(
            Country.iso_code.label("iso"),
            TradeRecordV2.year.label("year"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("exp"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("imp"),
        )
        .join(Country, TradeRecordV2.reporter_id == Country.country_id)
        .filter(Country.iso_code.in_([r.iso for r in ordered_reporters]))
        .group_by(Country.iso_code, TradeRecordV2.year)
        .order_by(TradeRecordV2.year.asc())
        .all()
    )

    # Build country vectors {iso: {year: value}}
    series_map: Dict[str, Dict[int, float]] = {r.iso: {} for r in ordered_reporters}
    all_years = sorted(list(set(r.year for r in rows)))

    for r in rows:
        exp = float(r.exp or 0.0)
        imp = float(r.imp or 0.0)
        if metric == "trade_balance":
            val = exp - imp
        elif metric == "exports":
            val = exp
        elif metric == "imports":
            val = imp
        else: # total_trade
            val = exp + imp
        series_map[r.iso][r.year] = val

    def pearson_corr(vec_a: List[float], vec_b: List[float]) -> float:
        if len(vec_a) != len(vec_b) or len(vec_a) < 2:
            return 0.0
        n = len(vec_a)
        mean_a = sum(vec_a) / n
        mean_b = sum(vec_b) / n
        var_a = sum((x - mean_a) ** 2 for x in vec_a)
        var_b = sum((y - mean_b) ** 2 for y in vec_b)
        if var_a == 0 or var_b == 0:
            return 1.0 if vec_a == vec_b else 0.0
        cov = sum((x - mean_a) * (y - mean_b) for x, y in zip(vec_a, vec_b))
        r = cov / math.sqrt(var_a * var_b)
        return max(-1.0, min(1.0, r))

    # Construct K x K correlation matrix
    k = len(ordered_reporters)
    matrix: List[List[float]] = []

    for i in range(k):
        row_corrs: List[float] = []
        iso_i = ordered_reporters[i].iso
        vec_i = [series_map[iso_i].get(yr, 0.0) for yr in all_years]
        for j in range(k):
            if i == j:
                row_corrs.append(1.0)
            else:
                iso_j = ordered_reporters[j].iso
                vec_j = [series_map[iso_j].get(yr, 0.0) for yr in all_years]
                corr_val = pearson_corr(vec_i, vec_j)
                row_corrs.append(round(corr_val, 3))
        matrix.append(row_corrs)

    return CorrelationMatrixResponse(
        countries=ordered_reporters,
        metric=metric,
        matrix=matrix,
    )


@router.get("/bilateral-matrix", response_model=BilateralMatrixResponse)
def get_bilateral_matrix(
    countries: Optional[str] = Query("USA,CHN,DEU,IND,GBR,JPN", description="Comma-separated ISO codes for interaction matrix"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns an interaction and comparative merchandise balance matrix for key global trading economies.
    Displays comparative bilateral turnover and trade differential metrics between major economic powerhouses.
    """
    target_isos = [c.strip().upper() for c in (countries or "USA,CHN,DEU,IND,GBR,JPN").split(",") if c.strip()][:12]
    c_info = db.query(Country.iso_code, Country.country_name).filter(Country.iso_code.in_(target_isos)).all()
    name_lookup = {r[0]: r[1] for r in c_info}
    ordered_reporters = [ReporterOption(iso=iso, desc=name_lookup.get(iso, iso)) for iso in target_isos if iso in name_lookup]

    # Fetch cumulative trade statistics for the selected economies
    rows = (
        db.query(
            Country.iso_code.label("iso"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "X", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("exp"),
            func.coalesce(func.sum(case((TradeRecordV2.flow_code == "M", TradeRecordV2.primary_value), else_=0.0)), 0.0).label("imp"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("tot"),
        )
        .join(Country, TradeRecordV2.reporter_id == Country.country_id)
        .filter(Country.iso_code.in_([r.iso for r in ordered_reporters]))
        .group_by(Country.iso_code)
        .all()
    )

    stats = {r.iso: {"exp": float(r.exp or 0.0), "imp": float(r.imp or 0.0), "tot": float(r.tot or 0.0)} for r in rows}
    k = len(ordered_reporters)

    # Comparative trade balance gap matrix: (Bal_A - Bal_B)
    matrix: List[List[float]] = []
    pairs: List[BilateralDirectedFlow] = []

    for i in range(k):
        row_vals: List[float] = []
        iso_a = ordered_reporters[i].iso
        name_a = ordered_reporters[i].desc
        bal_a = (stats.get(iso_a, {}).get("exp", 0.0) - stats.get(iso_a, {}).get("imp", 0.0))

        for j in range(k):
            iso_b = ordered_reporters[j].iso
            name_b = ordered_reporters[j].desc
            bal_b = (stats.get(iso_b, {}).get("exp", 0.0) - stats.get(iso_b, {}).get("imp", 0.0))

            gap = bal_a - bal_b
            row_vals.append(round(gap, 2))

            if i != j:
                pairs.append(
                    BilateralDirectedFlow(
                        exporter_iso=iso_a,
                        exporter_name=name_a,
                        importer_iso=iso_b,
                        importer_name=name_b,
                        export_value=stats.get(iso_a, {}).get("exp", 0.0),
                        import_value=stats.get(iso_b, {}).get("imp", 0.0),
                        net_balance=round(gap, 2),
                    )
                )
        matrix.append(row_vals)

    return BilateralMatrixResponse(
        countries=ordered_reporters,
        metric_title="Comparative Trade Balance Gap (Bal_A - Bal_B in USD)",
        matrix=matrix,
        pairs=pairs,
    )
