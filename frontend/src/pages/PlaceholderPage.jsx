import React from "react";
import { Link } from "react-router-dom";
import { Clock, ArrowLeft } from "lucide-react";

export const PlaceholderPage = ({ title, phase }) => {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrapper}>
          <Clock size={36} color="#3b82f6" />
        </div>
        <h1 style={styles.title}>{title}</h1>
        <div style={styles.badge}>{phase}</div>
        <p style={styles.description}>
          This module is part of the planned roadmap and will be implemented in a subsequent project phase.
        </p>
        <Link to="/" style={styles.button}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "48px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "80vh",
  },
  card: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "16px",
    padding: "40px",
    maxWidth: "500px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
  },
  iconWrapper: {
    display: "inline-flex",
    padding: "16px",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: "50%",
    marginBottom: "16px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 8px 0",
  },
  badge: {
    display: "inline-block",
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    color: "#fbbf24",
    padding: "4px 12px",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: "700",
    marginBottom: "16px",
    border: "1px solid rgba(245, 158, 11, 0.4)",
  },
  description: {
    fontSize: "14px",
    color: "#94a3b8",
    lineHeight: "1.6",
    margin: "0 0 28px 0",
  },
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "10px 20px",
    borderRadius: "8px",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: "600",
  },
};
