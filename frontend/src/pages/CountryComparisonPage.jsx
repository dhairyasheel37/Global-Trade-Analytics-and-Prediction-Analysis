import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api/client";
import {
  ArrowLeftRight,
  TrendingUp,
  Scale,
  Calendar,
  RotateCcw,
  AlertCircle,
  Activity,
  Globe2,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Formatter for currency values
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

export const CountryComparisonPage = () => {
  // Filter Options State (from /api/dashboard/filter-options)
  const [filterOptions, setFilterOptions] = useState({
    reporters: [],
    years: [],
  });
  const [optionsLoading, setOptionsLoading] = useState(true);

  // Country Selection State
  const [countryA, setCountryA] = useState("IND");
  const [countryB, setCountryB] = useState("USA");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");

  // Comparison Data State
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Trend Metric Toggle
  const [trendMetric, setTrendMetric] = useState("total"); // "total" | "exports" | "imports"

  // 1. Fetch Filter Options on Mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setOptionsLoading(true);
        const res = await api.get("/dashboard/filter-options");
        if (res.data) {
          const reps = res.data.reporters || [];
          const yrs = res.data.years || [];
          setFilterOptions({ reporters: reps, years: yrs });

          // Set default start/end years if available
          if (yrs.length > 0) {
            setStartYear(yrs[0].toString());
            setEndYear(yrs[yrs.length - 1].toString());
          }
        }
      } catch (err) {
        console.error("Failed to load filter options:", err);
      } finally {
        setOptionsLoading(false);
      }
    };
    fetchOptions();
  }, []);

  // 2. Fetch Comparison Data
  const fetchComparison = useCallback(
    async (cA, cB, sY, eY) => {
      if (!cA || !cB) return;

      if (cA.trim().toUpperCase() === cB.trim().toUpperCase()) {
        setError("Country A and Country B must be different countries. Please choose distinct economies to compare.");
        setComparisonData(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const params = { countryA: cA, countryB: cB };
        if (sY) params.start_year = parseInt(sY, 10);
        if (eY) params.end_year = parseInt(eY, 10);

        const res = await api.get("/country-comparison", { params });
        setComparisonData(res.data);
      } catch (err) {
        console.error("Comparison fetch error:", err);
        const detail =
          err.response?.data?.detail || "Failed to load country comparison data. Please verify your selection.";
        setError(detail);
        setComparisonData(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Trigger fetch whenever selection changes
  useEffect(() => {
    if (countryA && countryB && !optionsLoading) {
      fetchComparison(countryA, countryB, startYear, endYear);
    }
  }, [countryA, countryB, startYear, endYear, optionsLoading, fetchComparison]);

  // Swap Country A and Country B
  const handleSwap = () => {
    const temp = countryA;
    setCountryA(countryB);
    setCountryB(temp);
  };

  // Reset Filters
  const handleReset = () => {
    setCountryA("IND");
    setCountryB("USA");
    if (filterOptions.years.length > 0) {
      setStartYear(filterOptions.years[0].toString());
      setEndYear(filterOptions.years[filterOptions.years.length - 1].toString());
    } else {
      setStartYear("");
      setEndYear("");
    }
  };

  // Merge Yearly Trend for Charting
  const mergedTrendData = useMemo(() => {
    if (!comparisonData) return [];
    const yearlyA = comparisonData.countryA?.yearly || [];
    const yearlyB = comparisonData.countryB?.yearly || [];

    const map = new Map();

    yearlyA.forEach((row) => {
      map.set(row.year, {
        year: row.year,
        countryATotal: row.total_value,
        countryAExport: row.export_value,
        countryAImport: row.import_value,
      });
    });

    yearlyB.forEach((row) => {
      const existing = map.get(row.year) || { year: row.year };
      map.set(row.year, {
        ...existing,
        countryBTotal: row.total_value,
        countryBExport: row.export_value,
        countryBImport: row.import_value,
      });
    });

    return Array.from(map.values()).sort((a, b) => a.year - b.year);
  }, [comparisonData]);

  const hasTrendData = mergedTrendData.length >= 2;

  const sideA = comparisonData?.countryA;
  const sideB = comparisonData?.countryB;
  const diff = comparisonData?.difference;

  // Compute Coverage Ratios (Exports / Imports * 100)
  const coverageA = sideA && sideA.imports > 0 ? ((sideA.exports / sideA.imports) * 100).toFixed(1) : "N/A";
  const coverageB = sideB && sideB.imports > 0 ? ((sideB.exports / sideB.imports) * 100).toFixed(1) : "N/A";

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            <div style={styles.iconWrapper}>
              <ArrowLeftRight size={26} color="#3b82f6" />
            </div>
            <h1 style={styles.title} data-testid="country-comparison-title">
              Country Comparison
            </h1>
          </div>
          <p style={styles.subtitle}>
            Head-to-head macroeconomic analysis, trade balance differentials, growth trajectories, and trade coverage across 190 global reporting economies.
          </p>
        </div>
      </div>

      {/* Control / Selection Bar */}
      <div style={styles.controlCard}>
        <div style={styles.controlGrid}>
          {/* Country A Select */}
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>
              <span style={{ ...styles.countryDot, backgroundColor: "#3b82f6" }} />
              Country A (Primary)
            </label>
            <select
              style={styles.selectInput}
              value={countryA}
              onChange={(e) => setCountryA(e.target.value)}
              data-testid="country-a-select"
            >
              {filterOptions.reporters.map((r) => (
                <option key={`a-${r.iso}`} value={r.iso}>
                  {r.desc} ({r.iso})
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div style={styles.swapWrapper}>
            <button
              style={styles.swapBtn}
              onClick={handleSwap}
              title="Swap Country A and Country B"
              data-testid="swap-countries-btn"
            >
              <ArrowLeftRight size={18} color="#f8fafc" />
            </button>
          </div>

          {/* Country B Select */}
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>
              <span style={{ ...styles.countryDot, backgroundColor: "#10b981" }} />
              Country B (Comparative)
            </label>
            <select
              style={styles.selectInput}
              value={countryB}
              onChange={(e) => setCountryB(e.target.value)}
              data-testid="country-b-select"
            >
              {filterOptions.reporters.map((r) => (
                <option key={`b-${r.iso}`} value={r.iso}>
                  {r.desc} ({r.iso})
                </option>
              ))}
            </select>
          </div>

          {/* Start Year */}
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>
              <Calendar size={14} color="#94a3b8" />
              Start Year
            </label>
            <select
              style={styles.selectInput}
              value={startYear}
              onChange={(e) => setStartYear(e.target.value)}
              data-testid="start-year-select"
            >
              <option value="">Earliest ({filterOptions.years[0] || 2014})</option>
              {filterOptions.years.map((y) => (
                <option key={`sy-${y}`} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* End Year */}
          <div style={styles.controlGroup}>
            <label style={styles.controlLabel}>
              <Calendar size={14} color="#94a3b8" />
              End Year
            </label>
            <select
              style={styles.selectInput}
              value={endYear}
              onChange={(e) => setEndYear(e.target.value)}
              data-testid="end-year-select"
            >
              <option value="">Latest ({filterOptions.years[filterOptions.years.length - 1] || 2025})</option>
              {filterOptions.years.map((y) => (
                <option key={`ey-${y}`} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Button */}
          <div style={styles.resetWrapper}>
            <button
              style={styles.resetBtn}
              onClick={handleReset}
              title="Reset comparison defaults"
              data-testid="reset-btn"
            >
              <RotateCcw size={15} />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={styles.errorAlert} data-testid="error-alert">
          <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ color: "#ef4444", fontSize: "14px" }}>Comparison Notice: </strong>
            <span style={{ color: "#fca5a5", fontSize: "14px" }}>{error}</span>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <span style={{ color: "#94a3b8", fontSize: "14px" }}>
            Aggregating and computing comparative trade metrics...
          </span>
        </div>
      )}

      {/* Main Content Area */}
      {!loading && comparisonData && (
        <div style={styles.contentSection}>
          {/* 1. Side-by-Side KPI Cards */}
          <div style={styles.kpiComparisonGrid}>
            {/* Country A KPI Card */}
            <div style={{ ...styles.countryKpiCard, borderColor: "rgba(59, 130, 246, 0.4)" }} data-testid="country-a-kpi-card">
              <div style={styles.countryCardHeader}>
                <div>
                  <div style={styles.countryBadgeA}>Country A</div>
                  <h2 style={styles.countryName}>{sideA?.name}</h2>
                  <span style={styles.countryIso}>ISO: {sideA?.iso}</span>
                </div>
                <div>
                  <span style={styles.macroPill}>UN Comtrade Reporter</span>
                </div>
              </div>

              <div style={styles.metricsList}>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Total Trade Volume:</span>
                  <strong style={styles.metricValue}>{formatCurrency(sideA?.totalTrade)}</strong>
                </div>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Total Exports:</span>
                  <span style={{ ...styles.metricValue, color: "#38bdf8" }}>
                    {formatCurrency(sideA?.exports)}
                    {sideA?.exportGrowth !== null && sideA?.exportGrowth !== undefined && (
                      <small style={{ marginLeft: "6px", color: sideA.exportGrowth >= 0 ? "#10b981" : "#ef4444" }}>
                        ({sideA.exportGrowth > 0 ? "+" : ""}{sideA.exportGrowth}%)
                      </small>
                    )}
                  </span>
                </div>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Total Imports:</span>
                  <span style={{ ...styles.metricValue, color: "#a78bfa" }}>
                    {formatCurrency(sideA?.imports)}
                    {sideA?.importGrowth !== null && sideA?.importGrowth !== undefined && (
                      <small style={{ marginLeft: "6px", color: sideA.importGrowth >= 0 ? "#10b981" : "#ef4444" }}>
                        ({sideA.importGrowth > 0 ? "+" : ""}{sideA.importGrowth}%)
                      </small>
                    )}
                  </span>
                </div>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Net Trade Balance:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong
                      style={{
                        ...styles.metricValue,
                        color: sideA?.tradeBalance >= 0 ? "#10b981" : "#ef4444",
                      }}
                    >
                      {formatCurrency(sideA?.tradeBalance)}
                    </strong>
                    <span
                      style={{
                        ...styles.balanceBadge,
                        backgroundColor: sideA?.tradeBalance >= 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: sideA?.tradeBalance >= 0 ? "#34d399" : "#f87171",
                        borderColor: sideA?.tradeBalance >= 0 ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
                      }}
                    >
                      {sideA?.tradeBalanceStatus}
                    </span>
                  </div>
                </div>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Export Coverage Ratio:</span>
                  <strong style={styles.metricValue}>{coverageA}%</strong>
                </div>
              </div>
            </div>

            {/* Country B KPI Card */}
            <div style={{ ...styles.countryKpiCard, borderColor: "rgba(16, 185, 129, 0.4)" }} data-testid="country-b-kpi-card">
              <div style={styles.countryCardHeader}>
                <div>
                  <div style={styles.countryBadgeB}>Country B</div>
                  <h2 style={styles.countryName}>{sideB?.name}</h2>
                  <span style={styles.countryIso}>ISO: {sideB?.iso}</span>
                </div>
                <div>
                  <span style={styles.macroPill}>UN Comtrade Reporter</span>
                </div>
              </div>

              <div style={styles.metricsList}>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Total Trade Volume:</span>
                  <strong style={styles.metricValue}>{formatCurrency(sideB?.totalTrade)}</strong>
                </div>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Total Exports:</span>
                  <span style={{ ...styles.metricValue, color: "#38bdf8" }}>
                    {formatCurrency(sideB?.exports)}
                    {sideB?.exportGrowth !== null && sideB?.exportGrowth !== undefined && (
                      <small style={{ marginLeft: "6px", color: sideB.exportGrowth >= 0 ? "#10b981" : "#ef4444" }}>
                        ({sideB.exportGrowth > 0 ? "+" : ""}{sideB.exportGrowth}%)
                      </small>
                    )}
                  </span>
                </div>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Total Imports:</span>
                  <span style={{ ...styles.metricValue, color: "#a78bfa" }}>
                    {formatCurrency(sideB?.imports)}
                    {sideB?.importGrowth !== null && sideB?.importGrowth !== undefined && (
                      <small style={{ marginLeft: "6px", color: sideB.importGrowth >= 0 ? "#10b981" : "#ef4444" }}>
                        ({sideB.importGrowth > 0 ? "+" : ""}{sideB.importGrowth}%)
                      </small>
                    )}
                  </span>
                </div>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Net Trade Balance:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong
                      style={{
                        ...styles.metricValue,
                        color: sideB?.tradeBalance >= 0 ? "#10b981" : "#ef4444",
                      }}
                    >
                      {formatCurrency(sideB?.tradeBalance)}
                    </strong>
                    <span
                      style={{
                        ...styles.balanceBadge,
                        backgroundColor: sideB?.tradeBalance >= 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: sideB?.tradeBalance >= 0 ? "#34d399" : "#f87171",
                        borderColor: sideB?.tradeBalance >= 0 ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
                      }}
                    >
                      {sideB?.tradeBalanceStatus}
                    </span>
                  </div>
                </div>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Export Coverage Ratio:</span>
                  <strong style={styles.metricValue}>{coverageB}%</strong>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Difference Summary Strip */}
          <div style={styles.diffCard} data-testid="difference-summary">
            <div style={styles.diffHeader}>
              <Scale size={18} color="#f59e0b" />
              <span style={styles.diffTitle}>
                Net Differential ({diff?.direction || "Country A - Country B"}): {sideA?.name} vs {sideB?.name}
              </span>
            </div>
            <div style={styles.diffGrid}>
              <div style={styles.diffMetricItem}>
                <span style={styles.diffMetricLabel}>Total Trade Delta</span>
                <span style={{ ...styles.diffMetricValue, color: diff?.totalTradeDiff >= 0 ? "#38bdf8" : "#f472b6" }}>
                  {formatCurrency(diff?.totalTradeDiff)}
                </span>
                <span style={styles.diffSubNote}>
                  {diff?.totalTradeDiff >= 0 ? `${sideA?.name} is higher` : `${sideB?.name} is higher`}
                </span>
              </div>
              <div style={styles.diffMetricItem}>
                <span style={styles.diffMetricLabel}>Export Volume Delta</span>
                <span style={{ ...styles.diffMetricValue, color: diff?.exportsDiff >= 0 ? "#34d399" : "#f87171" }}>
                  {formatCurrency(diff?.exportsDiff)}
                </span>
                <span style={styles.diffSubNote}>
                  {diff?.exportsDiff >= 0 ? `${sideA?.name} exports more` : `${sideB?.name} exports more`}
                </span>
              </div>
              <div style={styles.diffMetricItem}>
                <span style={styles.diffMetricLabel}>Import Volume Delta</span>
                <span style={{ ...styles.diffMetricValue, color: diff?.importsDiff >= 0 ? "#a78bfa" : "#fb923c" }}>
                  {formatCurrency(diff?.importsDiff)}
                </span>
                <span style={styles.diffSubNote}>
                  {diff?.importsDiff >= 0 ? `${sideA?.name} imports more` : `${sideB?.name} imports more`}
                </span>
              </div>
              <div style={styles.diffMetricItem}>
                <span style={styles.diffMetricLabel}>Trade Balance Delta</span>
                <span style={{ ...styles.diffMetricValue, color: diff?.tradeBalanceDiff >= 0 ? "#10b981" : "#ef4444" }}>
                  {formatCurrency(diff?.tradeBalanceDiff)}
                </span>
                <span style={styles.diffSubNote}>
                  {diff?.tradeBalanceDiff >= 0 ? `${sideA?.name} net position stronger` : `${sideB?.name} net position stronger`}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Historical Yearly Trend Comparison */}
          <div style={styles.sectionCard} data-testid="yearly-trend-section">
            <div style={styles.sectionHeaderBetween}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <TrendingUp size={20} color="#3b82f6" />
                <h3 style={styles.sectionHeading}>Historical Trend Trajectory (2014–2025)</h3>
              </div>
              {hasTrendData && (
                <div style={styles.metricToggleGroup}>
                  <button
                    style={{
                      ...styles.toggleBtn,
                      backgroundColor: trendMetric === "total" ? "#2563eb" : "#1e293b",
                    }}
                    onClick={() => setTrendMetric("total")}
                  >
                    Total Trade
                  </button>
                  <button
                    style={{
                      ...styles.toggleBtn,
                      backgroundColor: trendMetric === "exports" ? "#2563eb" : "#1e293b",
                    }}
                    onClick={() => setTrendMetric("exports")}
                  >
                    Exports
                  </button>
                  <button
                    style={{
                      ...styles.toggleBtn,
                      backgroundColor: trendMetric === "imports" ? "#2563eb" : "#1e293b",
                    }}
                    onClick={() => setTrendMetric("imports")}
                  >
                    Imports
                  </button>
                </div>
              )}
            </div>

            {hasTrendData ? (
              <div style={{ width: "100%", height: 350, marginTop: "16px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedTrendData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="year" stroke="#94a3b8" />
                    <YAxis
                      stroke="#94a3b8"
                      tickFormatter={(val) => {
                        if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
                        if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
                        if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
                        return `$${val}`;
                      }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc" }}
                      formatter={(val, name) => [formatCurrency(val), name]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey={
                        trendMetric === "total"
                          ? "countryATotal"
                          : trendMetric === "exports"
                          ? "countryAExport"
                          : "countryAImport"
                      }
                      name={`${sideA?.name} (${sideA?.iso})`}
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                      activeDot={{ r: 7 }}
                    />
                    <Line
                      type="monotone"
                      dataKey={
                        trendMetric === "total"
                          ? "countryBTotal"
                          : trendMetric === "exports"
                          ? "countryBExport"
                          : "countryBImport"
                      }
                      name={`${sideB?.name} (${sideB?.iso})`}
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={styles.unavailableNotice}>
                <Activity size={18} color="#94a3b8" />
                <span>Historical trend analysis requires at least 2 years of comparative data.</span>
              </div>
            )}
          </div>

          {/* 4. Comparative Macroeconomic Trade Dynamics Table */}
          <div style={styles.sectionCard} data-testid="macro-comparison-table">
            <div style={styles.sectionCardHeader}>
              <Scale size={20} color="#f59e0b" />
              <div>
                <h3 style={styles.sectionHeading}>Macroeconomic Head-to-Head Alignment</h3>
                <p style={styles.sectionSubtext}>
                  Comprehensive trade metric alignment between {sideA?.name} and {sideB?.name}.
                </p>
              </div>
            </div>

            <div style={styles.tableResponsive}>
              <table style={styles.dataTable}>
                <thead>
                  <tr>
                    <th style={styles.th}>Indicator</th>
                    <th style={styles.thRight}>{sideA?.name} ({sideA?.iso})</th>
                    <th style={styles.thRight}>{sideB?.name} ({sideB?.iso})</th>
                    <th style={styles.thRight}>Differential ({sideA?.iso} − {sideB?.iso})</th>
                    <th style={styles.th}>Comparative Assessment</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={styles.tr}>
                    <td style={styles.td}>
                      <strong>Total Trade Volume</strong>
                    </td>
                    <td style={{ ...styles.tdRight, color: "#38bdf8", fontWeight: 600 }}>
                      {formatCurrency(sideA?.totalTrade)}
                    </td>
                    <td style={{ ...styles.tdRight, color: "#34d399", fontWeight: 600 }}>
                      {formatCurrency(sideB?.totalTrade)}
                    </td>
                    <td
                      style={{
                        ...styles.tdRight,
                        fontWeight: 600,
                        color: (diff?.totalTradeDiff || 0) >= 0 ? "#38bdf8" : "#f472b6",
                      }}
                    >
                      {formatCurrency(diff?.totalTradeDiff)}
                    </td>
                    <td style={styles.td}>
                      {(diff?.totalTradeDiff || 0) >= 0
                        ? `${sideA?.name} handles larger global merchandise trade`
                        : `${sideB?.name} handles larger global merchandise trade`}
                    </td>
                  </tr>

                  <tr style={styles.tr}>
                    <td style={styles.td}>
                      <strong>Total Outbound Exports</strong>
                    </td>
                    <td style={{ ...styles.tdRight, color: "#38bdf8", fontWeight: 600 }}>
                      {formatCurrency(sideA?.exports)}
                    </td>
                    <td style={{ ...styles.tdRight, color: "#34d399", fontWeight: 600 }}>
                      {formatCurrency(sideB?.exports)}
                    </td>
                    <td
                      style={{
                        ...styles.tdRight,
                        fontWeight: 600,
                        color: (diff?.exportsDiff || 0) >= 0 ? "#34d399" : "#f87171",
                      }}
                    >
                      {formatCurrency(diff?.exportsDiff)}
                    </td>
                    <td style={styles.td}>
                      {(diff?.exportsDiff || 0) >= 0
                        ? `${sideA?.name} has higher total exports`
                        : `${sideB?.name} has higher total exports`}
                    </td>
                  </tr>

                  <tr style={styles.tr}>
                    <td style={styles.td}>
                      <strong>Total Inbound Imports</strong>
                    </td>
                    <td style={{ ...styles.tdRight, color: "#38bdf8", fontWeight: 600 }}>
                      {formatCurrency(sideA?.imports)}
                    </td>
                    <td style={{ ...styles.tdRight, color: "#34d399", fontWeight: 600 }}>
                      {formatCurrency(sideB?.imports)}
                    </td>
                    <td
                      style={{
                        ...styles.tdRight,
                        fontWeight: 600,
                        color: (diff?.importsDiff || 0) >= 0 ? "#a78bfa" : "#fb923c",
                      }}
                    >
                      {formatCurrency(diff?.importsDiff)}
                    </td>
                    <td style={styles.td}>
                      {(diff?.importsDiff || 0) >= 0
                        ? `${sideA?.name} imports more merchandise`
                        : `${sideB?.name} imports more merchandise`}
                    </td>
                  </tr>

                  <tr style={styles.tr}>
                    <td style={styles.td}>
                      <strong>Net Trade Balance</strong>
                    </td>
                    <td
                      style={{
                        ...styles.tdRight,
                        color: (sideA?.tradeBalance || 0) >= 0 ? "#10b981" : "#ef4444",
                        fontWeight: 600,
                      }}
                    >
                      {formatCurrency(sideA?.tradeBalance)} ({sideA?.tradeBalanceStatus})
                    </td>
                    <td
                      style={{
                        ...styles.tdRight,
                        color: (sideB?.tradeBalance || 0) >= 0 ? "#10b981" : "#ef4444",
                        fontWeight: 600,
                      }}
                    >
                      {formatCurrency(sideB?.tradeBalance)} ({sideB?.tradeBalanceStatus})
                    </td>
                    <td
                      style={{
                        ...styles.tdRight,
                        fontWeight: 600,
                        color: (diff?.tradeBalanceDiff || 0) >= 0 ? "#10b981" : "#ef4444",
                      }}
                    >
                      {formatCurrency(diff?.tradeBalanceDiff)}
                    </td>
                    <td style={styles.td}>
                      {(diff?.tradeBalanceDiff || 0) >= 0
                        ? `${sideA?.name} holds stronger net position by ${formatCurrency(diff?.tradeBalanceDiff)}`
                        : `${sideB?.name} holds stronger net position by ${formatCurrency(Math.abs(diff?.tradeBalanceDiff || 0))}`}
                    </td>
                  </tr>

                  <tr style={styles.tr}>
                    <td style={styles.td}>
                      <strong>Export Coverage Ratio</strong>
                    </td>
                    <td style={{ ...styles.tdRight, color: "#f8fafc", fontWeight: 600 }}>
                      {coverageA}%
                    </td>
                    <td style={{ ...styles.tdRight, color: "#f8fafc", fontWeight: 600 }}>
                      {coverageB}%
                    </td>
                    <td style={{ ...styles.tdRight, color: "#94a3b8", fontWeight: 600 }}>
                      {coverageA !== "N/A" && coverageB !== "N/A"
                        ? `${(parseFloat(coverageA) - parseFloat(coverageB)).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td style={styles.td}>
                      {parseFloat(coverageA) > 100
                        ? `${sideA?.name} covers all imports with exports`
                        : `${sideA?.name} has import expenditure exceeding exports`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const styles = {
  container: {
    padding: "clamp(12px, 3vw, 28px) clamp(12px, 3vw, 32px)",
    maxWidth: "1400px",
    margin: "0 auto",
    color: "#f8fafc",
    boxSizing: "border-box",
  },
  header: {
    marginBottom: "20px",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "6px",
  },
  iconWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
  },
  title: {
    fontSize: "clamp(20px, 2.5vw, 28px)",
    fontWeight: "700",
    color: "#f8fafc",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: 0,
    lineHeight: 1.5,
  },
  controlCard: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "16px 20px",
    marginBottom: "24px",
  },
  controlGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
    gap: "14px",
    alignItems: "flex-end",
  },
  controlGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  controlLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  countryDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    display: "inline-block",
  },
  selectInput: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    color: "#f8fafc",
    padding: "9px 12px",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  swapWrapper: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingBottom: "2px",
  },
  swapBtn: {
    backgroundColor: "#2563eb",
    border: "none",
    borderRadius: "8px",
    width: "40px",
    height: "38px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
  },
  resetWrapper: {
    display: "flex",
    alignItems: "flex-end",
  },
  resetBtn: {
    backgroundColor: "#334155",
    border: "none",
    color: "#f8fafc",
    padding: "9px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
    height: "38px",
    boxSizing: "border-box",
    transition: "background-color 0.2s ease",
  },
  errorAlert: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "10px",
    padding: "14px 18px",
    marginBottom: "20px",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "60px 20px",
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid #334155",
    borderTop: "3px solid #3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  contentSection: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  kpiComparisonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
    gap: "20px",
  },
  countryKpiCard: {
    backgroundColor: "#1e293b",
    border: "1px solid",
    borderRadius: "12px",
    padding: "20px",
    boxSizing: "border-box",
  },
  countryCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: "14px",
    borderBottom: "1px solid #334155",
    marginBottom: "16px",
  },
  countryBadgeA: {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: "700",
    color: "#60a5fa",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "2px",
  },
  countryBadgeB: {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: "700",
    color: "#34d399",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "2px",
  },
  countryName: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#f8fafc",
    margin: 0,
  },
  countryIso: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  macroPill: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    border: "1px solid rgba(59, 130, 246, 0.25)",
    color: "#93c5fd",
    padding: "4px 10px",
    borderRadius: "14px",
    fontSize: "11px",
    fontWeight: "600",
  },
  metricsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "14px",
    flexWrap: "wrap",
    gap: "6px",
  },
  metricLabel: {
    color: "#94a3b8",
  },
  metricValue: {
    fontWeight: "600",
    color: "#f8fafc",
  },
  balanceBadge: {
    fontSize: "11px",
    fontWeight: "600",
    padding: "2px 8px",
    borderRadius: "6px",
    border: "1px solid",
  },
  diffCard: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "18px 20px",
  },
  diffHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
  },
  diffTitle: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#f8fafc",
  },
  diffGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
    gap: "14px",
  },
  diffMetricItem: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  diffMetricLabel: {
    fontSize: "12px",
    color: "#94a3b8",
    fontWeight: "500",
  },
  diffMetricValue: {
    fontSize: "18px",
    fontWeight: "700",
  },
  diffSubNote: {
    fontSize: "11px",
    color: "#64748b",
  },
  sectionCard: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "20px",
  },
  sectionCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
  },
  sectionHeaderBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
  },
  sectionHeading: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#f8fafc",
    margin: 0,
  },
  sectionSubtext: {
    fontSize: "13px",
    color: "#94a3b8",
    margin: 0,
  },
  metricToggleGroup: {
    display: "flex",
    backgroundColor: "#0f172a",
    padding: "3px",
    borderRadius: "8px",
    border: "1px solid #334155",
  },
  toggleBtn: {
    border: "none",
    color: "#f8fafc",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
  },
  tableResponsive: {
    overflowX: "auto",
    maxWidth: "100%",
  },
  dataTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    color: "#94a3b8",
    borderBottom: "1px solid #334155",
    fontWeight: "600",
  },
  thRight: {
    textAlign: "right",
    padding: "10px 12px",
    color: "#94a3b8",
    borderBottom: "1px solid #334155",
    fontWeight: "600",
  },
  tr: {
    borderBottom: "1px solid #334155",
  },
  td: {
    padding: "10px 12px",
    color: "#f8fafc",
  },
  tdRight: {
    textAlign: "right",
    padding: "10px 12px",
    color: "#f8fafc",
  },
  unavailableNotice: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "30px 16px",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: "14px",
  },
};

export default CountryComparisonPage;
