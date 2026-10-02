import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import { ShieldCheck, ArrowLeft, RefreshCw, Terminal, CheckCircle2 } from "lucide-react";

export const AdminPage = () => {
  const { user } = useAuth();
  const [pingData, setPingData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAdminPing = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/ping");
      setPingData({ status: response.status, data: response.data });
    } catch (err) {
      setPingData({
        status: err.response?.status || 500,
        data: err.response?.data || { error: err.message },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminPing();
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <Link to="/" style={styles.backLink}>
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
          <span style={styles.adminBadge}>ADMIN ONLY CONSOLE</span>
        </div>

        <div style={styles.card}>
          <div style={styles.titleRow}>
            <div style={styles.iconBox}>
              <ShieldCheck size={28} color="#f59e0b" />
            </div>
            <div>
              <h1 style={styles.title}>Admin Control Panel</h1>
              <p style={styles.subtitle}>
                Authenticated as administrator: <strong>{user?.username}</strong>
              </p>
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>
                <Terminal size={18} color="#38bdf8" />
                <span>Protected Endpoint Response (GET /api/admin/ping)</span>
              </h2>
              <button
                onClick={fetchAdminPing}
                disabled={loading}
                style={styles.refreshBtn}
              >
                <RefreshCw size={14} className={loading ? "spin" : ""} />
                <span>{loading ? "Refreshing..." : "Re-ping"}</span>
              </button>
            </div>

            {pingData && (
              <div style={styles.responseBox}>
                <div style={styles.responseMeta}>
                  <span style={styles.metaLabel}>HTTP Status:</span>
                  <span style={styles.status200}>{pingData.status} OK</span>
                </div>
                <pre style={styles.jsonBlock}>
                  {JSON.stringify(pingData.data, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div style={styles.securityAuditBox}>
            <h3 style={styles.auditTitle}>Security Enforcement Summary:</h3>
            <div style={styles.auditItem}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>JWT Bearer signature validated by server</span>
            </div>
            <div style={styles.auditItem}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>Role evaluated server-side as 'ADMIN'</span>
            </div>
            <div style={styles.auditItem}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>Non-admin requests to /api/admin/ping strictly return HTTP 403</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#090d16",
    color: "#f8fafc",
    padding: "32px 20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  container: {
    maxWidth: "800px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  backLink: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: "500",
  },
  adminBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    color: "#fbbf24",
    padding: "4px 10px",
    borderRadius: "9999px",
    fontSize: "11px",
    fontWeight: "700",
    border: "1px solid rgba(245, 158, 11, 0.4)",
    letterSpacing: "0.05em",
  },
  card: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "16px",
    padding: "32px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "28px",
    paddingBottom: "20px",
    borderBottom: "1px solid #1f2937",
  },
  iconBox: {
    padding: "12px",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: "12px",
    border: "1px solid rgba(245, 158, 11, 0.2)",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    margin: "0 0 4px 0",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: "0",
  },
  section: {
    marginBottom: "28px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: "600",
    color: "#e2e8f0",
    margin: "0",
  },
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#e2e8f0",
    padding: "6px 12px",
    fontSize: "12px",
    cursor: "pointer",
  },
  responseBox: {
    backgroundColor: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    padding: "16px",
  },
  responseMeta: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
  },
  metaLabel: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  status200: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#34d399",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    padding: "2px 8px",
    borderRadius: "4px",
  },
  jsonBlock: {
    margin: "0",
    padding: "12px",
    backgroundColor: "#020617",
    borderRadius: "6px",
    color: "#e2e8f0",
    fontSize: "13px",
    lineHeight: "1.5",
    overflowX: "auto",
  },
  securityAuditBox: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    padding: "18px",
  },
  auditTitle: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#cbd5e1",
    margin: "0 0 12px 0",
    textTransform: "uppercase",
  },
  auditItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "#94a3b8",
    marginBottom: "8px",
  },
};
