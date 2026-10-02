import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import {
  Globe2,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Percent,
  TrendingUp,
  Package,
  Users,
  Info,
  Filter,
  RotateCcw,
  AlertCircle,
  Layers,
  HelpCircle,
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

export const CountryAnalysisPage = () => {
  // Filter Options State
  const [filterOptions, setFilterOptions] = useState({
    reporters: [],
    years: [],
    flows: [],
    partners: [],
    products: [],
  });

  // Selected Country & Filters
  const [selectedReporter, setSelectedReporter] = useState("");
  const [selectedPartner, setSelectedPartner] = useState("ALL");
  const [selectedProduct, setSelectedProduct] = useState("ALL");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");

  // Applied Search State
  const [appliedParams, setAppliedParams] = useState({
    reporter: "",
    start_year: "",
    end_year: "",
    partner: "ALL",
    product: "ALL",
  });

  // Data States
  const [profile, setProfile] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [topPartnersData, setTopPartnersData] = useState(null);
  const [topProductsData, setTopProductsData] = useState(null);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Fetch Filter Options on Mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await api.get("/dashboard/filter-options");
        setFilterOptions(res.data);
        if (res.data.reporters.length > 0) {
          // Default to USA or first available reporter
          const defaultRep = res.data.reporters.find((r) => r.iso === "USA")?.iso || res.data.reporters[0].iso;
          const firstYr = res.data.years[0];
          const lastYr = res.data.years[res.data.years.length - 1];

          setSelectedReporter(defaultRep);
          setStartYear(firstYr);
          setEndYear(lastYr);
          setAppliedParams({
            reporter: defaultRep,
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

  // 2. Fetch Country Profile, Trend, Granular Partners, and Granular Products
  const fetchCountryData = useCallback(async () => {
    if (!appliedParams.reporter) return;

    setLoading(true);
    setError(null);

    const profileParams = {
      reporter: appliedParams.reporter,
    };
    if (appliedParams.start_year) profileParams.start_year = appliedParams.start_year;
    if (appliedParams.end_year) profileParams.end_year = appliedParams.end_year;
    if (appliedParams.partner && appliedParams.partner !== "ALL") profileParams.partner = appliedParams.partner;
    if (appliedParams.product && appliedParams.product !== "ALL") profileParams.product = appliedParams.product;

    const breakdownParams = {
      reporter: appliedParams.reporter,
    };
    if (appliedParams.start_year) breakdownParams.start_year = appliedParams.start_year;
    if (appliedParams.end_year) breakdownParams.end_year = appliedParams.end_year;

    try {
      const [profRes, trendRes, partnersRes, productsRes] = await Promise.all([
        api.get("/country-analysis/profile", { params: profileParams }),
        api.get("/country-analysis/trend", { params: profileParams }),
        api.get("/country-analysis/partners", { params: breakdownParams }),
        api.get("/country-analysis/products", { params: breakdownParams }),
      ]);

      setProfile(profRes.data);
      setTrendData(trendRes.data);
      setTopPartnersData(partnersRes.data);
      setTopProductsData(productsRes.data);
    } catch (err) {
      console.error("Country analysis fetch error:", err);
      setError(
        err.response?.data?.detail || "Failed to load country analysis data. Please check connection."
      );
    } finally {
      setLoading(false);
    }
  }, [appliedParams]);

  useEffect(() => {
    fetchCountryData();
  }, [fetchCountryData]);

  // Form Handlers with Immediate Auto-Fetch
  const handleReporterChange = (newIso) => {
    setSelectedReporter(newIso);
    setSelectedPartner("ALL");
    setSelectedProduct("ALL");
    setAppliedParams((prev) => ({
      ...prev,
      reporter: newIso,
      partner: "ALL",
      product: "ALL",
    }));
  };

  const handlePartnerChange = (newPartner) => {
    setSelectedPartner(newPartner);
    setAppliedParams((prev) => ({
      ...prev,
      partner: newPartner,
    }));
  };

  const handleProductChange = (newProduct) => {
    setSelectedProduct(newProduct);
    setAppliedParams((prev) => ({
      ...prev,
      product: newProduct,
    }));
  };

  const handleStartYearChange = (newYear) => {
    setStartYear(newYear);
    setAppliedParams((prev) => ({
      ...prev,
      start_year: newYear,
    }));
  };

  const handleEndYearChange = (newYear) => {
    setEndYear(newYear);
    setAppliedParams((prev) => ({
      ...prev,
      end_year: newYear,
    }));
  };

  const handleApply = (e) => {
    if (e) e.preventDefault();
    if (!selectedReporter) return;
    setAppliedParams({
      reporter: selectedReporter,
      start_year: startYear,
      end_year: endYear,
      partner: selectedPartner,
      product: selectedProduct,
    });
  };

  const handleReset = () => {
    const defaultRep = filterOptions.reporters.find((r) => r.iso === "USA")?.iso || filterOptions.reporters[0]?.iso || "";
    const firstYr = filterOptions.years[0] || "";
    const lastYr = filterOptions.years[filterOptions.years.length - 1] || "";
    setSelectedReporter(defaultRep);
    setSelectedPartner("ALL");
    setSelectedProduct("ALL");
    setStartYear(firstYr);
    setEndYear(lastYr);
    setAppliedParams({
      reporter: defaultRep,
      start_year: firstYr,
      end_year: lastYr,
      partner: "ALL",
      product: "ALL",
    });
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Country Trade Profile</h1>
          <p style={styles.pageSubtitle}>
            Comprehensive trade indicators, historical trends, and bilateral exposure profile
          </p>
        </div>
      </div>

      {/* Scope Notice Banner */}
      <ScopeNoticeBanner />

      {/* Country & Year Range Filter Controls */}
      <div style={styles.filterCard}>
        <div style={styles.filterHeader}>
          <Filter size={16} color="#60a5fa" />
          <span style={styles.filterTitle}>Select Reporter & Filters</span>
        </div>

        <form onSubmit={handleApply} style={styles.filterForm}>
          {/* Country Dropdown */}
          <div style={{ ...styles.filterGroup, flex: 2 }}>
            <label style={styles.filterLabel}>Reporter Country</label>
            <select
              value={selectedReporter}
              onChange={(e) => handleReporterChange(e.target.value)}
              style={styles.select}
            >
              {filterOptions.reporters.map((r) => (
                <option key={r.iso} value={r.iso}>
                  {r.desc} ({r.iso})
                </option>
              ))}
            </select>
          </div>

          {/* Partner Country */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Partner Country</label>
            <select
              value={selectedPartner}
              onChange={(e) => handlePartnerChange(e.target.value)}
              style={styles.select}
            >
              {filterOptions.partners && filterOptions.partners.length > 0 ? (
                filterOptions.partners.map((p) => (
                  <option key={p.iso} value={p.iso}>
                    {p.desc} ({p.iso})
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
              value={selectedProduct}
              onChange={(e) => handleProductChange(e.target.value)}
              style={styles.select}
            >
              {filterOptions.products && filterOptions.products.length > 0 ? (
                filterOptions.products.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.desc} ({p.code})
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
              value={startYear}
              onChange={(e) => handleStartYearChange(e.target.value)}
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
              onChange={(e) => handleEndYearChange(e.target.value)}
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
              View Profile
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
          <p style={styles.loadingText}>Generating comprehensive country profile...</p>
        </div>
      ) : !appliedParams.reporter ? (
        /* No Selection Prompt */
        <div style={styles.emptyState}>
          <div style={styles.emptyIconWrapper}>
            <Globe2 size={48} color="#60a5fa" />
          </div>
          <h2 style={styles.emptyTitle}>Select a country to inspect its trade profile</h2>
          <p style={styles.emptySubtitle}>
            Choose any of the 190 reporter nations from the dropdown above to view export/import trends and balance metrics.
          </p>
        </div>
      ) : profile?.no_data ? (
        /* Empty Range State */
        <div style={styles.emptyState}>
          <div style={styles.emptyIconWrapper}>
            <Layers size={48} color="#64748b" />
          </div>
          <h2 style={styles.emptyTitle}>No records match the selected filters.</h2>
          <p style={styles.emptySubtitle}>
            {profile?.reporter_name} ({profile?.reporter_iso}) does not have trade data in the {appliedParams.start_year}–{appliedParams.end_year} range.
          </p>
          <button onClick={handleReset} style={styles.resetBtnLarge}>
            Reset Filters to Default Range
          </button>
        </div>
      ) : (
        /* Main Profile View */
        <div style={styles.content}>
          {/* Country Banner */}
          <div style={styles.countryHeaderBanner}>
            <div style={styles.countryBadge}>
              <Globe2 size={24} color="#38bdf8" />
              <div>
                <h2 style={styles.countryName}>{profile?.reporter_name}</h2>
                <span style={styles.countryIso}>ISO Code: {profile?.reporter_iso}</span>
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
            {/* Total Exports */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Total Exports</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(16, 185, 129, 0.15)" }}>
                  <ArrowUpRight size={20} color="#34d399" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(profile?.total_exports)}</div>
              <div style={styles.kpiSub}>Outbound Trade Volume</div>
            </div>

            {/* Total Imports */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Total Imports</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(59, 130, 246, 0.15)" }}>
                  <ArrowDownRight size={20} color="#60a5fa" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(profile?.total_imports)}</div>
              <div style={styles.kpiSub}>Inbound Trade Volume</div>
            </div>

            {/* Trade Balance */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Trade Balance</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(168, 85, 247, 0.15)" }}>
                  <Scale size={20} color="#c084fc" />
                </div>
              </div>
              <div style={styles.kpiValue}>{formatCurrency(profile?.trade_balance)}</div>
              <div style={styles.balanceStatus}>
                <span
                  style={
                    profile?.trade_balance_status === "Trade Surplus"
                      ? styles.statusSurplus
                      : profile?.trade_balance_status === "Trade Deficit"
                      ? styles.statusDeficit
                      : styles.statusBalanced
                  }
                >
                  {profile?.trade_balance_status}
                </span>
              </div>
            </div>

            {/* Export Growth % */}
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
                  <span style={styles.growthNA} title="Base year value is 0 or only 1 year selected">
                    N/A
                  </span>
                )}
              </div>
              <div style={styles.kpiSub}>First Year to Last Year</div>
            </div>

            {/* Import Growth % */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>Import Growth</span>
                <div style={{ ...styles.kpiIcon, backgroundColor: "rgba(245, 158, 11, 0.15)" }}>
                  <Percent size={18} color="#fbbf24" />
                </div>
              </div>
              <div style={styles.kpiValue}>
                {profile?.import_growth !== null ? (
                  <span style={profile?.import_growth >= 0 ? styles.growthPositive : styles.growthNegative}>
                    {profile?.import_growth >= 0 ? `+${profile?.import_growth}%` : `${profile?.import_growth}%`}
                  </span>
                ) : (
                  <span style={styles.growthNA} title="Base year value is 0 or only 1 year selected">
                    N/A
                  </span>
                )}
              </div>
              <div style={styles.kpiSub}>First Year to Last Year</div>
            </div>
          </div>

          {/* Historical Export vs Import Line Chart */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <div style={styles.chartTitleGroup}>
                <TrendingUp size={18} color="#38bdf8" />
                <span style={styles.chartTitle}>Historical Export & Import Trends</span>
              </div>
              <span style={styles.chartTag}>Time-Series Overview</span>
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

          {/* Top Partners & Top Products Sections */}
          <div style={styles.gridTwo}>
            {/* Top Partners Section */}
            <div style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <div style={styles.detailTitleGroup}>
                  <Users size={18} color="#60a5fa" />
                  <h3 style={styles.detailTitle}>Top Trading Partners</h3>
                </div>
              </div>

              {!topPartnersData?.has_granular_data ? (
                <div style={styles.limitationNotice}>
                  <Info size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
                  <span>
                    {topPartnersData?.message || "Granular partner/product data has not been uploaded for this reporter."}
                  </span>
                </div>
              ) : (
                <>
                  <div style={styles.subsetNotice} data-testid="top-partners-subset-notice">
                    <Info size={15} color="#38bdf8" style={{ flexShrink: 0 }} />
                    <span>
                      <strong style={{ color: "#38bdf8" }}>Granular Tracked Subset:</strong> Bilateral totals reflect uploaded data across 4 tracked commodity chapters (HS 30, 84, 85, 87; 2018–2024), representing a sample subset rather than a reconciliation of {profile?.reporter_name || "this country"}&apos;s full multi-commodity World baseline.
                    </span>
                  </div>
                  <div style={styles.itemList}>
                    {topPartnersData.partners.map((item, idx) => (
                      <div key={idx} style={styles.itemRow}>
                        <div style={styles.itemMeta}>
                          <span style={styles.itemName}>{item.partner_desc}</span>
                          <span style={styles.itemCode}>ISO: {item.partner_iso}</span>
                        </div>
                        <div style={styles.itemStats}>
                          <span style={styles.itemValue}>{formatCurrency(item.trade_value)}</span>
                          <span style={styles.itemShare}>{item.share_percentage}% Share</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Top Products Section */}
            <div style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <div style={styles.detailTitleGroup}>
                  <Package size={18} color="#f59e0b" />
                  <h3 style={styles.detailTitle}>Top Traded Commodities</h3>
                </div>
              </div>

              {!topProductsData?.has_granular_data ? (
                <div style={styles.limitationNotice}>
                  <Info size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
                  <span>
                    {topProductsData?.message || "Granular partner/product data has not been uploaded for this reporter."}
                  </span>
                </div>
              ) : (
                <>
                  <div style={styles.subsetNotice} data-testid="top-products-subset-notice">
                    <Info size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <span>
                      <strong style={{ color: "#f59e0b" }}>Granular Tracked Subset:</strong> Commodity totals reflect the 4 tracked HS chapters across bilateral partner countries (2018–2024), representing a granular subset of {profile?.reporter_name || "this country"}&apos;s overall trade.
                    </span>
                  </div>
                  <div style={styles.itemList}>
                    {topProductsData.products.map((item, idx) => (
                      <div key={idx} style={styles.itemRow}>
                        <div style={styles.itemMeta}>
                          <span style={styles.itemName}>{item.cmd_desc}</span>
                          <span style={styles.itemCode}>Code: {item.cmd_code}</span>
                        </div>
                        <div style={styles.itemStats}>
                          <span style={styles.itemValue}>{formatCurrency(item.trade_value)}</span>
                          <span style={styles.itemShare}>{item.share_percentage}% Share</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
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
  countryHeaderBanner: {
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
  countryBadge: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  countryName: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0",
  },
  countryIso: {
    fontSize: "12px",
    color: "#38bdf8",
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
  limitationNotice: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    border: "1px solid rgba(14, 165, 233, 0.25)",
    borderRadius: "8px",
    padding: "8px 12px",
    marginBottom: "14px",
    fontSize: "12px",
    color: "#bae6fd",
    lineHeight: "1.4",
  },
  subsetNotice: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    border: "1px solid rgba(56, 189, 248, 0.25)",
    borderRadius: "8px",
    padding: "8px 12px",
    marginBottom: "14px",
    fontSize: "12px",
    color: "#cbd5e1",
    lineHeight: "1.4",
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
    flexDirection: "column",
    gap: "2px",
  },
  itemName: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#f8fafc",
  },
  itemCode: {
    fontSize: "11px",
    color: "#64748b",
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
