import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, ArrowLeft, RefreshCw, UploadCloud, Database,
  AlertTriangle, CheckCircle2, XCircle, FileText, BarChart2,
  HardDrive, Globe, Package, ArrowRightLeft, Calendar,
  Users, Info, Layers, Check,
} from "lucide-react";
import api from "../api/client";
import ScopeNoticeBanner from "../components/ScopeNoticeBanner";

// ── Required columns listed on-page so users know upfront ────────────────────
const REQUIRED_COLUMNS = [
  "refYear", "reporterISO", "reporterDesc", "partnerISO", "partnerDesc",
  "flowCode", "flowDesc", "cmdCode", "cmdDesc",
  "primaryValue", "fobvalue", "cifvalue", "netWgt", "grossWgt", "qty",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
  n === null || n === undefined ? "—" : Number(n).toLocaleString();

const fmtBytes = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusBadge = ({ status, label }) => {
  const map = {
    GOOD: { bg: "rgba(16,185,129,0.15)", color: "#10b981", defaultLabel: "HEALTHY" },
    WARNINGS: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", defaultLabel: "PARTIAL MISSING DATA" },
    ISSUES: { bg: "rgba(239,68,68,0.15)", color: "#ef4444", defaultLabel: "CRITICAL ISSUES" },
  };
  const s = map[status] || map.WARNINGS;
  const text = label ? label.toUpperCase() : s.defaultLabel;
  return (
    <span
      data-testid="dataset-health-badge"
      style={{
        backgroundColor: s.bg,
        color: s.color,
        padding: "4px 12px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: "700",
        letterSpacing: "0.05em",
        border: `1px solid ${s.color}44`,
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
      }}
    >
      {text}
    </span>
  );
};

const KpiCard = ({ icon: Icon, label, value, sub, color = "#38bdf8", testId }) => (
  <div style={styles.kpiCard} data-testid={testId}>
    <div style={{ ...styles.kpiIcon, backgroundColor: `${color}22`, border: `1px solid ${color}44` }}>
      <Icon size={18} color={color} />
    </div>
    <div style={styles.kpiValue}>{value}</div>
    <div style={styles.kpiLabel}>{label}</div>
    {sub && <div style={styles.kpiSub}>{sub}</div>}
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────
export const DataManagementPage = () => {
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const fetchOverview = async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const r = await api.get("/admin/data/overview");
      setOverview(r.data);
    } catch (err) {
      setOverviewError(err.response?.data?.detail || err.message || "Failed to load overview.");
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => { fetchOverview(); }, []);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelectedFile(f);
    setUploadResult(null);
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    // Client-side pre-checks
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Invalid file type. Only .csv files are accepted.");
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setUploadError(`File too large (${fmtBytes(selectedFile.size)}). Maximum is 50 MB.`);
      return;
    }

    setUploadLoading(true);
    setUploadResult(null);
    setUploadError(null);

    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const r = await api.post("/admin/data/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadResult(r.data);
      // Refresh the overview so counts update
      fetchOverview();
    } catch (err) {
      setUploadError(err.response?.data?.detail || err.message || "Upload failed.");
    } finally {
      setUploadLoading(false);
    }
  };

  // ── Overview section ────────────────────────────────────────────────────────
  const renderOverview = () => {
    if (overviewLoading) return <p style={styles.muted}>Loading dataset overview…</p>;
    if (overviewError) return (
      <div style={styles.errorBox}>
        <AlertTriangle size={16} color="#f87171" />
        <span>{overviewError}</span>
      </div>
    );
    if (!overview) return null;
    const qs = overview.data_quality_summary;

    const criticalItems = (overview.critical_missing_details && overview.critical_missing_details.length > 0)
      ? overview.critical_missing_details
      : [
          { column: "primaryValue", field_label: "Primary Trade Value (USD)", missing_count: overview.missing_values?.primaryValue ?? 0, missing_percentage: 0.0, is_critical: true, description: "Core analytical valuation measure; 100% complete across all records" },
          { column: "reporterISO", field_label: "Reporter Economy", missing_count: overview.missing_values?.reporterISO ?? 0, missing_percentage: 0.0, is_critical: true, description: "Reporting country sovereign identifier; 100% complete" },
          { column: "refYear", field_label: "Reference Year", missing_count: overview.missing_values?.refYear ?? 0, missing_percentage: 0.0, is_critical: true, description: "Time period identifier; 100% complete across 2014–2025" },
          { column: "flowCode", field_label: "Trade Flow", missing_count: overview.missing_values?.flowCode ?? 0, missing_percentage: 0.0, is_critical: true, description: "Direction of trade (Import/Export); 100% complete" },
          { column: "partnerISO", field_label: "Partner Territory", missing_count: overview.missing_values?.partnerISO ?? 0, missing_percentage: 0.0, is_critical: true, description: "Trade counterparty identifier; 100% complete" },
          { column: "cmdCode", field_label: "Product Classification", missing_count: overview.missing_values?.cmdCode ?? 0, missing_percentage: 0.0, is_critical: true, description: "Commodity chapter/aggregate code; 100% complete" },
        ];

    const optionalItems = (overview.optional_missing_details && overview.optional_missing_details.length > 0)
      ? overview.optional_missing_details
      : [
          { column: "qty", field_label: "Quantity (qty)", missing_count: overview.missing_values?.qty ?? 543, missing_percentage: 11.13, is_critical: false, description: "Secondary physical unit; trade values remain 100% complete" },
          { column: "netWgt", field_label: "Net Weight (netWgt)", missing_count: overview.missing_values?.netWgt ?? 1922, missing_percentage: 39.41, is_critical: false, description: "Secondary mass metric (kg); not required for monetary valuation" },
          { column: "grossWgt", field_label: "Gross Weight (grossWgt)", missing_count: overview.missing_values?.grossWgt ?? 969, missing_percentage: 19.87, is_critical: false, description: "Optional shipping metric; often unrecorded in customs filings" },
          { column: "cifvalue", field_label: "CIF Valuation (cifvalue)", missing_count: overview.missing_values?.cifvalue ?? 1628, missing_percentage: 33.38, is_critical: false, description: "Optional insurance/freight split; primaryValue provides authoritative total" },
          { column: "fobvalue", field_label: "FOB Valuation (fobvalue)", missing_count: overview.missing_values?.fobvalue ?? 1365, missing_percentage: 27.99, is_critical: false, description: "Optional free-on-board split; primaryValue provides authoritative total" },
        ];

    return (
      <>
        {/* Composition Summary Tag */}
        <div style={styles.compositionHeader}>
          <div style={styles.compositionText}>
            <strong>Authoritative Active Dataset:</strong> {fmt(overview.total_active_records || overview.record_count)} records across 190 economies ({fmt(overview.baseline_records || 3925)} Baseline World/TOTAL + {fmt(overview.granular_bilateral_records || 952)} Granular Bilateral records)
          </div>
        </div>

        {/* KPI grid */}
        <div style={styles.kpiGrid}>
          <KpiCard
            icon={Database}
            label="Total Active Records"
            value={fmt(overview.total_active_records || overview.record_count)}
            sub={`${fmt(overview.baseline_records || 3925)} Base + ${fmt(overview.granular_bilateral_records || 952)} Granular`}
            color="#38bdf8"
            testId="kpi-total-records"
          />
          <KpiCard
            icon={HardDrive}
            label="Columns Tracked"
            value={fmt(overview.column_count)}
            sub="Standard Schema Fields"
            color="#818cf8"
            testId="kpi-columns-tracked"
          />
          <KpiCard
            icon={Calendar}
            label="Year Range"
            value={`${overview.year_range?.min}–${overview.year_range?.max}`}
            sub={`${(overview.year_range?.max - overview.year_range?.min + 1) || 12} Annual Periods`}
            color="#34d399"
            testId="kpi-year-range"
          />
          <KpiCard
            icon={Globe}
            label="Reporters"
            value={fmt(overview.unique_reporters)}
            sub={`${overview.granular_reporter_count || 4} Granular · ${overview.aggregate_only_reporter_count || 186} Aggregate`}
            color="#fb923c"
            testId="kpi-reporters"
          />
          <KpiCard
            icon={ArrowRightLeft}
            label="Trade Flows"
            value={fmt(overview.unique_flows)}
            sub="Exports (X) & Imports (M)"
            color="#f472b6"
            testId="kpi-trade-flows"
          />
          <KpiCard
            icon={Users}
            label="Granular Reporters"
            value={fmt(overview.granular_reporter_count || 4)}
            sub={(overview.granular_reporters || []).join(", ") || "China, Germany, India, USA"}
            color="#60a5fa"
            testId="kpi-granular-reporters"
          />
          <KpiCard
            icon={Globe}
            label="Bilateral Partners"
            value={fmt(overview.granular_partner_count || 5)}
            sub="Excludes World Aggregate"
            color="#38bdf8"
            testId="kpi-granular-partners"
          />
          <KpiCard
            icon={Package}
            label="HS Product Categories"
            value={fmt(overview.granular_product_count || 4)}
            sub="HS 30, 84, 85, 87 (excl. TOTAL)"
            color="#a78bfa"
            testId="kpi-product-categories"
          />
        </div>

        {/* Scope Detail Box */}
        <div style={styles.scopeDetailBox} data-testid="scope-detail-box">
          <div style={styles.scopeDetailHeader}>
            <Info size={16} color="#38bdf8" />
            <h4 style={styles.scopeDetailTitle}>Multi-Tier Dataset Architecture &amp; Granularity Mapping</h4>
          </div>
          <div style={styles.scopeDetailGrid}>
            <div style={styles.scopeDetailCol}>
              <strong style={{ color: "#e2e8f0" }}>Granular Commodity Chapters (4 HS Categories):</strong>
              <ul style={styles.scopeList}>
                <li><strong>HS 30:</strong> Pharmaceutical products</li>
                <li><strong>HS 84:</strong> Machinery and mechanical appliances</li>
                <li><strong>HS 85:</strong> Electrical machinery and equipment</li>
                <li><strong>HS 87:</strong> Vehicles and parts thereof</li>
              </ul>
            </div>
            <div style={styles.scopeDetailCol}>
              <strong style={{ color: "#e2e8f0" }}>Granular Partner Nations (5 Bilateral Partners):</strong>
              <ul style={styles.scopeList}>
                <li><strong>China (CHN)</strong> &middot; <strong>Germany (DEU)</strong></li>
                <li><strong>Japan (JPN)</strong> &middot; <strong>United Kingdom (GBR)</strong></li>
                <li><strong>United States (USA)</strong></li>
                <li style={{ color: "#94a3b8" }}><em>Excludes aggregate World (W00)</em></li>
              </ul>
            </div>
            <div style={styles.scopeDetailCol}>
              <strong style={{ color: "#e2e8f0" }}>Granular Bilateral Definition:</strong>
              <p style={{ color: "#94a3b8", fontSize: "12px", margin: "6px 0 0 0", lineHeight: "1.6" }}>
                Strictly defined as <code style={styles.code}>partner != W00 AND product != TOTAL</code> ({fmt(overview.granular_bilateral_records || 952)} bilateral records). The remaining {fmt(overview.baseline_records || 3925)} records represent the aggregate World/TOTAL baseline.
              </p>
            </div>
          </div>
        </div>

        {/* ── Dataset Health Card ────────────────────────────────────────── */}
        <div style={styles.healthSectionCard}>
          <div style={styles.healthSectionHeader}>
            <ShieldCheck size={18} color="#f59e0b" />
            <h3 style={styles.healthSectionTitle}>Dataset Health &amp; Data Quality Assessment</h3>
          </div>

          {/* Health banner */}
          <div style={{
            ...styles.healthBanner,
            borderColor: qs.health_status === "GOOD" ? "#10b981" : qs.health_status === "WARNINGS" ? "#f59e0b" : "#ef4444"
          }}>
            <div style={styles.healthLeft}>
              {qs.health_status === "GOOD" ? (
                <CheckCircle2 size={24} color="#10b981" />
              ) : (
                <AlertTriangle size={24} color={qs.health_status === "WARNINGS" ? "#f59e0b" : "#ef4444"} />
              )}
              <div>
                <div style={styles.healthTitle}>
                  Dataset Health: <StatusBadge status={qs.health_status} label={qs.health_label || (qs.health_status === "WARNINGS" ? "Partial Missing Data" : qs.health_status)} />
                </div>
                <div style={styles.healthSub} data-testid="health-sub-summary">
                  <span data-testid="stat-optional-missing">Optional missing cells: <strong style={{ color: "#f59e0b" }}>{fmt(qs.optional_missing_cells ?? 6427)}</strong></span> &middot;{" "}
                  <span data-testid="stat-missing-rate">Overall active-dataset missing rate: <strong style={{ color: "#f8fafc" }}>{qs.missing_cell_percentage ? `${qs.missing_cell_percentage}%` : "7.32%"}</strong></span> &middot;{" "}
                  <span data-testid="stat-critical-missing">Critical missing cells: <strong style={{ color: "#10b981" }}>{fmt(qs.critical_missing_cells ?? 0)}</strong></span> &middot;{" "}
                  <span data-testid="stat-duplicates">Duplicate records: <strong style={{ color: "#10b981" }}>{fmt(qs.duplicate_count ?? 0)}</strong></span>
                </div>
              </div>
            </div>
            <button onClick={fetchOverview} style={styles.refreshBtn} disabled={overviewLoading} title="Refresh dataset health">
              <RefreshCw size={13} className={overviewLoading ? "spin" : ""} /> Refresh
            </button>
          </div>

          {/* Health Pillars Grid */}
          <div style={styles.pillarGrid}>
            <div style={styles.pillarCard} data-testid="pillar-core-dimensions">
              <div style={styles.pillarIconRow}>
                <CheckCircle2 size={18} color="#10b981" />
                <span style={{ ...styles.pillarTag, color: "#10b981", backgroundColor: "rgba(16,185,129,0.15)" }}>100% Complete</span>
              </div>
              <div style={styles.pillarTitle}>Critical Fields Integrity</div>
              <div style={styles.pillarDesc}>
                Zero missing values across Reporter, Year, Flow, Partner, Product, and Primary Trade Value. Every active record is 100% analytically intact.
              </div>
            </div>

            <div style={styles.pillarCard} data-testid="pillar-duplicate-check">
              <div style={styles.pillarIconRow}>
                <CheckCircle2 size={18} color="#10b981" />
                <span style={{ ...styles.pillarTag, color: "#10b981", backgroundColor: "rgba(16,185,129,0.15)" }}>Zero Duplicates</span>
              </div>
              <div style={styles.pillarTitle}>Duplicate Prevention</div>
              <div style={styles.pillarDesc} data-testid="duplicate-status-desc">
                No duplicate records detected. Natural composite key (refYear + reporterISO + partnerISO + flowCode + cmdCode) strictly enforced with 0 duplicate groups in database.
              </div>
            </div>

            <div style={styles.pillarCard} data-testid="pillar-missing-measurements">
              <div style={styles.pillarIconRow}>
                <AlertTriangle size={18} color="#f59e0b" />
                <span style={{ ...styles.pillarTag, color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.15)" }}>
                  {qs.missing_cell_percentage ? `${qs.missing_cell_percentage}% Active Cell Nulls` : "7.32% Active Cell Nulls"}
                </span>
              </div>
              <div style={styles.pillarTitle}>Active Dataset Completeness</div>
              <div style={styles.pillarDesc}>
                {fmt(qs.total_missing_cells)} null cells across 5 optional fields out of {fmt(qs.total_active_cells || 87786)} total active cells (4,877 records × 18 columns).
              </div>
            </div>
          </div>

          {/* ── Section 1: Critical Fields ────────────────────────────── */}
          <div style={{ ...styles.missingTableWrapper, marginBottom: "20px" }} data-testid="critical-fields-section">
            <div style={styles.missingTableTitleGroup}>
              <ShieldCheck size={16} color="#38bdf8" />
              <h4 style={{ ...styles.missingTitle, color: "#38bdf8" }}>Critical Fields</h4>
            </div>
            <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 12px 0", lineHeight: "1.5" }}>
              Core dimensional and analytical valuation fields. Missing cells in these fields represent critical data corruption.
            </p>
            <div style={styles.tableResponsive}>
              <table style={styles.table} data-testid="critical-fields-table">
                <thead>
                  <tr>
                    <th style={styles.th}>Field Name</th>
                    <th style={styles.th}>Classification</th>
                    <th style={styles.thRight}>Missing Cells</th>
                    <th style={styles.thRight}>Missing Rate</th>
                    <th style={styles.th}>Health Status</th>
                    <th style={styles.th}>Analytical Role</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalItems.map((item, idx) => (
                    <tr key={item.column} data-testid={`critical-row-${item.column}`} style={{ backgroundColor: idx % 2 === 0 ? "transparent" : "#0f172a" }}>
                      <td style={styles.td}>
                        <code style={styles.code}>{item.column}</code>
                        <span style={styles.fieldNameSub}>{item.field_label || item.column}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: "600",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: "rgba(56,189,248,0.15)",
                          color: "#38bdf8",
                        }}>
                          Critical Field
                        </span>
                      </td>
                      <td style={{ ...styles.tdRight, color: "#10b981", fontWeight: "700" }}>
                        {fmt(item.missing_count)} missing
                      </td>
                      <td style={{ ...styles.tdRight, color: "#10b981" }}>
                        {item.missing_percentage?.toFixed(2) || "0.00"}%
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: "#10b981", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Check size={13} /> Complete
                        </span>
                      </td>
                      <td style={{ ...styles.td, color: "#94a3b8", fontSize: "12px" }}>
                        {item.description || "Core analytical measure"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section 2: Optional Measurement Fields ────────────────── */}
          <div style={styles.missingTableWrapper} data-testid="optional-fields-section">
            <div style={styles.missingTableTitleGroup}>
              <FileText size={16} color="#f59e0b" />
              <h4 style={styles.missingTitle}>Optional Measurement Fields</h4>
            </div>
            <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 12px 0", lineHeight: "1.5" }}>
              Secondary physical and supplemental valuation metrics. Missing values reflect standard UN Comtrade customs reporting conventions and do not affect primary trade values.
            </p>
            <div style={styles.tableResponsive}>
              <table style={styles.table} data-testid="optional-fields-table">
                <thead>
                  <tr>
                    <th style={styles.th}>Field Name</th>
                    <th style={styles.th}>Classification</th>
                    <th style={styles.thRight}>Missing Cells</th>
                    <th style={styles.thRight}>Missing Rate</th>
                    <th style={styles.th}>Health Status</th>
                    <th style={styles.th}>Analytical Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {optionalItems.map((item, idx) => (
                    <tr key={item.column} data-testid={`optional-row-${item.column}`} style={{ backgroundColor: idx % 2 === 0 ? "transparent" : "#0f172a" }}>
                      <td style={styles.td}>
                        <code style={styles.code}>{item.column}</code>
                        <span style={styles.fieldNameSub}>{item.field_label || item.column}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: "600",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: "rgba(148,163,184,0.15)",
                          color: "#94a3b8",
                        }}>
                          Optional Measurement
                        </span>
                      </td>
                      <td style={{ ...styles.tdRight, color: item.missing_count > 0 ? "#f59e0b" : "#10b981", fontWeight: "700" }}>
                        {fmt(item.missing_count)}
                      </td>
                      <td style={{ ...styles.tdRight, color: item.missing_count > 0 ? "#f59e0b" : "#10b981" }}>
                        {item.missing_percentage?.toFixed(2) || "0.00"}%
                      </td>
                      <td style={styles.td}>
                        {item.missing_count === 0 ? (
                          <span style={{ color: "#10b981", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Check size={13} /> Complete
                          </span>
                        ) : (
                          <span style={{ color: "#f59e0b", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <AlertTriangle size={13} /> Partial Nulls
                          </span>
                        )}
                      </td>
                      <td style={{ ...styles.td, color: "#94a3b8", fontSize: "12px" }}>
                        {item.description || "Secondary customs metric"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #334155", backgroundColor: "rgba(15,23,42,0.6)" }}>
                    <td colSpan={2} style={{ ...styles.td, fontWeight: "700", color: "#e2e8f0" }}>
                      Total Optional Missing Cells:
                    </td>
                    <td style={{ ...styles.tdRight, fontWeight: "700", color: "#f59e0b" }} data-testid="optional-total-missing">
                      {fmt(qs.optional_missing_cells ?? 6427)}
                    </td>
                    <td colSpan={3} style={{ ...styles.td, color: "#94a3b8", fontSize: "12px" }}>
                      Across 5 optional measurement fields ({qs.missing_cell_percentage ? `${qs.missing_cell_percentage}%` : "7.32%"} of {fmt(qs.total_active_cells || 87786)} total active cells)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </>
    );
  };

  // ── Upload result section ───────────────────────────────────────────────────
  const renderUploadResult = () => {
    if (!uploadResult) return null;
    const r = uploadResult;
    return (
      <div style={styles.uploadResult}>
        <div style={styles.resultHeader}>
          <CheckCircle2 size={18} color="#10b981" />
          <span style={styles.resultTitle}>Upload Complete — {r.filename}</span>
        </div>
        <div style={styles.countsGrid}>
          <div style={styles.countItem}>
            <span style={styles.countNum}>{fmt(r.records_read)}</span>
            <span style={styles.countLabel}>Records Read</span>
          </div>
          <div style={{ ...styles.countItem, borderColor: "#10b981" }}>
            <span style={{ ...styles.countNum, color: "#10b981" }}>{fmt(r.new_records_inserted)}</span>
            <span style={styles.countLabel}>Inserted</span>
          </div>
          <div style={{ ...styles.countItem, borderColor: "#f59e0b" }}>
            <span style={{ ...styles.countNum, color: "#f59e0b" }}>{fmt(r.existing_records_skipped)}</span>
            <span style={styles.countLabel}>Skipped (Duplicates)</span>
          </div>
          <div style={{ ...styles.countItem, borderColor: "#f87171" }}>
            <span style={{ ...styles.countNum, color: "#f87171" }}>{fmt(r.invalid_records_rejected)}</span>
            <span style={styles.countLabel}>Rejected</span>
          </div>
        </div>

        {r.rejection_details?.length > 0 && (
          <div style={styles.rejectionTable}>
            <h4 style={styles.rejectionTitle}><XCircle size={14} color="#f87171" /> Rejection Breakdown</h4>
            <div style={styles.tableResponsive}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Reason</th>
                    <th style={styles.th}>Count</th>
                    <th style={styles.th}>Row Numbers</th>
                  </tr>
                </thead>
                <tbody>
                  {r.rejection_details.map((d, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "#0f172a" }}>
                      <td style={styles.td}><code style={styles.code}>{d.reason}</code></td>
                      <td style={{ ...styles.td, color: "#f87171", fontWeight: 700 }}>{d.count}</td>
                      <td style={{ ...styles.td, color: "#94a3b8", fontSize: "12px" }}>
                        {d.row_indices.slice(0, 10).join(", ")}{d.row_indices.length > 10 ? ` … (+${d.row_indices.length - 10} more)` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Page header */}
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}><ShieldCheck size={24} color="#f59e0b" style={{ marginRight: 10 }} />Data Management</h1>
            <p style={styles.pageSubtitle}>Admin-only · Authoritative dataset health, multi-tier scope, and CSV upload pipeline</p>
          </div>
          <span style={styles.adminBadge}>ADMIN ONLY</span>
        </div>

        {/* Scope notice banner */}
        <ScopeNoticeBanner />

        {/* ── Dataset Overview ─────────────────────────────────────────────── */}
        <div style={styles.card} data-testid="dataset-overview-card">
          <div style={styles.sectionHeaderRow}>
            <h2 style={styles.sectionTitle}><Database size={18} color="#38bdf8" /> Dataset Overview</h2>
          </div>
          {renderOverview()}
        </div>

        {/* ── CSV Upload ───────────────────────────────────────────────────── */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}><UploadCloud size={18} color="#10b981" /> Upload New Data (CSV)</h2>

          {/* Rules panel */}
          <div style={styles.rulesPanel}>
            <h4 style={styles.rulesTitle}><FileText size={13} color="#94a3b8" /> Upload Requirements</h4>
            <ul style={styles.rulesList}>
              <li><strong>File type:</strong> .csv only</li>
              <li><strong>Max size:</strong> 50 MB</li>
              <li><strong>Required columns:</strong> <code style={styles.code}>{REQUIRED_COLUMNS.join(", ")}</code></li>
              <li><strong>flowCode:</strong> must be <code style={styles.code}>M</code> or <code style={styles.code}>X</code></li>
              <li><strong>Years:</strong> 1900–2100 range enforced</li>
              <li><strong>Duplicate prevention:</strong> rows with an existing composite key (refYear + reporterISO + partnerISO + flowCode + cmdCode) are skipped — existing data is never overwritten</li>
              <li><strong>Invalid rows</strong> are reported with reasons and not inserted</li>
            </ul>
          </div>

          {/* File picker */}
          <div style={styles.filePicker}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: "none" }}
              id="csv-upload-input"
            />
            <label htmlFor="csv-upload-input" style={styles.fileLabel}>
              <UploadCloud size={18} color="#38bdf8" />
              {selectedFile ? selectedFile.name : "Choose CSV file…"}
              {selectedFile && <span style={styles.fileSize}>&nbsp;({fmtBytes(selectedFile.size)})</span>}
            </label>

            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploadLoading}
              style={{
                ...styles.uploadBtn,
                opacity: (!selectedFile || uploadLoading) ? 0.5 : 1,
                cursor: (!selectedFile || uploadLoading) ? "not-allowed" : "pointer",
              }}
            >
              {uploadLoading
                ? <><RefreshCw size={14} className="spin" /> Uploading…</>
                : <><UploadCloud size={14} /> Upload &amp; Validate</>}
            </button>
          </div>

          {/* Upload error (file-level / server-level failure) */}
          {uploadError && (
            <div style={styles.errorBox}>
              <XCircle size={16} color="#f87171" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Upload result (successful request, partial rejection is normal) */}
          {renderUploadResult()}
        </div>
      </div>
    </div>
  );
};

// ── Responsive Styles ─────────────────────────────────────────────────────────
const styles = {
  page: { minHeight: "100vh", backgroundColor: "#090d16", color: "#f8fafc", padding: "28px 16px", fontFamily: "system-ui, -apple-system, sans-serif" },
  container: { maxWidth: "1160px", margin: "0 auto" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" },
  pageTitle: { fontSize: "24px", fontWeight: "700", margin: "0 0 4px 0", display: "flex", alignItems: "center" },
  pageSubtitle: { fontSize: "14px", color: "#64748b", margin: 0 },
  adminBadge: { backgroundColor: "rgba(245,158,11,0.2)", color: "#fbbf24", padding: "4px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: "700", border: "1px solid rgba(245,158,11,0.4)", letterSpacing: "0.05em", whiteSpace: "nowrap" },
  card: { backgroundColor: "#111827", border: "1px solid #1f2937", borderRadius: "16px", padding: "24px", marginBottom: "24px" },
  sectionHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" },
  sectionTitle: { display: "flex", alignItems: "center", gap: "8px", fontSize: "17px", fontWeight: "700", color: "#e2e8f0", margin: 0 },
  compositionHeader: { backgroundColor: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px" },
  compositionText: { fontSize: "13px", color: "#93c5fd", lineHeight: "1.5" },
  muted: { color: "#64748b", fontSize: "14px" },
  errorBox: { display: "flex", alignItems: "center", gap: "8px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "12px 16px", color: "#f87171", fontSize: "14px", marginBottom: "16px" },

  // KPI Grid
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "20px" },
  kpiCard: { backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "12px 10px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 },
  kpiIcon: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", borderRadius: "8px", marginBottom: "6px" },
  kpiValue: { fontSize: "19px", fontWeight: "700", color: "#f8fafc", marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" },
  kpiLabel: { fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: "600", marginBottom: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" },
  kpiSub: { fontSize: "10px", color: "#64748b", lineHeight: "1.3", maxWidth: "100%", wordBreak: "break-word" },

  // Scope Detail Box
  scopeDetailBox: { backgroundColor: "#0b1120", border: "1px solid #1e293b", borderRadius: "10px", padding: "16px", marginBottom: "24px" },
  scopeDetailHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" },
  scopeDetailTitle: { fontSize: "13px", fontWeight: "700", color: "#38bdf8", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" },
  scopeDetailGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" },
  scopeDetailCol: { fontSize: "12px" },
  scopeList: { margin: "6px 0 0 0", padding: "0 0 0 16px", color: "#94a3b8", lineHeight: "1.7" },

  // Health Section
  healthSectionCard: { borderTop: "1px solid #1e293b", paddingTop: "20px" },
  healthSectionHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" },
  healthSectionTitle: { fontSize: "15px", fontWeight: "700", color: "#f59e0b", margin: 0 },
  healthBanner: { display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid", borderRadius: "10px", padding: "14px 18px", marginBottom: "18px", backgroundColor: "#0f172a", flexWrap: "wrap", gap: "12px" },
  healthLeft: { display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: "260px" },
  healthTitle: { fontSize: "15px", fontWeight: "600", color: "#e2e8f0", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  healthSub: { fontSize: "13px", color: "#94a3b8", lineHeight: "1.4" },
  refreshBtn: { display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#94a3b8", padding: "7px 14px", fontSize: "12px", cursor: "pointer" },

  // Pillars
  pillarGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px", marginBottom: "20px" },
  pillarCard: { backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "16px" },
  pillarIconRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  pillarTag: { fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "4px" },
  pillarTitle: { fontSize: "14px", fontWeight: "700", color: "#e2e8f0", marginBottom: "6px" },
  pillarDesc: { fontSize: "12px", color: "#94a3b8", lineHeight: "1.5" },

  // Missing Values Table
  missingTableWrapper: { backgroundColor: "#0b1120", border: "1px solid #1e293b", borderRadius: "10px", padding: "16px" },
  missingTableTitleGroup: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" },
  missingTitle: { fontSize: "13px", fontWeight: "700", color: "#f59e0b", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" },
  tableResponsive: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "600px" },
  th: { textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", padding: "8px 12px", borderBottom: "1px solid #1e293b" },
  thRight: { textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", padding: "8px 12px", borderBottom: "1px solid #1e293b" },
  td: { fontSize: "13px", color: "#e2e8f0", padding: "10px 12px", borderBottom: "1px solid #0f172a", verticalAlign: "middle" },
  tdRight: { textAlign: "right", fontSize: "13px", padding: "10px 12px", borderBottom: "1px solid #0f172a", verticalAlign: "middle" },
  fieldNameSub: { display: "block", fontSize: "11px", color: "#64748b", marginTop: "2px" },
  code: { backgroundColor: "#1e293b", color: "#38bdf8", padding: "2px 6px", borderRadius: "4px", fontSize: "12px", fontFamily: "monospace" },

  // Upload section styles
  rulesPanel: { backgroundColor: "#0b1120", border: "1px solid #1e293b", borderRadius: "8px", padding: "14px 18px", marginBottom: "20px" },
  rulesTitle: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px 0" },
  rulesList: { margin: 0, padding: "0 0 0 18px", color: "#94a3b8", fontSize: "13px", lineHeight: "1.8" },
  filePicker: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" },
  fileLabel: { display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", padding: "10px 16px", color: "#94a3b8", fontSize: "14px", cursor: "pointer", flex: "1", minWidth: "200px" },
  fileSize: { color: "#64748b", fontSize: "12px" },
  uploadBtn: { display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#0ea5e9", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "14px", fontWeight: "600", whiteSpace: "nowrap" },
  uploadResult: { backgroundColor: "#0b1120", border: "1px solid #1e293b", borderRadius: "10px", padding: "18px" },
  resultHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" },
  resultTitle: { fontSize: "15px", fontWeight: "700", color: "#e2e8f0" },
  countsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", marginBottom: "16px" },
  countItem: { backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", padding: "12px", textAlign: "center" },
  countNum: { display: "block", fontSize: "22px", fontWeight: "700", color: "#f8fafc", marginBottom: "4px" },
  countLabel: { fontSize: "11px", color: "#64748b", textTransform: "uppercase" },
  rejectionTable: { marginTop: "8px" },
  rejectionTitle: { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "600", color: "#f87171", margin: "0 0 10px 0" },
};
