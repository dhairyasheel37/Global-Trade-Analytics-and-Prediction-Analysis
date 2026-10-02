import React, { useState, useEffect } from "react";
import api from "../api/client";
import {
  Info,
  Globe2,
  TrendingUp,
  Scale,
  Package,
  BrainCircuit,
  Database,
  ShieldCheck,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Code2,
  Sparkles,
  BarChart3,
  FileText,
  Lock,
} from "lucide-react";

export const AboutPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/about/dataset-stats");
      setStats(res.data);
    } catch (err) {
      console.error("Failed to load dataset stats:", err);
      setError("Unable to load live system statistics. Please verify backend connectivity.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div style={styles.container}>
      {/* Page Header */}
      <div style={styles.header}>
        <div style={styles.headerIcon}>
          <Info size={28} color="#38bdf8" />
        </div>
        <div>
          <h1 style={styles.pageTitle}>Global Trade Analysis and Prediction System</h1>
          <p style={styles.pageSubtitle}>
            System Architecture, Methodological Framework, and Live Platform Specification
          </p>
        </div>
      </div>

      {/* Dynamic Live Panel: System at a Glance */}
      <div style={styles.liveCard}>
        <div style={styles.liveHeader}>
          <div style={styles.liveTitleGroup}>
            <Database size={18} color="#38bdf8" />
            <h2 style={styles.liveTitle}>This System at a Glance</h2>
            <span style={styles.liveBadge}>
              <span style={styles.liveDot}></span> Live Database Connection
            </span>
          </div>
          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            style={styles.refreshBtn}
            title="Refresh database statistics"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>Sync Stats</span>
          </button>
        </div>

        {loading ? (
          <div style={styles.loadingBox}>
            <RefreshCw size={24} color="#38bdf8" className="spin" />
            <span style={styles.loadingText}>Querying active SQLite database...</span>
          </div>
        ) : error ? (
          <div style={styles.errorBox}>
            <AlertTriangle size={18} color="#f87171" />
            <span>{error}</span>
            <button onClick={fetchStats} style={styles.retryBtn}>
              Retry
            </button>
          </div>
        ) : stats ? (
          <div style={styles.statsGrid}>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>Total Trade Records</span>
              <span style={styles.statValue}>
                {stats.total_records?.toLocaleString() || "3,925"}
              </span>
              <span style={styles.statSub}>Validated relational records</span>
            </div>

            <div style={styles.statBox}>
              <span style={styles.statLabel}>Temporal Range</span>
              <span style={styles.statValue}>
                {stats.year_range?.start_year} – {stats.year_range?.end_year}
              </span>
              <span style={styles.statSub}>
                {stats.year_range?.end_year && stats.year_range?.start_year
                  ? `${stats.year_range.end_year - stats.year_range.start_year + 1} Annual Periods`
                  : "Historical span"}
              </span>
            </div>

            <div style={styles.statBox}>
              <span style={styles.statLabel}>Reporting Economies</span>
              <span style={styles.statValue}>{stats.reporter_count}</span>
              <span style={styles.statSub}>Sovereign nations & territories</span>
            </div>

            <div style={styles.statBox}>
              <span style={styles.statLabel}>Trade Flow Types</span>
              <span style={styles.statValue}>{stats.flow_count} Flows</span>
              <span style={styles.statSub}>Exports (X) & Imports (M)</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Main Content Sections */}
      <div style={styles.contentGrid}>
        {/* Section 1: Problem Statement & Objectives */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Globe2 size={20} color="#60a5fa" />
            <h3 style={styles.cardTitle}>Problem Statement & Core Objectives</h3>
          </div>
          <div style={styles.cardBody}>
            <h4 style={styles.subHeading}>The Analytical Challenge</h4>
            <p style={styles.paragraph}>
              International commerce generates massive streams of multilateral trade data across hundreds of national customs authorities. Manually aggregating, reconciling, and forecasting these high-dimensional records is labor-intensive, error-prone, and obscures macro-level structural trade imbalances and longitudinal economic shifts.
            </p>

            <h4 style={styles.subHeading}>System Objectives</h4>
            <div style={styles.objectivesList}>
              <div style={styles.objectiveItem}>
                <CheckCircle2 size={16} color="#34d399" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span><strong>Analyze Global Trade:</strong> Provide comprehensive aggregation across 190 reporting economies and multilateral partner flows.</span>
              </div>
              <div style={styles.objectiveItem}>
                <CheckCircle2 size={16} color="#34d399" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span><strong>Identify Longitudinal Trends:</strong> Track annual trade volume trajectories and historical YoY acceleration.</span>
              </div>
              <div style={styles.objectiveItem}>
                <CheckCircle2 size={16} color="#34d399" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span><strong>Compare Sovereign Economies:</strong> Contrast bilateral surpluses, deficits, and relative trade market shares.</span>
              </div>
              <div style={styles.objectiveItem}>
                <CheckCircle2 size={16} color="#34d399" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span><strong>Calculate Trade Balances:</strong> Accurately evaluate net balances (Exports minus Imports) at global and country levels.</span>
              </div>
              <div style={styles.objectiveItem}>
                <CheckCircle2 size={16} color="#34d399" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span><strong>Predict Future Trade Horizons:</strong> Generate recursive 1–5 year statistical forecasts with 95% confidence intervals.</span>
              </div>
              <div style={styles.objectiveItem}>
                <CheckCircle2 size={16} color="#34d399" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span><strong>Interactive Visualizations & Briefings:</strong> Deliver responsive charts and print-ready executive analytical reports.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Machine Learning Framework */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <BrainCircuit size={20} color="#c084fc" />
            <h3 style={styles.cardTitle}>Machine Learning & Forecasting Framework</h3>
          </div>
          <div style={styles.cardBody}>
            <p style={styles.paragraph}>
              The predictive engine employs two distinct families of algorithms to model longitudinal trade series: <strong>Linear Regression</strong> (parametric trend baseline) and <strong>Random Forest Regressor</strong> (50-tree non-linear ensemble).
            </p>

            <h4 style={styles.subHeading}>Rigorous Chronological Validation</h4>
            <div style={styles.highlightBox}>
              <AlertTriangle size={18} color="#fbbf24" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong style={{ color: "#fbbf24", display: "block", marginBottom: "4px" }}>
                  Why Chronological Splitting is Mandatory (Preventing Data Leakage)
                </strong>
                <span style={{ fontSize: "13px", color: "#e2e8f0", lineHeight: "1.5" }}>
                  Standard random k-fold cross-validation or randomized train/test splits are catastrophic for time-series data because future economic states leak into past training points. The system enforces a strict <strong>chronological split</strong>: historical years (e.g. 2017–2023) are used strictly for model training, and the most recent periods (2024–2025) are held out for out-of-sample backtesting.
                </span>
              </div>
            </div>

            <h4 style={styles.subHeading}>Leakage-Free Feature Engineering</h4>
            <p style={styles.paragraph}>
              Models are trained on strictly backwards-looking lag features generated without lookahead bias:
            </p>
            <ul style={styles.featureBulletList}>
              <li><strong>Prior Year Lags (<code>lag_1</code>, <code>lag_2</code>, <code>lag_3</code>):</strong> Captures short- and medium-term autocorrelation.</li>
              <li><strong>Rolling Window Mean (<code>rolling_mean_3</code>):</strong> 3-year trailing moving average of past observations.</li>
              <li><strong>YoY Growth Velocity (<code>pct_change_1</code>):</strong> First-difference percentage rate of change.</li>
              <li><strong>Normalized Time Trend (<code>year_trend</code>):</strong> Linear baseline trend indicator.</li>
            </ul>

            <h4 style={styles.subHeading}>Statistical Metrics & Safeguards</h4>
            <div style={styles.metricsExplanations}>
              <div style={styles.metricExplain}>
                <strong>MAE (Mean Absolute Error):</strong> Primary selection criterion; robust to extreme macroeconomic shocks.
              </div>
              <div style={styles.metricExplain}>
                <strong>RMSE (Root Mean Squared Error):</strong> Quadratic metric sensitive to large forecasting deviations.
              </div>
              <div style={styles.metricExplain}>
                <strong>R² Score:</strong> Proportion of variance explained compared to a naive historical-mean baseline.
              </div>
              <div style={styles.metricExplain}>
                <strong>Low-Confidence Guard:</strong> If holdout R² &lt; 0, the system automatically emits a prominent warning that the model failed to outperform a historical average.
              </div>
              <div style={styles.metricExplain}>
                <strong>Data Sufficiency Threshold:</strong> Enforces a hard requirement of at least 8 usable annual observations before allowing model fitting.
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Architecture & Technical Stack */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Server size={20} color="#34d399" />
            <h3 style={styles.cardTitle}>System Architecture & Technical Stack</h3>
          </div>
          <div style={styles.cardBody}>
            <p style={styles.paragraph}>
              The platform is built upon a decoupled, service-oriented architecture designed for deterministic computation and high reliability:
            </p>

            <div style={styles.archGrid}>
              <div style={styles.archBox}>
                <div style={styles.archHeader}>
                  <Code2 size={16} color="#60a5fa" />
                  <strong>Frontend Layer</strong>
                </div>
                <span style={styles.archDesc}>
                  Single Page Application built with <strong>React 19</strong>, <strong>Vite</strong>, and <strong>React Router</strong>. Visualized via <strong>Recharts</strong> with fully responsive layouts and print-to-PDF CSS.
                </span>
              </div>

              <div style={styles.archBox}>
                <div style={styles.archHeader}>
                  <Server size={16} color="#34d399" />
                  <strong>Backend Services</strong>
                </div>
                <span style={styles.archDesc}>
                  <strong>FastAPI (Python 3.12)</strong> RESTful microservices with <strong>Pydantic v2</strong> data validation schemas, dependency injection, and modular route orchestration.
                </span>
              </div>

              <div style={styles.archBox}>
                <div style={styles.archHeader}>
                  <Database size={16} color="#f59e0b" />
                  <strong>Data Persistence</strong>
                </div>
                <span style={styles.archDesc}>
                  <strong>SQLite</strong> database with <strong>SQLAlchemy ORM</strong>. Composite indexing on <code>(refYear, reporterISO, partnerISO, flowCode, cmdCode)</code> guarantees deterministic uniqueness.
                </span>
              </div>

              <div style={styles.archBox}>
                <div style={styles.archHeader}>
                  <Lock size={16} color="#c084fc" />
                  <strong>Security & Auth</strong>
                </div>
                <span style={styles.archDesc}>
                  Stateless <strong>JWT Bearer tokens</strong> with PBKDF2-SHA256 password hashing. Enforces granular Role-Based Access Control (<code>ADMIN</code> vs <code>USER</code> roles).
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Dataset Scope & Structural Realities */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Package size={20} color="#f59e0b" />
            <h3 style={styles.cardTitle}>Dataset Profile & Known Structural Limitations</h3>
          </div>
          <div style={styles.cardBody}>
            <p style={styles.paragraph}>
              Transparency and data integrity are central to this platform. The underlying trade dataset conforms to the United Nations Comtrade standard multilateral schema, with two known structural characteristics that are stated honestly across the system:
            </p>

            <div style={styles.limitationsList}>
              <div style={styles.limitationItem}>
                <div style={styles.limitationBadge}>PARTNER SCOPE</div>
                <div>
                  <strong style={{ color: "#f8fafc" }}>Single Partner ("World" / PartnerISO: W00):</strong>
                  <p style={styles.limitationText}>
                    All reported bilateral trade records in this release represent sovereign country trade with the <em>World aggregate</em> rather than granular bilateral nation-to-nation dyads.
                  </p>
                </div>
              </div>

              <div style={styles.limitationItem}>
                <div style={styles.limitationBadge}>COMMODITY SCOPE</div>
                <div>
                  <strong style={{ color: "#f8fafc" }}>Single Commodity ("TOTAL" / All Commodities):</strong>
                  <p style={styles.limitationText}>
                    The dataset aggregates commodity trade at the highest classification level (<code>TOTAL: All Commodities</code>). Individual HS-2/HS-6 product chapters are not disaggregated in this baseline dataset.
                  </p>
                </div>
              </div>
            </div>

            <div style={styles.integrityNote}>
              <ShieldCheck size={16} color="#34d399" style={{ flexShrink: 0 }} />
              <span>
                <strong>Data Verification Principle:</strong> All metrics, aggregations, and forecasts are evaluated dynamically against the SQLite database with deterministic seeds and leakage-free pipelines.
              </span>
            </div>
          </div>
        </div>
      </div>
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
    alignItems: "center",
    gap: "16px",
    marginBottom: "24px",
  },
  headerIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    border: "1px solid rgba(56, 189, 248, 0.2)",
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 4px 0",
  },
  pageSubtitle: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: 0,
  },
  liveCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "20px 24px",
    marginBottom: "28px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
  },
  liveHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    paddingBottom: "12px",
    borderBottom: "1px solid #1f2937",
  },
  liveTitleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  liveTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#ffffff",
    margin: 0,
  },
  liveBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "rgba(52, 211, 153, 0.1)",
    color: "#34d399",
    border: "1px solid rgba(52, 211, 153, 0.2)",
    padding: "2px 8px",
    borderRadius: "9999px",
    fontSize: "11px",
    fontWeight: "600",
  },
  liveDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#34d399",
  },
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#1e293b",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  loadingBox: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "24px",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    padding: "12px 16px",
    borderRadius: "8px",
    color: "#f87171",
    fontSize: "13px",
  },
  retryBtn: {
    marginLeft: "auto",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "12px",
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  statBox: {
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "14px 16px",
  },
  statLabel: {
    display: "block",
    fontSize: "11px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: "4px",
  },
  statValue: {
    display: "block",
    fontSize: "20px",
    fontWeight: "700",
    color: "#38bdf8",
    marginBottom: "2px",
  },
  statSub: {
    fontSize: "11px",
    color: "#64748b",
  },
  contentGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  card: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "24px",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
    borderBottom: "1px solid #1f2937",
    paddingBottom: "12px",
  },
  cardTitle: {
    fontSize: "17px",
    fontWeight: "600",
    color: "#ffffff",
    margin: 0,
  },
  cardBody: {
    fontSize: "14px",
    lineHeight: "1.6",
    color: "#cbd5e1",
  },
  subHeading: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#f8fafc",
    margin: "16px 0 8px 0",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  paragraph: {
    fontSize: "14px",
    color: "#cbd5e1",
    lineHeight: "1.6",
    margin: "0 0 12px 0",
  },
  objectivesList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "12px",
    marginTop: "12px",
  },
  objectiveItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    color: "#cbd5e1",
  },
  highlightBox: {
    display: "flex",
    gap: "12px",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    borderRadius: "8px",
    padding: "14px 16px",
    margin: "16px 0",
  },
  featureBulletList: {
    margin: "8px 0 16px 20px",
    padding: 0,
    color: "#cbd5e1",
    fontSize: "13px",
    lineHeight: "1.7",
  },
  metricsExplanations: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "10px",
    marginTop: "12px",
  },
  metricExplain: {
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "6px",
    padding: "10px 12px",
    fontSize: "12px",
    color: "#cbd5e1",
  },
  archGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
    marginTop: "14px",
  },
  archBox: {
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "16px",
  },
  archHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
    color: "#f8fafc",
    fontSize: "14px",
  },
  archDesc: {
    fontSize: "12px",
    color: "#94a3b8",
    lineHeight: "1.5",
    display: "block",
  },
  limitationsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    margin: "16px 0",
  },
  limitationItem: {
    display: "flex",
    gap: "14px",
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "14px 16px",
    alignItems: "flex-start",
  },
  limitationBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    color: "#fbbf24",
    fontSize: "10px",
    fontWeight: "700",
    padding: "4px 8px",
    borderRadius: "4px",
    letterSpacing: "0.06em",
    flexShrink: 0,
    marginTop: "2px",
  },
  limitationText: {
    fontSize: "13px",
    color: "#cbd5e1",
    margin: "4px 0 0 0",
    lineHeight: "1.5",
  },
  integrityNote: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(52, 211, 153, 0.1)",
    border: "1px solid rgba(52, 211, 153, 0.25)",
    borderRadius: "8px",
    padding: "12px 16px",
    fontSize: "13px",
    color: "#34d399",
    marginTop: "16px",
  },
};
