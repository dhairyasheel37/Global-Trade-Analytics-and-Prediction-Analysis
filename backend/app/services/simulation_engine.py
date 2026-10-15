"""
Scenario Simulator & Tariff Impact Engine ("What-If" Analysis).
Implements econometric Armington elasticity models, domestic price pass-through,
tariff revenue estimation, bilateral trade diversion, and trajectory projections.
"""
from __future__ import annotations

import math
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from app.models import TradeRecordV2, TradeRecord, Country, Product
from app.schemas import (
    SimulationRequest,
    SimulationResult,
    SimulationBaselineMetrics,
    SimulationShockMetrics,
    DivertedPartnerItem,
    TrajectoryPoint,
    SensitivityPoint,
    SimulationExecutiveSummary,
    PresetScenario,
    SectorElasticityItem,
)
from app.utils.logger import logger


SECTOR_ELASTICITIES: Dict[str, SectorElasticityItem] = {
    "TOTAL": SectorElasticityItem(
        product_code="TOTAL",
        product_name="All Commodities (Macro Total)",
        default_elasticity=-1.20,
        substitution_elasticity=3.0,
        category_description="Aggregate macroeconomic merchandise trade flow across all sectors.",
    ),
    "30": SectorElasticityItem(
        product_code="30",
        product_name="Pharmaceutical Products",
        default_elasticity=-0.65,
        substitution_elasticity=1.8,
        category_description="Essential healthcare and pharmaceutical goods; inelastic consumer demand.",
    ),
    "84": SectorElasticityItem(
        product_code="84",
        product_name="Nuclear Reactors, Boilers & Machinery",
        default_elasticity=-1.35,
        substitution_elasticity=3.5,
        category_description="Heavy industrial machinery and capital goods; moderate global substitutability.",
    ),
    "85": SectorElasticityItem(
        product_code="85",
        product_name="Electrical Machinery & Electronics",
        default_elasticity=-1.50,
        substitution_elasticity=4.2,
        category_description="Consumer electronics, components, and semiconductors; highly elastic and price-sensitive.",
    ),
    "87": SectorElasticityItem(
        product_code="87",
        product_name="Vehicles and Parts Thereof",
        default_elasticity=-1.40,
        substitution_elasticity=3.8,
        category_description="Automotive vehicles and components; elastic demand with substantial local substitution.",
    ),
}

PRESET_SCENARIOS: List[PresetScenario] = [
    PresetScenario(
        id="us_china_tariff_25",
        title="US-China Section 301 Tariff Hike (+25%)",
        description="Simulates a 25% tariff on electronics and tech imports from China to the United States.",
        badge="Bilateral Tariff Shock",
        reporter_iso="USA",
        partner_iso="CHN",
        product_code="85",
        tariff_pct=25.0,
        demand_shock_pct=0.0,
        suggested_elasticity=-1.50,
        policy_context="Models supply chain re-routing and tariff revenue under strict trade policy interventions.",
    ),
    PresetScenario(
        id="global_tech_slump",
        title="Global Tech Demand Contraction (-15%)",
        description="Simulates a 15% worldwide decline in electronics and semiconductor export demand.",
        badge="Global Demand Shock",
        reporter_iso="USA",
        partner_iso="W00",
        product_code="85",
        tariff_pct=0.0,
        demand_shock_pct=-15.0,
        suggested_elasticity=-1.20,
        policy_context="Simulates the macroeconomic impact of a global hardware spending downturn.",
    ),
    PresetScenario(
        id="eu_cbam_tariff",
        title="EU Carbon Border Equalization (+12%)",
        description="Simulates a 12% environmental border tariff on machinery and industrial imports into Germany.",
        badge="Carbon Border Levy",
        reporter_iso="DEU",
        partner_iso="W00",
        product_code="84",
        tariff_pct=12.0,
        demand_shock_pct=0.0,
        suggested_elasticity=-1.35,
        policy_context="Analyzes price pass-through and green tariff adjustments on European heavy manufacturing.",
    ),
    PresetScenario(
        id="india_us_deal",
        title="India-US Trade Liberalization (-10%)",
        description="Simulates a 10% bilateral tariff reduction on pharmaceutical and technology trade.",
        badge="Trade Liberalization",
        reporter_iso="IND",
        partner_iso="USA",
        product_code="30",
        tariff_pct=-10.0,
        demand_shock_pct=5.0,
        suggested_elasticity=-0.65,
        policy_context="Evaluates volume expansion and bilateral healthcare supply chain integration.",
    ),
]


