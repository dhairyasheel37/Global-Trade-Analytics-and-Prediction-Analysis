import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Shield, Lock, User as UserIcon, AlertCircle, CheckCircle2 } from "lucide-react";

export const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error);
    }
  };

  const handleQuickLogin = async (demoUser, demoPass) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setError("");
    setLoading(true);
    const result = await login(demoUser, demoPass);
    setLoading(false);
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error);
    }
  };

  const fillCredentials = (demoUser, demoPass) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setError("");
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.iconWrapper}>
            <Shield size={32} color="#3b82f6" />
          </div>
          <h1 style={styles.mainTitle}>Global Trade Analytics</h1>
          <p style={styles.subtitle}>Authentication & Access Control Portal</p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Sign In</h2>
          <p style={styles.cardSubtitle}>Enter your credentials or use 1-click demo login</p>

          {error && (
            <div style={styles.errorAlert}>
              <AlertCircle size={18} style={{ marginRight: "8px", flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Username</label>
              <div style={styles.inputWrapper}>
                <UserIcon size={18} color="#64748b" style={styles.inputIcon} />
                <input
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  style={styles.input}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <div style={styles.inputWrapper}>
                <Lock size={18} color="#64748b" style={styles.inputIcon} />
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  style={styles.input}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={loading ? styles.buttonDisabled : styles.button}
            >
              {loading ? "Signing In..." : "Sign In to Platform"}
            </button>
          </form>

          <div style={styles.demoSection}>
            <p style={styles.demoTitle}>⚡ 1-Click Instant Demo Login:</p>
            <div style={styles.demoButtons}>
              <button
                type="button"
                onClick={() => handleQuickLogin("admin", "Admin@Trade2026!")}
                disabled={loading}
                style={styles.demoBtnAdmin}
                title="Click to sign in immediately as Administrator"
              >
                <div style={styles.demoRole}>System Admin</div>
                <div style={styles.demoDetails}>admin • Admin@Trade2026!</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin("trader", "Trader@Trade2026!")}
                disabled={loading}
                style={styles.demoBtnUser}
                title="Click to sign in immediately as Trade Analyst"
              >
                <div style={styles.demoRole}>Trade Analyst</div>
                <div style={styles.demoDetails}>trader • Trader@Trade2026!</div>
              </button>
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#090d16",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  container: {
    width: "100%",
    maxWidth: "440px",
  },
  header: {
    textAlign: "center",
    marginBottom: "24px",
  },
  iconWrapper: {
    display: "inline-flex",
    padding: "12px",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: "16px",
    border: "1px solid rgba(59, 130, 246, 0.2)",
    marginBottom: "12px",
  },
  mainTitle: {
    color: "#f8fafc",
    fontSize: "24px",
    fontWeight: "700",
    margin: "0 0 4px 0",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "14px",
    margin: "0",
  },
  card: {
    backgroundColor: "#131c2e",
    border: "1px solid #1e293b",
    borderRadius: "16px",
    padding: "32px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: "20px",
    fontWeight: "600",
    margin: "0 0 4px 0",
  },
  cardSubtitle: {
    color: "#64748b",
    fontSize: "13px",
    margin: "0 0 20px 0",
  },
  errorAlert: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    color: "#f87171",
    padding: "12px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "20px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    color: "#cbd5e1",
    fontSize: "13px",
    fontWeight: "500",
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: "12px",
  },
  input: {
    width: "100%",
    backgroundColor: "#0b1120",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "10px 12px 10px 38px",
    color: "#f8fafc",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
  button: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "8px",
    transition: "background-color 0.2s",
  },
  buttonDisabled: {
    backgroundColor: "#1e3a8a",
    color: "#93c5fd",
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "not-allowed",
    marginTop: "8px",
  },
  demoSection: {
    marginTop: "24px",
    paddingTop: "18px",
    borderTop: "1px solid #1e293b",
  },
  demoTitle: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "0 0 10px 0",
  },
  demoButtons: {
    display: "flex",
    gap: "8px",
  },
  demoBtnAdmin: {
    flex: 1,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    border: "1px solid rgba(59, 130, 246, 0.4)",
    borderRadius: "8px",
    padding: "10px 8px",
    color: "#e2e8f0",
    cursor: "pointer",
    textAlign: "center",
    transition: "all 0.2s ease",
  },
  demoBtnUser: {
    flex: 1,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    border: "1px solid rgba(16, 185, 129, 0.4)",
    borderRadius: "8px",
    padding: "10px 8px",
    color: "#e2e8f0",
    cursor: "pointer",
    textAlign: "center",
    transition: "all 0.2s ease",
  },
  demoRole: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: "3px",
  },
  demoDetails: {
    fontSize: "10px",
    color: "#94a3b8",
    fontFamily: "monospace",
    letterSpacing: "-0.01em",
  },
};
