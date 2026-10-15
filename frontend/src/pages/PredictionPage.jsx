import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import {
  BrainCircuit,
  TrendingUp,
  AlertTriangle,
  Info,
  Filter,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
  BarChart2,
  Calendar,
  DollarSign,
  Percent,
  Award,
  Sliders,
  Cpu,
  GitCompare,
  Activity,
  ArrowUpRight,
  Check,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Formatter for large currency values
const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return "$0.00";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)} B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)} M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)} K`;
  return `${sign}$${abs.toFixed(2)}`;
};

const formatNumber = (val, decimals = 1) => {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return Number(val).toFixed(decimals);
};

export const PredictionPage = () => {
  // Filters and Selectors
  const [reportersList, setReportersList] = useState([]);
  const [selectedReporter, setSelectedReporter] = useState("USA");
  const [selectedFlow, setSelectedFlow] = useState("X");
  const [forecastHorizon, setForecastHorizon] = useState(3);
  const [activeModelKey, setActiveModelKey] = useState("best"); // 'best', 'linear_regression', 'random_forest', 'arima', 'holt_winters', 'compare_all'

  // Applied State
  const [appliedParams, setAppliedParams] = useState({
    reporter: "USA",
    flow: "X",
    forecast_years: 3,
  });

  // Prediction Data State
  const [predictionData, setPredictionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Load Filter Options on Mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await api.get("/dashboard/filter-options");
        setReportersList(res.data.reporters);
      } catch (err) {
        console.error("Failed to load reporters:", err);
      }
    };
    fetchOptions();
  }, []);

  // 2. Fetch Prediction Results
  const fetchPrediction = useCallback(async () => {
    if (!appliedParams.reporter) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.get("/prediction/predict", {
        params: {
          reporter: appliedParams.reporter,
          flow: appliedParams.flow,
          forecast_years: appliedParams.forecast_years,
        },
      });
      setPredictionData(res.data);
    } catch (err) {
      console.error("Prediction fetch error:", err);
      setError(
        err.response?.data?.detail || "Failed to generate prediction models. Please verify selection."
      );
    } finally {
      setLoading(false);
    }
  }, [appliedParams]);

  useEffect(() => {
    fetchPrediction();
  }, [fetchPrediction]);

  const handleRunPrediction = (e) => {
    e.preventDefault();
    setAppliedParams({
      reporter: selectedReporter,
      flow: selectedFlow,
      forecast_years: forecastHorizon,
    });
  };

  // Determine models configuration and primary active model
  const bestModelKey = predictionData?.best_model || "linear_regression";
  const isCompareAll = activeModelKey === "compare_all";
  const primaryModelKey = activeModelKey === "best" ? bestModelKey : activeModelKey;
  const activeModel =
    predictionData?.models?.[primaryModelKey] || predictionData?.models?.["linear_regression"];

  const lrModel = predictionData?.models?.["linear_regression"];
  const rfModel = predictionData?.models?.["random_forest"];
  const arimaModel = predictionData?.models?.["arima"];
  const hwModel = predictionData?.models?.["holt_winters"];

  const candidateModels = [
    {
      key: "linear_regression",
      name: "Linear Regression",
      family: "Machine Learning (OLS)",
      familyBadge: "ML / OLS",
      badgeColor: "#3b82f6",
      order: lrModel?.model_order || "Degree 1 OLS",
      model: lrModel,
      color: "#3b82f6",
    },
    {
      key: "random_forest",
      name: "Random Forest",
      family: "Machine Learning (Ensemble)",
      familyBadge: "ML / RF",
      badgeColor: "#f59e0b",
      order: rfModel?.model_order || "50 Trees (Depth 3)",
      model: rfModel,
      color: "#f59e0b",
    },
    {
      key: "arima",
      name: "ARIMA Time-Series",
      family: "Time-Series (Autoregressive)",
      familyBadge: "TS / ARIMA",
      badgeColor: "#a855f7",
      order: arimaModel?.model_order || "ARIMA(p,d,q)",
      model: arimaModel,
      color: "#a855f7",
    },
    {
      key: "holt_winters",
      name: "Holt-Winters ETS",
      family: "Time-Series (State Space ETS)",
      familyBadge: "TS / ETS",
      badgeColor: "#06b6d4",
      order: hwModel?.model_order || "ETS(add, damped)",
      model: hwModel,
      color: "#06b6d4",
    },
  ];

  // Prepare unified time-series chart data points
  const chartData = [];
  if (predictionData?.historical_series) {
    const histMap = {};
    predictionData.historical_series.forEach((p) => {
      histMap[p.year] = { year: p.year, actual: p.actual };
    });

    const lastHistYear =
      predictionData.historical_series[predictionData.historical_series.length - 1]?.year;
    const lastHistVal =
      predictionData.historical_series[predictionData.historical_series.length - 1]?.actual;

    if (isCompareAll) {
      // Connect all 4 model projections to the last observed historical year
      if (lastHistYear && histMap[lastHistYear]) {
        histMap[lastHistYear].forecast_lr = lastHistVal;
        histMap[lastHistYear].forecast_rf = lastHistVal;
        histMap[lastHistYear].forecast_arima = lastHistVal;
        histMap[lastHistYear].forecast_hw = lastHistVal;
      }

      // Add projections from all 4 models
      const attachForecastSeries = (mObj, key) => {
        if (!mObj?.forecast_series) return;
        mObj.forecast_series.forEach((f) => {
          if (!histMap[f.year]) histMap[f.year] = { year: f.year };
          histMap[f.year][key] = f.predicted;
        });
      };

      attachForecastSeries(lrModel, "forecast_lr");
      attachForecastSeries(rfModel, "forecast_rf");
      attachForecastSeries(arimaModel, "forecast_arima");
      attachForecastSeries(hwModel, "forecast_hw");
    } else {
      // Single model view (or auto best)
      if (activeModel?.backtest_series) {
        activeModel.backtest_series.forEach((b) => {
          if (!histMap[b.year]) histMap[b.year] = { year: b.year };
          histMap[b.year].backtest = b.predicted;
        });
      }

      if (lastHistYear && histMap[lastHistYear]) {
        histMap[lastHistYear].forecast = lastHistVal;
        histMap[lastHistYear].lower_bound = lastHistVal;
        histMap[lastHistYear].upper_bound = lastHistVal;
        histMap[lastHistYear].ci_range = [lastHistVal, lastHistVal];
      }

      if (activeModel?.forecast_series) {
        activeModel.forecast_series.forEach((f) => {
          histMap[f.year] = {
            year: f.year,
            forecast: f.predicted,
            lower_bound: f.lower_bound,
            upper_bound: f.upper_bound,
            ci_range: [f.lower_bound, f.upper_bound],
          };
        });
      }
    }

    Object.keys(histMap)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((y) => chartData.push(histMap[y]));
  }

  // Multi-model future comparison list
  const futureYearsList =
    lrModel?.forecast_series?.map((pt) => pt.year) ||
    activeModel?.forecast_series?.map((pt) => pt.year) ||
    [];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Machine Learning Trade Prediction Engine</h1>
          <p style={styles.pageSubtitle}>
            Leakage-free time-series modeling, chronological backtesting, and multi-model forecast arena
          </p>
        </div>
      </div>

      {/* Dataset & Small-Data Transparency Disclosure Banner */}
      <div style={styles.noticeBanner}>
        <Info size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
        <span style={styles.noticeText}>
          <strong>Small-Data & Model Reliability Notice:</strong> Time-series models are trained on at
          most 12 annual observations (2014–2025). With 3-year lag feature engineering, models train
          on ~7 historical years and test on the final 2–3 years. Forecasts represent baseline
          econometric projections with 95% confidence intervals and must be interpreted with caution
          alongside domain macroeconomic context.
        </span>
      </div>

      {/* Filter & Control Bar */}
      <div style={styles.filterCard}>
        <div style={styles.filterHeader}>
          <Filter size={16} color="#60a5fa" />
          <span style={styles.filterTitle}>Prediction Configuration</span>
        </div>

        <form onSubmit={handleRunPrediction} style={styles.filterForm}>
          {/* Country Selector */}
          <div style={{ ...styles.filterGroup, flex: 2 }}>
            <label style={styles.filterLabel}>Reporter Country</label>
            <select
              value={selectedReporter}
              onChange={(e) => setSelectedReporter(e.target.value)}
              style={styles.select}
            >
              {reportersList.map((r) => (
                <option key={r.iso} value={r.iso}>
                  {r.desc} ({r.iso})
                </option>
              ))}
            </select>
          </div>

          {/* Flow Selector */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Trade Flow</label>
            <select
              value={selectedFlow}
              onChange={(e) => setSelectedFlow(e.target.value)}
              style={styles.select}
            >
              <option value="X">Exports (Outbound Flow X)</option>
              <option value="M">Imports (Inbound Flow M)</option>
              <option value="TOTAL">Total Trade Volume</option>
            </select>
          </div>

          {/* Forecast Horizon */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Forecast Horizon</label>
            <select
              value={forecastHorizon}
              onChange={(e) => setForecastHorizon(Number(e.target.value))}
              style={styles.select}
            >
              <option value={1}>1 Year (2026)</option>
              <option value={2}>2 Years (2026–2027)</option>
              <option value={3}>3 Years (2026–2028)</option>
              <option value={4}>4 Years (2026–2029)</option>
              <option value={5}>5 Years (2026–2030)</option>
            </select>
          </div>

          {/* Submit */}
          <div style={styles.filterActions}>
            <button type="submit" style={styles.applyBtn}>
              <Play size={14} fill="#ffffff" />
              <span>Train & Forecast</span>
            </button>
          </div>
        </form>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={styles.errorBanner}>
          <AlertCircle size={20} color="#f87171" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Overlay */}
      {loading ? (
        <div style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>
            Engineering lag features, fitting 4 time-series models, and calculating information criteria...
          </p>
        </div>
      ) : predictionData && !predictionData.success ? (
        /* Insufficient Data State */
        <div style={styles.emptyState}>
          <div style={styles.emptyIconWrapper}>
            <AlertTriangle size={48} color="#f59e0b" />
          </div>
          <h2 style={styles.emptyTitle}>Insufficient Historical Data</h2>
          <p style={styles.emptySubtitle}>
            {predictionData.error_message}
            <br />
            <strong>Available observations after feature engineering:</strong>{" "}
            {predictionData.usable_observations} (Minimum required: {predictionData.required_observations}).
          </p>
        </div>
      ) : predictionData ? (
        /* Main Results View */
        <div style={styles.content}>
          {/* Low-Confidence Warning Banner if R² < 0 */}
          {predictionData.low_confidence_warning && (
            <div style={styles.lowConfidenceBanner}>
              <AlertTriangle size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ display: "block", marginBottom: "2px" }}>Low Confidence Model Alert</strong>
                <span>{predictionData.low_confidence_warning}</span>
              </div>
            </div>
          )}

          {/* MODEL COMPARISON ARENA */}
          <div style={styles.arenaCard}>
            <div style={styles.arenaHeader}>
              <div style={styles.arenaTitleGroup}>
                <Award size={20} color="#c084fc" />
                <div>
                  <h2 style={styles.arenaTitle}>Model Comparison Arena</h2>
                  <p style={styles.arenaSubtitle}>
                    Side-by-side metric matrix comparing out-of-sample forecast accuracy (MAE, RMSE, MAPE, R²)
                    and statistical parsimony criteria (AIC, BIC)
                  </p>
                </div>
              </div>
              <div style={styles.arenaBadge}>
                <Layers size={13} color="#a855f7" />
                <span>4 Models + Naive Benchmark</span>
              </div>
            </div>

            {/* Winner Announcement Banner */}
            <div style={styles.winnerBanner}>
              <Sparkles size={16} color="#c084fc" style={{ flexShrink: 0 }} />
              <span>
                <strong>Consensus Best Performer:</strong>{" "}
                <span style={{ color: "#ffffff", fontWeight: "700" }}>
                  {predictionData.models?.[bestModelKey]?.display_name || bestModelKey}
                </span>{" "}
                achieved the lowest out-of-sample test MAE (
                {formatCurrency(predictionData.models?.[bestModelKey]?.metrics?.mae)}). Click any model's
                "Deploy to Chart" button or use the tabs below to toggle chart drivers.
              </span>
            </div>

            {/* Benchmarking Matrix Table */}
            <div style={styles.tableWrapper}>
              <table style={styles.arenaTable}>
                <thead>
                  <tr>
                    <th style={styles.th}>Model Architecture & Family</th>
                    <th style={styles.th}>Specification / Order</th>
                    <th style={styles.thRight}>Test MAE</th>
                    <th style={styles.thRight}>Test RMSE</th>
                    <th style={styles.thRight}>Test MAPE</th>
                    <th style={styles.thRight}>Test R² Score</th>
                    <th style={styles.thRight}>AIC (Akaike)</th>
                    <th style={styles.thRight}>BIC (Bayesian)</th>
                    <th style={{ ...styles.th, textAlign: "center" }}>Chart Driver</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Naive Mean Baseline Row */}
                  <tr style={styles.trBenchmark}>
                    <td style={styles.tdModel}>
                      <div style={styles.modelNameCol}>
                        <span style={styles.benchmarkTitle}>Naive Mean Baseline</span>
                        <span style={styles.benchmarkSub}>Benchmark Reference</span>
                      </div>
                    </td>
                    <td style={styles.tdSpec}>
                      <span style={styles.specCode}>y_train_mean (Zero-Variance)</span>
                    </td>
                    <td style={styles.tdNumber}>
                      <span style={styles.metricVal}>{formatCurrency(predictionData.baseline_mae)}</span>
                    </td>
                    <td style={styles.tdNumber}>—</td>
                    <td style={styles.tdNumber}>—</td>
                    <td style={styles.tdNumber}>
                      <span style={styles.r2Neutral}>0.000</span>
                    </td>
                    <td style={styles.tdNumber}>—</td>
                    <td style={styles.tdNumber}>—</td>
                    <td style={{ ...styles.td, textAlign: "center" }}>
                      <span style={styles.benchmarkPill}>Reference Baseline</span>
                    </td>
                  </tr>

                  {/* 4 Candidate Models Rows */}
                  {candidateModels.map((m) => {
                    const isBest = m.key === bestModelKey;
                    const isActive =
                      !isCompareAll &&
                      (activeModelKey === m.key || (activeModelKey === "best" && isBest));

                    return (
                      <tr key={m.key} style={isBest ? styles.trBest : styles.tr}>
                        <td style={styles.tdModel}>
                          <div style={styles.modelNameCol}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={styles.modelNameText}>{m.name}</span>
                              <span
                                style={{
                                  ...styles.familyBadge,
                                  borderColor: m.badgeColor,
                                  color: m.badgeColor,
                                }}
                              >
                                {m.familyBadge}
                              </span>
                            </div>
                            <span style={styles.modelSubtext}>{m.family}</span>
                          </div>
                        </td>
                        <td style={styles.tdSpec}>
                          <span style={styles.specCode}>{m.order}</span>
                        </td>
                        <td style={styles.tdNumber}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              gap: "6px",
                            }}
                          >
                            <span style={{ ...styles.metricVal, color: isBest ? "#34d399" : "#f8fafc" }}>
                              {formatCurrency(m.model?.metrics?.mae)}
                            </span>
                            {isBest && (
                              <span style={styles.bestPill} title="Lowest out-of-sample MAE">
                                <Award size={10} /> Best
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={styles.tdNumber}>
                          <span style={styles.metricVal}>{formatCurrency(m.model?.metrics?.rmse)}</span>
                        </td>
                        <td style={styles.tdNumber}>
                          <span style={styles.metricVal}>{m.model?.metrics?.mape ?? "—"}%</span>
                        </td>
                        <td style={styles.tdNumber}>
                          <span
                            style={
                              m.model?.metrics?.r2 >= 0 ? styles.r2Positive : styles.r2Negative
                            }
                          >
                            {m.model?.metrics?.r2 !== undefined ? m.model.metrics.r2 : "—"}
                          </span>
                        </td>
                        <td style={styles.tdNumber}>
                          <span style={styles.metricMuted}>{formatNumber(m.model?.metrics?.aic, 1)}</span>
                        </td>
                        <td style={styles.tdNumber}>
                          <span style={styles.metricMuted}>{formatNumber(m.model?.metrics?.bic, 1)}</span>
                        </td>
                        <td style={{ ...styles.td, textAlign: "center" }}>
                          {isActive ? (
                            <span style={styles.activePill}>
                              <Check size={12} /> Active Driver
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveModelKey(m.key)}
                              style={styles.deployBtn}
                            >
                              <span>Deploy to Chart</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Model Selection Tabs */}
          <div style={styles.modelTabBar}>
            <span style={styles.modelTabLabel}>Forecast Driver:</span>
            <button
              type="button"
              onClick={() => setActiveModelKey("best")}
              style={activeModelKey === "best" ? styles.tabBtnActive : styles.tabBtn}
            >
              <Sparkles size={14} color={activeModelKey === "best" ? "#ffffff" : "#60a5fa"} />
              <span>
                Auto Best ({predictionData.models?.[bestModelKey]?.display_name || "Optimal"})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModelKey("linear_regression")}
              style={activeModelKey === "linear_regression" ? styles.tabBtnActive : styles.tabBtn}
            >
              <span style={{ color: "#3b82f6" }}>●</span>
              <span>Linear Regression</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModelKey("random_forest")}
              style={activeModelKey === "random_forest" ? styles.tabBtnActive : styles.tabBtn}
            >
              <span style={{ color: "#f59e0b" }}>●</span>
              <span>Random Forest</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModelKey("arima")}
              style={activeModelKey === "arima" ? styles.tabBtnActive : styles.tabBtn}
            >
              <span style={{ color: "#a855f7" }}>●</span>
              <span>ARIMA Time-Series</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModelKey("holt_winters")}
              style={activeModelKey === "holt_winters" ? styles.tabBtnActive : styles.tabBtn}
            >
              <span style={{ color: "#06b6d4" }}>●</span>
              <span>Holt-Winters ETS</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModelKey("compare_all")}
              style={activeModelKey === "compare_all" ? styles.tabBtnActivePurple : styles.tabBtn}
            >
              <Layers
                size={14}
                color={activeModelKey === "compare_all" ? "#ffffff" : "#c084fc"}
              />
              <span>Compare All Projections (Overlay)</span>
            </button>
          </div>

          {/* Interactive Prediction Chart */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <div style={styles.chartTitleGroup}>
                <TrendingUp size={18} color="#a855f7" />
                <span style={styles.chartTitle}>
                  {predictionData.reporter_name} ({predictionData.flow_desc}): Historical & Multi-Year Projections
                </span>
              </div>
              <span style={styles.chartTag}>
                {isCompareAll
                  ? "Multi-Model Forecast Overlay (All 4 Models)"
                  : `Visualizing: ${activeModel?.display_name || "Active Model"}`}
              </span>
            </div>

            <div style={styles.chartWrapper}>
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickFormatter={(v) => formatCurrency(v)}
                  />
                  <Tooltip
                    formatter={(v, name) => [
                      formatCurrency(Array.isArray(v) ? v[1] : v),
                      name === "actual"
                        ? "Observed Historical Actual"
                        : name === "backtest"
                        ? "Chronological Test Backtest"
                        : name === "forecast"
                        ? `${activeModel?.display_name || "Active Model"} Forecast`
                        : name === "forecast_lr"
                        ? "Linear Regression Forecast"
                        : name === "forecast_rf"
                        ? "Random Forest Forecast"
                        : name === "forecast_arima"
                        ? "ARIMA Forecast"
                        : name === "forecast_hw"
                        ? "Holt-Winters ETS Forecast"
                        : name,
                    ]}
                    contentStyle={styles.customTooltip}
                  />
                  <Legend
                    formatter={(name) =>
                      name === "actual"
                        ? "Observed Historical (2014–2025)"
                        : name === "backtest"
                        ? "Chronological Test Backtest"
                        : name === "forecast"
                        ? `${activeModel?.display_name || "Active Model"} Forecast (2026–2030)`
                        : name === "forecast_lr"
                        ? "Linear Regression (OLS)"
                        : name === "forecast_rf"
                        ? "Random Forest (50 Trees)"
                        : name === "forecast_arima"
                        ? `ARIMA (${arimaModel?.model_order || "Auto"})`
                        : name === "forecast_hw"
                        ? `Holt-Winters ETS (${hwModel?.model_order || "ETS"})`
                        : name === "ci_range"
                        ? "95% Confidence Interval"
                        : name
                    }
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />

                  {/* Historical Solid Line */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#10b981" }}
                    activeDot={{ r: 6 }}
                  />

                  {isCompareAll ? (
                    <>
                      {/* Multi-Model Projections Overlay */}
                      <Line
                        type="monotone"
                        dataKey="forecast_lr"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        strokeDasharray="4 4"
                        dot={{ r: 4, fill: "#3b82f6" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast_rf"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        strokeDasharray="4 4"
                        dot={{ r: 4, fill: "#f59e0b" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast_arima"
                        stroke="#a855f7"
                        strokeWidth={2.5}
                        strokeDasharray="5 5"
                        dot={{ r: 4, fill: "#a855f7" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast_hw"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        strokeDasharray="4 4"
                        dot={{ r: 4, fill: "#06b6d4" }}
                      />
                    </>
                  ) : (
                    <>
                      {/* Single Model View with 95% Confidence Band */}
                      <Area
                        type="monotone"
                        dataKey="ci_range"
                        stroke="none"
                        fill="rgba(168, 85, 247, 0.15)"
                      />
                      <Line
                        type="monotone"
                        dataKey="backtest"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 4, fill: "#f59e0b" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="#a855f7"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        dot={{ r: 5, fill: "#a855f7" }}
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Two-Column Grid: Projections Table & Feature / Parameter Breakdown */}
          <div style={styles.gridTwo}>
            {/* Projections Table Panel */}
            <div style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <div style={styles.detailTitleGroup}>
                  <Calendar size={18} color="#38bdf8" />
                  <h3 style={styles.detailTitle}>
                    {isCompareAll
                      ? "Multi-Model Forecast Consensus Matrix"
                      : `Future Forecast Projections (${activeModel?.display_name})`}
                  </h3>
                </div>
                <span style={styles.chartTag}>
                  {activeModel?.forecast_series?.length || 3} Projected Years
                </span>
              </div>

              <div style={styles.tableWrapper}>
                {isCompareAll ? (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Year</th>
                        <th style={styles.thRight}>Linear Reg</th>
                        <th style={styles.thRight}>Random Forest</th>
                        <th style={styles.thRight}>ARIMA</th>
                        <th style={styles.thRight}>Holt-Winters</th>
                        <th style={styles.thRight}>Consensus Mean</th>
                      </tr>
                    </thead>
                    <tbody>
                      {futureYearsList.map((yr, idx) => {
                        const valLr = lrModel?.forecast_series?.[idx]?.predicted;
                        const valRf = rfModel?.forecast_series?.[idx]?.predicted;
                        const valArima = arimaModel?.forecast_series?.[idx]?.predicted;
                        const valHw = hwModel?.forecast_series?.[idx]?.predicted;
                        const vals = [valLr, valRf, valArima, valHw].filter(
                          (v) => v !== undefined && v !== null
                        );
                        const meanVal = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

                        return (
                          <tr key={yr} style={styles.tr}>
                            <td style={styles.tdYear}>{yr}</td>
                            <td style={styles.tdNumber}>{formatCurrency(valLr)}</td>
                            <td style={styles.tdNumber}>{formatCurrency(valRf)}</td>
                            <td style={styles.tdNumber}>{formatCurrency(valArima)}</td>
                            <td style={styles.tdNumber}>{formatCurrency(valHw)}</td>
                            <td style={styles.tdForecast}>{formatCurrency(meanVal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Year</th>
                        <th style={styles.thRight}>Forecast Value</th>
                        <th style={styles.thRight}>95% Range (Lower – Upper)</th>
                        <th style={styles.thRight}>Projected YoY Growth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeModel?.forecast_series?.map((pt) => (
                        <tr key={pt.year} style={styles.tr}>
                          <td style={styles.tdYear}>{pt.year}</td>
                          <td style={styles.tdForecast}>{formatCurrency(pt.predicted)}</td>
                          <td style={styles.tdRange}>
                            {formatCurrency(pt.lower_bound)} – {formatCurrency(pt.upper_bound)}
                          </td>
                          <td style={styles.tdGrowth}>
                            {pt.growth_pct !== null ? (
                              <span
                                style={
                                  pt.growth_pct >= 0 ? styles.growthPositive : styles.growthNegative
                                }
                              >
                                {pt.growth_pct >= 0 ? `+${pt.growth_pct}%` : `${pt.growth_pct}%`}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Feature Weighting / Diagnostics Panel */}
            <div style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <div style={styles.detailTitleGroup}>
                  <BarChart2 size={18} color="#f59e0b" />
                  <h3 style={styles.detailTitle}>
                    {isCompareAll
                      ? "Forecasting Methodology Reference"
                      : primaryModelKey === "arima"
                      ? "ARIMA Diagnostics & Parameters"
                      : primaryModelKey === "holt_winters"
                      ? "Holt-Winters Smoothing Parameters"
                      : "Feature Weightings & Lag Importance"}
                  </h3>
                </div>
                <span style={styles.chartTag}>
                  {isCompareAll
                    ? "Econometric Architectures"
                    : primaryModelKey === "arima"
                    ? arimaModel?.model_order || "ARIMA(p,d,q)"
                    : primaryModelKey === "holt_winters"
                    ? hwModel?.model_order || "ETS"
                    : "Leakage-Free Features"}
                </span>
              </div>

              {isCompareAll ? (
                <div style={styles.featureList}>
                  <div style={styles.methodCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ ...styles.familyBadge, borderColor: "#3b82f6", color: "#3b82f6" }}>
                        ML / OLS
                      </span>
                      <strong style={{ color: "#ffffff", fontSize: "13px" }}>Linear Regression</strong>
                    </div>
                    <p style={styles.methodDesc}>
                      Fits parametric ordinary least squares regression across lag_1, lag_2, lag_3, 3-year rolling mean, and linear time trend.
                    </p>
                  </div>

                  <div style={styles.methodCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ ...styles.familyBadge, borderColor: "#f59e0b", color: "#f59e0b" }}>
                        ML / RF
                      </span>
                      <strong style={{ color: "#ffffff", fontSize: "13px" }}>Random Forest Regressor</strong>
                    </div>
                    <p style={styles.methodDesc}>
                      Non-linear ensemble of 50 shallow decision trees (max_depth=3) using bootstrap aggregation to mitigate overfitting on short horizons.
                    </p>
                  </div>

                  <div style={styles.methodCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ ...styles.familyBadge, borderColor: "#a855f7", color: "#a855f7" }}>
                        TS / ARIMA
                      </span>
                      <strong style={{ color: "#ffffff", fontSize: "13px" }}>ARIMA Time-Series</strong>
                    </div>
                    <p style={styles.methodDesc}>
                      Box-Jenkins autoregressive integrated moving average with automated order search minimizing Akaike Information Criterion (AIC).
                    </p>
                  </div>

                  <div style={styles.methodCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ ...styles.familyBadge, borderColor: "#06b6d4", color: "#06b6d4" }}>
                        TS / ETS
                      </span>
                      <strong style={{ color: "#ffffff", fontSize: "13px" }}>Holt-Winters Exponential Smoothing</strong>
                    </div>
                    <p style={styles.methodDesc}>
                      State space ETS model with additive damped trend, level smoothing parameter (α), and trend decay parameter (φ).
                    </p>
                  </div>
                </div>
              ) : (
                <div style={styles.featureList}>
                  {activeModel?.feature_importance?.map((f) => (
                    <div key={f.feature_name} style={styles.featureRow}>
                      <div style={styles.featureMeta}>
                        <span style={styles.featureName}>
                          {f.feature_name === "lag_1"
                            ? "Prior Year Value (Lag 1)"
                            : f.feature_name === "lag_2"
                            ? "Two Years Prior (Lag 2)"
                            : f.feature_name === "lag_3"
                            ? "Three Years Prior (Lag 3)"
                            : f.feature_name === "rolling_mean_3"
                            ? "3-Year Past Rolling Mean"
                            : f.feature_name === "pct_change_1"
                            ? "Past YoY Growth Velocity"
                            : f.feature_name === "year_trend"
                            ? "Linear Year Trend"
                            : f.feature_name}
                        </span>
                        <span style={styles.featureCode}>Parameter / Feature: {f.feature_name}</span>
                      </div>
                      <div style={styles.featureScore}>
                        <span style={styles.scoreVal}>{f.importance_score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const styles = {
  container: {
    padding: "28px 32px",
    maxWidth: "1400px",
    margin: "0 auto",
    color: "#f8fafc",
  },
  header: {
    marginBottom: "16px",
  },
  pageTitle: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 6px 0",
    letterSpacing: "-0.02em",
  },
  pageSubtitle: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: "0",
  },
  noticeBanner: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    border: "1px solid rgba(14, 165, 233, 0.3)",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "20px",
    fontSize: "13px",
    color: "#bae6fd",
    lineHeight: "1.5",
  },
  noticeText: {
    flex: 1,
  },
  lowConfidenceBanner: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    border: "1px solid rgba(245, 158, 11, 0.4)",
    borderRadius: "10px",
    padding: "12px 16px",
    color: "#fde68a",
    fontSize: "13px",
    lineHeight: "1.5",
  },
  filterCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "18px 20px",
    marginBottom: "24px",
  },
  filterHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "14px",
  },
  filterTitle: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#cbd5e1",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  filterForm: {
    display: "flex",
    gap: "14px",
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: "160px",
  },
  filterLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
  },
  select: {
    backgroundColor: "#0b1120",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "9px 12px",
    color: "#f8fafc",
    fontSize: "13px",
    outline: "none",
    width: "100%",
  },
  filterActions: {
    display: "flex",
    gap: "8px",
  },
  applyBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "9px 18px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#f87171",
    padding: "14px 18px",
    borderRadius: "10px",
    fontSize: "14px",
    marginBottom: "20px",
  },
  loadingBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "350px",
    backgroundColor: "#111827",
    borderRadius: "12px",
    border: "1px solid #1f2937",
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid #334155",
    borderTop: "3px solid #8b5cf6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    marginTop: "16px",
    color: "#94a3b8",
    fontSize: "14px",
  },
  emptyState: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "16px",
    padding: "48px 24px",
    textAlign: "center",
    maxWidth: "600px",
    margin: "32px auto",
  },
  emptyIconWrapper: {
    marginBottom: "16px",
  },
  emptyTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 8px 0",
  },
  emptySubtitle: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: "0 0 16px 0",
    lineHeight: "1.6",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  arenaCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "14px",
    padding: "22px 24px",
  },
  arenaHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
    flexWrap: "wrap",
    gap: "10px",
  },
  arenaTitleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  arenaTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 3px 0",
    letterSpacing: "-0.01em",
  },
  arenaSubtitle: {
    fontSize: "13px",
    color: "#94a3b8",
    margin: 0,
  },
  arenaBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    border: "1px solid rgba(168, 85, 247, 0.3)",
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "11px",
    color: "#c084fc",
    fontWeight: "600",
  },
  winnerBanner: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    border: "1px solid rgba(168, 85, 247, 0.3)",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    color: "#e9d5ff",
    marginBottom: "16px",
  },
  arenaTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  modelNameCol: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  modelNameText: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#ffffff",
  },
  modelSubtext: {
    fontSize: "11px",
    color: "#64748b",
  },
  familyBadge: {
    fontSize: "10px",
    fontWeight: "700",
    border: "1px solid",
    borderRadius: "4px",
    padding: "1px 5px",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  benchmarkTitle: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#94a3b8",
  },
  benchmarkSub: {
    fontSize: "11px",
    color: "#64748b",
  },
  specCode: {
    fontSize: "12px",
    color: "#cbd5e1",
    fontFamily: "monospace",
    backgroundColor: "#0b1120",
    padding: "3px 7px",
    borderRadius: "4px",
    border: "1px solid #1e293b",
  },
  bestPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    fontSize: "10px",
    fontWeight: "700",
    color: "#34d399",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    border: "1px solid rgba(16, 185, 129, 0.4)",
    padding: "2px 6px",
    borderRadius: "4px",
    textTransform: "uppercase",
  },
  benchmarkPill: {
    fontSize: "11px",
    color: "#64748b",
    backgroundColor: "#1e293b",
    padding: "3px 8px",
    borderRadius: "4px",
    fontWeight: "600",
  },
  activePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#34d399",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    padding: "4px 10px",
    borderRadius: "6px",
  },
  deployBtn: {
    backgroundColor: "#2563eb",
    border: "none",
    borderRadius: "6px",
    color: "#ffffff",
    padding: "5px 12px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  modelTabBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  modelTabLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#94a3b8",
    marginRight: "4px",
  },
  tabBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "6px",
    padding: "6px 12px",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
  },
  tabBtnActive: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#2563eb",
    border: "1px solid #3b82f6",
    borderRadius: "6px",
    padding: "6px 12px",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  tabBtnActivePurple: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#7c3aed",
    border: "1px solid #8b5cf6",
    borderRadius: "6px",
    padding: "6px 12px",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  chartCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "20px",
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    flexWrap: "wrap",
    gap: "8px",
  },
  chartTitleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  chartTitle: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#f8fafc",
  },
  chartTag: {
    fontSize: "11px",
    color: "#64748b",
    backgroundColor: "#0b1120",
    padding: "2px 8px",
    borderRadius: "4px",
    border: "1px solid #1e293b",
  },
  chartWrapper: {
    width: "100%",
  },
  customTooltip: {
    backgroundColor: "#0b1120",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#f8fafc",
    fontSize: "12px",
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
    gap: "20px",
  },
  detailCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "20px",
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  detailTitleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  detailTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    backgroundColor: "#0b1120",
    color: "#94a3b8",
    fontWeight: "600",
    padding: "9px 10px",
    borderBottom: "1px solid #1f2937",
    textAlign: "left",
  },
  thRight: {
    backgroundColor: "#0b1120",
    color: "#94a3b8",
    fontWeight: "600",
    padding: "9px 10px",
    borderBottom: "1px solid #1f2937",
    textAlign: "right",
  },
  tr: {
    borderBottom: "1px solid #1e293b",
  },
  trBest: {
    borderBottom: "1px solid rgba(168, 85, 247, 0.3)",
    backgroundColor: "rgba(168, 85, 247, 0.05)",
  },
  trBenchmark: {
    borderBottom: "1px dashed #334155",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  td: {
    padding: "10px",
  },
  tdModel: {
    padding: "10px",
    color: "#ffffff",
  },
  tdSpec: {
    padding: "10px",
    color: "#94a3b8",
  },
  tdNumber: {
    padding: "10px",
    textAlign: "right",
    color: "#cbd5e1",
    fontSize: "13px",
  },
  tdYear: {
    padding: "10px",
    color: "#ffffff",
    fontWeight: "700",
  },
  tdForecast: {
    padding: "10px",
    color: "#c084fc",
    textAlign: "right",
    fontWeight: "700",
  },
  tdRange: {
    padding: "10px",
    color: "#94a3b8",
    textAlign: "right",
    fontSize: "12px",
  },
  tdGrowth: {
    padding: "10px",
    textAlign: "right",
    fontWeight: "600",
  },
  growthPositive: {
    color: "#34d399",
  },
  growthNegative: {
    color: "#f87171",
  },
  metricVal: {
    fontWeight: "700",
    color: "#f8fafc",
  },
  metricMuted: {
    color: "#94a3b8",
  },
  r2Positive: {
    fontWeight: "700",
    color: "#34d399",
  },
  r2Negative: {
    fontWeight: "700",
    color: "#f87171",
  },
  r2Neutral: {
    fontWeight: "600",
    color: "#94a3b8",
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  featureRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "10px 14px",
  },
  featureMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  featureName: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#f8fafc",
  },
  featureCode: {
    fontSize: "11px",
    color: "#64748b",
  },
  featureScore: {
    backgroundColor: "#1e293b",
    padding: "4px 8px",
    borderRadius: "6px",
  },
  scoreVal: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#f59e0b",
  },
  methodCard: {
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  methodDesc: {
    fontSize: "12px",
    color: "#94a3b8",
    margin: 0,
    lineHeight: "1.5",
  },
};
