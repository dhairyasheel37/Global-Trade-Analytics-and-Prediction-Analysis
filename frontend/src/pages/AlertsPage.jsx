import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import {
  Bell,
  Calendar,
  ShieldAlert,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  Plus,
  Trash2,
  Download,
  Filter,
  Check,
  X,
  Mail,
  RefreshCw,
  FileText,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Activity,
  Layers,
  Info,
  Server,
  Settings,
  Key,
} from "lucide-react";

export const AlertsPage = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState("briefings"); // 'briefings', 'rules', 'feed', 'outbox'

  // Summary stats
  const [summaryStats, setSummaryStats] = useState({
    active_briefings: 0,
    monitored_rules: 0,
    unresolved_alerts: 0,
    total_outbox_sent: 0,
  });

  // SMTP Configuration State
  const [smtpConfig, setSmtpConfig] = useState({
    is_configured: false,
    mode: "SIMULATED_DEV_OUTBOX",
    host: "",
    port: 587,
    user_masked: "",
    from_email: "briefings@globaltrade.analytics",
    use_tls: true,
  });
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [smtpForm, setSmtpForm] = useState({
    host: "",
    port: 587,
    user: "",
    password: "",
    from_email: "briefings@globaltrade.analytics",
    use_tls: true,
  });
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpStatusMessage, setSmtpStatusMessage] = useState(null);

  // Country options
  const [reportersList, setReportersList] = useState([]);

  // Data states
  const [briefings, setBriefings] = useState([]);
  const [rules, setRules] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [outboxLogs, setOutboxLogs] = useState([]);

  // Modals & form state
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [bannerMessage, setBannerMessage] = useState(null);

  // Filter state for notifications feed
  const [notifStatusFilter, setNotifStatusFilter] = useState("ALL");
  const [notifSeverityFilter, setNotifSeverityFilter] = useState("ALL");

  // Briefing Form
  const [briefingForm, setBriefingForm] = useState({
    name: "Monthly Executive Trade Briefing",
    frequency: "MONTHLY",
    reporter_iso: "USA",
    flow_code: "TOTAL",
    include_prediction: true,
    forecast_years: 3,
    recipients: "csuite@trade.gov, analyst@macropolicy.org",
  });

  // Rule Form
  const [ruleForm, setRuleForm] = useState({
    title: "US Trade Deficit Expansion > 20% YoY",
    rule_type: "DEFICIT_EXPANSION_YOY",
    reporter_iso: "USA",
    comparison_operator: ">",
    threshold_value: 20.0,
    severity: "CRITICAL",
    recipients: "risk-desk@treasury.gov",
  });

  // Test Email Form
  const [testForm, setTestForm] = useState({
    recipient: "analyst@trade.gov",
    email_type: "BRIEFING",
    reporter_iso: "USA",
  });

  // Load Initial Metadata
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const res = await api.get("/dashboard/filter-options");
        setReportersList(res.data.reporters || []);
      } catch (err) {
        console.error("Failed to load reporters:", err);
      }
    };
    fetchFilterOptions();
  }, []);

  // Fetch Summary Stats & Tab Data
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, smtpRes] = await Promise.all([
        api.get("/alerts/summary-stats"),
        api.get("/alerts/smtp-config").catch(() => ({ data: null })),
      ]);
      setSummaryStats(statsRes.data);
      if (smtpRes && smtpRes.data) {
        setSmtpConfig(smtpRes.data);
      }

      if (activeTab === "briefings") {
        const res = await api.get("/alerts/briefings");
        setBriefings(res.data);
      } else if (activeTab === "rules") {
        const res = await api.get("/alerts/rules");
        setRules(res.data);
      } else if (activeTab === "feed") {
        const params = {};
        if (notifStatusFilter !== "ALL") params.status = notifStatusFilter;
        if (notifSeverityFilter !== "ALL") params.severity = notifSeverityFilter;
        const res = await api.get("/alerts/notifications", { params });
        setNotifications(res.data);
      } else if (activeTab === "outbox") {
        const res = await api.get("/alerts/outbox");
        setOutboxLogs(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch alerts data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, notifStatusFilter, notifSeverityFilter]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Show banner alert message
  const showBanner = (msg, isError = false) => {
    setBannerMessage({ text: msg, isError });
    setTimeout(() => setBannerMessage(null), 5000);
  };

  // 1. Briefing Actions
  const handleCreateBriefing = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.post("/alerts/briefings", briefingForm);
      setShowBriefingModal(false);
      showBanner("Scheduled briefing created successfully.");
      refreshData();
    } catch (err) {
      showBanner(err.response?.data?.detail || "Failed to create briefing schedule.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBriefing = async (schedule) => {
    try {
      await api.put(`/alerts/briefings/${schedule.id}`, {
        is_active: !schedule.is_active,
      });
      refreshData();
    } catch (err) {
      showBanner("Failed to toggle briefing schedule.", true);
    }
  };

  const handleDeleteBriefing = async (id) => {
    if (!window.confirm("Are you sure you want to delete this scheduled briefing?")) return;
    try {
      await api.delete(`/alerts/briefings/${id}`);
      showBanner("Briefing schedule deleted.");
      refreshData();
    } catch (err) {
      showBanner("Failed to delete briefing.", true);
    }
  };

  const handleTriggerBriefing = async (id) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/alerts/briefings/${id}/trigger`);
      showBanner(res.data.message || "Briefing generated and dispatched.");
      refreshData();
    } catch (err) {
      showBanner(err.response?.data?.detail || "Failed to trigger briefing.", true);
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Alert Rules Actions
  const handleCreateRule = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.post("/alerts/rules", ruleForm);
      setShowRuleModal(false);
      showBanner("Alert rule created successfully.");
      refreshData();
    } catch (err) {
      showBanner(err.response?.data?.detail || "Failed to create alert rule.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivatePreset = async (preset) => {
    setActionLoading(true);
    try {
      await api.post("/alerts/rules", preset);
      showBanner(`Preset activated: "${preset.title}"`);
      refreshData();
    } catch (err) {
      showBanner(err.response?.data?.detail || "Failed to activate preset.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Are you sure you want to delete this alert rule?")) return;
    try {
      await api.delete(`/alerts/rules/${id}`);
      showBanner("Alert rule deleted.");
      refreshData();
    } catch (err) {
      showBanner("Failed to delete alert rule.", true);
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      await api.put(`/alerts/rules/${rule.id}`, { is_active: !rule.is_active });
      refreshData();
    } catch (err) {
      showBanner("Failed to toggle rule.", true);
    }
  };

  const handleEvaluateRulesNow = async () => {
    setActionLoading(true);
    try {
      const res = await api.post("/alerts/rules/evaluate");
      showBanner(
        `Audit completed! Evaluated ${res.data.rules_evaluated} rules. Triggered ${res.data.alerts_triggered_count} new alerts.`
      );
      refreshData();
    } catch (err) {
      showBanner("Failed to evaluate rules.", true);
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Notification Actions
  const handleResolveNotif = async (id) => {
    try {
      await api.post(`/alerts/notifications/${id}/resolve`);
      showBanner("Alert marked as RESOLVED.");
      refreshData();
    } catch (err) {
      showBanner("Failed to resolve alert.", true);
    }
  };

  const handleAcknowledgeNotif = async (id) => {
    try {
      await api.post(`/alerts/notifications/${id}/acknowledge`);
      showBanner("Alert marked as ACKNOWLEDGED.");
      refreshData();
    } catch (err) {
      showBanner("Failed to acknowledge alert.", true);
    }
  };

  // 4. Outbox & Test Email Actions
  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.post("/alerts/test-email", testForm);
      setShowTestModal(false);
      showBanner(res.data.message);
      refreshData();
    } catch (err) {
      showBanner(err.response?.data?.detail || "Failed to send test email.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = async (outboxId, filename) => {
    try {
      const res = await api.get(`/alerts/outbox/${outboxId}/download-pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename || "Executive_Briefing.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showBanner("Failed to download PDF attachment.", true);
    }
  };

  // 5. SMTP Configuration Handlers
  const openSmtpModal = () => {
    setSmtpForm({
      host: smtpConfig.host || "",
      port: smtpConfig.port || 587,
      user: "",
      password: "",
      from_email: smtpConfig.from_email || "briefings@globaltrade.analytics",
      use_tls: smtpConfig.use_tls !== undefined ? smtpConfig.use_tls : true,
    });
    setSmtpStatusMessage(null);
    setShowSmtpModal(true);
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    if (smtpForm.host.includes("@")) {
      setSmtpStatusMessage({
        success: false,
        message: "Invalid SMTP Host: Hostname cannot be an email address. Use a server address like 'smtp.gmail.com'.",
      });
      return;
    }
    setActionLoading(true);
    setSmtpStatusMessage(null);
    try {
      const res = await api.post("/alerts/smtp-config", smtpForm);
      setSmtpConfig({
        is_configured: res.data.is_configured,
        mode: res.data.mode,
        host: res.data.host,
        port: res.data.port,
        user_masked: res.data.user_masked,
        from_email: res.data.from_email,
        use_tls: res.data.use_tls,
      });
      showBanner(res.data.message, !res.data.success);
      if (res.data.success) {
        setShowSmtpModal(false);
      } else {
        setSmtpStatusMessage({ success: false, message: res.data.message });
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to save SMTP configuration.";
      showBanner(msg, true);
      setSmtpStatusMessage({ success: false, message: msg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestSmtpConnection = async () => {
    if (!smtpForm.host || !smtpForm.host.trim()) {
      setSmtpStatusMessage({
        success: false,
        message: "Please enter an SMTP Host before testing the connection.",
      });
      return;
    }
    if (smtpForm.host.includes("@")) {
      setSmtpStatusMessage({
        success: false,
        message: "Invalid SMTP Host: Hostname cannot be an email address. Use a server address like 'smtp.gmail.com'.",
      });
      return;
    }
    setSmtpTesting(true);
    setSmtpStatusMessage(null);
    try {
      // Test current form inputs directly before saving
      const res = await api.post("/alerts/smtp-config/test", smtpForm);
      setSmtpStatusMessage({ success: res.data.success, message: res.data.message });
    } catch (err) {
      setSmtpStatusMessage({
        success: false,
        message: err.response?.data?.detail || "SMTP connection test failed.",
      });
    } finally {
      setSmtpTesting(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={styles.pageTitle}>Automated Briefings & Risk Alerts</h1>
            <span style={styles.headerBadge}>Enterprise Delivery</span>
          </div>
          <p style={styles.pageSubtitle}>
            Schedule recurring executive PDF dossiers and configure intelligent trade anomaly threshold monitors
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"
            onClick={openSmtpModal}
            style={{
              ...styles.actionBtnOutline,
              borderColor: smtpConfig.is_configured ? "#10b981" : "#f59e0b",
              color: smtpConfig.is_configured ? "#34d399" : "#fbbf24",
              backgroundColor: smtpConfig.is_configured ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
            }}
            title="Configure SMTP Server or inspect connection"
          >
            <Server size={14} />
            <span>
              {smtpConfig.is_configured
                ? `SMTP: ${smtpConfig.host}:${smtpConfig.port}`
                : "SMTP: Dev Outbox (Configure)"}
            </span>
          </button>
          <button
            type="button"
            onClick={handleEvaluateRulesNow}
            disabled={actionLoading}
            style={styles.actionBtnOutline}
          >
            <RefreshCw size={14} className={actionLoading ? "spin" : ""} />
            <span>Audit Thresholds Now</span>
          </button>
          <button
            type="button"
            onClick={() => setShowTestModal(true)}
            style={styles.actionBtnPrimary}
          >
            <Send size={14} />
            <span>Send Test Email</span>
          </button>
        </div>
      </div>

      {/* Global Alert Notification Banner */}
      {bannerMessage && (
        <div
          style={{
            ...styles.alertBanner,
            backgroundColor: bannerMessage.isError ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
            borderColor: bannerMessage.isError ? "#ef4444" : "#10b981",
            color: bannerMessage.isError ? "#fca5a5" : "#6ee7b7",
          }}
        >
          {bannerMessage.isError ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{bannerMessage.text}</span>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>Active Briefings</span>
            <Calendar size={18} color="#38bdf8" />
          </div>
          <div style={styles.kpiValue}>{summaryStats.active_briefings}</div>
          <div style={styles.kpiSub}>Scheduled PDF Subscriptions</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>Monitored Rules</span>
            <ShieldAlert size={18} color="#c084fc" />
          </div>
          <div style={styles.kpiValue}>{summaryStats.monitored_rules}</div>
          <div style={styles.kpiSub}>Anomaly & Risk Thresholds</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>Unresolved Alerts</span>
            <AlertTriangle
              size={18}
              color={summaryStats.unresolved_alerts > 0 ? "#f87171" : "#34d399"}
            />
          </div>
          <div
            style={{
              ...styles.kpiValue,
              color: summaryStats.unresolved_alerts > 0 ? "#f87171" : "#ffffff",
            }}
          >
            {summaryStats.unresolved_alerts}
          </div>
          <div style={styles.kpiSub}>Active Breaches Awaiting Action</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>Outbox Dispatches</span>
            <Send size={18} color="#34d399" />
          </div>
          <div style={styles.kpiValue}>{summaryStats.total_outbox_sent}</div>
          <div style={styles.kpiSub}>Executive Emails Logged</div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div style={styles.tabBar}>
        <button
          type="button"
          onClick={() => setActiveTab("briefings")}
          style={activeTab === "briefings" ? styles.tabBtnActive : styles.tabBtn}
        >
          <Calendar size={15} />
          <span>Scheduled Executive Briefings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          style={activeTab === "rules" ? styles.tabBtnActive : styles.tabBtn}
        >
          <ShieldAlert size={15} />
          <span>Alert Rules & Thresholds</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("feed")}
          style={activeTab === "feed" ? styles.tabBtnActive : styles.tabBtn}
        >
          <AlertTriangle size={15} />
          <span>Triggered Alerts Feed</span>
          {summaryStats.unresolved_alerts > 0 && (
            <span style={styles.tabBadge}>{summaryStats.unresolved_alerts}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("outbox")}
          style={activeTab === "outbox" ? styles.tabBtnActive : styles.tabBtn}
        >
          <Send size={15} />
          <span>Outbox & Sent Briefings</span>
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* 1. SCHEDULED EXECUTIVE BRIEFINGS */}
      {activeTab === "briefings" && (
        <div style={styles.tabContent}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Automated Executive PDF Briefings</h2>
              <p style={styles.sectionSubtitle}>
                Recurring high-resolution C-suite briefings delivering balance breakdowns and 2026–2030 predictions to email lists
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBriefingModal(true)}
              style={styles.primaryBtn}
            >
              <Plus size={15} />
              <span>Schedule New Briefing</span>
            </button>
          </div>

          {loading ? (
            <div style={styles.loadingBox}>Loading briefing subscriptions...</div>
          ) : briefings.length === 0 ? (
            <div style={styles.emptyCard}>
              <Calendar size={36} color="#64748b" />
              <h3 style={styles.emptyTitle}>No Scheduled Briefings Configured</h3>
              <p style={styles.emptyText}>
                Create an automated briefing subscription to deliver monthly executive PDF reports directly to stakeholder emails.
              </p>
              <button
                type="button"
                onClick={() => setShowBriefingModal(true)}
                style={styles.primaryBtn}
              >
                <Plus size={14} />
                <span>Create Briefing Schedule</span>
              </button>
            </div>
          ) : (
            <div style={styles.gridCards}>
              {briefings.map((b) => (
                <div key={b.id} style={styles.briefingCard}>
                  <div style={styles.cardHeader}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h3 style={styles.cardTitle}>{b.name}</h3>
                        <span style={styles.freqBadge}>{b.frequency}</span>
                      </div>
                      <span style={styles.cardScope}>
                        Scope: {b.reporter_iso || "Global Macro Summary"} &bull; {b.flow_code} Flow
                      </span>
                    </div>

                    <label style={styles.switch}>
                      <input
                        type="checkbox"
                        checked={b.is_active}
                        onChange={() => handleToggleBriefing(b)}
                      />
                      <span style={styles.slider}></span>
                    </label>
                  </div>

                  <div style={styles.cardBody}>
                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>Recipients:</span>
                      <span style={styles.metaVal}>{b.recipients}</span>
                    </div>
                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>Forecast Attached:</span>
                      <span style={styles.metaVal}>
                        {b.include_prediction ? `Yes (${b.forecast_years} Years)` : "No"}
                      </span>
                    </div>
                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>Next Run:</span>
                      <span style={styles.nextRunVal}>
                        <Clock size={12} />
                        {b.next_run_at ? new Date(b.next_run_at).toLocaleString() : "Pending"}
                      </span>
                    </div>
                  </div>

                  <div style={styles.cardFooter}>
                    <button
                      type="button"
                      onClick={() => handleTriggerBriefing(b.id)}
                      disabled={actionLoading}
                      style={styles.triggerBtn}
                    >
                      <Play size={13} fill="#ffffff" />
                      <span>Trigger Dispatch Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBriefing(b.id)}
                      style={styles.iconBtnDanger}
                      title="Delete Schedule"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. ALERT RULES & THRESHOLDS */}
      {activeTab === "rules" && (
        <div style={styles.tabContent}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Trade Anomaly & Risk Threshold Rules</h2>
              <p style={styles.sectionSubtitle}>
                Configure automated threshold monitors (e.g. "Notify if country deficit expands by more than 20% YoY")
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={handleEvaluateRulesNow}
                disabled={actionLoading}
                style={styles.actionBtnOutline}
              >
                <RefreshCw size={14} className={actionLoading ? "spin" : ""} />
                <span>Evaluate Rules Now</span>
              </button>
              <button
                type="button"
                onClick={() => setShowRuleModal(true)}
                style={styles.primaryBtn}
              >
                <Plus size={15} />
                <span>Create Custom Rule</span>
              </button>
            </div>
          </div>

          {/* Preset Rules Carousel / Banner */}
          <div style={styles.presetSection}>
            <div style={styles.presetHeader}>
              <Sparkles size={16} color="#c084fc" />
              <span style={styles.presetTitle}>Curated Trade Risk Threshold Presets (1-Click Activate)</span>
            </div>
            <div style={styles.presetGrid}>
              <div style={styles.presetCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <strong style={{ color: "#ffffff", fontSize: "13px" }}>US Deficit Expansion (&gt; 20% YoY)</strong>
                  <span style={{ ...styles.sevBadge, backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                    CRITICAL
                  </span>
                </div>
                <p style={styles.presetDesc}>
                  Notifies immediately if United States merchandise trade deficit expands by over 20% compared to prior baseline year.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    handleActivatePreset({
                      title: "US Deficit Expansion > 20% YoY",
                      rule_type: "DEFICIT_EXPANSION_YOY",
                      reporter_iso: "USA",
                      comparison_operator: ">",
                      threshold_value: 20.0,
                      severity: "CRITICAL",
                      recipients: "alerts@macrotrade.org",
                    })
                  }
                  style={styles.presetBtn}
                >
                  <Plus size={12} /> Activate Rule
                </button>
              </div>

              <div style={styles.presetCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <strong style={{ color: "#ffffff", fontSize: "13px" }}>Major Export Contraction (&gt; 15% YoY)</strong>
                  <span style={{ ...styles.sevBadge, backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                    WARNING
                  </span>
                </div>
                <p style={styles.presetDesc}>
                  Audits all sovereign exporters and flags severe outbound merchandise drops exceeding 15% YoY.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    handleActivatePreset({
                      title: "Major Export Contraction > 15% YoY",
                      rule_type: "EXPORT_CONTRACTION_YOY",
                      reporter_iso: "ALL",
                      comparison_operator: ">",
                      threshold_value: 15.0,
                      severity: "WARNING",
                      recipients: "alerts@macrotrade.org",
                    })
                  }
                  style={styles.presetBtn}
                >
                  <Plus size={12} /> Activate Rule
                </button>
              </div>

              <div style={styles.presetCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <strong style={{ color: "#ffffff", fontSize: "13px" }}>Surplus-to-Deficit Reversal</strong>
                  <span style={{ ...styles.sevBadge, backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
                    INFO
                  </span>
                </div>
                <p style={styles.presetDesc}>
                  Monitors structural balance flips when a surplus exporter transitions into negative net balance territory.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    handleActivatePreset({
                      title: "Trade Balance Reversal",
                      rule_type: "BALANCE_REVERSAL",
                      reporter_iso: "ALL",
                      comparison_operator: ">",
                      threshold_value: 0.0,
                      severity: "WARNING",
                      recipients: "alerts@macrotrade.org",
                    })
                  }
                  style={styles.presetBtn}
                >
                  <Plus size={12} /> Activate Rule
                </button>
              </div>
            </div>
          </div>

          {/* Active Rules Table */}
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Rule Title & Type</th>
                  <th style={styles.th}>Target Country</th>
                  <th style={styles.th}>Condition & Threshold</th>
                  <th style={styles.th}>Severity</th>
                  <th style={styles.th}>Email Notification</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>
                      No alert rules configured. Click "Create Custom Rule" or activate a curated preset above.
                    </td>
                  </tr>
                ) : (
                  rules.map((r) => (
                    <tr key={r.id} style={styles.tr}>
                      <td style={styles.td}>
                        <strong style={{ color: "#ffffff", display: "block" }}>{r.title}</strong>
                        <span style={styles.ruleCode}>{r.rule_type}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.scopeBadge}>{r.reporter_iso || "ALL"}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontFamily: "monospace", color: "#c084fc", fontWeight: "700" }}>
                          {r.comparison_operator} {r.threshold_value}%
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.sevBadge,
                            backgroundColor:
                              r.severity === "CRITICAL"
                                ? "rgba(239, 68, 68, 0.15)"
                                : r.severity === "WARNING"
                                ? "rgba(245, 158, 11, 0.15)"
                                : "rgba(59, 130, 246, 0.15)",
                            color:
                              r.severity === "CRITICAL"
                                ? "#ef4444"
                                : r.severity === "WARNING"
                                ? "#f59e0b"
                                : "#3b82f6",
                          }}
                        >
                          {r.severity}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
                          {r.recipients || "In-App Feed Only"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <label style={styles.switch}>
                          <input
                            type="checkbox"
                            checked={r.is_active}
                            onChange={() => handleToggleRule(r)}
                          />
                          <span style={styles.slider}></span>
                        </label>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(r.id)}
                          style={styles.iconBtnDanger}
                          title="Delete Rule"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TRIGGERED ALERTS FEED */}
      {activeTab === "feed" && (
        <div style={styles.tabContent}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Triggered Risk Incidents & Alerts Feed</h2>
              <p style={styles.sectionSubtitle}>
                Audit trail of macroeconomic threshold breaches detected by the real-time rule engine
              </p>
            </div>
            {/* Filter controls */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Filter size={15} color="#94a3b8" />
              <select
                value={notifStatusFilter}
                onChange={(e) => setNotifStatusFilter(e.target.value)}
                style={styles.selectSmall}
              >
                <option value="ALL">All Statuses</option>
                <option value="TRIGGERED">Triggered</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
              </select>

              <select
                value={notifSeverityFilter}
                onChange={(e) => setNotifSeverityFilter(e.target.value)}
                style={styles.selectSmall}
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={styles.loadingBox}>Loading alert feed...</div>
          ) : notifications.length === 0 ? (
            <div style={styles.emptyCard}>
              <CheckCircle2 size={40} color="#10b981" />
              <h3 style={styles.emptyTitle}>All Clear — No Threshold Breaches Detected</h3>
              <p style={styles.emptyText}>
                Monitored economies are performing within configured volatility bounds. Click "Evaluate Rules Now" to run an immediate audit.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {notifications.map((n) => {
                const isCrit = n.severity === "CRITICAL";
                const isResolved = n.status === "RESOLVED";

                return (
                  <div
                    key={n.id}
                    style={{
                      ...styles.feedCard,
                      borderLeft: `4px solid ${
                        isResolved ? "#10b981" : isCrit ? "#ef4444" : "#f59e0b"
                      }`,
                      opacity: isResolved ? 0.75 : 1,
                    }}
                  >
                    <div style={styles.feedCardHeader}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            ...styles.sevBadge,
                            backgroundColor: isCrit
                              ? "rgba(239, 68, 68, 0.2)"
                              : "rgba(245, 158, 11, 0.2)",
                            color: isCrit ? "#ef4444" : "#f59e0b",
                          }}
                        >
                          {n.severity}
                        </span>
                        <strong style={{ color: "#ffffff", fontSize: "14px" }}>{n.title}</strong>
                        <span style={styles.scopeBadge}>{n.reporter_iso}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={styles.timeTag}>
                          <Clock size={12} />
                          {new Date(n.triggered_at).toLocaleString()}
                        </span>
                        <span
                          style={{
                            ...styles.statusTag,
                            backgroundColor:
                              n.status === "RESOLVED"
                                ? "rgba(16, 185, 129, 0.15)"
                                : n.status === "ACKNOWLEDGED"
                                ? "rgba(59, 130, 246, 0.15)"
                                : "rgba(239, 68, 68, 0.15)",
                            color:
                              n.status === "RESOLVED"
                                ? "#34d399"
                                : n.status === "ACKNOWLEDGED"
                                ? "#60a5fa"
                                : "#f87171",
                          }}
                        >
                          {n.status}
                        </span>
                      </div>
                    </div>

                    <p style={styles.feedMessage}>{n.message}</p>

                    <div style={styles.feedMetricsRow}>
                      <div style={styles.feedMetricItem}>
                        <span style={styles.feedMetricLabel}>Observed Value:</span>
                        <span style={styles.feedMetricVal}>
                          ${n.observed_value ? (n.observed_value / 1e9).toFixed(2) : "0.00"} B
                        </span>
                      </div>
                      <div style={styles.feedMetricItem}>
                        <span style={styles.feedMetricLabel}>Baseline Prior Year:</span>
                        <span style={styles.feedMetricVal}>
                          ${n.baseline_value ? (n.baseline_value / 1e9).toFixed(2) : "0.00"} B
                        </span>
                      </div>
                      <div style={styles.feedMetricItem}>
                        <span style={styles.feedMetricLabel}>YoY Percentage Delta:</span>
                        <span
                          style={{
                            ...styles.feedMetricVal,
                            color: n.delta_pct >= 0 ? "#ef4444" : "#10b981",
                          }}
                        >
                          {n.delta_pct !== null ? `${n.delta_pct > 0 ? "+" : ""}${n.delta_pct}%` : "—"}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                        {n.status === "TRIGGERED" && (
                          <button
                            type="button"
                            onClick={() => handleAcknowledgeNotif(n.id)}
                            style={styles.ackBtn}
                          >
                            <span>Acknowledge</span>
                          </button>
                        )}
                        {n.status !== "RESOLVED" && (
                          <button
                            type="button"
                            onClick={() => handleResolveNotif(n.id)}
                            style={styles.resolveBtn}
                          >
                            <Check size={12} />
                            <span>Mark Resolved</span>
                          </button>
                        )}
                        {isResolved && (
                          <span style={{ fontSize: "11px", color: "#10b981", fontWeight: "600" }}>
                            ✓ Resolved on {new Date(n.resolved_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. OUTBOX & SENT BRIEFINGS */}
      {activeTab === "outbox" && (
        <div style={styles.tabContent}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Email Outbox & Delivery Audit Trail</h2>
              <p style={styles.sectionSubtitle}>
                Persistent record of all executive PDF dossiers, threshold alerts, and test dispatches
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTestModal(true)}
              style={styles.primaryBtn}
            >
              <Send size={14} />
              <span>Send Sample Email</span>
            </button>
          </div>

          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Email Subject</th>
                  <th style={styles.th}>Recipients</th>
                  <th style={styles.th}>Delivery Status</th>
                  <th style={styles.th}>Attachment</th>
                  <th style={styles.th}>Timestamp</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Download</th>
                </tr>
              </thead>
              <tbody>
                {outboxLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>
                      No emails logged in outbox yet. Trigger a briefing or send a test email.
                    </td>
                  </tr>
                ) : (
                  outboxLogs.map((l) => (
                    <tr key={l.id} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={styles.emailTypeBadge}>{l.email_type}</span>
                      </td>
                      <td style={styles.td}>
                        <strong style={{ color: "#ffffff" }}>{l.subject}</strong>
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontSize: "12px", color: "#cbd5e1" }}>{l.recipients}</span>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusTag,
                            backgroundColor:
                              l.status === "SENT"
                                ? "rgba(16, 185, 129, 0.15)"
                                : l.status === "SIMULATED_DEV_OUTBOX"
                                ? "rgba(168, 85, 247, 0.15)"
                                : "rgba(239, 68, 68, 0.15)",
                            color:
                              l.status === "SENT"
                                ? "#34d399"
                                : l.status === "SIMULATED_DEV_OUTBOX"
                                ? "#c084fc"
                                : "#f87171",
                          }}
                        >
                          {l.status === "SIMULATED_DEV_OUTBOX" ? "Dev Outbox (Logged)" : l.status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {l.has_attachment ? (
                          <span style={styles.attachmentPill}>
                            <FileText size={12} /> {l.attachment_filename || "Briefing.pdf"}
                          </span>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                          {new Date(l.sent_at).toLocaleString()}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {l.has_attachment && (
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(l.id, l.attachment_filename)}
                            style={styles.downloadBtn}
                            title="Download Attached PDF"
                          >
                            <Download size={13} />
                            <span>Download PDF</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: SCHEDULE NEW BRIEFING */}
      {showBriefingModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Schedule Executive PDF Briefing</h3>
              <button
                type="button"
                onClick={() => setShowBriefingModal(false)}
                style={styles.closeBtn}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBriefing} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Briefing Dossier Name</label>
                <input
                  type="text"
                  required
                  value={briefingForm.name}
                  onChange={(e) => setBriefingForm({ ...briefingForm, name: e.target.value })}
                  style={styles.input}
                  placeholder="e.g. Monthly Macro Executive Dossier"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Delivery Frequency</label>
                  <select
                    value={briefingForm.frequency}
                    onChange={(e) => setBriefingForm({ ...briefingForm, frequency: e.target.value })}
                    style={styles.select}
                  >
                    <option value="DAILY">Daily Morning Briefing</option>
                    <option value="WEEKLY">Weekly Macro Wrap (Mondays)</option>
                    <option value="MONTHLY">Monthly Executive Summary</option>
                    <option value="ON_SYNC">On UN Comtrade Live Sync</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Territory Focus</label>
                  <select
                    value={briefingForm.reporter_iso}
                    onChange={(e) =>
                      setBriefingForm({ ...briefingForm, reporter_iso: e.target.value })
                    }
                    style={styles.select}
                  >
                    <option value="ALL">Global Macro Aggregate</option>
                    {reportersList.map((r) => (
                      <option key={r.iso} value={r.iso}>
                        {r.desc} ({r.iso})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Trade Flow Scope</label>
                  <select
                    value={briefingForm.flow_code}
                    onChange={(e) => setBriefingForm({ ...briefingForm, flow_code: e.target.value })}
                    style={styles.select}
                  >
                    <option value="TOTAL">Total Trade Turnover</option>
                    <option value="X">Exports (Outbound Flow X)</option>
                    <option value="M">Imports (Inbound Flow M)</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Prediction Forecast Horizon</label>
                  <select
                    value={briefingForm.forecast_years}
                    onChange={(e) =>
                      setBriefingForm({ ...briefingForm, forecast_years: Number(e.target.value) })
                    }
                    style={styles.select}
                  >
                    <option value={1}>1 Year (2026)</option>
                    <option value={2}>2 Years (2026–2027)</option>
                    <option value={3}>3 Years (2026–2028)</option>
                    <option value={5}>5 Years (2026–2030)</option>
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Recipient Email Addresses (Comma-Separated)</label>
                <input
                  type="text"
                  required
                  value={briefingForm.recipients}
                  onChange={(e) => setBriefingForm({ ...briefingForm, recipients: e.target.value })}
                  style={styles.input}
                  placeholder="analyst@trade.gov, csuite@macropolicy.org"
                />
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowBriefingModal(false)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} style={styles.submitBtn}>
                  {actionLoading ? "Scheduling..." : "Create Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ALERT RULE */}
      {showRuleModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Configure Anomaly & Risk Alert Rule</h3>
              <button
                type="button"
                onClick={() => setShowRuleModal(false)}
                style={styles.closeBtn}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRule} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Rule Name / Title</label>
                <input
                  type="text"
                  required
                  value={ruleForm.title}
                  onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })}
                  style={styles.input}
                  placeholder="e.g. US Deficit Expansion > 20% YoY"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Anomaly Rule Type</label>
                  <select
                    value={ruleForm.rule_type}
                    onChange={(e) => setRuleForm({ ...ruleForm, rule_type: e.target.value })}
                    style={styles.select}
                  >
                    <option value="DEFICIT_EXPANSION_YOY">Deficit Expansion YoY</option>
                    <option value="EXPORT_CONTRACTION_YOY">Export Contraction YoY</option>
                    <option value="IMPORT_SURGE_YOY">Import Volume Surge YoY</option>
                    <option value="BALANCE_REVERSAL">Surplus-to-Deficit Reversal</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Target Economy</label>
                  <select
                    value={ruleForm.reporter_iso}
                    onChange={(e) => setRuleForm({ ...ruleForm, reporter_iso: e.target.value })}
                    style={styles.select}
                  >
                    <option value="ALL">All Tracked Economies</option>
                    {reportersList.map((r) => (
                      <option key={r.iso} value={r.iso}>
                        {r.desc} ({r.iso})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Operator</label>
                  <select
                    value={ruleForm.comparison_operator}
                    onChange={(e) =>
                      setRuleForm({ ...ruleForm, comparison_operator: e.target.value })
                    }
                    style={styles.select}
                  >
                    <option value=">">Greater than (&gt;)</option>
                    <option value=">=">Greater than or equal (&gt;=)</option>
                    <option value="<">Less than (&lt;)</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Threshold Value (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={ruleForm.threshold_value}
                    onChange={(e) =>
                      setRuleForm({ ...ruleForm, threshold_value: Number(e.target.value) })
                    }
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Severity Level</label>
                  <select
                    value={ruleForm.severity}
                    onChange={(e) => setRuleForm({ ...ruleForm, severity: e.target.value })}
                    style={styles.select}
                  >
                    <option value="CRITICAL">Critical (Red)</option>
                    <option value="WARNING">Warning (Amber)</option>
                    <option value="INFO">Info (Blue)</option>
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Instant Email Alert Recipients</label>
                <input
                  type="text"
                  value={ruleForm.recipients}
                  onChange={(e) => setRuleForm({ ...ruleForm, recipients: e.target.value })}
                  style={styles.input}
                  placeholder="desk@macrorisk.org (Optional)"
                />
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} style={styles.submitBtn}>
                  {actionLoading ? "Saving..." : "Save Alert Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SEND TEST EMAIL */}
      {showTestModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Dispatch Sample Test Email</h3>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                style={styles.closeBtn}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Recipient Email Address</label>
                <input
                  type="email"
                  required
                  value={testForm.recipient}
                  onChange={(e) => setTestForm({ ...testForm, recipient: e.target.value })}
                  style={styles.input}
                  placeholder="analyst@trade.gov"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Email Dispatch Type</label>
                  <select
                    value={testForm.email_type}
                    onChange={(e) => setTestForm({ ...testForm, email_type: e.target.value })}
                    style={styles.select}
                  >
                    <option value="BRIEFING">Executive Briefing Template</option>
                    <option value="ALERT">Risk Alert Warning Template</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Sample Territory</label>
                  <select
                    value={testForm.reporter_iso}
                    onChange={(e) => setTestForm({ ...testForm, reporter_iso: e.target.value })}
                    style={styles.select}
                  >
                    {reportersList.map((r) => (
                      <option key={r.iso} value={r.iso}>
                        {r.desc} ({r.iso})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!smtpConfig.is_configured ? (
                <div
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid #f59e0b",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    fontSize: "12px",
                    color: "#fef3c7",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    margin: "12px 0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", color: "#fbbf24" }}>
                    <AlertTriangle size={15} />
                    <span>Live SMTP is Not Configured (Simulation Mode)</span>
                  </div>
                  <span style={{ color: "#cbd5e1", lineHeight: "1.4" }}>
                    This test email will be safely simulated and recorded in the <strong>Outbox &amp; Sent Briefings</strong> tab below where you can view it and download the PDF.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTestModal(false);
                      openSmtpModal();
                    }}
                    style={{
                      marginTop: "4px",
                      backgroundColor: "#f59e0b",
                      color: "#0f172a",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontWeight: "700",
                      cursor: "pointer",
                      width: "fit-content",
                      fontSize: "11px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Server size={12} /> Configure Real SMTP Delivery
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid #10b981",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "12px",
                    color: "#6ee7b7",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    margin: "12px 0",
                  }}
                >
                  <CheckCircle2 size={15} color="#34d399" />
                  <span>
                    Delivering live via SMTP server: <strong>{smtpConfig.host}:{smtpConfig.port}</strong> (from {smtpConfig.from_email})
                  </span>
                </div>
              )}

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} style={styles.submitBtn}>
                  {actionLoading ? "Sending..." : "Dispatch Test Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SMTP SERVER DELIVERY CONFIGURATION */}
      {showSmtpModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: "560px" }}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Server size={18} color="#38bdf8" />
                <h3 style={styles.modalTitle}>SMTP Server Delivery Configuration</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSmtpModal(false)}
                style={styles.closeBtn}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSmtp} style={styles.modalForm}>
              <div
                style={{
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  border: "1px solid #3b82f6",
                  borderRadius: "8px",
                  padding: "12px",
                  fontSize: "12px",
                  color: "#93c5fd",
                  lineHeight: "1.4",
                }}
              >
                <strong>Configure SMTP to dispatch real emails to external inboxes:</strong>
                <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                  <li><strong>Gmail:</strong> Host: <code>smtp.gmail.com</code> | Port: <code>587</code> | Requires a 16-character <strong>App Password</strong> from Google Account &gt; Security &gt; App Passwords.</li>
                  <li><strong>Outlook / Office365:</strong> Host: <code>smtp.office365.com</code> | Port: <code>587</code>.</li>
                  <li><strong>Custom SMTP:</strong> Enter your host, port, credentials, and sender address.</li>
                </ul>
              </div>

              {smtpStatusMessage && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    backgroundColor: smtpStatusMessage.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    border: `1px solid ${smtpStatusMessage.success ? "#10b981" : "#ef4444"}`,
                    color: smtpStatusMessage.success ? "#6ee7b7" : "#fca5a5",
                  }}
                >
                  {smtpStatusMessage.message}
                </div>
              )}

              {/* Quick Presets */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600" }}>Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => setSmtpForm({
                    ...smtpForm,
                    host: "smtp.gmail.com",
                    port: 587,
                    use_tls: true,
                    from_email: smtpForm.user && smtpForm.user.includes("@") ? smtpForm.user : smtpForm.from_email,
                  })}
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    padding: "3px 10px",
                    borderRadius: "6px",
                    border: "1px solid #38bdf8",
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    cursor: "pointer",
                  }}
                >
                  ⚡ Gmail (smtp.gmail.com:587)
                </button>
                <button
                  type="button"
                  onClick={() => setSmtpForm({
                    ...smtpForm,
                    host: "smtp.office365.com",
                    port: 587,
                    use_tls: true,
                  })}
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    padding: "3px 10px",
                    borderRadius: "6px",
                    border: "1px solid #94a3b8",
                    background: "rgba(148, 163, 184, 0.15)",
                    color: "#cbd5e1",
                    cursor: "pointer",
                  }}
                >
                  Outlook / Office 365
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>SMTP Host *</label>
                  <input
                    type="text"
                    required
                    value={smtpForm.host}
                    onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                    style={{
                      ...styles.input,
                      borderColor: smtpForm.host.includes("@") ? "#ef4444" : undefined,
                    }}
                    placeholder="e.g. smtp.gmail.com"
                  />
                  {smtpForm.host.includes("@") && (
                    <div style={{ marginTop: "4px", fontSize: "11px", color: "#fca5a5", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>⚠️ SMTP Host must be a server domain (e.g. <strong>smtp.gmail.com</strong>), not an email address.</span>
                    </div>
                  )}
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Port *</label>
                  <input
                    type="number"
                    required
                    value={smtpForm.port}
                    onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value) || 587 })}
                    style={styles.input}
                    placeholder="587"
                  />
                </div>
              </div>

              {smtpForm.host.toLowerCase().includes("gmail") && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(168, 85, 247, 0.1)",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                    fontSize: "11px",
                    color: "#d8b4fe",
                    lineHeight: "1.4",
                  }}
                >
                  💡 <strong>Gmail Configuration Tip:</strong> Enter your <strong>full Gmail address</strong> in Username/Email, and a 16-character <strong>Google App Password</strong> (from Google Account &gt; Security &gt; 2-Step Verification &gt; App Passwords). Your Sender "From" should also match your Gmail address.
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Username / Email</label>
                  <input
                    type="text"
                    value={smtpForm.user}
                    onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                    style={styles.input}
                    placeholder="your-email@gmail.com"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Password / App Password</label>
                  <input
                    type="password"
                    value={smtpForm.password}
                    onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })}
                    style={styles.input}
                    placeholder="16-character Google App Password"
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Sender "From" Email</label>
                <input
                  type="email"
                  value={smtpForm.from_email}
                  onChange={(e) => setSmtpForm({ ...smtpForm, from_email: e.target.value })}
                  style={styles.input}
                  placeholder="briefings@globaltrade.analytics"
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  id="smtp_tls"
                  checked={smtpForm.use_tls}
                  onChange={(e) => setSmtpForm({ ...smtpForm, use_tls: e.target.checked })}
                  style={{ accentColor: "#3b82f6", width: "16px", height: "16px" }}
                />
                <label htmlFor="smtp_tls" style={{ fontSize: "13px", color: "#cbd5e1", cursor: "pointer" }}>
                  Enable STARTTLS Encryption (Recommended on port 587)
                </label>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={handleTestSmtpConnection}
                  disabled={smtpTesting || !smtpForm.host || smtpForm.host.includes("@")}
                  style={styles.actionBtnOutline}
                >
                  <RefreshCw size={14} className={smtpTesting ? "spin" : ""} />
                  <span>{smtpTesting ? "Testing..." : "Test Connection"}</span>
                </button>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setShowSmtpModal(false)}
                    style={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || smtpForm.host.includes("@")}
                    style={styles.submitBtn}
                  >
                    {actionLoading ? "Connecting..." : "Save & Connect SMTP"}
                  </button>
                </div>
              </div>
            </form>
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
    alignItems: "flex-start",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "14px",
  },
  pageTitle: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 6px 0",
    letterSpacing: "-0.02em",
  },
  headerBadge: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    border: "1px solid rgba(168, 85, 247, 0.4)",
    color: "#c084fc",
    fontSize: "11px",
    fontWeight: "700",
    padding: "3px 8px",
    borderRadius: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  pageSubtitle: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: 0,
  },
  headerActions: {
    display: "flex",
    gap: "10px",
  },
  actionBtnOutline: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#111827",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#e2e8f0",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  actionBtnPrimary: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#2563eb",
    border: "none",
    borderRadius: "8px",
    color: "#ffffff",
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  alertBanner: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    border: "1px solid",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "20px",
    fontSize: "13px",
    fontWeight: "500",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  kpiCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "18px 20px",
  },
  kpiHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  kpiLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  kpiValue: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: "1.2",
    marginBottom: "4px",
  },
  kpiSub: {
    fontSize: "12px",
    color: "#64748b",
  },
  tabBar: {
    display: "flex",
    gap: "8px",
    borderBottom: "1px solid #1f2937",
    paddingBottom: "12px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  tabBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "8px",
    padding: "8px 16px",
    color: "#94a3b8",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  tabBtnActive: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#2563eb",
    border: "1px solid #3b82f6",
    borderRadius: "8px",
    padding: "8px 16px",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  tabBadge: {
    backgroundColor: "#ef4444",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 6px",
    borderRadius: "10px",
  },
  tabContent: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 4px 0",
  },
  sectionSubtitle: {
    fontSize: "13px",
    color: "#94a3b8",
    margin: 0,
  },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  emptyCard: {
    backgroundColor: "#111827",
    border: "1px dashed #334155",
    borderRadius: "14px",
    padding: "48px 24px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  },
  emptyTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "4px 0 0 0",
  },
  emptyText: {
    fontSize: "13px",
    color: "#94a3b8",
    maxWidth: "500px",
    margin: "0 0 8px 0",
    lineHeight: "1.5",
  },
  gridCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: "16px",
  },
  briefingCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "14px",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#ffffff",
    margin: 0,
  },
  cardScope: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  freqBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    color: "#60a5fa",
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  cardBody: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "16px",
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "12px 14px",
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
  },
  metaLabel: {
    color: "#64748b",
  },
  metaVal: {
    color: "#cbd5e1",
    fontWeight: "500",
    maxWidth: "200px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  nextRunVal: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    color: "#38bdf8",
    fontWeight: "600",
  },
  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },
  triggerBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    backgroundColor: "#2563eb",
    border: "none",
    borderRadius: "6px",
    color: "#ffffff",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  iconBtnDanger: {
    backgroundColor: "transparent",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    borderRadius: "6px",
    color: "#f87171",
    padding: "6px 10px",
    cursor: "pointer",
  },
  presetSection: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "18px 20px",
    marginBottom: "8px",
  },
  presetHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "14px",
  },
  presetTitle: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#e2e8f0",
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "14px",
  },
  presetCard: {
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  presetDesc: {
    fontSize: "12px",
    color: "#94a3b8",
    margin: 0,
    lineHeight: "1.4",
  },
  presetBtn: {
    marginTop: "auto",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    border: "1px solid rgba(168, 85, 247, 0.4)",
    borderRadius: "6px",
    color: "#c084fc",
    padding: "5px 10px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  tableCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    overflow: "hidden",
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
    padding: "10px 14px",
    borderBottom: "1px solid #1f2937",
    textAlign: "left",
  },
  tr: {
    borderBottom: "1px solid #1e293b",
  },
  td: {
    padding: "12px 14px",
  },
  ruleCode: {
    fontSize: "11px",
    color: "#64748b",
    fontFamily: "monospace",
  },
  scopeBadge: {
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    fontSize: "11px",
    fontWeight: "700",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  sevBadge: {
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 8px",
    borderRadius: "4px",
    textTransform: "uppercase",
  },
  statusTag: {
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 8px",
    borderRadius: "4px",
    textTransform: "uppercase",
  },
  feedCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "10px",
    padding: "16px 20px",
  },
  feedCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
    flexWrap: "wrap",
    gap: "8px",
  },
  timeTag: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    color: "#94a3b8",
  },
  feedMessage: {
    fontSize: "13px",
    color: "#f8fafc",
    margin: "0 0 12px 0",
    lineHeight: "1.5",
  },
  feedMetricsRow: {
    display: "flex",
    gap: "24px",
    alignItems: "center",
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "10px 14px",
    flexWrap: "wrap",
  },
  feedMetricItem: {
    display: "flex",
    gap: "6px",
    fontSize: "12px",
  },
  feedMetricLabel: {
    color: "#64748b",
  },
  feedMetricVal: {
    color: "#ffffff",
    fontWeight: "700",
  },
  ackBtn: {
    backgroundColor: "transparent",
    border: "1px solid #3b82f6",
    color: "#60a5fa",
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
  },
  resolveBtn: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "#10b981",
    border: "none",
    color: "#ffffff",
    borderRadius: "6px",
    padding: "5px 12px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
  },
  emailTypeBadge: {
    backgroundColor: "#1e293b",
    color: "#cbd5e1",
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  attachmentPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    color: "#38bdf8",
    fontSize: "12px",
  },
  downloadBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "#2563eb",
    border: "none",
    color: "#ffffff",
    padding: "5px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
  },
  selectSmall: {
    backgroundColor: "#0b1120",
    border: "1px solid #334155",
    color: "#cbd5e1",
    borderRadius: "6px",
    padding: "5px 10px",
    fontSize: "12px",
    outline: "none",
  },
  switch: {
    position: "relative",
    display: "inline-block",
    width: "36px",
    height: "20px",
  },
  slider: {
    position: "absolute",
    cursor: "pointer",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#334155",
    borderRadius: "20px",
    transition: ".2s",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modalCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "14px",
    maxWidth: "540px",
    width: "100%",
    padding: "24px",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
  },
  modalTitle: {
    fontSize: "17px",
    fontWeight: "700",
    color: "#ffffff",
    margin: 0,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
  },
  modalForm: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  formLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
  },
  input: {
    backgroundColor: "#0b1120",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "9px 12px",
    color: "#ffffff",
    fontSize: "13px",
    outline: "none",
  },
  select: {
    backgroundColor: "#0b1120",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "9px 12px",
    color: "#ffffff",
    fontSize: "13px",
    outline: "none",
  },
  noticeSmall: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    border: "1px solid rgba(56, 189, 248, 0.25)",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "12px",
    color: "#bae6fd",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "8px",
  },
  cancelBtn: {
    backgroundColor: "transparent",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#cbd5e1",
    padding: "9px 16px",
    fontSize: "13px",
    cursor: "pointer",
  },
  submitBtn: {
    backgroundColor: "#7c3aed",
    border: "none",
    borderRadius: "8px",
    color: "#ffffff",
    padding: "9px 18px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  loadingBox: {
    padding: "40px",
    textAlign: "center",
    color: "#94a3b8",
  },
};
