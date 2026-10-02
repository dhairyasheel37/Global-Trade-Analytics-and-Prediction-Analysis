import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import {
  User,
  ShieldCheck,
  LogOut,
  Database,
  Lock,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Server,
} from "lucide-react";

export const HomePage = () => {
  const { user, isAdmin, logout } = useAuth();
  const [activeTest, setActiveTest] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runTest = async (testName, testFn) => {
    setActiveTest(testName);
    setLoading(true);
    setTestResult(null);
    try {
      const response = await testFn();
      setTestResult({
        success: true,
        status: response.status,
        data: response.data,
      });
    } catch (err) {
      setTestResult({
        success: false,
        status: err.response?.status || 500,
        data: err.response?.data || { error: err.message },
      });
    } finally {
      setLoading(false);
    }
  };

  const testAuthMe = () => runTest("GET /api/auth/me", () => api.get("/auth/me"));
  const testAdminPing = () => runTest("GET /api/admin/ping", () => api.get("/admin/ping"));
  const testDataSummary = () => runTest("GET /api/data/summary", () => api.get("/data/summary"));
  const testHealth = () => runTest("GET /api/health", () => api.get("/health"));

  return (
    <div style={styles.page}>
      {/* Top Navigation Bar */}
      <header style={styles.navbar}>
        <div style={styles.navBrand}>
          <Globe size={24} color="#3b82f6" />
          <span style={styles.navTitle}>Global Trade Analytics</span>
          <span style={styles.phaseBadge}>Phase 2: Auth</span>
        </div>

        <div style={styles.userSection}>
          <div style={styles.userBadge}>
            <User size={16} color="#94a3b8" />
            <span style={styles.userName}>{user?.username}</span>
            <span style={user?.role === "ADMIN" ? styles.adminTag : styles.userTag}>
              {user?.role}
            </span>
          </div>

          <button onClick={logout} style={styles.logoutBtn}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={styles.main}>
        {/* Status Welcome Banner */}
        <section style={styles.welcomeBanner}>
          <div style={styles.bannerHeader}>
            <ShieldCheck size={28} color="#10b981" />
            <div>
              <h2 style={styles.bannerTitle}>Authentication Flow Verified</h2>
              <p style={styles.bannerSubtitle}>
                You are securely logged in as <strong>{user?.username}</strong> with{" "}
                <strong>{user?.role}</strong> privileges.
              </p>
            </div>
          </div>
        </section>

        {/* Test Control Center */}
        <div style={styles.grid}>
          {/* Card 1: Interactive API Verification */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>
              <Server size={20} color="#38bdf8" />
              <span>Live Endpoint Verification</span>
            </h3>
            <p style={styles.cardDescription}>
              Trigger live authenticated requests to verify token parsing, role checking, and RBAC responses.
            </p>

            <div style={styles.buttonList}>
              <button
                onClick={testAuthMe}
                disabled={loading}
                style={activeTest === "GET /api/auth/me" ? styles.activeBtn : styles.actionBtn}
              >
                1. Test GET /api/auth/me
              </button>

              <button
                onClick={testAdminPing}
                disabled={loading}
                style={activeTest === "GET /api/admin/ping" ? styles.activeBtn : styles.actionBtn}
              >
                2. Test GET /api/admin/ping (RBAC Test)
              </button>

              <button
                onClick={testDataSummary}
                disabled={loading}
                style={activeTest === "GET /api/data/summary" ? styles.activeBtn : styles.actionBtn}
              >
                3. Test GET /api/data/summary (Phase 1 Data)
              </button>

              <button
                onClick={testHealth}
                disabled={loading}
                style={activeTest === "GET /api/health" ? styles.activeBtn : styles.actionBtn}
              >
                4. Test GET /api/health
              </button>
            </div>
          </div>

          {/* Card 2: Frontend Route Guard Tests */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>
              <Lock size={20} color="#f59e0b" />
              <span>Frontend Route Guard Tests</span>
            </h3>
            <p style={styles.cardDescription}>
              Navigate to protected frontend routes to test client-side and server-side RBAC guards.
            </p>

            <div style={styles.routeLinks}>
              <Link to="/admin" style={styles.adminRouteLink}>
                <span>Navigate to /admin Page</span>
                <span style={styles.subtext}>
                  {isAdmin ? "(Will open admin console)" : "(Will show 'Admin access required.')"}
                </span>
              </Link>
            </div>

            <div style={styles.infoBox}>
              <p style={styles.infoTitle}>RBAC Security Model:</p>
              <ul style={styles.infoList}>
                <li><strong>ADMIN Role:</strong> Full access to all data & admin endpoints.</li>
                <li><strong>USER Role:</strong> Access to trade data; receives 403 on admin routes.</li>
                <li><strong>Unauthenticated:</strong> Automatically redirected to /login.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Live Response Inspector */}
        {testResult && (
          <section style={styles.resultSection}>
            <div style={styles.resultHeader}>
              <div style={styles.resultTitleWrapper}>
                {testResult.status === 200 ? (
                  <CheckCircle2 size={18} color="#10b981" />
                ) : (
                  <AlertTriangle size={18} color="#ef4444" />
                )}
                <span style={styles.resultEndpoint}>{activeTest}</span>
              </div>
              <span
                style={
                  testResult.status === 200
                    ? styles.statusBadgeSuccess
                    : testResult.status === 403
                    ? styles.statusBadgeWarning
                    : styles.statusBadgeDanger
                }
              >
                HTTP {testResult.status}
              </span>
            </div>
            <pre style={styles.resultPre}>
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          </section>
        )}
      </main>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#090d16",
    color: "#f8fafc",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 28px",
    backgroundColor: "#111827",
    borderBottom: "1px solid #1f2937",
  },
  navBrand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  navTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#ffffff",
  },
  phaseBadge: {
    fontSize: "11px",
    fontWeight: "600",
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    color: "#60a5fa",
    padding: "3px 8px",
    borderRadius: "12px",
    border: "1px solid rgba(59, 130, 246, 0.3)",
  },
  userSection: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  userBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#1f2937",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "13px",
  },
  userName: {
    fontWeight: "600",
    color: "#f1f5f9",
  },
  adminTag: {
    fontSize: "10px",
    fontWeight: "700",
    backgroundColor: "#854d0e",
    color: "#fef08a",
    padding: "2px 6px",
    borderRadius: "4px",
    textTransform: "uppercase",
  },
  userTag: {
    fontSize: "10px",
    fontWeight: "700",
    backgroundColor: "#0369a1",
    color: "#e0f2fe",
    padding: "2px 6px",
    borderRadius: "4px",
    textTransform: "uppercase",
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#374151",
    border: "none",
    borderRadius: "8px",
    color: "#f87171",
    padding: "6px 12px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  main: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "32px 20px",
  },
  welcomeBanner: {
    backgroundColor: "#131c2e",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "20px 24px",
    marginBottom: "28px",
  },
  bannerHeader: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  bannerTitle: {
    margin: "0 0 4px 0",
    fontSize: "18px",
    fontWeight: "700",
    color: "#ffffff",
  },
  bannerSubtitle: {
    margin: "0",
    fontSize: "14px",
    color: "#94a3b8",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
    gap: "24px",
    marginBottom: "28px",
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
    gap: "10px",
    fontSize: "16px",
    fontWeight: "600",
    margin: "0 0 8px 0",
    color: "#f8fafc",
  },
  cardDescription: {
    fontSize: "13px",
    color: "#94a3b8",
    margin: "0 0 20px 0",
    lineHeight: "1.4",
  },
  buttonList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  actionBtn: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#e2e8f0",
    fontSize: "13px",
    fontWeight: "500",
    textAlign: "left",
    cursor: "pointer",
  },
  activeBtn: {
    backgroundColor: "#2563eb",
    border: "1px solid #3b82f6",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: "600",
    textAlign: "left",
    cursor: "pointer",
  },
  routeLinks: {
    marginBottom: "20px",
  },
  adminRouteLink: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "12px",
    color: "#38bdf8",
    textDecoration: "none",
    fontWeight: "600",
    fontSize: "14px",
  },
  subtext: {
    fontSize: "12px",
    color: "#94a3b8",
    fontWeight: "normal",
  },
  infoBox: {
    backgroundColor: "#0b1120",
    border: "1px solid #1f2937",
    borderRadius: "8px",
    padding: "14px",
  },
  infoTitle: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#cbd5e1",
    margin: "0 0 6px 0",
    textTransform: "uppercase",
  },
  infoList: {
    margin: "0",
    paddingLeft: "18px",
    fontSize: "12px",
    color: "#94a3b8",
    lineHeight: "1.6",
  },
  resultSection: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "20px",
  },
  resultHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    paddingBottom: "12px",
    borderBottom: "1px solid #1e293b",
  },
  resultTitleWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  resultEndpoint: {
    fontWeight: "600",
    fontSize: "14px",
    color: "#f8fafc",
  },
  statusBadgeSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    color: "#34d399",
    padding: "3px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "700",
    border: "1px solid rgba(16, 185, 129, 0.4)",
  },
  statusBadgeWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    color: "#fbbf24",
    padding: "3px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "700",
    border: "1px solid rgba(245, 158, 11, 0.4)",
  },
  statusBadgeDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    color: "#f87171",
    padding: "3px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "700",
    border: "1px solid rgba(239, 68, 68, 0.4)",
  },
  resultPre: {
    margin: "0",
    padding: "12px",
    backgroundColor: "#020617",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#e2e8f0",
    overflowX: "auto",
    lineHeight: "1.5",
  },
};
