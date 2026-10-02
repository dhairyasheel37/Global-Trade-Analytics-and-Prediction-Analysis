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
  if (val === null || val === undefined) return "$0.00";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)} B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)} M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)} K`;
  return `${sign}$${abs.toFixed(2)}`;
};

export const PredictionPage = () => {
  // Filters and Selectors
  const [reportersList, setReportersList] = useState([]);
  const [selectedReporter, setSelectedReporter] = useState("USA");
  const [selectedFlow, setSelectedFlow] = useState("X");
  const [forecastHorizon, setForecastHorizon] = useState(3);
  const [activeModelKey, setActiveModelKey] = useState("best"); // 'best', 'linear_regression', 'random_forest', 'both'

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

  // Determine which model to visualize
  const bestModelKey = predictionData?.best_model || "linear_regression";
  const primaryModelKey = activeModelKey === "best" ? bestModelKey : activeModelKey;
  const activeModel = predictionData?.models?.[primaryModelKey] || predictionData?.models?.["linear_regression"];
  const lrModel = predictionData?.models?.["linear_regression"];
  const rfModel = predictionData?.models?.["random_forest"];

  // Prepare unified time-series chart data points
  const chartData = [];
  if (predictionData?.historical_series) {
    const histMap = {};
    predictionData.historical_series.forEach((p) => {
      histMap[p.year] = { year: p.year, actual: p.actual };
    });

    // Add backtest predictions
    if (activeModel?.backtest_series) {
      activeModel.backtest_series.forEach((b) => {
        if (!histMap[b.year]) histMap[b.year] = { year: b.year };
        histMap[b.year].backtest = b.predicted;
      });
    }

    // Bridge point: Connect last actual observation to the forecast line
    const lastHistYear = predictionData.historical_series[predictionData.historical_series.length - 1]?.year;
    const lastHistVal = predictionData.historical_series[predictionData.historical_series.length - 1]?.actual;

    if (lastHistYear && histMap[lastHistYear]) {
      histMap[lastHistYear].forecast = lastHistVal;
      histMap[lastHistYear].lower_bound = lastHistVal;
      histMap[lastHistYear].upper_bound = lastHistVal;
      histMap[lastHistYear].ci_range = [lastHistVal, lastHistVal];
    }

    // Add future forecast points
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

    Object.keys(histMap)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((y) => chartData.push(histMap[y]));
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Machine Learning Trade Prediction Engine</h1>
          <p style={styles.pageSubtitle}>
            Leakage-free time-series modeling, chronological backtesting, and recursive multi-step forecasting
          </p>
        </div>
      </div>

      {/* Dataset & Small-Data Transparency Disclosure Banner */}
      <div style={styles.noticeBanner}>
        <Info size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
        <span style={styles.noticeText}>
          <strong>Small-Data & Model Reliability Notice:</strong> Time-series models are trained on at most 12 annual observations (2014–2025). With 3-year lag feature engineering, models train on ~7 historical years and test on the final 2–3 years. Forecasts represent baseline statistical trend projections with 95% confidence intervals and must be interpreted with caution alongside domain context.
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
            Engineering lag features, performing chronological split, and training prediction models...
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
            <strong>Available observations after feature engineering:</strong> {predictionData.usable_observations} (Minimum required: {predictionData.required_observations}).
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

          {/* Model Selection Tabs */}
          <div style={styles.modelTabBar}>
            <span style={styles.modelTabLabel}>Model View:</span>
            <button
              type="button"
              onClick={() => setActiveModelKey("best")}
              style={activeModelKey === "best" ? styles.tabBtnActive : styles.tabBtn}
            >
              <Sparkles size={14} color={activeModelKey === "best" ? "#ffffff" : "#60a5fa"} />
              <span>Auto-Selected Best Model ({bestModelKey === "linear_regression" ? "Linear Regression" : "Random Forest"})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModelKey("linear_regression")}
              style={activeModelKey === "linear_regression" ? styles.tabBtnActive : styles.tabBtn}
            >
              <span>Linear Regression</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModelKey("random_forest")}
              style={activeModelKey === "random_forest" ? styles.tabBtnActive : styles.tabBtn}
            >
              <span>Random Forest</span>
            </button>
          </div>

          {/* Model Performance Comparison Cards */}
          <div style={styles.modelGrid}>
            {/* Baseline Benchmark Card */}
            <div style={styles.modelCardBenchmark}>
              <div style={styles.modelCardHeader}>
                <div>
                  <h3 style={styles.modelName}>Naive Mean Baseline</h3>
                  <span style={styles.modelType}>Benchmark Reference</span>
                </div>
                <div style={styles.benchmarkTag}>Benchmark</div>
              </div>

              <div style={styles.metricRow}>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>Baseline Test MAE</span>
                  <span style={styles.metricVal}>{formatCurrency(predictionData.baseline_mae)}</span>
                </div>
              </div>
              <div style={styles.modelCardFooter}>
                Predicts test years as the training set historical mean ($y_{`train\\_mean`}$).
              </div>
            </div>

            {/* Linear Regression Card */}
            <div style={bestModelKey === "linear_regression" ? styles.modelCardBest : styles.modelCard}>
              <div style={styles.modelCardHeader}>
                <div>
                  <h3 style={styles.modelName}>Linear Regression</h3>
                  <span style={styles.modelType}>Parametric Trend Baseline</span>
                </div>
                {bestModelKey === "linear_regression" && (
                  <div style={styles.bestBadge}>
                    <CheckCircle2 size={12} />
                    <span>Best Performer</span>
                  </div>
                )}
              </div>

              <div style={styles.metricRow}>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>MAE</span>
                  <span style={styles.metricVal}>{formatCurrency(lrModel?.metrics.mae)}</span>
                </div>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>RMSE</span>
                  <span style={styles.metricVal}>{formatCurrency(lrModel?.metrics.rmse)}</span>
                </div>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>R² Score</span>
                  <span style={lrModel?.metrics.r2 >= 0 ? styles.r2Positive : styles.r2Negative}>
                    {lrModel?.metrics.r2}
                  </span>
                </div>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>MAPE</span>
                  <span style={styles.metricVal}>{lrModel?.metrics.mape}%</span>
                </div>
              </div>
            </div>

            {/* Random Forest Card */}
            <div style={bestModelKey === "random_forest" ? styles.modelCardBest : styles.modelCard}>
              <div style={styles.modelCardHeader}>
                <div>
                  <h3 style={styles.modelName}>Random Forest</h3>
                  <span style={styles.modelType}>50 Trees, Non-Linear Ensemble</span>
                </div>
                {bestModelKey === "random_forest" && (
                  <div style={styles.bestBadge}>
                    <CheckCircle2 size={12} />
                    <span>Best Performer</span>
                  </div>
                )}
              </div>

              <div style={styles.metricRow}>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>MAE</span>
                  <span style={styles.metricVal}>{formatCurrency(rfModel?.metrics.mae)}</span>
                </div>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>RMSE</span>
                  <span style={styles.metricVal}>{formatCurrency(rfModel?.metrics.rmse)}</span>
                </div>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>R² Score</span>
                  <span style={rfModel?.metrics.r2 >= 0 ? styles.r2Positive : styles.r2Negative}>
                    {rfModel?.metrics.r2}
                  </span>
                </div>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>MAPE</span>
                  <span style={styles.metricVal}>{rfModel?.metrics.mape}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Prediction Chart */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <div style={styles.chartTitleGroup}>
                <TrendingUp size={18} color="#a855f7" />
                <span style={styles.chartTitle}>
                  {predictionData.reporter_name} ({predictionData.flow_desc}): Historical & Multi-Year Projection
                </span>
              </div>
              <span style={styles.chartTag}>
                Visualizing: {activeModel?.display_name}
              </span>
            </div>

            <div style={styles.chartWrapper}>
              <ResponsiveContainer width="100%" height={340}>
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
                        ? "Historical Actual"
                        : name === "backtest"
                        ? "Backtest Prediction"
                        : name === "forecast"
                        ? "Future Forecast"
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
                        ? "Model Forecast (2026–2030)"
                        : name === "ci_range"
                        ? "95% Confidence Interval"
                        : name
                    }
                    wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
                  />
                  {/* Shaded 95% Confidence Interval Area */}
                  <Area
                    type="monotone"
                    dataKey="ci_range"
                    stroke="none"
                    fill="rgba(168, 85, 247, 0.15)"
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
                  {/* Backtest Dashed Line */}
                  <Line
                    type="monotone"
                    dataKey="backtest"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 4, fill: "#f59e0b" }}
                  />
                  {/* Future Forecast Line */}
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#a855f7"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ r: 5, fill: "#a855f7" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Two-Column Grid: Projections Table & Feature Importance */}
          <div style={styles.gridTwo}>
            {/* Projections Table */}
            <div style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <div style={styles.detailTitleGroup}>
                  <Calendar size={18} color="#38bdf8" />
                  <h3 style={styles.detailTitle}>Future Forecast Projections</h3>
                </div>
                <span style={styles.chartTag}>{activeModel?.forecast_series?.length} Projected Years</span>
              </div>

              <div style={styles.tableWrapper}>
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
                            <span style={pt.growth_pct >= 0 ? styles.growthPositive : styles.growthNegative}>
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
              </div>
            </div>

            {/* Feature Weighting / Importance Breakdown */}
            <div style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <div style={styles.detailTitleGroup}>
                  <BarChart2 size={18} color="#f59e0b" />
                  <h3 style={styles.detailTitle}>Feature Weightings & Lag Importance</h3>
                </div>
                <span style={styles.chartTag}>Leakage-Free Features</span>
              </div>

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
                          : "Linear Year Trend"}
                      </span>
                      <span style={styles.featureCode}>Feature: {f.feature_name}</span>
                    </div>
                    <div style={styles.featureScore}>
                      <span style={styles.scoreVal}>{f.importance_score}</span>
                    </div>
                  </div>
                ))}
              </div>
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
  modelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },
  modelCardBenchmark: {
    backgroundColor: "#0b1120",
    border: "1px dashed #334155",
    borderRadius: "12px",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  modelCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
  },
  modelCardBest: {
    backgroundColor: "#111827",
    border: "1px solid rgba(168, 85, 247, 0.6)",
    borderRadius: "12px",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 0 15px rgba(168, 85, 247, 0.1)",
  },
  modelCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "14px",
  },
  modelName: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 2px 0",
  },
  modelType: {
    fontSize: "11px",
    color: "#64748b",
  },
  benchmarkTag: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#94a3b8",
    backgroundColor: "#1e293b",
    padding: "2px 8px",
    borderRadius: "4px",
  },
  bestBadge: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#c084fc",
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    padding: "2px 8px",
    borderRadius: "4px",
    border: "1px solid rgba(168, 85, 247, 0.3)",
  },
  metricRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "10px",
  },
  metricItem: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  metricLabel: {
    fontSize: "11px",
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  metricVal: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#f8fafc",
  },
  r2Positive: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#34d399",
  },
  r2Negative: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#f87171",
  },
  modelCardFooter: {
    fontSize: "11px",
    color: "#64748b",
    marginTop: "12px",
    lineHeight: "1.4",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
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
};
