import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import {
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  RotateCcw,
  AlertCircle,
  Layers,
  Globe2,
  GitCompare,
  Check,
  X,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
} from "recharts";

// Formatter for large monetary numbers
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

export const TradeBalancePage = () => {
  // Filter Options State
  const [filterOptions, setFilterOptions] = useState({
    reporters: [],
    years: [],
    flows: [],
  });

  // Filter Form Inputs
  const [selectedReporter, setSelectedReporter] = useState("GLOBAL");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");

  // Applied Query Params
  const [appliedParams, setAppliedParams] = useState({
    reporter: "GLOBAL",
    start_year: "",
    end_year: "",
  });

  // Summary & Chart Data
  const [summary, setSummary] = useState(null);
  const [yearlyData, setYearlyData] = useState([]);

  // Multi-Country Comparison State
  const [compareSelection, setCompareSelection] = useState(["USA", "CHN", "DEU"]);
  const [compareResults, setCompareResults] = useState([]);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [compareError, setCompareError] = useState(null);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Fetch Filter Options on Mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await api.get("/dashboard/filter-options");
        setFilterOptions(res.data);
        if (res.data.years.length > 0) {
          const firstYr = res.data.years[0];
          const lastYr = res.data.years[res.data.years.length - 1];
          setStartYear(firstYr);
          setEndYear(lastYr);
          setAppliedParams({
            reporter: "GLOBAL",
            start_year: firstYr,
            end_year: lastYr,
          });
        }
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    };
    fetchOptions();
  }, []);

  // 2. Fetch Trade Balance Summary & Yearly Series
  const fetchBalanceData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = {};
    if (appliedParams.reporter && appliedParams.reporter !== "GLOBAL" && appliedParams.reporter !== "ALL") {
      params.reporter = appliedParams.reporter;
    }
    if (appliedParams.start_year) params.start_year = appliedParams.start_year;
    if (appliedParams.end_year) params.end_year = appliedParams.end_year;

    try {
      const [sumRes, yrRes] = await Promise.all([
        api.get("/trade-balance/summary", { params }),
        api.get("/trade-balance/by-year", { params }),
      ]);

      setSummary(sumRes.data);
      setYearlyData(yrRes.data);
    } catch (err) {
      console.error("Trade balance fetch error:", err);
      setError(
        err.response?.data?.detail || "Failed to load trade balance data. Please check connection."
      );
    } finally {
      setLoading(false);
    }
  }, [appliedParams]);

  // 3. Fetch Country Comparison
  const fetchCountryComparison = useCallback(async () => {
    if (compareSelection.length < 2 || compareSelection.length > 5) return;

    setLoadingCompare(true);
    setCompareError(null);

    const params = {
      reporters: compareSelection.join(","),
    };
    if (appliedParams.start_year) params.start_year = appliedParams.start_year;
    if (appliedParams.end_year) params.end_year = appliedParams.end_year;

    try {
      const res = await api.get("/trade-balance/compare-countries", { params });
      setCompareResults(res.data);
    } catch (err) {
      console.error("Comparison fetch error:", err);
      setCompareError(
        err.response?.data?.detail || "Failed to load comparison data. Please verify selections."
      );
    } finally {
      setLoadingCompare(false);
    }
  }, [compareSelection, appliedParams.start_year, appliedParams.end_year]);

  useEffect(() => {
    fetchBalanceData();
  }, [fetchBalanceData]);

  useEffect(() => {
    fetchCountryComparison();
  }, [fetchCountryComparison]);

  // Form Handlers
  const handleApply = (e) => {
    e.preventDefault();
    setAppliedParams({
      reporter: selectedReporter,
      start_year: startYear,
      end_year: endYear,
    });
  };

  const handleReset = () => {
    const firstYr = filterOptions.years[0] || "";
    const lastYr = filterOptions.years[filterOptions.years.length - 1] || "";
    setSelectedReporter("GLOBAL");
    setStartYear(firstYr);
    setEndYear(lastYr);
    setAppliedParams({
      reporter: "GLOBAL",
      start_year: firstYr,
      end_year: lastYr,
    });
  };

  const toggleCompareCountry = (iso) => {
    if (compareSelection.includes(iso)) {
      if (compareSelection.length > 1) {
        setCompareSelection(compareSelection.filter((c) => c !== iso));
      }
    } else {
      if (compareSelection.length < 5) {
        setCompareSelection([...compareSelection, iso]);
      }
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Trade Balance Analysis</h1>
          <p style={styles.pageSubtitle}>
            Macroeconomic net trade balances (Exports − Imports), historical trajectories, and multi-country comparisons
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div style={styles.filterCard}>
        <div style={styles.filterHeader}>
          <Filter size={16} color="#60a5fa" />
          <span style={styles.filterTitle}>Trade Balance Scope</span>
        </div>

        <form onSubmit={handleApply} style={styles.filterForm}>
          {/* Reporter Selector */}
          <div style={{ ...styles.filterGroup, flex: 2 }}>
            <label style={styles.filterLabel}>Country / Geographical Scope</label>
            <select
              value={selectedReporter}
              onChange={(e) => setSelectedReporter(e.target.value)}
              style={styles.select}
            >
              <option value="GLOBAL">Global Cumulative (All 190 Countries)</option>
              {filterOptions.reporters.map((r) => (
                <option key={r.iso} value={r.iso}>
                  {r.desc} ({r.iso})
                </option>
              ))}
            </select>
          </div>

          {/* Start Year */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Start Year</label>
            <select
              value={startYear}
              onChange={(e) => setStartYear(e.target.value)}
              style={styles.select}
            >
              {filterOptions.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* End Year */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>End Year</label>
            <select
              value={endYear}
              onChange={(e) => setEndYear(e.target.value)}
              style={styles.select}
            >
              {filterOptions.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div style={styles.filterActions}>
            <button type="submit" style={styles.applyBtn}>
              Apply Filter
            </button>
            <button type="button" onClick={handleReset} style={styles.resetBtn}>
              <RotateCcw size={14} />
              <span>Reset</span>
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
          <p style={styles.loadingText}>Computing net trade balances and time series...</p>
        </div>
      ) : summary?.no_data ? (
        /* Empty State */
        <div style={styles.emptyState}>
          <div style={styles.emptyIconWrapper}>
            <Layers size={48} color="#64748b" />
          </div>
          <h2 style={styles.emptyTitle}>No records match the selected filters.</h2>
          <p style={styles.emptySubtitle}>
            Try broadening the year range or selecting a different country.
          </p>
          <button onClick={handleReset} style={styles.resetBtnLarge}>
            Reset Filters to Default
          </button>
        </div>
      ) : (
        /* Main View */
        <div style={styles.content}>
          {/* 4 Summary KPI Cards */}
          <div style={styles.kpiGrid}>
            {/* Total Export */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Total Export Volume</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(16, 185, 129, 0.15)" }}>
                  <ArrowUpRight size={20} color="#34d399" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(summary?.total_export)}</div>
              <div style={styles.kpiSub}>Outbound Commodities (X)</div>
            </div>

            {/* Total Import */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Total Import Volume</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(59, 130, 246, 0.15)" }}>
                  <ArrowDownRight size={20} color="#60a5fa" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(summary?.total_import)}</div>
              <div style={styles.kpiSub}>Inbound Commodities (M)</div>
            </div>

            {/* Net Trade Balance */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Net Trade Balance</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(168, 85, 247, 0.15)" }}>
                  <Scale size={20} color="#c084fc" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(summary?.trade_balance)}</div>
              <div style={styles.kpiSub}>Exports minus Imports</div>
            </div>

            {/* Trade Balance Status */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Balance Status</span>
                <Globe2 size={18} color="#94a3b8" />
              </div>
              <div style={{ marginTop: "4px" }}>
                <span
                  style={
                    summary?.trade_balance_status === "Trade Surplus"
                      ? styles.statusSurplusLarge
                      : summary?.trade_balance_status === "Trade Deficit"
                      ? styles.statusDeficitLarge
                      : styles.statusBalancedLarge
                  }
                >
                  {summary?.trade_balance_status}
                </span>
              </div>
              <div style={{ ...styles.kpiSub, marginTop: "8px" }}>
                Scope: {summary?.reporter} ({summary?.start_year}–{summary?.end_year})
              </div>
            </div>
          </div>

          {/* Historical Composed Chart: Exports, Imports & Balance */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <div style={styles.chartTitleGroup}>
                <TrendingUp size={18} color="#a855f7" />
                <span style={styles.chartTitle}>Annual Trade Balance Trajectory</span>
              </div>
              <span style={styles.chartTag}>Grouped Bars + Balance Overlay Line</span>
            </div>
            <div style={styles.chartWrapper}>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={yearlyData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickFormatter={(v) => formatCurrency(v)}
                  />
                  <Tooltip
                    formatter={(v, name) => [
                      formatCurrency(v),
                      name === "export_value"
                        ? "Exports"
                        : name === "import_value"
                        ? "Imports"
                        : "Net Balance",
                    ]}
                    contentStyle={styles.customTooltip}
                  />
                  <Legend
                    formatter={(name) =>
                      name === "export_value"
                        ? "Exports (X)"
                        : name === "import_value"
                        ? "Imports (M)"
                        : "Trade Balance (Net)"
                    }
                    wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
                  />
                  <Bar dataKey="export_value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="import_value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="trade_balance"
                    stroke="#c084fc"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#c084fc" }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cross-Country Comparison Section */}
          <div style={styles.comparisonCard}>
            <div style={styles.comparisonHeader}>
              <div style={styles.chartTitleGroup}>
                <GitCompare size={20} color="#38bdf8" />
                <h3 style={styles.comparisonTitle}>Cross-Country Trade Balance Comparison</h3>
              </div>
              <span style={styles.compareCountBadge}>
                {compareSelection.length} of 5 Countries Selected
              </span>
            </div>

            <p style={styles.comparisonSub}>
              Select 2 to 5 nations to compare export performance, import requirements, and net surpluses/deficits side-by-side:
            </p>

            {/* Quick Country Selection Chips */}
            <div style={styles.chipContainer}>
              {["USA", "CHN", "DEU", "JPN", "GBR", "FRA", "IND", "KOR", "ITA", "CAN", "BRA", "AUS"].map((iso) => {
                const isSelected = compareSelection.includes(iso);
                const countryObj = filterOptions.reporters.find((r) => r.iso === iso);
                const label = countryObj ? `${countryObj.desc} (${iso})` : iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => toggleCompareCountry(iso)}
                    style={isSelected ? styles.chipActive : styles.chipInactive}
                  >
                    {isSelected ? <Check size={14} /> : null}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {compareError && (
              <div style={styles.compareErrorBox}>
                <AlertCircle size={16} color="#f87171" />
                <span>{compareError}</span>
              </div>
            )}

            {/* Comparison Results */}
            {loadingCompare ? (
              <div style={styles.miniLoading}>
                <div style={styles.miniSpinner}></div>
                <span>Computing comparative balances...</span>
              </div>
            ) : compareResults.length >= 2 ? (
              <div style={styles.compareResultsLayout}>
                {/* Comparison Table */}
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Country</th>
                        <th style={styles.thRight}>Total Export</th>
                        <th style={styles.thRight}>Total Import</th>
                        <th style={styles.thRight}>Trade Balance</th>
                        <th style={styles.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareResults.map((r) => (
                        <tr key={r.reporter_iso} style={styles.tr}>
                          <td style={styles.tdCountry}>
                            <span style={styles.isoTag}>{r.reporter_iso}</span>
                            <span>{r.reporter_desc}</span>
                          </td>
                          <td style={styles.tdExport}>{formatCurrency(r.total_export)}</td>
                          <td style={styles.tdImport}>{formatCurrency(r.total_import)}</td>
                          <td style={r.trade_balance >= 0 ? styles.tdSurplus : styles.tdDeficit}>
                            {formatCurrency(r.trade_balance)}
                          </td>
                          <td style={styles.td}>
                            <span
                              style={
                                r.status === "Trade Surplus"
                                  ? styles.statusSurplus
                                  : r.status === "Trade Deficit"
                                  ? styles.statusDeficit
                                  : styles.statusBalanced
                              }
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Comparative Bar Chart */}
                <div style={styles.chartWrapperSmall}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={compareResults} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="reporter_iso" stroke="#64748b" tick={{ fill: "#f8fafc", fontSize: 12, fontWeight: 600 }} />
                      <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} />
                      <Tooltip
                        formatter={(v, name) => [
                          formatCurrency(v),
                          name === "total_export" ? "Exports" : name === "total_import" ? "Imports" : "Net Balance",
                        ]}
                        contentStyle={styles.customTooltip}
                      />
                      <Legend
                        formatter={(name) => (name === "total_export" ? "Exports" : "Imports")}
                        wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                      />
                      <Bar dataKey="total_export" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total_import" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
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
    marginBottom: "20px",
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
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  resetBtn: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "9px 12px",
    color: "#cbd5e1",
    fontSize: "13px",
    fontWeight: "500",
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
    borderTop: "3px solid #3b82f6",
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
    margin: "0 0 24px 0",
    lineHeight: "1.5",
  },
  resetBtnLarge: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
  },
  kpiCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
  },
  kpiHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  kpiLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  kpiIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: "4px",
  },
  kpiSub: {
    fontSize: "11px",
    color: "#64748b",
  },
  statusSurplusLarge: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#34d399",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    padding: "4px 10px",
    borderRadius: "6px",
    display: "inline-block",
  },
  statusDeficitLarge: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#f87171",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: "4px 10px",
    borderRadius: "6px",
    display: "inline-block",
  },
  statusBalancedLarge: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#94a3b8",
    backgroundColor: "rgba(148, 163, 184, 0.15)",
    padding: "4px 10px",
    borderRadius: "6px",
    display: "inline-block",
  },
  statusSurplus: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#34d399",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  statusDeficit: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#f87171",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  statusBalanced: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#94a3b8",
    backgroundColor: "rgba(148, 163, 184, 0.15)",
    padding: "2px 6px",
    borderRadius: "4px",
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
  comparisonCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "20px",
  },
  comparisonHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
    flexWrap: "wrap",
    gap: "8px",
  },
  comparisonTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0",
  },
  compareCountBadge: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    padding: "2px 8px",
    borderRadius: "6px",
  },
  comparisonSub: {
    fontSize: "13px",
    color: "#94a3b8",
    margin: "0 0 14px 0",
  },
  chipContainer: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  chipActive: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "1px solid #3b82f6",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  chipInactive: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#0b1120",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
  },
  compareErrorBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#f87171",
    fontSize: "13px",
    marginBottom: "14px",
  },
  miniLoading: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#94a3b8",
    fontSize: "13px",
    padding: "20px 0",
  },
  miniSpinner: {
    width: "16px",
    height: "16px",
    border: "2px solid #334155",
    borderTop: "2px solid #3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  compareResultsLayout: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
    gap: "20px",
    marginTop: "8px",
  },
  tableWrapper: {
    overflowX: "auto",
    border: "1px solid #1f2937",
    borderRadius: "8px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
    textAlign: "left",
  },
  th: {
    backgroundColor: "#0b1120",
    color: "#94a3b8",
    fontWeight: "600",
    padding: "10px 12px",
    borderBottom: "1px solid #1f2937",
    whiteSpace: "nowrap",
  },
  thRight: {
    backgroundColor: "#0b1120",
    color: "#94a3b8",
    fontWeight: "600",
    padding: "10px 12px",
    borderBottom: "1px solid #1f2937",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #1e293b",
  },
  td: {
    padding: "10px 12px",
    color: "#e2e8f0",
    whiteSpace: "nowrap",
  },
  tdCountry: {
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#ffffff",
    fontWeight: "600",
  },
  isoTag: {
    backgroundColor: "#1e293b",
    color: "#38bdf8",
    padding: "1px 6px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "700",
  },
  tdExport: {
    padding: "10px 12px",
    color: "#34d399",
    textAlign: "right",
    fontWeight: "600",
  },
  tdImport: {
    padding: "10px 12px",
    color: "#60a5fa",
    textAlign: "right",
    fontWeight: "600",
  },
  tdSurplus: {
    padding: "10px 12px",
    color: "#34d399",
    textAlign: "right",
    fontWeight: "700",
  },
  tdDeficit: {
    padding: "10px 12px",
    color: "#f87171",
    textAlign: "right",
    fontWeight: "700",
  },
  chartWrapperSmall: {
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "16px",
  },
};
