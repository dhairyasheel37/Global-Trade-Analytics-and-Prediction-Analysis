import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import {
  FileText,
  Printer,
  RefreshCw,
  Play,
  Filter,
  Globe2,
  TrendingUp,
  Scale,
  Package,
  BrainCircuit,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  Info,
  Sparkles,
  ArrowRight,
  FileSpreadsheet,
  Download,
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
} from "recharts";

// Currency formatter
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

export const ReportsPage = () => {
  // Filter options loaded from server
  const [reportersList, setReportersList] = useState([]);
  const [yearsList, setYearsList] = useState([]);

  // Selected filters
  const [selectedReporter, setSelectedReporter] = useState("");
  const [selectedFlow, setSelectedFlow] = useState("");
  const [selectedStartYear, setSelectedStartYear] = useState("");
  const [selectedEndYear, setSelectedEndYear] = useState("");
  const [includePrediction, setIncludePrediction] = useState(false);
  const [forecastYears, setForecastYears] = useState(3);

  // Report state
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // 1. Fetch available filter options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await api.get("/dashboard/filter-options");
        setReportersList(res.data.reporters || []);
        setYearsList(res.data.years || []);
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    };
    fetchOptions();
  }, []);

  // 2. Generate report function
  const handleGenerateReport = useCallback(
    async (overrideParams = null) => {
      setLoading(true);
      setError(null);

      const params = overrideParams || {
        reporter: selectedReporter || null,
        flow: selectedFlow || null,
        start_year: selectedStartYear ? parseInt(selectedStartYear, 10) : null,
        end_year: selectedEndYear ? parseInt(selectedEndYear, 10) : null,
        include_prediction: includePrediction,
        forecast_years: forecastYears,
      };

      try {
        const res = await api.post("/reports/generate", params);
        setReportData(res.data);
      } catch (err) {
        console.error("Report generation error:", err);
        setError(
          err.response?.data?.detail || "Failed to generate report. Please check your filter criteria."
        );
      } finally {
        setLoading(false);
      }
    },
    [
      selectedReporter,
      selectedFlow,
      selectedStartYear,
      selectedEndYear,
      includePrediction,
      forecastYears,
    ]
  );

  // Generate an initial default global report on load
  useEffect(() => {
    handleGenerateReport({
      reporter: null,
      flow: null,
      start_year: null,
      end_year: null,
      include_prediction: false,
      forecast_years: 3,
    });
  }, []);

  // 3. Export to PDF handler
  const handleDownloadPdf = async () => {
    if (!reportData) return;
    setDownloadingPdf(true);
    try {
      const payload = {
        reporter: selectedReporter || null,
        flow: selectedFlow || null,
        start_year: selectedStartYear ? parseInt(selectedStartYear, 10) : null,
        end_year: selectedEndYear ? parseInt(selectedEndYear, 10) : null,
        include_prediction: includePrediction,
        forecast_years: forecastYears,
      };
      const res = await api.post("/reports/export/pdf", payload, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filename = `Trade_Report_${selectedReporter || "Global"}_${new Date().toISOString().slice(0, 10)}.pdf`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download failed:", err);
      alert("Failed to download PDF report. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // 4. Export to Excel handler
  const handleDownloadExcel = async () => {
    if (!reportData) return;
    setDownloadingExcel(true);
    try {
      const payload = {
        reporter: selectedReporter || null,
        flow: selectedFlow || null,
        start_year: selectedStartYear ? parseInt(selectedStartYear, 10) : null,
        end_year: selectedEndYear ? parseInt(selectedEndYear, 10) : null,
        include_prediction: includePrediction,
        forecast_years: forecastYears,
      };
      const res = await api.post("/reports/export/excel", payload, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filename = `Trade_Report_${selectedReporter || "Global"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Excel download failed:", err);
      alert("Failed to download Excel report. Please try again.");
    } finally {
      setDownloadingExcel(false);
    }
  };

  // 5. Print View handler
  const handlePrint = () => {
    window.print();
  };

  const ts = reportData?.trade_stats;
  const cp = reportData?.country_profile;
  const pp = reportData?.product_profile;
  const pred = reportData?.prediction;
  const trend = reportData?.yearly_trend || [];

  return (
    <div style={styles.container}>
      {/* Print-specific media styles */}
      <style>
        {`
          @media print {
            aside, .no-print, header, nav, button {
              display: none !important;
            }
            body, #root, main, div {
              background: #ffffff !important;
              color: #0f172a !important;
            }
            .printable-card {
              background: #ffffff !important;
              border: 1px solid #cbd5e1 !important;
              box-shadow: none !important;
              color: #0f172a !important;
              break-inside: avoid;
              margin-bottom: 20px !important;
            }
            .print-text-dark {
              color: #0f172a !important;
            }
            .print-text-muted {
              color: #475569 !important;
            }
          }
        `}
      </style>

      {/* Header & Print Actions */}
      <div style={styles.header} className="no-print">
        <div>
          <h1 style={styles.pageTitle}>Automated Analytical Trade Reports</h1>
          <p style={styles.pageSubtitle}>
            Consolidates trade flows, bilateral balances, commodity statistics, and machine learning forecasts into an exportable briefing.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={loading || !reportData || downloadingPdf}
            style={{
              ...styles.pdfBtn,
              opacity: loading || !reportData || downloadingPdf ? 0.6 : 1,
              cursor: loading || !reportData || downloadingPdf ? "not-allowed" : "pointer",
            }}
            title="Download executive-styled vector PDF briefing report"
          >
            {downloadingPdf ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <FileText size={16} />
            )}
            <span>{downloadingPdf ? "Generating PDF..." : "Executive PDF (.pdf)"}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={loading || !reportData || downloadingExcel}
            style={{
              ...styles.excelBtn,
              opacity: loading || !reportData || downloadingExcel ? 0.6 : 1,
              cursor: loading || !reportData || downloadingExcel ? "not-allowed" : "pointer",
            }}
            title="Download formatted multi-tab Excel financial workbook with formulas"
          >
            {downloadingExcel ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={16} />
            )}
            <span>{downloadingExcel ? "Generating Excel..." : "Executive Excel (.xlsx)"}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || !reportData}
            style={styles.printBtn}
            title="Print current on-screen briefing"
          >
            <Printer size={16} />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar (hidden on print) */}
      <div style={styles.filterCard} className="no-print">
        <div style={styles.filterHeader}>
          <div style={styles.filterTitleGroup}>
            <Filter size={16} color="#38bdf8" />
            <h2 style={styles.filterTitle}>Report Scope & Filter Parameters</h2>
          </div>
          <span style={styles.filterHint}>Adjust parameters and click Generate Report</span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerateReport();
          }}
          style={styles.filterForm}
        >
          {/* Reporter Selector */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Country / Reporter</label>
            <select
              value={selectedReporter}
              onChange={(e) => setSelectedReporter(e.target.value)}
              style={styles.select}
            >
              <option value="">Global (All Countries Aggregate)</option>
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
              <option value="">All Flows (Exports & Imports)</option>
              <option value="X">Exports (Outbound Flow X)</option>
              <option value="M">Imports (Inbound Flow M)</option>
            </select>
          </div>

          {/* Start Year */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Start Year</label>
            <select
              value={selectedStartYear}
              onChange={(e) => setSelectedStartYear(e.target.value)}
              style={styles.select}
            >
              <option value="">Full History (2014)</option>
              {yearsList.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* End Year */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>End Year</label>
            <select
              value={selectedEndYear}
              onChange={(e) => setSelectedEndYear(e.target.value)}
              style={styles.select}
            >
              <option value="">Latest Available (2025)</option>
              {yearsList.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Prediction Checkbox & Forecast Years */}
          <div style={styles.filterGroupCheck}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={includePrediction}
                onChange={(e) => setIncludePrediction(e.target.checked)}
                style={styles.checkbox}
              />
              <span style={{ fontWeight: "600", color: "#e2e8f0" }}>Include ML Forecast</span>
            </label>

            {includePrediction && (
              <div style={styles.horizonInline}>
                <span style={styles.horizonLabel}>Horizon:</span>
                <select
                  value={forecastYears}
                  onChange={(e) => setForecastYears(Number(e.target.value))}
                  style={styles.horizonSelect}
                >
                  <option value={1}>1 Year (2026)</option>
                  <option value={2}>2 Years (2026–2027)</option>
                  <option value={3}>3 Years (2026–2028)</option>
                  <option value={4}>4 Years (2026–2029)</option>
                  <option value={5}>5 Years (2026–2030)</option>
                </select>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <div style={styles.filterActions}>
            <button
              type="submit"
              disabled={loading}
              style={loading ? styles.generateBtnDisabled : styles.generateBtn}
            >
              {loading ? (
                <>
                  <RefreshCw size={15} className="spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Play size={15} fill="#ffffff" />
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div style={styles.errorBanner} className="no-print">
          <AlertCircle size={20} color="#f87171" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Placeholder */}
      {loading && (
        <div style={styles.loadingBox} className="no-print">
          <RefreshCw size={36} color="#38bdf8" className="spin" />
          <p style={styles.loadingText}>
            Composing analytical data across trade statistics, country profile, and forecasting models...
          </p>
        </div>
      )}

      {/* Report Document Presentation */}
      {reportData && !loading && (
        <div style={styles.reportDocument} className="printable-report">
          {/* Report Title Header */}
          <div style={styles.documentHeader}>
            <div style={styles.docBadgeGroup}>
              <span style={styles.docBadge}>OFFICIAL BRIEFING</span>
              <span style={styles.docTimestamp}>
                Generated: {new Date(reportData.generated_at).toLocaleString()}
              </span>
            </div>
            <h2 style={styles.documentTitle} className="print-text-dark">
              {reportData.report_title}
            </h2>
            <div style={styles.scopeSummary} className="print-text-muted">
              <span><strong>Scope:</strong> {reportData.filters.reporter || "Global (All Reporters)"}</span>
              <span> &bull; </span>
              <span>
                <strong>Flow:</strong>{" "}
                {reportData.filters.flow === "X"
                  ? "Exports (X)"
                  : reportData.filters.flow === "M"
                  ? "Imports (M)"
                  : "Exports & Imports Combined"}
              </span>
              <span> &bull; </span>
              <span>
                <strong>Years:</strong>{" "}
                {reportData.filters.start_year || 2014} – {reportData.filters.end_year || 2025}
              </span>
              <span> &bull; </span>
              <span>
                <strong>Commodity:</strong> {pp?.cmd_desc || "All Commodities (TOTAL)"}
              </span>
            </div>
          </div>

          {/* Empty Data State */}
          {reportData.no_data ? (
            <div style={styles.emptyStateCard} className="printable-card">
              <AlertTriangle size={36} color="#f59e0b" />
              <h3 style={styles.emptyTitle}>No Data Matching Criteria</h3>
              <p style={styles.emptyDesc}>
                {reportData.message || "No trade observations were found for this combination of country, flow, and year range."}
              </p>
            </div>
          ) : (
            <>
              {/* Executive Summary Metrics Grid */}
              <div style={styles.metricsGrid}>
                <div style={styles.metricCard} className="printable-card">
                  <div style={styles.metricHeader}>
                    <span style={styles.metricLabel}>Total Trade Volume</span>
                    <DollarSign size={16} color="#38bdf8" />
                  </div>
                  <div style={styles.metricVal}>{formatCurrency(ts?.total_trade_value)}</div>
                  <div style={styles.metricSub}>Across {ts?.record_count} observations</div>
                </div>

                <div style={styles.metricCard} className="printable-card">
                  <div style={styles.metricHeader}>
                    <span style={styles.metricLabel}>Export Volume</span>
                    <TrendingUp size={16} color="#34d399" />
                  </div>
                  <div style={{ ...styles.metricVal, color: "#34d399" }}>
                    {formatCurrency(ts?.export_value)}
                  </div>
                  <div style={styles.metricSub}>Outbound trade flow (X)</div>
                </div>

                <div style={styles.metricCard} className="printable-card">
                  <div style={styles.metricHeader}>
                    <span style={styles.metricLabel}>Import Volume</span>
                    <Package size={16} color="#f87171" />
                  </div>
                  <div style={{ ...styles.metricVal, color: "#f87171" }}>
                    {formatCurrency(ts?.import_value)}
                  </div>
                  <div style={styles.metricSub}>Inbound trade flow (M)</div>
                </div>

                <div style={styles.metricCard} className="printable-card">
                  <div style={styles.metricHeader}>
                    <span style={styles.metricLabel}>Trade Balance</span>
                    <Scale size={16} color="#c084fc" />
                  </div>
                  <div
                    style={{
                      ...styles.metricVal,
                      color: (ts?.trade_balance || 0) >= 0 ? "#34d399" : "#f87171",
                    }}
                  >
                    {formatCurrency(ts?.trade_balance)}
                  </div>
                  <div style={styles.metricSub}>
                    {(ts?.trade_balance || 0) >= 0 ? "Trade Surplus" : "Trade Deficit"}
                  </div>
                </div>
              </div>

              {/* Country Profile Section (if country selected) */}
              {cp && (
                <div style={styles.sectionCard} className="printable-card">
                  <div style={styles.sectionHeader}>
                    <Globe2 size={20} color="#38bdf8" />
                    <h3 style={styles.sectionTitle}>Country Analytical Profile: {cp.reporter_name}</h3>
                  </div>
                  <div style={styles.profileDetailsGrid}>
                    <div style={styles.profileItem}>
                      <span style={styles.profileLabel}>Reporter ISO Code</span>
                      <span style={styles.profileValue}>{cp.reporter_iso}</span>
                    </div>
                    <div style={styles.profileItem}>
                      <span style={styles.profileLabel}>Trade Balance Status</span>
                      <span
                        style={{
                          ...styles.profileValue,
                          color: cp.trade_balance >= 0 ? "#34d399" : "#f87171",
                        }}
                      >
                        {cp.trade_balance_status}
                      </span>
                    </div>
                    <div style={styles.profileItem}>
                      <span style={styles.profileLabel}>Export Growth Rate</span>
                      <span style={styles.profileValue}>
                        {cp.export_growth !== null ? `${cp.export_growth}%` : "N/A"}
                      </span>
                    </div>
                    <div style={styles.profileItem}>
                      <span style={styles.profileLabel}>Import Growth Rate</span>
                      <span style={styles.profileValue}>
                        {cp.import_growth !== null ? `${cp.import_growth}%` : "N/A"}
                      </span>
                    </div>
                  </div>
                  {cp.growth_note && (
                    <div style={styles.growthNote}>
                      <Info size={14} color="#94a3b8" />
                      <span>{cp.growth_note}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Historical Trend Chart View */}
              {trend.length > 0 && (
                <div style={styles.sectionCard} className="printable-card">
                  <div style={styles.sectionHeader}>
                    <TrendingUp size={20} color="#34d399" />
                    <h3 style={styles.sectionTitle}>Historical Annual Trade Volume Dynamics</h3>
                  </div>
                  <div style={styles.chartWrapper}>
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={trend} margin={{ top: 15, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="year" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" tickFormatter={(v) => formatCurrency(v)} />
                        <Tooltip
                          formatter={(val, name) => [
                            formatCurrency(val),
                            name === "export_value"
                              ? "Exports (X)"
                              : name === "import_value"
                              ? "Imports (M)"
                              : "Total Trade",
                          ]}
                          contentStyle={styles.customTooltip}
                        />
                        <Legend
                          formatter={(name) =>
                            name === "export_value"
                              ? "Exports (X)"
                              : name === "import_value"
                              ? "Imports (M)"
                              : "Total Trade"
                          }
                        />
                        <Bar dataKey="export_value" fill="#34d399" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="import_value" fill="#f87171" radius={[4, 4, 0, 0]} />
                        <Line
                          type="monotone"
                          dataKey="total_value"
                          stroke="#38bdf8"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Machine Learning Prediction Section */}
              {pred && (
                <div style={styles.sectionCard} className="printable-card">
                  <div style={styles.sectionHeader}>
                    <BrainCircuit size={20} color="#c084fc" />
                    <div>
                      <h3 style={styles.sectionTitle}>
                        Predictive Trade Projections ({pred.reporter_name} &bull; {pred.flow_desc})
                      </h3>
                      <span style={styles.sectionSubtitle}>
                        Model: {pred.models?.[pred.best_model]?.display_name || pred.best_model?.replace("_", " ").toUpperCase()} &bull; Horizon: {pred.models?.[pred.best_model]?.forecast_series?.length || 0} Years
                      </span>
                    </div>
                  </div>

                  {/* Verbatim Low Confidence Model Warning */}
                  {pred.low_confidence_warning && (
                    <div style={styles.warningAlertBox}>
                      <AlertTriangle size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
                      <div>
                        <strong style={styles.warningAlertTitle}>Low Confidence Model Warning</strong>
                        <p style={styles.warningAlertText}>{pred.low_confidence_warning}</p>
                      </div>
                    </div>
                  )}

                  {/* Multi-Year Forecast Table */}
                  {pred.models?.[pred.best_model]?.forecast_series && (
                    <div style={styles.forecastTableContainer}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Forecast Year</th>
                            <th style={styles.thRight}>Projected Value</th>
                            <th style={styles.thRight}>95% Confidence Band (Lower – Upper)</th>
                            <th style={styles.thRight}>YoY Growth Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pred.models[pred.best_model].forecast_series.map((pt) => (
                            <tr key={pt.year} style={styles.tr}>
                              <td style={styles.tdYear}>{pt.year}</td>
                              <td style={styles.tdForecast}>{formatCurrency(pt.predicted)}</td>
                              <td style={styles.tdRange}>
                                {formatCurrency(pt.lower_bound)} – {formatCurrency(pt.upper_bound)}
                              </td>
                              <td style={styles.tdGrowth}>
                                {pt.growth_pct !== null ? (
                                  <span style={pt.growth_pct >= 0 ? styles.growthPos : styles.growthNeg}>
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
                  )}

                  {/* Verbatim Reliability Note / Disclaimer */}
                  {pred.reliability_note && (
                    <div style={styles.disclaimerBox}>
                      <Info size={16} color="#60a5fa" style={{ flexShrink: 0 }} />
                      <span style={styles.disclaimerText}>{pred.reliability_note}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: "24px 32px",
    maxWidth: "1300px",
    margin: "0 auto",
    color: "#f8fafc",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
  },
  pageTitle: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 6px 0",
  },
  pageSubtitle: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: 0,
    maxWidth: "750px",
  },
  headerActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
  },
  pdfBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#0284c7",
    color: "#ffffff",
    border: "1px solid #0369a1",
    borderRadius: "8px",
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: "600",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
    transition: "background-color 0.2s",
  },
  excelBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#059669",
    color: "#ffffff",
    border: "1px solid #047857",
    borderRadius: "8px",
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: "600",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
    transition: "background-color 0.2s",
  },
  printBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  filterCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "28px",
  },
  filterHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    borderBottom: "1px solid #1f2937",
    paddingBottom: "12px",
  },
  filterTitleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  filterTitle: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#e2e8f0",
    margin: 0,
  },
  filterHint: {
    fontSize: "12px",
    color: "#64748b",
  },
  filterForm: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    alignItems: "flex-end",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: "180px",
    flex: "1 1 180px",
  },
  filterGroupCheck: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    minWidth: "240px",
    height: "38px",
  },
  filterLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  select: {
    backgroundColor: "#0b1120",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "13px",
    outline: "none",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    fontSize: "13px",
  },
  checkbox: {
    width: "16px",
    height: "16px",
    accentColor: "#a855f7",
    cursor: "pointer",
  },
  horizonInline: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  horizonLabel: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  horizonSelect: {
    backgroundColor: "#0b1120",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "4px 8px",
    fontSize: "12px",
    outline: "none",
  },
  filterActions: {
    marginLeft: "auto",
  },
  generateBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "9px 20px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  generateBtnDisabled: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#1e3a8a",
    color: "#93c5fd",
    border: "none",
    borderRadius: "8px",
    padding: "9px 20px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "not-allowed",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid #ef4444",
    borderRadius: "8px",
    padding: "12px 16px",
    color: "#f87171",
    fontSize: "14px",
    marginBottom: "20px",
  },
  loadingBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "14px",
    padding: "60px",
    backgroundColor: "#111827",
    borderRadius: "12px",
    border: "1px solid #1f2937",
  },
  loadingText: {
    fontSize: "14px",
    color: "#94a3b8",
    textAlign: "center",
    maxWidth: "500px",
    margin: 0,
  },
  reportDocument: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  documentHeader: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "24px 28px",
  },
  docBadgeGroup: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  docBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    color: "#60a5fa",
    fontSize: "11px",
    fontWeight: "700",
    padding: "3px 8px",
    borderRadius: "4px",
    letterSpacing: "0.06em",
  },
  docTimestamp: {
    fontSize: "12px",
    color: "#64748b",
  },
  documentTitle: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 10px 0",
  },
  scopeSummary: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  emptyStateCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "48px 24px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  },
  emptyTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#f8fafc",
    margin: 0,
  },
  emptyDesc: {
    fontSize: "14px",
    color: "#94a3b8",
    maxWidth: "500px",
    margin: 0,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  metricCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "10px",
    padding: "18px",
  },
  metricHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  metricLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  metricVal: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: "4px",
  },
  metricSub: {
    fontSize: "12px",
    color: "#64748b",
  },
  sectionCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "24px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#ffffff",
    margin: 0,
  },
  sectionSubtitle: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  profileDetailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "14px",
    marginBottom: "16px",
  },
  profileItem: {
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "12px 14px",
  },
  profileLabel: {
    display: "block",
    fontSize: "11px",
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: "4px",
  },
  profileValue: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#f8fafc",
  },
  growthNote: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "#94a3b8",
    backgroundColor: "#0b1120",
    padding: "8px 12px",
    borderRadius: "6px",
  },
  chartWrapper: {
    width: "100%",
    marginTop: "10px",
  },
  customTooltip: {
    backgroundColor: "#0b1120",
    border: "1px solid #334155",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#f8fafc",
  },
  warningAlertBox: {
    display: "flex",
    gap: "12px",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    border: "1px solid rgba(245, 158, 11, 0.4)",
    borderRadius: "8px",
    padding: "14px",
    marginBottom: "20px",
  },
  warningAlertTitle: {
    display: "block",
    fontSize: "13px",
    fontWeight: "700",
    color: "#fbbf24",
    marginBottom: "3px",
  },
  warningAlertText: {
    fontSize: "13px",
    color: "#fbbf24",
    margin: 0,
    lineHeight: "1.4",
  },
  forecastTableContainer: {
    overflowX: "auto",
    marginBottom: "16px",
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
    padding: "10px 12px",
    borderBottom: "1px solid #1f2937",
    textAlign: "left",
  },
  thRight: {
    backgroundColor: "#0b1120",
    color: "#94a3b8",
    fontWeight: "600",
    padding: "10px 12px",
    borderBottom: "1px solid #1f2937",
    textAlign: "right",
  },
  tr: {
    borderBottom: "1px solid #1e293b",
  },
  tdYear: {
    padding: "10px 12px",
    color: "#ffffff",
    fontWeight: "700",
  },
  tdForecast: {
    padding: "10px 12px",
    color: "#c084fc",
    textAlign: "right",
    fontWeight: "700",
  },
  tdRange: {
    padding: "10px 12px",
    color: "#94a3b8",
    textAlign: "right",
    fontSize: "12px",
  },
  tdGrowth: {
    padding: "10px 12px",
    textAlign: "right",
    fontWeight: "600",
  },
  growthPos: {
    color: "#34d399",
  },
  growthNeg: {
    color: "#f87171",
  },
  disclaimerBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "12px 14px",
  },
  disclaimerText: {
    fontSize: "12px",
    color: "#94a3b8",
    lineHeight: "1.4",
  },
};
