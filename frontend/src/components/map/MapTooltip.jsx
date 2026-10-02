import React from "react";
import { Globe2 } from "lucide-react";

export const MapTooltip = ({ country, position, activeMetric }) => {
  if (!country) return null;

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

  const getBalanceColor = (status) => {
    if (status === "Trade Surplus") return "#10b981";
    if (status === "Trade Deficit") return "#f43f5e";
    return "#94a3b8";
  };

  return (
    <div
      style={{
        ...styles.tooltip,
        left: position.x + 15,
        top: position.y - 15,
      }}
    >
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <Globe2 size={15} color="#60a5fa" />
          <span style={styles.countryName}>{country.country_name}</span>
          <span style={styles.isoBadge}>{country.iso_code}</span>
        </div>
      </div>

      <div style={styles.divider} />

      {country.total_trade === 0 ? (
        <div style={styles.noDataNotice}>No trade reported for this year</div>
      ) : (
        <div style={styles.metricsGrid}>
          <div style={styles.metricRow}>
            <span style={styles.metricLabel}>Total Trade:</span>
            <span style={styles.metricValueBold}>
              {formatCurrency(country.total_trade)}
            </span>
          </div>
          <div style={styles.metricRow}>
            <span style={styles.metricLabel}>Exports (X):</span>
            <span style={{ ...styles.metricValue, color: "#10b981" }}>
              {formatCurrency(country.exports)}
            </span>
          </div>
          <div style={styles.metricRow}>
            <span style={styles.metricLabel}>Imports (M):</span>
            <span style={{ ...styles.metricValue, color: "#38bdf8" }}>
              {formatCurrency(country.imports)}
            </span>
          </div>
          <div style={styles.metricRow}>
            <span style={styles.metricLabel}>Trade Balance:</span>
            <span
              style={{
                ...styles.metricValue,
                color: getBalanceColor(country.trade_balance_status),
                fontWeight: "600",
              }}
            >
              {formatCurrency(country.trade_balance)} ({country.trade_balance_status})
            </span>
          </div>
        </div>
      )}
      <div style={styles.clickHint}>Click to view detailed analysis & comparison</div>
    </div>
  );
};

const styles = {
  tooltip: {
    position: "fixed",
    zIndex: 9999,
    pointerEvents: "none",
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    backdropFilter: "blur(8px)",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "12px 14px",
    minWidth: "240px",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    transition: "transform 0.05s ease-out",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  countryName: {
    color: "#f8fafc",
    fontSize: "13px",
    fontWeight: "600",
  },
  isoBadge: {
    backgroundColor: "#1e293b",
    color: "#94a3b8",
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 6px",
    borderRadius: "4px",
    border: "1px solid #475569",
  },
  granularBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    color: "#f59e0b",
    fontSize: "10px",
    fontWeight: "600",
    padding: "2px 6px",
    borderRadius: "4px",
    alignSelf: "flex-start",
    marginTop: "2px",
  },
  divider: {
    height: "1px",
    backgroundColor: "#334155",
    margin: "8px 0",
  },
  noDataNotice: {
    color: "#94a3b8",
    fontSize: "11px",
    fontStyle: "italic",
    padding: "4px 0",
  },
  metricsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "11px",
  },
  metricLabel: {
    color: "#94a3b8",
  },
  metricValue: {
    color: "#cbd5e1",
    fontWeight: "500",
  },
  metricValueBold: {
    color: "#f8fafc",
    fontWeight: "700",
  },
  clickHint: {
    marginTop: "8px",
    fontSize: "10px",
    color: "#64748b",
    fontStyle: "italic",
    textAlign: "center",
  },
};
