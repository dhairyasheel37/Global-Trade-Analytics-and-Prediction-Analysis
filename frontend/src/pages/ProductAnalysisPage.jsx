import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import {
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Percent,
  TrendingUp,
  Globe2,
  DollarSign,
  Info,
  Filter,
  RotateCcw,
  AlertCircle,
  Layers,
  ArrowUp,
  ArrowDown,
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
import ScopeNoticeBanner from "../components/ScopeNoticeBanner";

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

export const ProductAnalysisPage = () => {
  // Filter Options State
  const [productsList, setProductsList] = useState([]);
  const [partnersList, setPartnersList] = useState([]);
  const [yearsList, setYearsList] = useState([]);

  // Selected State
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedPartner, setSelectedPartner] = useState("ALL");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");

  // Applied State
  const [appliedParams, setAppliedParams] = useState({
    product: "",
    start_year: "",
    end_year: "",
    partner: "ALL",
  });

  // Data States
  const [profile, setProfile] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [topExporters, setTopExporters] = useState([]);
  const [topImporters, setTopImporters] = useState([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Fetch Products List & Years & Partners on Mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [prodRes, filterRes] = await Promise.all([
          api.get("/product-analysis/list"),
          api.get("/dashboard/filter-options"),
        ]);

        setProductsList(prodRes.data);
        setYearsList(filterRes.data.years);
        setPartnersList(filterRes.data.partners || []);

        if (prodRes.data.length > 0) {
          const defaultProd = prodRes.data[0].cmd_code;
          const firstYr = filterRes.data.years[0];
          const lastYr = filterRes.data.years[filterRes.data.years.length - 1];

          setSelectedProduct(defaultProd);
          setSelectedPartner("ALL");
          setStartYear(firstYr);
          setEndYear(lastYr);
          setAppliedParams({
            product: defaultProd,
            start_year: firstYr,
            end_year: lastYr,
            partner: "ALL",
          });
        }
      } catch (err) {
        console.error("Failed to load product initial data:", err);
      }
    };
    fetchInitialData();
  }, []);

  // 2. Fetch Product Profile, Trend, Top Exporters, and Top Importers
  const fetchProductData = useCallback(async () => {
    if (!appliedParams.product) return;

    setLoading(true);
    setError(null);

    const params = {
      product: appliedParams.product,
    };
    if (appliedParams.start_year) params.start_year = appliedParams.start_year;
    if (appliedParams.end_year) params.end_year = appliedParams.end_year;
    if (appliedParams.partner && appliedParams.partner !== "ALL") {
      params.partner = appliedParams.partner;
    }

    try {
      const [profRes, trendRes, expRes, impRes] = await Promise.all([
        api.get("/product-analysis/profile", { params }),
        api.get("/product-analysis/trend", { params }),
        api.get("/product-analysis/top-exporters", { params: { ...params, limit: 10 } }),
        api.get("/product-analysis/top-importers", { params: { ...params, limit: 10 } }),
      ]);

      setProfile(profRes.data);
      setTrendData(trendRes.data);
      setTopExporters(expRes.data);
      setTopImporters(impRes.data);
    } catch (err) {
      console.error("Product analysis fetch error:", err);
      setError(
        err.response?.data?.detail || "Failed to load product analysis data. Please check connection."
      );
    } finally {
      setLoading(false);
    }
  }, [appliedParams]);

  useEffect(() => {
    fetchProductData();
  }, [fetchProductData]);

  // Form Handlers
  const handleApply = (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setAppliedParams({
      product: selectedProduct,
      partner: selectedPartner,
      start_year: startYear,
      end_year: endYear,
    });
  };

  const handleReset = () => {
    const defaultProd = productsList[0]?.cmd_code || "";
    const firstYr = yearsList[0] || "";
    const lastYr = yearsList[yearsList.length - 1] || "";
    setSelectedProduct(defaultProd);
    setSelectedPartner("ALL");
    setStartYear(firstYr);
    setEndYear(lastYr);
    setAppliedParams({
      product: defaultProd,
      partner: "ALL",
      start_year: firstYr,
      end_year: lastYr,
    });
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Product & Commodity Analysis</h1>
          <p style={styles.pageSubtitle}>
            Global commodity flow indicators, historical volume trajectories, and market distribution
          </p>
        </div>
      </div>

      {/* Dataset Scope Notice Banner */}
      <ScopeNoticeBanner />

      {/* Filter Controls */}
      <div style={styles.filterCard}>
        <div style={styles.filterHeader}>
          <Filter size={16} color="#60a5fa" />
          <span style={styles.filterTitle}>Select Product & Filters</span>
        </div>

        <form onSubmit={handleApply} style={styles.filterForm}>
          {/* Product Dropdown */}
          <div style={{ ...styles.filterGroup, flex: 2 }}>
            <label style={styles.filterLabel}>Commodity Code</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              style={styles.select}
            >
              {productsList.map((p) => (
                <option key={p.cmd_code} value={p.cmd_code}>
                  {p.cmd_desc} ({p.cmd_code})
                </option>
              ))}
            </select>
          </div>

          {/* Partner Country */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Partner Country</label>
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              style={styles.select}
            >
              {partnersList && partnersList.length > 0 ? (
                partnersList.map((p) => (
                  <option key={p.iso} value={p.iso}>
                    {p.desc} ({p.iso})
                  </option>
                ))
              ) : (
                <option value="ALL">All Partners (World aggregate)</option>
              )}
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
              {yearsList.map((y) => (
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
              {yearsList.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div style={styles.filterActions}>
            <button type="submit" style={styles.applyBtn}>
              View Profile
            </button>
            <button type="button" onClick={handleReset} style={styles.resetBtn}>
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
      {loading ? (
        <div style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Computing commodity metrics and market distributions...</p>
        </div>
      ) : profile?.no_data ? (
        /* Empty State */
        <div style={styles.emptyState}>
          <div style={styles.emptyIconWrapper}>
            <Layers size={48} color="#64748b" />
          </div>
          <h2 style={styles.emptyTitle}>No records match the selected filters.</h2>
          <p style={styles.emptySubtitle}>
            No trade observations were recorded for {profile?.cmd_desc} in the selected year range.
          </p>
          <button onClick={handleReset} style={styles.resetBtnLarge}>
            Reset Filters to Default Range
          </button>
        </div>
      ) : (
        /* Main Content */
        <div style={styles.content}>
          {/* Commodity Header Banner */}
          <div style={styles.productHeaderBanner}>
            <div style={styles.productBadge}>
              <Package size={24} color="#f59e0b" />
              <div>
                <h2 style={styles.productName}>{profile?.cmd_desc}</h2>
                <span style={styles.productCode}>Commodity Code: {profile?.cmd_code}</span>
              </div>
            </div>
            {profile?.growth_note && (
              <div style={styles.growthNoteTag}>
                <Info size={14} color="#94a3b8" />
                <span>{profile?.growth_note}</span>
              </div>
            )}
          </div>

          {/* 5 Profile Summary Cards */}
          <div style={styles.kpiGrid}>
            {/* Total Trade Value */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Total Trade Value</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(59, 130, 246, 0.15)" }}>
                  <DollarSign size={20} color="#60a5fa" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(profile?.total_trade_value)}</div>
              <div style={styles.kpiSub}>Global Commodity Volume</div>
            </div>

            {/* Total Exports */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Global Exports</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(16, 185, 129, 0.15)" }}>
                  <ArrowUpRight size={20} color="#34d399" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(profile?.total_exports)}</div>
              <div style={styles.kpiSub}>Total Outbound Flow</div>
            </div>

            {/* Total Imports */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Global Imports</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(245, 158, 11, 0.15)" }}>
                  <ArrowDownRight size={20} color="#fbbf24" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(profile?.total_imports)}</div>
              <div style={styles.kpiSub}>Total Inbound Flow</div>
            </div>

            {/* Export Growth */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Export Growth</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(56, 189, 248, 0.15)" }}>
                  <Percent size={18} color="#38bdf8" />
                </div>
              </div>
              <div style={styles.kpiValue}>
                {profile?.export_growth !== null ? (
                  <span style={profile?.export_growth >= 0 ? styles.growthPositive : styles.growthNegative}>
                    {profile?.export_growth >= 0 ? `+${profile?.export_growth}%` : `${profile?.export_growth}%`}
                  </span>
                ) : (
                  <span style={styles.growthNA}>N/A</span>
                )}
              </div>
              <div style={styles.kpiSub}>First Year to Last Year</div>
            </div>

            {/* Import Growth */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Import Growth</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(168, 85, 247, 0.15)" }}>
                  <Percent size={18} color="#c084fc" />
                </div>
              </div>
              <div style={styles.kpiValue}>
                {profile?.import_growth !== null ? (
                  <span style={profile?.import_growth >= 0 ? styles.growthPositive : styles.growthNegative}>
                    {profile?.import_growth >= 0 ? `+${profile?.import_growth}%` : `${profile?.import_growth}%`}
                  </span>
                ) : (
                  <span style={styles.growthNA}>N/A</span>
                )}
              </div>
              <div style={styles.kpiSub}>First Year to Last Year</div>
            </div>
          </div>

          {/* Historical Export vs Import Line Chart */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <div style={styles.chartTitleGroup}>
                <TrendingUp size={18} color="#3b82f6" />
                <span style={styles.chartTitle}>Historical Commodity Trade Trajectory</span>
              </div>
              <span style={styles.chartTag}>Annual Volume</span>
            </div>
            <div style={styles.chartWrapper}>
              <ResponsiveContainer width="100%" height={290}>
                <LineChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
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
                      name === "export_value" ? "Exports (X)" : "Imports (M)",
                    ]}
                    contentStyle={styles.customTooltip}
                  />
                  <Legend
                    formatter={(name) => (name === "export_value" ? "Exports (X)" : "Imports (M)")}
                    wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="export_value"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#10b981" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="import_value"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#3b82f6" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Exporters & Top Importers Grid */}
          <div style={styles.gridTwo}>
            {/* Top Exporters */}
            <div style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <div style={styles.detailTitleGroup}>
                  <ArrowUpRight size={18} color="#34d399" />
                  <h3 style={styles.detailTitle}>Top 10 Exporting Nations</h3>
                </div>
                <span style={styles.chartTag}>Outbound Market Share</span>
              </div>

              <div style={styles.itemList}>
                {topExporters.map((item, idx) => (
                  <div key={idx} style={styles.itemRow}>
                    <div style={styles.itemMeta}>
                      <span style={styles.rankNum}>{idx + 1}.</span>
                      <div>
                        <span style={styles.itemName}>{item.reporter_desc}</span>
                        <span style={styles.itemCode}>ISO: {item.reporter_iso}</span>
                      </div>
                    </div>
                    <div style={styles.itemStats}>
                      <span style={styles.itemValue}>{formatCurrency(item.trade_value)}</span>
                      <span style={styles.itemShare}>{item.share_percentage}% of Exports</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Importers */}
            <div style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <div style={styles.detailTitleGroup}>
                  <ArrowDownRight size={18} color="#fbbf24" />
                  <h3 style={styles.detailTitle}>Top 10 Importing Nations</h3>
                </div>
                <span style={styles.chartTag}>Inbound Market Share</span>
              </div>

              <div style={styles.itemList}>
                {topImporters.map((item, idx) => (
                  <div key={idx} style={styles.itemRow}>
                    <div style={styles.itemMeta}>
                      <span style={styles.rankNum}>{idx + 1}.</span>
                      <div>
                        <span style={styles.itemName}>{item.reporter_desc}</span>
                        <span style={styles.itemCode}>ISO: {item.reporter_iso}</span>
                      </div>
                    </div>
                    <div style={styles.itemStats}>
                      <span style={styles.itemValue}>{formatCurrency(item.trade_value)}</span>
                      <span style={styles.itemShare}>{item.share_percentage}% of Imports</span>
                    </div>
                  </div>
                ))}
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
  productHeaderBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "16px 20px",
    flexWrap: "wrap",
    gap: "12px",
  },
  productBadge: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  productName: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0",
  },
  productCode: {
    fontSize: "12px",
    color: "#f59e0b",
    fontWeight: "600",
  },
  growthNoteTag: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#94a3b8",
    backgroundColor: "#0b1120",
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid #1e293b",
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
  growthPositive: {
    color: "#34d399",
  },
  growthNegative: {
    color: "#f87171",
  },
  growthNA: {
    color: "#94a3b8",
    fontSize: "18px",
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
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
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
    fontSize: "16px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0",
  },
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "12px 14px",
  },
  itemMeta: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  rankNum: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#64748b",
    width: "20px",
  },
  itemName: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#f8fafc",
    display: "block",
  },
  itemCode: {
    fontSize: "11px",
    color: "#64748b",
    display: "block",
  },
  itemStats: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "2px",
  },
  itemValue: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#ffffff",
  },
  itemShare: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#38bdf8",
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    padding: "1px 6px",
    borderRadius: "4px",
  },
};