class ScenarioSimulationEngine:
    """
    Econometric simulation engine calculating trade volume shifts,
    revenue yields, partner flow diversions, and multi-year trajectories.
    """

    def get_presets(self) -> List[PresetScenario]:
        return PRESET_SCENARIOS

    def get_sector_elasticities(self) -> List[SectorElasticityItem]:
        return list(SECTOR_ELASTICITIES.values())

    def _resolve_country(self, db: Session, iso: str) -> Optional[Country]:
        clean = iso.strip().upper()
        return (
            db.query(Country)
            .filter(or_(Country.iso_code == clean, Country.country_name == clean))
            .first()
        )

    def _resolve_product(self, db: Session, code: str) -> Optional[Product]:
        clean = code.strip().upper()
        return db.query(Product).filter(Product.product_code == clean).first()

    def get_baseline_trade(
        self,
        db: Session,
        reporter_id: int,
        partner_id: Optional[int],
        product_id: Optional[int],
        year: int,
    ) -> Tuple[float, float]:
        """
        Retrieves baseline imports (M) and exports (X) in USD for specified entities and year.
        Returns (imports, exports).
        """
        # Query v2 schema first
        q = (
            db.query(
                TradeRecordV2.flow_code,
                func.sum(TradeRecordV2.primary_value).label("total_val"),
            )
            .filter(
                TradeRecordV2.reporter_id == reporter_id,
                TradeRecordV2.year == year,
            )
        )
        if partner_id is not None:
            q = q.filter(TradeRecordV2.partner_id == partner_id)
        if product_id is not None:
            q = q.filter(TradeRecordV2.product_id == product_id)

        rows = q.group_by(TradeRecordV2.flow_code).all()
        imports = 0.0
        exports = 0.0
        for flow_code, val in rows:
            if flow_code == "M":
                imports = float(val or 0.0)
            elif flow_code == "X":
                exports = float(val or 0.0)

        # Fallback to legacy trade_records if v2 has 0 and macro TOTAL
        if imports == 0.0 and exports == 0.0:
            rep_country = db.query(Country).filter(Country.country_id == reporter_id).first()
            if rep_country:
                q_leg = (
                    db.query(
                        TradeRecord.flowCode,
                        func.sum(TradeRecord.primaryValue).label("total_val"),
                    )
                    .filter(
                        TradeRecord.reporterISO == rep_country.iso_code,
                        TradeRecord.refYear == year,
                        TradeRecord.cmdCode == "TOTAL",
                    )
                )
                if partner_id is not None:
                    part_country = db.query(Country).filter(Country.country_id == partner_id).first()
                    if part_country:
                        q_leg = q_leg.filter(TradeRecord.partnerISO == part_country.iso_code)
                for f_code, v in q_leg.group_by(TradeRecord.flowCode).all():
                    if f_code == "M":
                        imports = float(v or 0.0)
                    elif f_code == "X":
                        exports = float(v or 0.0)

        return imports, exports

    def get_historical_series(
        self,
        db: Session,
        reporter_id: int,
        partner_id: Optional[int],
        product_id: Optional[int],
        start_year: int = 2018,
        end_year: int = 2023,
    ) -> List[Tuple[int, float]]:
        """
        Retrieves historical import values for trajectory baseline projection.
        """
        q = (
            db.query(
                TradeRecordV2.year,
                func.sum(TradeRecordV2.primary_value).label("val"),
            )
            .filter(
                TradeRecordV2.reporter_id == reporter_id,
                TradeRecordV2.flow_code == "M",
                TradeRecordV2.year.between(start_year, end_year),
            )
        )
        if partner_id is not None:
            q = q.filter(TradeRecordV2.partner_id == partner_id)
        if product_id is not None:
            q = q.filter(TradeRecordV2.product_id == product_id)

        rows = q.group_by(TradeRecordV2.year).order_by(TradeRecordV2.year).all()
        series = {r[0]: float(r[1] or 0.0) for r in rows}

        # Check if legacy table has data if series is empty
        if not any(series.values()):
            rep_country = db.query(Country).filter(Country.country_id == reporter_id).first()
            if rep_country:
                q_leg = (
                    db.query(
                        TradeRecord.refYear,
                        func.sum(TradeRecord.primaryValue),
                    )
                    .filter(
                        TradeRecord.reporterISO == rep_country.iso_code,
                        TradeRecord.flowCode == "M",
                        TradeRecord.cmdCode == "TOTAL",
                        TradeRecord.refYear.between(start_year, end_year),
                    )
                )
                if partner_id is not None:
                    part_country = db.query(Country).filter(Country.country_id == partner_id).first()
                    if part_country:
                        q_leg = q_leg.filter(TradeRecord.partnerISO == part_country.iso_code)
                for y, val in q_leg.group_by(TradeRecord.refYear).all():
                    series[y] = float(val or 0.0)

        # Format full range
        return [(y, series.get(y, 0.0)) for y in range(start_year, end_year + 1)]

    def get_top_alternative_exporters(
        self,
        db: Session,
        importer_id: int,
        target_partner_id: Optional[int],
        product_id: Optional[int],
        year: int,
        limit: int = 4,
    ) -> List[Tuple[str, str, float]]:
        """
        Identifies top alternative suppliers of this commodity to the importer.
        Returns list of (partner_iso, partner_name, baseline_imports).
        """
        q = (
            db.query(
                Country.iso_code,
                Country.country_name,
                func.sum(TradeRecordV2.primary_value).label("imp_val"),
            )
            .join(Country, Country.country_id == TradeRecordV2.partner_id)
            .filter(
                TradeRecordV2.reporter_id == importer_id,
                TradeRecordV2.flow_code == "M",
                TradeRecordV2.year == year,
                Country.iso_code != "W00",
            )
        )
        if target_partner_id is not None:
            q = q.filter(TradeRecordV2.partner_id != target_partner_id)
        if product_id is not None:
            q = q.filter(TradeRecordV2.product_id == product_id)

        rows = (
            q.group_by(Country.iso_code, Country.country_name)
            .order_by(func.sum(TradeRecordV2.primary_value).desc())
            .limit(limit)
            .all()
        )
        return [(str(r[0]), str(r[1]), float(r[2] or 0.0)) for r in rows]

    def run_simulation(self, db: Session, req: SimulationRequest) -> SimulationResult:
        """
        Executes an econometric what-if policy simulation.
        """
        # 1. Resolve Reporter Country
        rep_country = self._resolve_country(db, req.reporter_iso)
        if not rep_country:
            rep_country = Country(iso_code=req.reporter_iso.upper(), country_name=req.reporter_iso.upper())

        # 2. Resolve Partner Country
        part_iso = req.partner_iso.strip().upper() if req.partner_iso else "W00"
        part_country = self._resolve_country(db, part_iso) if part_iso != "W00" else None
        partner_id = part_country.country_id if part_country else None
        partner_name = part_country.country_name if part_country else "World (All Partners)"

        # 3. Resolve Product Classification
        prod_code = req.product_code.strip().upper() if req.product_code else "TOTAL"
        product_obj = self._resolve_product(db, prod_code)
        product_id = product_obj.product_id if product_obj else None
        product_name = (
            SECTOR_ELASTICITIES.get(prod_code, SECTOR_ELASTICITIES["TOTAL"]).product_name
            if prod_code in SECTOR_ELASTICITIES
            else (product_obj.product_name if product_obj else f"Commodity {prod_code}")
        )

        # 4. Resolve Baseline Year & Metrics
        baseline_year = req.baseline_year or 2023
        base_imports, base_exports = self.get_baseline_trade(
            db=db,
            reporter_id=rep_country.country_id,
            partner_id=partner_id,
            product_id=product_id,
            year=baseline_year,
        )

        # In case baseline has 0 recorded (e.g. year not populated), fallback to latest non-zero year
        if base_imports == 0.0 and base_exports == 0.0:
            for fallback_y in [2022, 2021, 2020]:
                fb_m, fb_x = self.get_baseline_trade(
                    db=db,
                    reporter_id=rep_country.country_id,
                    partner_id=partner_id,
                    product_id=product_id,
                    year=fallback_y,
                )
                if fb_m > 0 or fb_x > 0:
                    base_imports, base_exports = fb_m, fb_x
                    baseline_year = fallback_y
                    break

        base_trade_balance = base_exports - base_imports
        base_total_trade = base_exports + base_imports

        # 5. Resolve Elasticity & Multipliers
        default_sector = SECTOR_ELASTICITIES.get(prod_code, SECTOR_ELASTICITIES["TOTAL"])
        elasticity = (
            req.price_elasticity
            if req.price_elasticity is not None
            else default_sector.default_elasticity
        )
        # Ensure elasticity is strictly negative for standard downward sloping demand
        effective_elasticity = -abs(elasticity)

        tau = req.tariff_pct / 100.0
        delta_demand = req.demand_shock_pct / 100.0

        # 6. Compute Post-Shock Import Volume
        # Armington elasticity: %Delta Q = epsilon * tau
        # For non-negative tariffs: V_sim = V_base * max(0.01, (1 + tau)^epsilon) * (1 + delta_demand)
        # For negative tariffs (liberalization): V_sim = V_base * (1 + |tau| * |epsilon|) * (1 + delta_demand)
        if tau >= 0.0:
            price_factor = max(0.01, (1.0 + tau) ** effective_elasticity)
        else:
            price_factor = 1.0 + (abs(tau) * abs(effective_elasticity))

        demand_factor = max(0.05, 1.0 + delta_demand)
        sim_imports = max(0.0, base_imports * price_factor * demand_factor)

        # Import deltas
        import_delta_val = sim_imports - base_imports
        import_delta_pct = ((sim_imports / base_imports) - 1.0) * 100.0 if base_imports > 0 else 0.0

        # Export adjustments (exports contract/expand with global demand shock)
        sim_exports = max(0.0, base_exports * demand_factor)
        export_delta_val = sim_exports - base_exports
        export_delta_pct = delta_demand * 100.0 if base_exports > 0 else 0.0

        # Trade balance shifts
        sim_trade_balance = sim_exports - sim_imports
        trade_balance_delta = sim_trade_balance - base_trade_balance

        # Tariff Revenue
        # TR = tau * V_simulated (tariffs only generate revenue if tau > 0)
        annual_tariff_rev = max(0.0, tau * sim_imports) if tau > 0.0 else 0.0

        # Lost volume and diversion
        trade_lost = max(0.0, base_imports - sim_imports)
        diversion_rate = max(0.0, min(1.0, req.diversion_rate))
        total_diverted = trade_lost * diversion_rate

        # 7. Compute Trade Diversion to Alternative Partners
        top_alts = self.get_top_alternative_exporters(
            db=db,
            importer_id=rep_country.country_id,
            target_partner_id=partner_id,
            product_id=product_id,
            year=baseline_year,
            limit=4,
        )

        diverted_items: List[DivertedPartnerItem] = []
        if total_diverted > 0 and top_alts:
            total_alt_base = sum(a[2] for a in top_alts)
            for alt_iso, alt_name, alt_base in top_alts:
                weight = (alt_base / total_alt_base) if total_alt_base > 0 else (1.0 / len(top_alts))
                diverted_val = total_diverted * weight
                diverted_items.append(
                    DivertedPartnerItem(
                        partner_iso=alt_iso,
                        partner_name=alt_name,
                        baseline_share_pct=round(weight * 100.0, 1),
                        diverted_value=round(diverted_val, 2),
                        projected_new_value=round(alt_base + diverted_val, 2),
                    )
                )

        # 8. Multi-Year Trajectory (Historical + Projections)
        hist_series = self.get_historical_series(
            db=db,
            reporter_id=rep_country.country_id,
            partner_id=partner_id,
            product_id=product_id,
            start_year=2018,
            end_year=baseline_year,
        )

        # Compute historical CAGR for forward trend
        cagr = 0.02  # default 2% growth
        if len(hist_series) >= 2 and hist_series[0][1] > 0 and hist_series[-1][1] > 0:
            n_years = len(hist_series) - 1
            observed_cagr = (hist_series[-1][1] / hist_series[0][1]) ** (1.0 / n_years) - 1.0
            # Bound CAGR within sane limits [-0.05, 0.08]
            cagr = max(-0.05, min(0.08, observed_cagr))

        trajectory: List[TrajectoryPoint] = []
        for y, val in hist_series:
            trajectory.append(
                TrajectoryPoint(
                    year=y,
                    baseline_value=round(val, 2),
                    simulated_value=round(val, 2),
                    tariff_revenue=0.0,
                    delta_value=0.0,
                    is_projection=False,
                )
            )

        # Forward projection points
        horizon = max(1, min(5, req.projection_horizon_years))
        last_base = base_imports
        last_sim = sim_imports
        for step in range(1, horizon + 1):
            proj_year = baseline_year + step
            proj_base = last_base * ((1.0 + cagr) ** step)
            # Simulated trajectory continues with compounding growth on top of the shifted base
            proj_sim = last_sim * ((1.0 + cagr) ** step)
            proj_rev = max(0.0, tau * proj_sim) if tau > 0 else 0.0
            trajectory.append(
                TrajectoryPoint(
                    year=proj_year,
                    baseline_value=round(proj_base, 2),
                    simulated_value=round(proj_sim, 2),
                    tariff_revenue=round(proj_rev, 2),
                    delta_value=round(proj_sim - proj_base, 2),
                    is_projection=True,
                )
            )

        # 9. Sensitivity Curve (Tariff vs. Revenue & Volume)
        sensitivity_curve: List[SensitivityPoint] = []
        test_tariffs = [0.0, 5.0, 10.0, 15.0, 20.0, 25.0, 30.0, 40.0, 50.0]
        for t_pct in test_tariffs:
            t_rate = t_pct / 100.0
            t_price_factor = max(0.01, (1.0 + t_rate) ** effective_elasticity)
            t_imports = base_imports * t_price_factor * demand_factor
            t_rev = t_rate * t_imports
            t_loss = ((base_imports - t_imports) / base_imports * 100.0) if base_imports > 0 else 0.0
            sensitivity_curve.append(
                SensitivityPoint(
                    tariff_pct=t_pct,
                    projected_imports=round(t_imports, 2),
                    tariff_revenue=round(t_rev, 2),
                    volume_loss_pct=round(t_loss, 2),
                )
            )

        # 10. Automated Policy Executive Briefing
        headline = (
            f"Simulation: {req.reporter_iso} Imposes {req.tariff_pct:+.1f}% Tariff on "
            f"{part_iso} for {product_name}"
        )
        if req.tariff_pct > 0:
            consumer_impact = (
                f"Domestic import prices for {product_name} will experience upward pressure of approximately "
                f"+{req.tariff_pct:.1f}%, with domestic importers absorbing estimated costs or passing them to consumers."
            )
            rev_assessment = (
                f"Projected customs duty yield reaches ${annual_tariff_rev:,.0f} annually, "
                f"offsetting trade deficit by ${abs(trade_balance_delta):,.0f}."
            )
        elif req.tariff_pct < 0:
            consumer_impact = (
                f"Bilateral tariff reduction of {abs(req.tariff_pct):.1f}% reduces import costs, "
                f"stimulating a +{abs(import_delta_pct):.1f}% volume expansion."
            )
            rev_assessment = "Tariff cut foregoes customs revenue to prioritize trade facilitation and consumer welfare."
        else:
            consumer_impact = f"Zero tariff change applied. Demand shifts drive an overall {import_delta_pct:+.1f}% change."
            rev_assessment = "No additional customs duties generated."

        if diverted_items:
            div_names = ", ".join([d.partner_name for d in diverted_items[:2]])
            diversion_assessment = (
                f"Approximately ${total_diverted:,.0f} in deflected trade redirects to alternative suppliers, "
                f"with {div_names} capturing the largest substitution shares."
            )
        else:
            diversion_assessment = "Negligible third-party diversion observed under current parameters."

        key_findings = [
            f"Baseline imports of ${base_imports:,.0f} shift by {import_delta_pct:+.1f}% to ${sim_imports:,.0f}.",
            f"Net trade balance impacts {rep_country.iso_code} by {trade_balance_delta:+,.0f} USD.",
            f"Price elasticity ({effective_elasticity:.2f}) dictates a demand reduction of {abs(import_delta_pct):.1f}%.",
        ]

        summary = SimulationExecutiveSummary(
            headline=headline,
            key_findings=key_findings,
            consumer_price_impact=consumer_impact,
            revenue_assessment=rev_assessment,
            diversion_assessment=diversion_assessment,
        )

        return SimulationResult(
            baseline=SimulationBaselineMetrics(
                year=baseline_year,
                reporter_iso=rep_country.iso_code,
                reporter_name=rep_country.country_name,
                partner_iso=part_iso,
                partner_name=partner_name,
                product_code=prod_code,
                product_name=product_name,
                baseline_imports=round(base_imports, 2),
                baseline_exports=round(base_exports, 2),
                baseline_trade_balance=round(base_trade_balance, 2),
                baseline_total_trade=round(base_total_trade, 2),
            ),
            shock_impact=SimulationShockMetrics(
                tariff_pct=req.tariff_pct,
                demand_shock_pct=req.demand_shock_pct,
                effective_elasticity=effective_elasticity,
                simulated_imports=round(sim_imports, 2),
                import_delta_value=round(import_delta_val, 2),
                import_delta_pct=round(import_delta_pct, 2),
                simulated_exports=round(sim_exports, 2),
                export_delta_value=round(export_delta_val, 2),
                export_delta_pct=round(export_delta_pct, 2),
                simulated_trade_balance=round(sim_trade_balance, 2),
                trade_balance_delta=round(trade_balance_delta, 2),
                annual_tariff_revenue=round(annual_tariff_rev, 2),
                trade_volume_lost=round(trade_lost, 2),
                total_diverted_volume=round(total_diverted, 2),
            ),
            trade_diversion=diverted_items,
            trajectory=trajectory,
            sensitivity_curve=sensitivity_curve,
            executive_summary=summary,
        )


# Global singleton instance
simulation_engine = ScenarioSimulationEngine()
