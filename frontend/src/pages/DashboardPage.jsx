import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Globe2,
  Map,
  FileSpreadsheet,
  Filter,
  RotateCcw,
  Info,
  X,
  AlertCircle,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Layers,
} from "lucide-react";
import ScopeNoticeBanner from "../components/ScopeNoticeBanner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Currency Formatter for Large Numbers (Trillions, Billions, Millions)
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

const FLOW_COLORS = {
  M: "#3b82f6", // Blue for Imports
  X: "#10b981", // Emerald for Exports
  Import: "#3b82f6",
  Export: "#10b981",
};

export const DashboardPage = () => {
  const navigate = useNavigate();

  // Filter Options (Populated from backend)
  const [filterOptions, setFilterOptions] = useState({
    reporters: [],
    years: [],
    flows: [],
  });

  // Selected Filter State
  const [selectedReporter, setSelectedReporter] = useState("ALL");
  const [selectedFlow, setSelectedFlow] = useState("ALL");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");

  // Active Applied Filters (for triggering API calls)
  const [appliedFilters, setAppliedFilters] = useState({
    reporter: "ALL",
    flow: "ALL",
    start_year: "",
    end_year: "",
  });

  // Data States
  const [kpis, setKpis] = useState(null);
  const [tradeByYear, setTradeByYear] = useState([]);
  const [importExportByYear, setImportExportByYear] = useState([]);
  const [topReporters, setTopReporters] = useState([]);
  const [flowDistribution, setFlowDistribution] = useState([]);
  const [tradeBalanceByYear, setTradeBalanceByYear] = useState([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNotice, setShowNotice] = useState(true);

  // 1. Fetch Filter Options on Initial Mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await api.get("/dashboard/filter-options");
        setFilterOptions(res.data);
        if (res.data.years.length > 0) {
          setStartYear(res.data.years[0]);
          setEndYear(res.data.years[res.data.years.length - 1]);
          setAppliedFilters((prev) => ({
            ...prev,
            start_year: res.data.years[0],
            end_year: res.data.years[res.data.years.length - 1],
          }));
        }
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    };
    fetchOptions();
  }, []);

  // 2. Fetch Dashboard Data based on Applied Filters
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = {};
    if (appliedFilters.reporter && appliedFilters.reporter !== "ALL") {
      params.reporter = appliedFilters.reporter;
    }
    if (appliedFilters.flow && appliedFilters.flow !== "ALL") {
      params.flow = appliedFilters.flow;
    }
    if (appliedFilters.start_year) {
      params.start_year = appliedFilters.start_year;
    }
    if (appliedFilters.end_year) {
      params.end_year = appliedFilters.end_year;
    }

    try {
      const [
        kpiRes,
        tradeYearRes,
        importExportRes,
        topRepRes,
        flowDistRes,
        balanceYearRes,
      ] = await Promise.all([
        api.get("/dashboard/kpis", { params }),
        api.get("/dashboard/trade-by-year", { params }),
        api.get("/dashboard/import-export-by-year", { params }),
        api.get("/dashboard/top-reporters", { params: { ...params, limit: 10 } }),
        api.get("/dashboard/flow-distribution", { params }),
        api.get("/dashboard/trade-balance-by-year", { params }),
      ]);

      setKpis(kpiRes.data);
      setTradeByYear(tradeYearRes.data);
      setImportExportByYear(importExportRes.data);
      setTopReporters(topRepRes.data);
      setFlowDistribution(flowDistRes.data);
      setTradeBalanceByYear(balanceYearRes.data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(
        err.response?.data?.detail || "Failed to load dashboard data. Please verify your connection."
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Filter Handlers
  const handleApplyFilters = (e) => {
    e.preventDefault();
    setAppliedFilters({
      reporter: selectedReporter,
      flow: selectedFlow,
      start_year: startYear,
      end_year: endYear,
    });
  };

  const handleResetFilters = () => {
    const defaultStart = filterOptions.years[0] || "";
    const defaultEnd = filterOptions.years[filterOptions.years.length - 1] || "";
    setSelectedReporter("ALL");
    setSelectedFlow("ALL");
    setStartYear(defaultStart);
    setEndYear(defaultEnd);
    setAppliedFilters({
      reporter: "ALL",
      flow: "ALL",
      start_year: defaultStart,
      end_year: defaultEnd,
    });
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Global Trade Overview</h1>
          <p style={styles.pageSubtitle}>
            Interactive analytical insights and trade volume distributions (2014–2025)
          </p>
        </div>
        <button
          onClick={() => navigate("/map")}
          style={styles.globalMapHeaderBtn}
          title="Open interactive geospatial world map"
        >
          <Map size={16} />
          <span>Interactive Global Map</span>
        </button>
      </div>

      {/* Dataset Limitation Notice Banner */}
      <ScopeNoticeBanner />

      {/* Global Filter Bar */}
      <div style={styles.filterCard}>
        <div style={styles.filterHeader}>
          <Filter size={16} color="#60a5fa" />
          <span style={styles.filterTitle}>Global Filters</span>
        </div>

        <form onSubmit={handleApplyFilters} style={styles.filterForm}>
          {/* Reporter Country Dropdown */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Reporter Country</label>
            <select
              value={selectedReporter}
              onChange={(e) => setSelectedReporter(e.target.value)}
              style={styles.select}
            >
              <option value="ALL">All Countries ({filterOptions.reporters.length})</option>
              {filterOptions.reporters.map((r) => (
                <option key={r.iso} value={r.iso}>
                  {r.desc} ({r.iso})
                </option>
              ))}
            </select>
          </div>

          {/* Trade Flow Dropdown */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Trade Flow</label>
            <select
              value={selectedFlow}
              onChange={(e) => setSelectedFlow(e.target.value)}
              style={styles.select}
            >
              <option value="ALL">All Flows (Import & Export)</option>
              {filterOptions.flows.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.desc} ({f.code})
                </option>
              ))}
            </select>
          </div>

          {/* Start Year Dropdown */}
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

          {/* End Year Dropdown */}
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
              Apply Filters
            </button>
            <button type="button" onClick={handleResetFilters} style={styles.resetBtn}>
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
          <p style={styles.loadingText}>Computing live trade metrics & visualizations...</p>
        </div>
      ) : kpis?.no_data ? (
        /* Empty Filter State */
        <div style={styles.emptyState}>
          <div style={styles.emptyIconWrapper}>
            <Layers size={48} color="#64748b" />
          </div>
          <h2 style={styles.emptyTitle}>No records match the selected filters.</h2>
          <p style={styles.emptySubtitle}>
            Try selecting a broader year range, another reporter country, or resetting your filter criteria.
          </p>
          <button onClick={handleResetFilters} style={styles.resetBtnLarge}>
            Reset Filters to Default
          </button>
        </div>
      ) : (
        /* Main Dashboard Content */
        <div style={styles.content}>
          {/* 6 KPI Summary Cards */}
          <div style={styles.kpiGrid}>
            {/* Total Trade Value */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Total Trade Value</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(59, 130, 246, 0.15)" }}>
                  <DollarSign size={20} color="#60a5fa" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(kpis?.total_trade_value)}</div>
              <div style={styles.kpiSub}>Export + Import Trade Volume</div>
            </div>

            {/* Total Exports */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Total Export</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(16, 185, 129, 0.15)" }}>
                  <ArrowUpRight size={20} color="#34d399" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(kpis?.total_export)}</div>
              <div style={styles.kpiSub}>Outbound Commodities</div>
            </div>

            {/* Total Imports */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Total Import</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(245, 158, 11, 0.15)" }}>
                  <ArrowDownRight size={20} color="#fbbf24" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(kpis?.total_import)}</div>
              <div style={styles.kpiSub}>Inbound Commodities</div>
            </div>

            {/* Trade Balance */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Trade Balance</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(168, 85, 247, 0.15)" }}>
                  <Scale size={20} color="#c084fc" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(kpis?.trade_balance)}</div>
              <div style={styles.balanceStatus}>
                <span
                  style={
                    kpis?.trade_balance_status === "Trade Surplus"
                      ? styles.statusSurplus
                      : kpis?.trade_balance_status === "Trade Deficit"
                      ? styles.statusDeficit
                      : styles.statusBalanced
                  }
                >
                  {kpis?.trade_balance_status}
                </span>
              </div>
            </div>

            {/* Number of Countries */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Reporting Countries</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(14, 165, 233, 0.15)" }}>
                  <Globe2 size={20} color="#38bdf8" />
                </div>
              </div>
              <div style={styles.kpiValue}>{kpis?.num_countries}</div>
              <div style={styles.kpiSub}>Distinct Reporter ISOs</div>
            </div>

            {/* Number of Records */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Observed Records</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(236, 72, 153, 0.15)" }}>
                  <FileSpreadsheet size={20} color="#f472b6" />
                </div>
              </div>
              <div style={styles.kpiValue}>{kpis?.num_records?.toLocaleString()}</div>
              <div style={styles.kpiSub}>Matching Data Rows</div>
            </div>
          </div>

          {/* Charts Row 1: Yearly Trend & Import vs Export */}
          <div style={styles.chartRow}>
            {/* Chart 1: Year-wise Total Trade Value */}
            <div style={styles.chartCard}>
              <div style={styles.chartHeader}>
                <div style={styles.chartTitleGroup}>
                  <TrendingUp size={18} color="#3b82f6" />
                  <span style={styles.chartTitle}>Year-wise Total Trade Value</span>
                </div>
                <span style={styles.chartTag}>Line Trend</span>
              </div>
              <div style={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={tradeByYear} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <Tooltip
                      formatter={(v) => [formatCurrency(v), "Total Trade"]}
                      contentStyle={styles.customTooltip}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_trade_value"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#3b82f6" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Import vs Export by Year */}
            <div style={styles.chartCard}>
              <div style={styles.chartHeader}>
                <div style={styles.chartTitleGroup}>
                  <BarChart3 size={18} color="#10b981" />
                  <span style={styles.chartTitle}>Import vs. Export by Year</span>
                </div>
                <span style={styles.chartTag}>Grouped Bar</span>
              </div>
              <div style={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={importExportByYear} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
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
                        name === "import_value" ? "Imports (M)" : "Exports (X)",
                      ]}
                      contentStyle={styles.customTooltip}
                    />
                    <Legend
                      formatter={(name) => (name === "import_value" ? "Imports (M)" : "Exports (X)")}
                      wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
                    />
                    <Bar dataKey="import_value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="export_value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2: Top Reporters & Flow Distribution Donut */}
          <div style={styles.chartRow}>
            {/* Chart 3: Top 10 Reporter Countries */}
            <div style={{ ...styles.chartCard, flex: 1.5 }}>
              <div style={styles.chartHeader}>
                <div style={styles.chartTitleGroup}>
                  <Globe2 size={18} color="#38bdf8" />
                  <span style={styles.chartTitle}>Top 10 Reporter Countries</span>
                </div>
                <span style={styles.chartTag}>Trade Volume (USD)</span>
              </div>
              <div style={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={topReporters}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#64748b"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="reporter_iso"
                      stroke="#64748b"
                      tick={{ fill: "#f1f5f9", fontSize: 12, fontWeight: 600 }}
                    />
                    <Tooltip
                      formatter={(v, name, item) => [
                        formatCurrency(v),
                        `${item.payload.reporter_desc} (${item.payload.reporter_iso})`,
                      ]}
                      contentStyle={styles.customTooltip}
                    />
                    <Bar dataKey="total_value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Trade Flow Distribution Donut */}
            <div style={{ ...styles.chartCard, flex: 1 }}>
              <div style={styles.chartHeader}>
                <div style={styles.chartTitleGroup}>
                  <PieIcon size={18} color="#f59e0b" />
                  <span style={styles.chartTitle}>Trade Flow Split</span>
                </div>
                <span style={styles.chartTag}>Donut Ratio</span>
              </div>
              <div style={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={flowDistribution}
                      dataKey="value"
                      nameKey="flow"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {flowDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={FLOW_COLORS[entry.flow_code] || (index === 0 ? "#3b82f6" : "#10b981")}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, name, item) => [
                        `${formatCurrency(v)} (${item.payload.percentage}%)`,
                        item.payload.flow,
                      ]}
                      contentStyle={styles.customTooltip}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 3: Trade Balance by Year */}
          <div style={styles.chartRowSingle}>
            <div style={styles.chartCard}>
              <div style={styles.chartHeader}>
                <div style={styles.chartTitleGroup}>
                  <Scale size={18} color="#a855f7" />
                  <span style={styles.chartTitle}>Annual Trade Balance (Exports − Imports)</span>
                </div>
                <span style={styles.chartTag}>Surplus (+) / Deficit (−)</span>
              </div>
              <div style={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={tradeBalanceByYear} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <Tooltip
                      formatter={(v, name, item) => [
                        `${formatCurrency(v)} (${item.payload.status})`,
                        "Trade Balance",
                      ]}
                      contentStyle={styles.customTooltip}
                    />
                    <Bar dataKey="trade_balance">
                      {tradeBalanceByYear.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.trade_balance >= 0 ? "#10b981" : "#ef4444"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
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
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "20px",
  },
  globalMapHeaderBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
    transition: "all 0.15s ease",
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
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    border: "1px solid rgba(14, 165, 233, 0.3)",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "20px",
  },
  noticeContent: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
  },
  noticeText: {
    fontSize: "13px",
    color: "#bae6fd",
    lineHeight: "1.5",
  },
  closeNoticeBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: "#7dd3fc",
    cursor: "pointer",
    padding: "2px",
    marginLeft: "8px",
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
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr)) 180px",
    gap: "14px",
    alignItems: "flex-end",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
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
    flex: 1,
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "9px 12px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 0.15s",
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
  balanceStatus: {
    marginTop: "2px",
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
  chartRow: {
    display: "flex",
    gap: "20px",
    flexWrap: "wrap",
  },
  chartRowSingle: {
    width: "100%",
  },
  chartCard: {
    flex: 1,
    minWidth: "320px",
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
};
