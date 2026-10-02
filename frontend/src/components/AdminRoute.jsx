import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

export const AdminRoute = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const [apiResult, setApiResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const testDirectAdminApi = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/ping");
      setApiResult({ status: res.status, data: res.data });
    } catch (err) {
      setApiResult({
        status: err.response?.status || 500,
        data: err.response?.data || { detail: err.message },
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.badge}>Access Denied</div>
          <h2 style={styles.title}>Admin access required.</h2>
          <p style={styles.description}>
            Your current account (<strong>{user?.username}</strong>) has the{" "}
            <span style={styles.roleTag}>{user?.role}</span> role and does not have administrative privileges to view this page.
          </p>

          <div style={styles.testBox}>
            <p style={styles.testLabel}>Test Direct Server-Side RBAC Enforcement:</p>
            <button
              onClick={testDirectAdminApi}
              disabled={loading}
              style={styles.testButton}
            >
              {loading ? "Calling API..." : "Send Request to GET /api/admin/ping"}
            </button>

            {apiResult && (
              <div style={apiResult.status === 200 ? styles.successResult : styles.errorResult}>
                <p><strong>HTTP Status:</strong> {apiResult.status}</p>
                <pre style={styles.jsonPre}>{JSON.stringify(apiResult.data, null, 2)}</pre>
              </div>
            )}
          </div>

          <div style={styles.actions}>
            <Link to="/" style={styles.backButton}>Return to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#0b1120",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "32px",
    maxWidth: "500px",
    width: "100%",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
    textAlign: "center",
    color: "#f8fafc",
  },
  badge: {
    display: "inline-block",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    color: "#f87171",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "4px 12px",
    borderRadius: "9999px",
    marginBottom: "16px",
    border: "1px solid rgba(239, 68, 68, 0.4)",
  },
  title: {
    fontSize: "24px",
    fontWeight: "700",
    margin: "0 0 12px 0",
    color: "#ffffff",
  },
  description: {
    fontSize: "14px",
    color: "#94a3b8",
    lineHeight: "1.5",
    margin: "0 0 24px 0",
  },
  roleTag: {
    backgroundColor: "#0284c7",
    color: "#ffffff",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "12px",
  },
  testBox: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "24px",
    textAlign: "left",
  },
  testLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#cbd5e1",
    margin: "0 0 8px 0",
  },
  testButton: {
    width: "100%",
    backgroundColor: "#475569",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    padding: "10px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  successResult: {
    marginTop: "12px",
    padding: "10px",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    border: "1px solid rgba(34, 197, 94, 0.4)",
    borderRadius: "6px",
    color: "#4ade80",
    fontSize: "12px",
  },
  errorResult: {
    marginTop: "12px",
    padding: "10px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    borderRadius: "6px",
    color: "#f87171",
    fontSize: "12px",
  },
  jsonPre: {
    margin: "6px 0 0 0",
    fontSize: "11px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
  actions: {
    display: "flex",
    justifyContent: "center",
  },
  backButton: {
    display: "inline-block",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "10px 24px",
    borderRadius: "6px",
    textDecoration: "none",
    fontWeight: "600",
    fontSize: "14px",
  },
};
