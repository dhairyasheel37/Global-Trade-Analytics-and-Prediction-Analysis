import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  FileSpreadsheet,
  Filter,
  RotateCcw,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  TrendingUp,
  BarChart3,
  Layers,
  AlertCircle,
  Hash,
  ChevronLeft,
  ChevronRight,
  Calculator,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import ScopeNoticeBanner from "../components/ScopeNoticeBanner";

// Formatter for large monetary values
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

export const TradeAnalysisPage = () => {
  // Filter Options State
  const [filterOptions, setFilterOptions] = useState({
    reporters: [],
    years: [],
    flows: [],
    partners: [],
    products: [],
  });

  // Filter Form Inputs
  const [selectedReporter, setSelectedReporter] = useState("ALL");
  const [selectedFlow, setSelectedFlow] = useState("ALL");
  const [selectedPartner, setSelectedPartner] = useState("ALL");
  const [selectedProduct, setSelectedProduct] = useState("ALL");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");

  // Applied Filters (Used across API queries)
  const [appliedFilters, setAppliedFilters] = useState({
    reporter: "ALL",
    flow: "ALL",
    start_year: "",
    end_year: "",
    partner: "ALL",
    product: "ALL",
  });

  // Analytics & Charts Data
  const [stats, setStats] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [importExportData, setImportExportData] = useState([]);

  // Table Data & Server-side Params
  const [tableRecords, setTableRecords] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState("refYear");
  const [sortOrder, setSortOrder] = useState("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // UI States
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
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
          setAppliedFilters((prev) => ({
            ...prev,
            start_year: firstYr,
            end_year: lastYr,
          }));
        }
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    };
    fetchOptions();
  }, []);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. Fetch Aggregated Stats & Charts Data
  const fetchStatsAndCharts = useCallback(async () => {
    setLoadingStats(true);
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
    if (appliedFilters.partner && appliedFilters.partner !== "ALL") {
      params.partner = appliedFilters.partner;
    }
    if (appliedFilters.product && appliedFilters.product !== "ALL") {
      params.product = appliedFilters.product;
    }

    try {
      const [statsRes, trendRes, impExpRes] = await Promise.all([
        api.get("/trade-analysis/stats", { params }),
        api.get("/trade-analysis/trend", { params }),
        api.get("/trade-analysis/import-export", { params }),
      ]);

      setStats(statsRes.data);
      setTrendData(trendRes.data);
      setImportExportData(impExpRes.data);
    } catch (err) {
      console.error("Trade analysis stats fetch error:", err);
      setError(
        err.response?.data?.detail || "Failed to load trade analysis stats. Please check connection."
      );
    } finally {
      setLoadingStats(false);
    }
  }, [appliedFilters]);

  // 3. Fetch Server-Side Paginated, Sorted, and Searched Table Records
  const fetchTableRecords = useCallback(async () => {
    setLoadingTable(true);

    const params = {
      page,
      page_size: pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
    };
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
    if (appliedFilters.partner && appliedFilters.partner !== "ALL") {
      params.partner = appliedFilters.partner;
    }
    if (appliedFilters.product && appliedFilters.product !== "ALL") {
      params.product = appliedFilters.product;
    }
    if (debouncedSearch && debouncedSearch.trim()) {
      params.search = debouncedSearch.trim();
    }

    try {
      const res = await api.get("/trade-analysis/records", { params });
      setTableRecords(res.data.records);
      setTotalCount(res.data.total_count);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      console.error("Table records fetch error:", err);
    } finally {
      setLoadingTable(false);
    }
  }, [appliedFilters, page, pageSize, sortBy, sortOrder, debouncedSearch]);

  useEffect(() => {
    fetchStatsAndCharts();
  }, [fetchStatsAndCharts]);

  useEffect(() => {
    fetchTableRecords();
  }, [fetchTableRecords]);

  // Filter Handlers with Immediate Auto-Synchronization
  const handleReporterChange = (val) => {
    setSelectedReporter(val);
    setPage(1);
    setAppliedFilters((prev) => ({ ...prev, reporter: val }));
  };

  const handleFlowChange = (val) => {
    setSelectedFlow(val);
    setPage(1);
    setAppliedFilters((prev) => ({ ...prev, flow: val }));
  };

  const handlePartnerChange = (val) => {
    setSelectedPartner(val);
    setPage(1);
    setAppliedFilters((prev) => ({ ...prev, partner: val }));
  };

  const handleProductChange = (val) => {
    setSelectedProduct(val);
    setPage(1);
    setAppliedFilters((prev) => ({ ...prev, product: val }));
  };

  const handleStartYearChange = (val) => {
    setStartYear(val);
    let finalEnd = endYear;
    if (val && endYear && Number(val) > Number(endYear)) {
      finalEnd = val;
      setEndYear(val);
    }
    setPage(1);
    setAppliedFilters((prev) => ({
      ...prev,
      start_year: val,
      end_year: finalEnd,
    }));
  };

  const handleEndYearChange = (val) => {
    setEndYear(val);
    let finalStart = startYear;
    if (val && startYear && Number(val) < Number(startYear)) {
      finalStart = val;
      setStartYear(val);
    }
    setPage(1);
    setAppliedFilters((prev) => ({
      ...prev,
      end_year: val,
      start_year: finalStart,
    }));
  };

  const handleApplyFilters = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setPage(1);
    setAppliedFilters({
      reporter: selectedReporter,
      flow: selectedFlow,
      start_year: startYear,
      end_year: endYear,
      partner: selectedPartner,
      product: selectedProduct,
    });
  };

  const handleResetFilters = () => {
    const defaultStart = filterOptions.years && filterOptions.years.length > 0 ? filterOptions.years[0] : "";
    const defaultEnd = filterOptions.years && filterOptions.years.length > 0 ? filterOptions.years[filterOptions.years.length - 1] : "";
    setSelectedReporter("ALL");
    setSelectedFlow("ALL");
    setSelectedPartner("ALL");
    setSelectedProduct("ALL");
    setStartYear(defaultStart);
    setEndYear(defaultEnd);
    setSearchTerm("");
    setDebouncedSearch("");
    setPage(1);
    setSortBy("refYear");
    setSortOrder("desc");
    setAppliedFilters({
      reporter: "ALL",
      flow: "ALL",
      partner: "ALL",
      product: "ALL",
      start_year: defaultStart,
      end_year: defaultEnd,
    });
  };

  // Sorting Header Click Handler
  const handleSort = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnKey);
      setSortOrder("desc");
    }
    setPage(1);
  };

  // CSV Export Generation
  const handleExportCSV = () => {
    if (!tableRecords || tableRecords.length === 0) return;

    const headers = [
      "ID",
      "Year",
      "Reporter ISO",
      "Reporter Name",
      "Flow Code",
      "Flow Description",
      "Partner ISO",
      "Partner Description",
      "Commodity Code",
      "Primary Value (USD)",
      "CIF Value (USD)",
      "FOB Value (USD)",
      "Net Weight (kg)",
      "Quantity",
    ];

    const rows = tableRecords.map((r) => [
      r.id,
      r.refYear,
      `"${r.reporterISO}"`,
      `"${r.reporterDesc}"`,
      `"${r.flowCode}"`,
      `"${r.flowDesc}"`,
      `"${r.partnerISO}"`,
      `"${r.partnerDesc}"`,
      `"${r.cmdCode}"`,
      r.primaryValue,
      r.cifvalue !== null ? r.cifvalue : "",
      r.fobvalue !== null ? r.fobvalue : "",
      r.netWgt !== null ? r.netWgt : "",
      r.qty !== null ? r.qty : "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Trade_Analysis_Export_${appliedFilters.reporter}_${appliedFilters.flow}_page${page}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortIcon = (columnKey) => {
    if (sortBy !== columnKey) {
      return <ArrowUpDown size={14} color="#64748b" style={{ marginLeft: "4px" }} />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp size={14} color="#3b82f6" style={{ marginLeft: "4px" }} />
    ) : (
      <ArrowDown size={14} color="#3b82f6" style={{ marginLeft: "4px" }} />
    );
  };

  return (
    <div style={styles.container}>
      {/* Page Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Trade Flow Analysis</h1>
          <p style={styles.pageSubtitle}>
            Drill-down statistical examination, historical time-series, and detailed record explorer
          </p>
        </div>
      </div>

      {/* Scope Notice Banner */}
      <ScopeNoticeBanner />

      {/* Filter Bar */}
      <div style={styles.filterCard}>
        <div style={styles.filterHeader}>
          <Filter size={16} color="#60a5fa" />
          <span style={styles.filterTitle}>Trade Analysis Filters</span>
        </div>

        <form onSubmit={handleApplyFilters} style={styles.filterForm}>
          {/* Reporter Country */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Reporter Country</label>
            <select
              data-testid="reporter-select"
              value={selectedReporter}
              onChange={(e) => handleReporterChange(e.target.value)}
              style={styles.select}
            >
              <option value="ALL">All Countries ({filterOptions.reporters?.length || 0})</option>
              {filterOptions.reporters?.map((r) => (
                <option key={r.iso} value={r.iso}>
                  {r.iso === "ALL" ? r.desc : `${r.desc} (${r.iso})`}
                </option>
              ))}
            </select>
          </div>

          {/* Trade Flow */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Trade Flow</label>
            <select
              data-testid="flow-select"
              value={selectedFlow}
              onChange={(e) => handleFlowChange(e.target.value)}
              style={styles.select}
            >
              <option value="ALL">All Flows (Import & Export)</option>
              {filterOptions.flows?.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.desc} ({f.code})
                </option>
              ))}
            </select>
          </div>

          {/* Partner Country */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Partner Country</label>
            <select
              data-testid="partner-select"
              value={selectedPartner}
              onChange={(e) => handlePartnerChange(e.target.value)}
              style={styles.select}
            >
              {filterOptions.partners && filterOptions.partners.length > 0 ? (
                filterOptions.partners.map((p) => (
                  <option key={p.iso} value={p.iso}>
                    {p.iso === "ALL" ? p.desc : `${p.desc} (${p.iso})`}
                  </option>
                ))
              ) : (
                <option value="ALL">All Partners (World aggregate)</option>
              )}
            </select>
          </div>

          {/* Product Category */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Product Category</label>
            <select
              data-testid="product-select"
              value={selectedProduct}
              onChange={(e) => handleProductChange(e.target.value)}
              style={styles.select}
            >
              {filterOptions.products && filterOptions.products.length > 0 ? (
                filterOptions.products.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code === "ALL" ? p.desc : `${p.desc} (${p.code})`}
                  </option>
                ))
              ) : (
                <option value="ALL">All Commodities (TOTAL aggregate)</option>
              )}
            </select>
          </div>

          {/* Start Year */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Start Year</label>
            <select
              data-testid="start-year-select"
              value={startYear}
              onChange={(e) => handleStartYearChange(e.target.value)}
              style={styles.select}
            >
              {filterOptions.years?.map((y) => (
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
              data-testid="end-year-select"
              value={endYear}
              onChange={(e) => handleEndYearChange(e.target.value)}
              style={styles.select}
            >
              {filterOptions.years?.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <div style={styles.filterActions}>
            <button type="submit" style={styles.applyBtn} data-testid="apply-filters-btn">
              Apply Filters
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              style={styles.resetBtn}
              data-testid="reset-filters-btn"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>
        </form>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={styles.errorBanner}>
          <AlertCircle size={20} color="#f87171" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Overlay */}
      {loadingStats ? (
        <div style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Computing trade statistics and record sets...</p>
        </div>
      ) : stats?.no_data ? (
        /* Empty Filter State */
        <div style={styles.emptyState}>
          <div style={styles.emptyIconWrapper}>
            <Layers size={48} color="#64748b" />
          </div>
          <h2 style={styles.emptyTitle}>No records match the selected filters.</h2>
          <p style={styles.emptySubtitle}>
            Try selecting a broader year range or resetting your filter criteria.
          </p>
          <button onClick={handleResetFilters} style={styles.resetBtnLarge}>
            Reset Filters to Default
          </button>
        </div>
      ) : (
        <div style={styles.content}>
          {/* 8 Stats Cards Grid */}
          <div style={styles.statsGrid}>
            {/* Total Trade Value */}
            <div style={styles.statCard} data-testid="stat-total-trade-value">
              <div style={styles.statHeader}>
                <span style={styles.statLabel}>Total Trade Value</span>
                <DollarSign size={18} color="#60a5fa" />
              </div>
              <div style={styles.statValue} data-testid="total-trade-value">
                {formatCurrency(stats?.total_trade_value)}
              </div>
              <div style={styles.statSub}>Sum of all matching flows</div>
            </div>

            {/* Average Trade Value */}
            <div style={styles.statCard} data-testid="stat-average-trade-value">
              <div style={styles.statHeader}>
                <span style={styles.statLabel}>Average Trade Value</span>
                <Calculator size={18} color="#38bdf8" />
              </div>
              <div style={styles.statValue} data-testid="average-trade-value">
                {formatCurrency(stats?.average_trade_value)}
              </div>
              <div style={styles.statSub}>Mean value per record</div>
            </div>

            {/* Min Trade Value */}
            <div style={styles.statCard} data-testid="stat-min-trade-value">
              <div style={styles.statHeader}>
                <span style={styles.statLabel}>Min Trade Value</span>
                <ArrowDownRight size={18} color="#94a3b8" />
              </div>
              <div style={styles.statValue} data-testid="min-trade-value">
                {formatCurrency(stats?.min_trade_value)}
              </div>
              <div style={styles.statSub}>Lowest recorded trade</div>
            </div>

            {/* Max Trade Value */}
            <div style={styles.statCard} data-testid="stat-max-trade-value">
              <div style={styles.statHeader}>
                <span style={styles.statLabel}>Max Trade Value</span>
                <ArrowUpRight size={18} color="#f59e0b" />
              </div>
              <div style={styles.statValue} data-testid="max-trade-value">
                {formatCurrency(stats?.max_trade_value)}
              </div>
              <div style={styles.statSub}>Peak single flow value</div>
            </div>

            {/* Total Exports */}
            <div style={styles.statCard} data-testid="stat-export-value">
              <div style={styles.statHeader}>
                <span style={styles.statLabel}>Export Value</span>
                <ArrowUpRight size={18} color="#34d399" />
              </div>
              <div style={styles.statValue} data-testid="export-value">
                {formatCurrency(stats?.export_value)}
              </div>
              <div style={styles.statSub}>Total Outbound Trade</div>
            </div>

            {/* Total Imports */}
            <div style={styles.statCard} data-testid="stat-import-value">
              <div style={styles.statHeader}>
                <span style={styles.statLabel}>Import Value</span>
                <ArrowDownRight size={18} color="#fbbf24" />
              </div>
              <div style={styles.statValue} data-testid="import-value">
                {formatCurrency(stats?.import_value)}
              </div>
              <div style={styles.statSub}>Total Inbound Trade</div>
            </div>

            {/* Trade Balance */}
            <div style={styles.statCard} data-testid="stat-trade-balance">
              <div style={styles.statHeader}>
                <span style={styles.statLabel}>Trade Balance</span>
                <Scale size={18} color="#c084fc" />
              </div>
              <div style={styles.statValue} data-testid="trade-balance-value">
                {formatCurrency(stats?.trade_balance)}
              </div>
              <div style={styles.statSub}>
                <span
                  style={
                    stats?.trade_balance >= 0 ? styles.statusSurplus : styles.statusDeficit
                  }
                >
                  {stats?.trade_balance >= 0 ? "Surplus (+)" : "Deficit (−)"}
                </span>
              </div>
            </div>

            {/* Record Count */}
            <div style={styles.statCard} data-testid="stat-record-count">
              <div style={styles.statHeader}>
                <span style={styles.statLabel}>Record Count</span>
                <Hash size={18} color="#f472b6" />
              </div>
              <div style={styles.statValue} data-testid="record-count-value">
                {stats?.record_count?.toLocaleString()}
              </div>
              <div style={styles.statSub}>Dataset Observations</div>
            </div>
          </div>

          {/* 2 Charts Grid */}
          <div style={styles.chartRow}>
            {/* Historical Trend Line Chart */}
            <div style={styles.chartCard}>
              <div style={styles.chartHeader}>
                <div style={styles.chartTitleGroup}>
                  <TrendingUp size={18} color="#3b82f6" />
                  <span style={styles.chartTitle}>Historical Trade Value Trend</span>
                </div>
                <span style={styles.chartTag}>Annual Volume</span>
              </div>
              <div style={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
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

            {/* Import vs Export Grouped Bar Chart */}
            <div style={styles.chartCard}>
              <div style={styles.chartHeader}>
                <div style={styles.chartTitleGroup}>
                  <BarChart3 size={18} color="#10b981" />
                  <span style={styles.chartTitle}>Import vs. Export Breakdown</span>
                </div>
                <span style={styles.chartTag}>Grouped Comparison</span>
              </div>
              <div style={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={importExportData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
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
                        name === "import_value" ? "Imports" : "Exports",
                      ]}
                      contentStyle={styles.customTooltip}
                    />
                    <Legend
                      formatter={(name) => (name === "import_value" ? "Imports" : "Exports")}
                      wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                    />
                    <Bar dataKey="import_value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="export_value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Interactive Data Table Section */}
          <div style={styles.tableCard}>
            {/* Table Control Bar */}
            <div style={styles.tableControlBar}>
              <div style={styles.tableTitleGroup}>
                <FileSpreadsheet size={20} color="#38bdf8" />
                <h3 style={styles.tableTitle}>Trade Records Explorer</h3>
                <span style={styles.recordBadge}>
                  {totalCount.toLocaleString()} Total Records
                </span>
              </div>

              <div style={styles.tableActions}>
                {/* Search Box */}
                <div style={styles.searchWrapper}>
                  <Search size={16} color="#64748b" style={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search country or ISO..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={styles.searchInput}
                    data-testid="search-input"
                  />
                </div>

                {/* CSV Export Button */}
                <button
                  onClick={handleExportCSV}
                  style={styles.exportBtn}
                  title="Export CSV"
                  data-testid="export-csv-btn"
                >
                  <Download size={15} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Data Table */}
            <div style={styles.tableWrapper}>
              {loadingTable ? (
                <div style={styles.tableLoading}>
                  <div style={styles.miniSpinner}></div>
                  <span>Updating records...</span>
                </div>
              ) : tableRecords.length === 0 ? (
                <div style={styles.tableEmpty}>
                  <p>No trade records found matching your search term.</p>
                </div>
              ) : (
                <table style={styles.table} data-testid="trade-records-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort("refYear")} style={styles.thSortable} data-testid="th-year">
                        <span>Year</span>
                        {renderSortIcon("refYear")}
                      </th>
                      <th onClick={() => handleSort("reporterISO")} style={styles.thSortable} data-testid="th-reporter">
                        <span>Reporter</span>
                        {renderSortIcon("reporterISO")}
                      </th>
                      <th onClick={() => handleSort("partnerISO")} style={styles.thSortable} data-testid="th-partner">
                        <span>Partner</span>
                        {renderSortIcon("partnerISO")}
                      </th>
                      <th onClick={() => handleSort("flowCode")} style={styles.thSortable} data-testid="th-flow">
                        <span>Flow</span>
                        {renderSortIcon("flowCode")}
                      </th>
                      <th onClick={() => handleSort("cmdCode")} style={styles.thSortable} data-testid="th-commodity">
                        <span>Commodity</span>
                        {renderSortIcon("cmdCode")}
                      </th>
                      <th onClick={() => handleSort("primaryValue")} style={styles.thSortableRight} data-testid="th-primary-value">
                        <span>Primary Value (USD)</span>
                        {renderSortIcon("primaryValue")}
                      </th>
                      <th onClick={() => handleSort("cifvalue")} style={styles.thSortableRight} data-testid="th-cif-value">
                        <span>CIF Value</span>
                        {renderSortIcon("cifvalue")}
                      </th>
                      <th onClick={() => handleSort("fobvalue")} style={styles.thSortableRight} data-testid="th-fob-value">
                        <span>FOB Value</span>
                        {renderSortIcon("fobvalue")}
                      </th>
                      <th onClick={() => handleSort("netWgt")} style={styles.thSortableRight} data-testid="th-qty">
                        <span>Net Wgt / Qty</span>
                        {renderSortIcon("netWgt")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRecords.map((row) => (
                      <tr key={row.id} style={styles.tr} data-testid={`table-row-${row.id}`}>
                        <td style={styles.tdYear}>{row.refYear}</td>
                        <td style={styles.td}>
                          <span style={styles.isoTag}>{row.reporterISO}</span>
                          <span style={{ marginLeft: "6px", color: "#cbd5e1" }}>{row.reporterDesc}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.partnerTag}>{row.partnerISO}</span>
                          <span style={{ marginLeft: "6px", color: "#cbd5e1" }}>{row.partnerDesc || row.partnerISO}</span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={
                              row.flowCode === "M" ? styles.flowImportBadge : styles.flowExportBadge
                            }
                          >
                            {row.flowDesc} ({row.flowCode})
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.cmdTag}>{row.cmdCode}</span>
                          <span style={{ marginLeft: "6px", color: "#94a3b8", fontSize: "12px" }} title={row.cmdDesc}>
                            {row.cmdDesc && row.cmdDesc.length > 25 ? `${row.cmdDesc.slice(0, 25)}...` : row.cmdDesc}
                          </span>
                        </td>
                        <td style={styles.tdPrimary}>${row.primaryValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={styles.tdMuted}>
                          {row.cifvalue !== null
                            ? `$${row.cifvalue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td style={styles.tdMuted}>
                          {row.fobvalue !== null
                            ? `$${row.fobvalue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td style={styles.tdMuted}>
                          {row.netWgt !== null
                            ? row.netWgt?.toLocaleString()
                            : row.qty !== null
                            ? row.qty?.toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            <div style={styles.paginationBar}>
              <div style={styles.pageSizeSelector}>
                <span style={styles.pageLabel}>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  style={styles.pageSelect}
                  data-testid="page-size-select"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span style={styles.rangeIndicator}>
                  Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString()}
                </span>
              </div>

              <div style={styles.pageButtons}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={page <= 1 ? styles.navBtnDisabled : styles.navBtn}
                  data-testid="prev-page-btn"
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>
                <span style={styles.pageCurrent}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={page >= totalPages ? styles.navBtnDisabled : styles.navBtn}
                  data-testid="next-page-btn"
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
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
    padding: "clamp(12px, 3vw, 28px) clamp(12px, 3vw, 32px)",
    maxWidth: "1400px",
    margin: "0 auto",
    color: "#f8fafc",
    boxSizing: "border-box",
    width: "100%",
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
    padding: "clamp(12px, 2.5vw, 18px) clamp(12px, 2.5vw, 20px)",
    marginBottom: "24px",
    boxSizing: "border-box",
    maxWidth: "100%",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: "14px",
    alignItems: "flex-end",
    maxWidth: "100%",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
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
    boxSizing: "border-box",
  },
  filterActions: {
    display: "flex",
    gap: "8px",
    width: "100%",
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
    whiteSpace: "nowrap",
  },
  resetBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "9px 12px",
    color: "#cbd5e1",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    whiteSpace: "nowrap",
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
    maxWidth: "100%",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
    gap: "14px",
    maxWidth: "100%",
  },
  statCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  statHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  statLabel: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  statValue: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: "4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  statSub: {
    fontSize: "11px",
    color: "#64748b",
  },
  statusSurplus: {
    color: "#34d399",
    fontWeight: "600",
  },
  statusDeficit: {
    color: "#f87171",
    fontWeight: "600",
  },
  chartRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
    gap: "20px",
    maxWidth: "100%",
  },
  chartCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "clamp(14px, 2.5vw, 20px)",
    minWidth: 0,
    maxWidth: "100%",
    boxSizing: "border-box",
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
    minWidth: 0,
  },
  customTooltip: {
    backgroundColor: "#0b1120",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#f8fafc",
    fontSize: "12px",
  },
  tableCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "clamp(14px, 2.5vw, 20px)",
    overflow: "hidden",
    minWidth: 0,
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  tableControlBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    flexWrap: "wrap",
    gap: "12px",
    maxWidth: "100%",
  },
  tableTitleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  tableTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0",
  },
  recordBadge: {
    fontSize: "12px",
    fontWeight: "600",
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    color: "#60a5fa",
    padding: "2px 8px",
    borderRadius: "6px",
  },
  tableActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  searchWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    minWidth: 0,
  },
  searchIcon: {
    position: "absolute",
    left: "10px",
  },
  searchInput: {
    backgroundColor: "#0b1120",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "7px 10px 7px 32px",
    color: "#f8fafc",
    fontSize: "13px",
    outline: "none",
    width: "180px",
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  exportBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#e2e8f0",
    padding: "7px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tableWrapper: {
    overflowX: "auto",
    border: "1px solid #1f2937",
    borderRadius: "8px",
    minHeight: "240px",
    minWidth: 0,
    maxWidth: "100%",
    WebkitOverflowScrolling: "touch",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
    textAlign: "left",
  },
  thSortable: {
    backgroundColor: "#0b1120",
    color: "#94a3b8",
    fontWeight: "600",
    padding: "12px 14px",
    borderBottom: "1px solid #1f2937",
    cursor: "pointer",
    whiteSpace: "nowrap",
    userSelect: "none",
  },
  thSortableRight: {
    backgroundColor: "#0b1120",
    color: "#94a3b8",
    fontWeight: "600",
    padding: "12px 14px",
    borderBottom: "1px solid #1f2937",
    cursor: "pointer",
    whiteSpace: "nowrap",
    textAlign: "right",
    userSelect: "none",
  },
  tr: {
    borderBottom: "1px solid #1e293b",
    transition: "background-color 0.1s",
  },
  td: {
    padding: "10px 14px",
    color: "#e2e8f0",
    whiteSpace: "nowrap",
  },
  tdYear: {
    padding: "10px 14px",
    color: "#f8fafc",
    fontWeight: "600",
  },
  tdIso: {
    padding: "10px 14px",
  },
  isoTag: {
    backgroundColor: "#1e293b",
    color: "#38bdf8",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "700",
  },
  partnerTag: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    color: "#c084fc",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "700",
  },
  cmdTag: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    color: "#fbbf24",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "700",
  },
  flowImportBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    color: "#60a5fa",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "600",
  },
  flowExportBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    color: "#34d399",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "600",
  },
  tdPrimary: {
    padding: "10px 14px",
    color: "#f8fafc",
    fontWeight: "600",
    textAlign: "right",
  },
  tdMuted: {
    padding: "10px 14px",
    color: "#64748b",
    textAlign: "right",
  },
  tableLoading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    minHeight: "200px",
    color: "#94a3b8",
  },
  miniSpinner: {
    width: "18px",
    height: "18px",
    border: "2px solid #334155",
    borderTop: "2px solid #3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  tableEmpty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "180px",
    color: "#94a3b8",
  },
  paginationBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "16px",
    flexWrap: "wrap",
    gap: "12px",
    maxWidth: "100%",
  },
  pageSizeSelector: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  pageLabel: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  pageSelect: {
    backgroundColor: "#0b1120",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "4px 8px",
    color: "#f8fafc",
    fontSize: "12px",
    outline: "none",
  },
  rangeIndicator: {
    fontSize: "12px",
    color: "#64748b",
    marginLeft: "8px",
  },
  pageButtons: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  navBtn: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#e2e8f0",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
  },
  navBtnDisabled: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "6px",
    color: "#475569",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "not-allowed",
  },
  pageCurrent: {
    fontSize: "12px",
    color: "#cbd5e1",
    fontWeight: "500",
    padding: "0 6px",
  },
};
