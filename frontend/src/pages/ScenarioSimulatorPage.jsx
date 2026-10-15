import React, { useState, useEffect, useMemo } from "react";
import api from "../api/client";
import {
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Scale,
  ArrowRightLeft,
  ShieldAlert,
  Sparkles,
  Download,
  Copy,
  Check,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Globe2,
  Layers,
  HelpCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  BarChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Currency formatter
const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return "$0.00";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)} B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)} M`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const COMMON_REPORTERS = [
  { iso: "USA", name: "United States" },
  { iso: "CHN", name: "China" },
  { iso: "DEU", name: "Germany" },
  { iso: "IND", name: "India" },
  { iso: "JPN", name: "Japan" },
  { iso: "GBR", name: "United Kingdom" },
  { iso: "FRA", name: "France" },
  { iso: "BRA", name: "Brazil" },
  { iso: "CAN", name: "Canada" },
  { iso: "KOR", name: "South Korea" },
  { iso: "MEX", name: "Mexico" },
  { iso: "ITA", name: "Italy" },
  { iso: "AUS", name: "Australia" },
];

const COMMON_PARTNERS = [
  { iso: "W00", name: "World (All Partners)" },
  { iso: "CHN", name: "China" },
  { iso: "USA", name: "United States" },
  { iso: "DEU", name: "Germany" },
  { iso: "IND", name: "India" },
  { iso: "JPN", name: "Japan" },
  { iso: "GBR", name: "United Kingdom" },
  { iso: "FRA", name: "France" },
  { iso: "MEX", name: "Mexico" },
  { iso: "CAN", name: "Canada" },
  { iso: "VNM", name: "Vietnam" },
  { iso: "KOR", name: "South Korea" },
];

export const ScenarioSimulatorPage = () => {
  // Preset scenarios & sector elasticities
  const [presets, setPresets] = useState([]);
  const [elasticities, setElasticities] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Simulation parameters
  const [reporterIso, setReporterIso] = useState("USA");
  const [partnerIso, setPartnerIso] = useState("CHN");
  const [productCode, setProductCode] = useState("85");
  const [tariffPct, setTariffPct] = useState(15.0);
  const [demandShockPct, setDemandShockPct] = useState(0.0);
  const [customElasticity, setCustomElasticity] = useState(-1.50);
  const [diversionRate, setDiversionRate] = useState(40);
  const [projectionHorizon, setProjectionHorizon] = useState(4);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Simulation execution & results
  const [simulationResult, setSimulationResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // 1. Initial Load: Fetch presets and elasticities, then run initial simulation
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [presetsRes, elastRes] = await Promise.all([
          api.get("/simulator/presets"),
          api.get("/simulator/elasticities"),
        ]);
        setPresets(presetsRes.data || []);
        setElasticities(elastRes.data || []);
      } catch (err) {
        console.warn("Could not load simulation metadata:", err.message);
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchMetadata();
  }, []);

  // Update default elasticity when product changes
  useEffect(() => {
    if (elasticities.length > 0) {
      const match = elasticities.find((e) => e.product_code === productCode);
      if (match) {
        setCustomElasticity(match.default_elasticity);
      }
    }
  }, [productCode, elasticities]);

  // 2. Trigger Simulation
  const executeSimulation = async (overrideParams = {}) => {
    setRunning(true);
    setError(null);
    try {
      const payload = {
        reporter_iso: overrideParams.reporter_iso || reporterIso,
        partner_iso: overrideParams.partner_iso !== undefined ? overrideParams.partner_iso : partnerIso,
        product_code: overrideParams.product_code || productCode,
        tariff_pct: overrideParams.tariff_pct !== undefined ? overrideParams.tariff_pct : Number(tariffPct),
        demand_shock_pct: overrideParams.demand_shock_pct !== undefined ? overrideParams.demand_shock_pct : Number(demandShockPct),
        price_elasticity: overrideParams.price_elasticity !== undefined ? overrideParams.price_elasticity : Number(customElasticity),
        diversion_rate: (overrideParams.diversion_rate !== undefined ? overrideParams.diversion_rate : Number(diversionRate)) / 100.0,
        projection_horizon_years: overrideParams.projection_horizon_years || Number(projectionHorizon),
      };

      const res = await api.post("/simulator/run", payload);
      setSimulationResult(res.data);
    } catch (err) {
      console.error("Simulation error:", err);
      setError(err.response?.data?.detail || err.message || "Simulation computation failed.");
    } finally {
      setRunning(false);
    }
  };

  // Run initial default simulation once initial metadata is ready
  useEffect(() => {
    if (!loadingInitial && !simulationResult) {
      executeSimulation();
    }
  }, [loadingInitial]);

  // Handle Preset Selection
  const applyPreset = (preset) => {
    setReporterIso(preset.reporter_iso);
    setPartnerIso(preset.partner_iso || "W00");
    setProductCode(preset.product_code);
    setTariffPct(preset.tariff_pct);
    setDemandShockPct(preset.demand_shock_pct);
    setCustomElasticity(preset.suggested_elasticity);

    executeSimulation({
      reporter_iso: preset.reporter_iso,
      partner_iso: preset.partner_iso || "W00",
      product_code: preset.product_code,
      tariff_pct: preset.tariff_pct,
      demand_shock_pct: preset.demand_shock_pct,
      price_elasticity: preset.suggested_elasticity,
    });
  };

  // Copy JSON Specification
  const handleCopySpec = () => {
    if (!simulationResult) return;
    navigator.clipboard.writeText(JSON.stringify(simulationResult, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download CSV Report
  const handleDownloadCsv = () => {
    if (!simulationResult) return;
    const { baseline, shock_impact, trajectory } = simulationResult;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Scenario Simulator & Tariff Impact Report\n";
    csvContent += `Reporter,${baseline.reporter_iso} (${baseline.reporter_name})\n`;
    csvContent += `Partner,${baseline.partner_iso} (${baseline.partner_name})\n`;
    csvContent += `Product,${baseline.product_code} (${baseline.product_name})\n`;
    csvContent += `Tariff Pct,${shock_impact.tariff_pct}%\n`;
    csvContent += `Demand Shock Pct,${shock_impact.demand_shock_pct}%\n`;
    csvContent += `Price Elasticity,${shock_impact.effective_elasticity}\n`;
    csvContent += `Baseline Imports (USD),${baseline.baseline_imports}\n`;
    csvContent += `Simulated Imports (USD),${shock_impact.simulated_imports}\n`;
    csvContent += `Import Delta (USD),${shock_impact.import_delta_value}\n`;
    csvContent += `Import Delta (%),${shock_impact.import_delta_pct}%\n`;
    csvContent += `Annual Tariff Revenue (USD),${shock_impact.annual_tariff_revenue}\n`;
    csvContent += `Trade Balance Shift (USD),${shock_impact.trade_balance_delta}\n\n`;

    csvContent += "Multi-Year Trajectory\n";
    csvContent += "Year,Baseline (USD),Simulated (USD),Delta (USD),Tariff Revenue (USD),Is Projection\n";
    trajectory.forEach((t) => {
      csvContent += `${t.year},${t.baseline_value},${t.simulated_value},${t.delta_value},${t.tariff_revenue},${t.is_projection}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Trade_Scenario_${baseline.reporter_iso}_${baseline.partner_iso}_${baseline.product_code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shock = simulationResult?.shock_impact;
  const baseline = simulationResult?.baseline;

  return (
    <div style={styles.container}>
      {/* 1. Hero Header */}
      <div style={styles.heroSection}>
        <div style={styles.heroBadge}>
          <Sparkles size={14} color="#60a5fa" />
          <span>ECONOMETRIC POLICY SIMULATION ENGINE</span>
        </div>
        <h1 style={styles.heroTitle}>
          Scenario Simulator & Tariff Impact Analysis
        </h1>
        <p style={styles.heroSubtitle}>
          Model hypothetical bilateral tariff hikes, retaliatory shocks, and global demand contractions.
          Simulate projected trade volumes, customs revenues, and trade flow diversions using Armington elasticity models.
        </p>
      </div>

      {/* 2. Policy Presets Carousel */}
      <div style={styles.presetsContainer}>
        <div style={styles.presetLabelRow}>
          <span style={styles.sectionHeaderTitle}>CURATED GEOPOLITICAL POLICY PRESETS</span>
          <span style={styles.presetInstruction}>Click any preset to auto-load parameters</span>
        </div>
        <div style={styles.presetsGrid}>
          {presets.map((preset) => {
            const isSelected =
              reporterIso === preset.reporter_iso &&
              partnerIso === (preset.partner_iso || "W00") &&
              productCode === preset.product_code &&
              tariffPct === preset.tariff_pct &&
              demandShockPct === preset.demand_shock_pct;
            return (
              <div
                key={preset.id}
                onClick={() => applyPreset(preset)}
                style={{
                  ...styles.presetCard,
                  ...(isSelected ? styles.presetCardActive : {}),
                }}
              >
                <div style={styles.presetCardHeader}>
                  <span style={styles.presetBadge}>{preset.badge}</span>
                  <span style={styles.presetTariffTag}>
                    {preset.tariff_pct > 0
                      ? `+${preset.tariff_pct}% Tariff`
                      : preset.tariff_pct < 0
                      ? `${preset.tariff_pct}% Cut`
                      : `${preset.demand_shock_pct}% Demand`}
                  </span>
                </div>
                <div style={styles.presetTitle}>{preset.title}</div>
                <div style={styles.presetDesc}>{preset.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Interactive Simulation Controls Panel */}
      <div style={styles.controlsCard}>
        <div style={styles.controlsHeader}>
          <div style={styles.controlsHeaderTitle}>
            <SlidersHorizontal size={20} color="#3b82f6" />
            <span>Interactive Shock Configuration</span>
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={styles.advancedToggleBtn}
          >
            <span>Advanced Assumptions</span>
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <div style={styles.controlsGrid}>
          {/* Importer Country */}
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>
              Importer / Reporter Country
            </label>
            <select
              value={reporterIso}
              onChange={(e) => setReporterIso(e.target.value)}
              style={styles.selectInput}
            >
              {COMMON_REPORTERS.map((r) => (
                <option key={r.iso} value={r.iso}>
                  {r.iso} — {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Exporter Partner */}
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>
              Target Exporter / Partner
            </label>
            <select
              value={partnerIso}
              onChange={(e) => setPartnerIso(e.target.value)}
              style={styles.selectInput}
            >
              {COMMON_PARTNERS.map((p) => (
                <option key={p.iso} value={p.iso}>
                  {p.iso === "W00" ? "🌐 World (All Partners)" : `${p.iso} — ${p.name}`}
                </option>
              ))}
            </select>
          </div>

          {/* Commodity Category */}
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>
              Commodity Sector
            </label>
            <select
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              style={styles.selectInput}
            >
              {elasticities.map((item) => (
                <option key={item.product_code} value={item.product_code}>
                  {item.product_code} — {item.product_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sliders Row */}
        <div style={styles.slidersRow}>
          {/* Tariff Slider */}
          <div style={styles.sliderContainer}>
            <div style={styles.sliderHeader}>
              <span style={styles.sliderTitle}>Ad-Valorem Tariff Rate Adjustment</span>
              <span
                style={{
                  ...styles.sliderValueBadge,
                  backgroundColor:
                    tariffPct > 0
                      ? "rgba(239, 68, 68, 0.15)"
                      : tariffPct < 0
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(148, 163, 184, 0.15)",
                  color:
                    tariffPct > 0
                      ? "#f87171"
                      : tariffPct < 0
                      ? "#34d399"
                      : "#94a3b8",
                  borderColor:
                    tariffPct > 0
                      ? "rgba(239, 68, 68, 0.3)"
                      : tariffPct < 0
                      ? "rgba(16, 185, 129, 0.3)"
                      : "rgba(148, 163, 184, 0.3)",
                }}
              >
                {tariffPct > 0 ? `+${tariffPct}% Hike` : tariffPct < 0 ? `${tariffPct}% Cut` : "0% (Status Quo)"}
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="75"
              step="1"
              value={tariffPct}
              onChange={(e) => setTariffPct(parseFloat(e.target.value))}
              style={styles.sliderInput}
            />
            <div style={styles.sliderScale}>
              <span>-30% (Liberalization)</span>
              <span>0%</span>
              <span>+75% (Prohibitive)</span>
            </div>
          </div>

          {/* Demand Shock Slider */}
          <div style={styles.sliderContainer}>
            <div style={styles.sliderHeader}>
              <span style={styles.sliderTitle}>Macro Demand Shift</span>
              <span
                style={{
                  ...styles.sliderValueBadge,
                  backgroundColor:
                    demandShockPct > 0
                      ? "rgba(59, 130, 246, 0.15)"
                      : demandShockPct < 0
                      ? "rgba(245, 158, 11, 0.15)"
                      : "rgba(148, 163, 184, 0.15)",
                  color:
                    demandShockPct > 0
                      ? "#60a5fa"
                      : demandShockPct < 0
                      ? "#fbbf24"
                      : "#94a3b8",
                  borderColor:
                    demandShockPct > 0
                      ? "rgba(59, 130, 246, 0.3)"
                      : demandShockPct < 0
                      ? "rgba(245, 158, 11, 0.3)"
                      : "rgba(148, 163, 184, 0.3)",
                }}
              >
                {demandShockPct > 0
                  ? `+${demandShockPct}% Expansion`
                  : demandShockPct < 0
                  ? `${demandShockPct}% Contraction`
                  : "0% Neutral"}
              </span>
            </div>
            <input
              type="range"
              min="-40"
              max="40"
              step="1"
              value={demandShockPct}
              onChange={(e) => setDemandShockPct(parseFloat(e.target.value))}
              style={styles.sliderInput}
            />
            <div style={styles.sliderScale}>
              <span>-40% (Recession)</span>
              <span>0%</span>
              <span>+40% (Boom)</span>
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Parameters */}
        {showAdvanced && (
          <div style={styles.advancedDrawer}>
            <div style={styles.advancedGrid}>
              <div style={styles.controlGroup}>
                <label style={styles.controlLabel}>
                  Price Elasticity of Demand (ε)
                </label>
                <div style={styles.numericInputWrapper}>
                  <input
                    type="number"
                    step="0.05"
                    min="-3.0"
                    max="-0.1"
                    value={customElasticity}
                    onChange={(e) => setCustomElasticity(parseFloat(e.target.value))}
                    style={styles.textInput}
                  />
                  <span style={styles.inputHelper}>Default for {productCode}: {elasticities.find(e => e.product_code === productCode)?.default_elasticity || -1.2}</span>
                </div>
              </div>

              <div style={styles.controlGroup}>
                <label style={styles.controlLabel}>
                  Trade Diversion Rate to 3rd Nations (%)
                </label>
                <div style={styles.numericInputWrapper}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={diversionRate}
                    onChange={(e) => setDiversionRate(parseInt(e.target.value) || 0)}
                    style={styles.textInput}
                  />
                  <span style={styles.inputHelper}>% of displaced imports diverted to alternative suppliers</span>
                </div>
              </div>

              <div style={styles.controlGroup}>
                <label style={styles.controlLabel}>
                  Forward Trajectory Horizon
                </label>
                <select
                  value={projectionHorizon}
                  onChange={(e) => setProjectionHorizon(parseInt(e.target.value))}
                  style={styles.selectInput}
                >
                  <option value={2}>2 Years Forward</option>
                  <option value={3}>3 Years Forward</option>
                  <option value={4}>4 Years Forward</option>
                  <option value={5}>5 Years Forward</option>
                </select>
                <span style={styles.inputHelper}>Projection timeline horizon</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div style={styles.actionsBar}>
          <button
            onClick={() => executeSimulation()}
            disabled={running}
            style={styles.runButton}
          >
            {running ? (
              <>
                <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
                <span>Simulating Economic Model...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>⚡ Run Policy Simulation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.errorBox}>
          <ShieldAlert size={20} color="#f87171" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. KPI Impact Scorecards */}
      {shock && baseline && (
        <div style={styles.kpiGrid}>
          {/* Card 1: Projected Imports */}
          <div style={styles.kpiCard}>
            <div style={styles.kpiCardHeader}>
              <span style={styles.kpiCardTitle}>PROJECTED IMPORTS</span>
              <DollarSign size={18} color="#60a5fa" />
            </div>
            <div style={styles.kpiCardValue}>{formatCurrency(shock.simulated_imports)}</div>
            <div style={styles.kpiDeltaRow}>
              <span
                style={{
                  ...styles.kpiDeltaBadge,
                  backgroundColor:
                    shock.import_delta_value < 0
                      ? "rgba(239, 68, 68, 0.15)"
                      : "rgba(16, 185, 129, 0.15)",
                  color: shock.import_delta_value < 0 ? "#f87171" : "#34d399",
                }}
              >
                {shock.import_delta_value < 0 ? (
                  <TrendingDown size={14} />
                ) : (
                  <TrendingUp size={14} />
                )}
                <span>
                  {formatCurrency(shock.import_delta_value)} ({shock.import_delta_pct > 0 ? "+" : ""}
                  {shock.import_delta_pct.toFixed(1)}%)
                </span>
              </span>
              <span style={styles.kpiBaselineText}>
                Base: {formatCurrency(baseline.baseline_imports)}
              </span>
            </div>
          </div>

          {/* Card 2: Annual Tariff Revenue */}
          <div style={styles.kpiCard}>
            <div style={styles.kpiCardHeader}>
              <span style={styles.kpiCardTitle}>ANNUAL CUSTOMS REVENUE</span>
              <DollarSign size={18} color="#34d399" />
            </div>
            <div style={{ ...styles.kpiCardValue, color: "#34d399" }}>
              {formatCurrency(shock.annual_tariff_revenue)}
            </div>
            <div style={styles.kpiSubtext}>
              {shock.tariff_pct > 0
                ? `Yield from ${shock.tariff_pct}% duty on post-shock trade volume`
                : "No customs duties collected under current tariff"}
            </div>
          </div>

          {/* Card 3: Trade Balance Shift */}
          <div style={styles.kpiCard}>
            <div style={styles.kpiCardHeader}>
              <span style={styles.kpiCardTitle}>TRADE BALANCE SHIFT</span>
              <Scale size={18} color="#f59e0b" />
            </div>
            <div style={styles.kpiCardValue}>{formatCurrency(shock.simulated_trade_balance)}</div>
            <div style={styles.kpiDeltaRow}>
              <span
                style={{
                  ...styles.kpiDeltaBadge,
                  backgroundColor:
                    shock.trade_balance_delta >= 0
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(239, 68, 68, 0.15)",
                  color: shock.trade_balance_delta >= 0 ? "#34d399" : "#f87171",
                }}
              >
                {shock.trade_balance_delta >= 0 ? "+" : ""}
                {formatCurrency(shock.trade_balance_delta)}
              </span>
              <span style={styles.kpiBaselineText}>
                {shock.trade_balance_delta >= 0 ? "Deficit Contraction" : "Deficit Expansion"}
              </span>
            </div>
          </div>

          {/* Card 4: Diverted Trade Volume */}
          <div style={styles.kpiCard}>
            <div style={styles.kpiCardHeader}>
              <span style={styles.kpiCardTitle}>DIVERTED TRADE FLOW</span>
              <ArrowRightLeft size={18} color="#8b5cf6" />
            </div>
            <div style={{ ...styles.kpiCardValue, color: "#a78bfa" }}>
              {formatCurrency(shock.total_diverted_volume)}
            </div>
            <div style={styles.kpiSubtext}>
              {shock.total_diverted_volume > 0
                ? `${diversionRate}% of lost trade redirected to alternative suppliers`
                : "Zero displacement under current parameters"}
            </div>
          </div>
        </div>
      )}

      {/* 5. Visualizations Section */}
      {simulationResult && (
        <div style={styles.visualizationsGrid}>
          {/* Chart 1: Baseline vs. Shock Trajectory Area Chart */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <div style={styles.chartTitle}>
                <BarChart3 size={18} color="#3b82f6" />
                <span>Multi-Year Trajectory: Baseline vs. Shock Projection</span>
              </div>
              <span style={styles.chartSub}>Historical trend with forward shock trajectory</span>
            </div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <ComposedChart
                  data={simulationResult.trajectory}
                  margin={{ top: 10, right: 25, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="baselineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickFormatter={(v) => formatCurrency(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: 8,
                      color: "#fff",
                    }}
                    formatter={(val, name) => [formatCurrency(val), name]}
                  />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="baseline_value"
                    name="Baseline Imports"
                    stroke="#3b82f6"
                    fill="url(#baselineGrad)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="simulated_value"
                    name="Simulated Post-Shock Imports"
                    stroke="#ef4444"
                    fill="url(#simGrad)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="tariff_revenue"
                    name="Annual Tariff Revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: "#10b981", r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Trade Diversion Beneficiary Nations */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <div style={styles.chartTitle}>
                <Globe2 size={18} color="#8b5cf6" />
                <span>Trade Diversion: Alternative Supplier Beneficiaries</span>
              </div>
              <span style={styles.chartSub}>Displaced trade captured by competitive third-party exporters</span>
            </div>
            <div style={{ width: "100%", height: 320 }}>
              {simulationResult.trade_diversion.length > 0 ? (
                <ResponsiveContainer>
                  <BarChart
                    data={simulationResult.trade_diversion}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#64748b"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <YAxis
                      dataKey="partner_iso"
                      type="category"
                      stroke="#64748b"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: 8,
                        color: "#fff",
                      }}
                      formatter={(val, name, props) => [
                        `${formatCurrency(val)} (${props.payload.baseline_share_pct}% share)`,
                        props.payload.partner_name,
                      ]}
                    />
                    <Bar
                      dataKey="diverted_value"
                      name="Diverted Trade Value"
                      fill="#8b5cf6"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={styles.noDiversionBox}>
                  <Info size={28} color="#64748b" />
                  <p style={{ marginTop: 8, color: "#94a3b8" }}>
                    No bilateral trade diversion observed. Diversion calculations apply when tariffs are placed on specific bilateral export partners.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Tariff Rate vs. Revenue Sensitivity Curve */}
      {simulationResult && (
        <div style={styles.fullWidthCard}>
          <div style={styles.chartHeader}>
            <div style={styles.chartTitle}>
              <Layers size={18} color="#10b981" />
              <span>Tariff Rate vs. Revenue Sensitivity Curve (Laffer-Style Elasticity Curve)</span>
            </div>
            <span style={styles.chartSub}>
              Evaluates customs revenue optimization against escalating import demand contraction
            </span>
          </div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <ComposedChart
                data={simulationResult.sensitivity_curve}
                margin={{ top: 10, right: 35, left: 15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="tariff_pct"
                  stroke="#64748b"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#10b981"
                  tick={{ fill: "#10b981", fontSize: 12 }}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#f87171"
                  tick={{ fill: "#f87171", fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: 8,
                    color: "#fff",
                  }}
                  formatter={(val, name) => [
                    name.includes("Revenue") ? formatCurrency(val) : `${val}%`,
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="tariff_revenue"
                  name="Projected Tariff Revenue"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: "#10b981", r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="volume_loss_pct"
                  name="Import Volume Loss (%)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 7. Executive Policy Briefing Card */}
      {simulationResult?.executive_summary && (
        <div style={styles.briefingCard}>
          <div style={styles.briefingHeader}>
            <div style={styles.briefingBadge}>
              <Info size={16} color="#60a5fa" />
              <span>AUTOMATED POLICY EXECUTIVE BRIEFING</span>
            </div>
            <div style={styles.briefingActions}>
              <button
                onClick={handleCopySpec}
                style={styles.actionPillBtn}
                title="Copy JSON Specification"
              >
                {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy Spec"}</span>
              </button>
              <button
                onClick={handleDownloadCsv}
                style={styles.actionPillBtn}
                title="Download CSV Report"
              >
                <Download size={14} />
                <span>Download CSV</span>
              </button>
            </div>
          </div>

          <h2 style={styles.briefingHeadline}>
            {simulationResult.executive_summary.headline}
          </h2>

          <div style={styles.briefingBodyGrid}>
            <div style={styles.briefingSection}>
              <div style={styles.briefingSectionTitle}>Key Economic Takeaways</div>
              <ul style={styles.briefingList}>
                {simulationResult.executive_summary.key_findings.map((finding, idx) => (
                  <li key={idx} style={styles.briefingListItem}>
                    {finding}
                  </li>
                ))}
              </ul>
            </div>

            <div style={styles.briefingSection}>
              <div style={styles.briefingSectionTitle}>Consumer & Price Pressure</div>
              <p style={styles.briefingText}>
                {simulationResult.executive_summary.consumer_price_impact}
              </p>

              <div style={{ ...styles.briefingSectionTitle, marginTop: 16 }}>
                Fiscal Revenue Assessment
              </div>
              <p style={styles.briefingText}>
                {simulationResult.executive_summary.revenue_assessment}
              </p>
            </div>
          </div>

          <div style={styles.diversionBriefingRow}>
            <span style={styles.diversionBriefingTitle}>Geopolitical Substitution: </span>
            <span style={styles.diversionBriefingText}>
              {simulationResult.executive_summary.diversion_assessment}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: "24px 32px 48px",
    maxWidth: 1440,
    margin: "0 auto",
    color: "#f8fafc",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  heroSection: {
    marginBottom: 24,
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    border: "1px solid rgba(59, 130, 246, 0.25)",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    color: "#60a5fa",
    letterSpacing: "0.05em",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: "-0.02em",
    margin: "0 0 8px 0",
  },
  heroSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    maxWidth: 880,
    lineHeight: 1.5,
    margin: 0,
  },
  presetsContainer: {
    marginBottom: 20,
  },
  presetLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
    letterSpacing: "0.06em",
  },
  presetInstruction: {
    fontSize: 12,
    color: "#475569",
  },
  presetsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
  },
  presetCard: {
    padding: "12px 16px",
    backgroundColor: "#0d1527",
    border: "1px solid #1e293b",
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  presetCardActive: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
  },
  presetCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  presetBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: "#60a5fa",
    textTransform: "uppercase",
  },
  presetTariffTag: {
    fontSize: 11,
    fontWeight: 700,
    color: "#f87171",
  },
  presetTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#f1f5f9",
    marginBottom: 4,
  },
  presetDesc: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.4,
  },
  controlsCard: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: "20px 24px",
    marginBottom: 24,
  },
  controlsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  controlsHeaderTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 15,
    fontWeight: 600,
    color: "#f8fafc",
  },
  advancedToggleBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "transparent",
    border: "none",
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  },
  controlsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginBottom: 16,
  },
  controlGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: "#94a3b8",
  },
  selectInput: {
    padding: "8px 12px",
    backgroundColor: "#090d16",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#f8fafc",
    fontSize: 13,
    outline: "none",
  },
  slidersRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
    paddingTop: 12,
    borderTop: "1px solid #1e293b",
    marginBottom: 16,
  },
  sliderContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  sliderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "#cbd5e1",
  },
  sliderValueBadge: {
    fontSize: 12,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 6,
    border: "1px solid transparent",
  },
  sliderInput: {
    width: "100%",
    accentColor: "#3b82f6",
    cursor: "pointer",
  },
  sliderScale: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    color: "#475569",
  },
  advancedDrawer: {
    padding: "16px 20px",
    backgroundColor: "#090d16",
    borderRadius: 8,
    border: "1px solid #1e293b",
    marginBottom: 16,
  },
  advancedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  },
  numericInputWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  textInput: {
    padding: "8px 12px",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 6,
    color: "#f8fafc",
    fontSize: 13,
    outline: "none",
  },
  inputHelper: {
    fontSize: 10,
    color: "#64748b",
  },
  actionsBar: {
    display: "flex",
    justifyContent: "flex-end",
  },
  runButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 24px",
    backgroundColor: "#2563eb",
    border: "none",
    borderRadius: 8,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
    transition: "background 0.15s ease",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 16px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: 8,
    color: "#f87171",
    fontSize: 13,
    marginBottom: 20,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: "16px 20px",
  },
  kpiCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  kpiCardTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    letterSpacing: "0.05em",
  },
  kpiCardValue: {
    fontSize: 24,
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: 8,
  },
  kpiDeltaRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  kpiDeltaBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  kpiBaselineText: {
    fontSize: 11,
    color: "#64748b",
  },
  kpiSubtext: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.4,
  },
  visualizationsGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr",
    gap: 16,
    marginBottom: 20,
  },
  chartCard: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: "18px 20px",
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#f1f5f9",
  },
  chartSub: {
    fontSize: 11,
    color: "#64748b",
  },
  fullWidthCard: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: "18px 20px",
    marginBottom: 20,
  },
  noDiversionBox: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 24,
  },
  briefingCard: {
    backgroundColor: "#0d1527",
    border: "1px solid #1e3a8a",
    borderRadius: 12,
    padding: "20px 24px",
  },
  briefingHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  briefingBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.05em",
  },
  briefingActions: {
    display: "flex",
    gap: 8,
  },
  actionPillBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 6,
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
  },
  briefingHeadline: {
    fontSize: 18,
    fontWeight: 700,
    color: "#ffffff",
    margin: "0 0 16px 0",
  },
  briefingBodyGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
    marginBottom: 16,
  },
  briefingSection: {
    display: "flex",
    flexDirection: "column",
  },
  briefingSectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 8,
  },
  briefingList: {
    margin: 0,
    paddingLeft: 18,
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 1.6,
  },
  briefingListItem: {
    marginBottom: 6,
  },
  briefingText: {
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.5,
    margin: 0,
  },
  diversionBriefingRow: {
    paddingTop: 12,
    borderTop: "1px solid rgba(30, 58, 138, 0.4)",
    fontSize: 12,
    color: "#94a3b8",
  },
  diversionBriefingTitle: {
    fontWeight: 600,
    color: "#a78bfa",
  },
  diversionBriefingText: {
    color: "#cbd5e1",
  },
};
