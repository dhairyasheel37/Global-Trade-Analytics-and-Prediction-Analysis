import React from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Globe2,
  TrendingUp,
  ArrowLeftRight,
  BarChart3,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from "lucide-react";

export const CountryMapDrawer = ({ country, onClose, selectedYear }) => {
  const navigate = useNavigate();

  if (!country) return null;

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return "$0.00";
    const abs = Math.abs(val);
    const sign = val < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)} Trillion`;
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)} Billion`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)} Million`;
    return `${sign}$${abs.toFixed(2)}`;
  };

  const isSurplus = country.trade_balance > 0;
  const isDeficit = country.trade_balance < 0;

  return (
    <div style={styles.drawerOverlay} onClick={onClose}>
      <div style={styles.drawerCard} data-testid="country-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div style={styles.header}>
          <div style={styles.titleArea}>
            <div style={styles.countryBadgeRow}>
              <span style={styles.isoTag}>{country.iso_code}</span>
              <span style={styles.macroTag}>Sovereign Economy</span>
            </div>
            <h2 style={styles.countryName}>{country.country_name}</h2>
            <div style={styles.yearNotice}>
              Data Scope: {selectedYear ? `Year ${selectedYear}` : "All Recorded Years (2014–2025)"}
            </div>
          </div>
          <button style={styles.closeBtn} data-testid="drawer-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div style={styles.divider} />

        {/* Content Body */}
        <div style={styles.body}>
          {/* Main Trade Stats Grid */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statHeader}>
                <span style={styles.statLabel}>Total Trade Volume</span>
                <BarChart3 size={16} color="#38bdf8" />
              </div>
              <div style={styles.statValue}>
                {formatCurrency(country.total_trade)}
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statHeader}>
                <span style={styles.statLabel}>Trade Balance</span>
                {isSurplus ? (
                  <ArrowUpRight size={16} color="#10b981" />
                ) : isDeficit ? (
                  <ArrowDownRight size={16} color="#f43f5e" />
                ) : (
                  <ArrowLeftRight size={16} color="#94a3b8" />
                )}
              </div>
              <div
                style={{
                  ...styles.statValue,
                  color: isSurplus ? "#10b981" : isDeficit ? "#f43f5e" : "#cbd5e1",
                }}
              >
                {formatCurrency(country.trade_balance)}
              </div>
              <div style={styles.statSubText}>{country.trade_balance_status}</div>
            </div>

            <div style={styles.statCardHalf}>
              <div style={styles.statHeader}>
                <span style={styles.statLabel}>Exports (X)</span>
                <span style={styles.flowBadgeX}>Outward</span>
              </div>
              <div style={{ ...styles.statValue, color: "#10b981" }}>
                {formatCurrency(country.exports)}
              </div>
            </div>

            <div style={styles.statCardHalf}>
              <div style={styles.statHeader}>
                <span style={styles.statLabel}>Imports (M)</span>
                <span style={styles.flowBadgeM}>Inward</span>
              </div>
              <div style={{ ...styles.statValue, color: "#38bdf8" }}>
                {formatCurrency(country.imports)}
              </div>
            </div>
          </div>

          {/* Macro Data Architecture Context */}
          <div style={styles.macroBox}>
            <div style={styles.boxTitle}>
              <Globe2 size={14} color="#38bdf8" />
              <span>Macroeconomic Trade Intelligence</span>
            </div>
            <p style={styles.boxText}>
              Official UN Comtrade merchandise trade flows reported at the aggregate World level (2014–2025).
            </p>
          </div>

          {/* Action Navigation Buttons */}
          <div style={styles.actionSection}>
            <span style={styles.actionTitle}>DEEP-DIVE MODULES</span>

            <button
              style={styles.primaryActionBtn}
              onClick={() => navigate(`/country-analysis?reporter=${country.iso_code}`)}
            >
              <TrendingUp size={16} />
              <span>Explore Country Profile</span>
              <ExternalLink size={14} style={{ marginLeft: "auto" }} />
            </button>

            <button
              style={styles.secondaryActionBtn}
              onClick={() => navigate(`/country-comparison?countryA=${country.iso_code}&countryB=USA`)}
            >
              <ArrowLeftRight size={16} />
              <span>Compare with USA</span>
              <ExternalLink size={14} style={{ marginLeft: "auto" }} />
            </button>

            <button
              style={styles.tertiaryActionBtn}
              onClick={() => navigate(`/trade-analysis?reporter=${country.iso_code}`)}
            >
              <BarChart3 size={16} />
              <span>Inspect Filtered Records</span>
              <ExternalLink size={14} style={{ marginLeft: "auto" }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  drawerOverlay: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 9000,
    display: "flex",
    justifyContent: "flex-end",
    backdropFilter: "blur(2px)",
  },
  drawerCard: {
    width: "100%",
    maxWidth: "380px",
    height: "100%",
    backgroundColor: "#0f172a",
    borderLeft: "1px solid #334155",
    boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.6)",
    display: "flex",
    flexDirection: "column",
    animation: "slideLeft 0.25s ease-out",
  },
  header: {
    padding: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleArea: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  countryBadgeRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  isoTag: {
    backgroundColor: "#1e293b",
    color: "#60a5fa",
    fontSize: "11px",
    fontWeight: "700",
    padding: "3px 7px",
    borderRadius: "4px",
    border: "1px solid #3b82f6",
  },
  granularTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    color: "#f59e0b",
    fontSize: "11px",
    fontWeight: "600",
    padding: "3px 8px",
    borderRadius: "4px",
    border: "1px solid rgba(245, 158, 11, 0.4)",
  },
  macroTag: {
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "500",
    padding: "3px 8px",
    borderRadius: "4px",
    border: "1px solid #334155",
  },
  countryName: {
    color: "#f8fafc",
    fontSize: "20px",
    fontWeight: "700",
    margin: "4px 0 0 0",
  },
  yearNotice: {
    color: "#94a3b8",
    fontSize: "12px",
  },
  closeBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    padding: "6px",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.2s",
  },
  divider: {
    height: "1px",
    backgroundColor: "#1e293b",
  },
  body: {
    padding: "20px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    flex: 1,
  },
  statsGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
  statCard: {
    width: "100%",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "14px",
  },
  statCardHalf: {
    width: "calc(50% - 6px)",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "12px",
    boxSizing: "border-box",
  },
  statHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "500",
    textTransform: "uppercase",
  },
  statValue: {
    color: "#f8fafc",
    fontSize: "16px",
    fontWeight: "700",
  },
  statSubText: {
    color: "#94a3b8",
    fontSize: "11px",
    marginTop: "4px",
  },
  flowBadgeX: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    color: "#10b981",
    fontSize: "10px",
    padding: "1px 5px",
    borderRadius: "3px",
  },
  flowBadgeM: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    color: "#38bdf8",
    fontSize: "10px",
    padding: "1px 5px",
    borderRadius: "3px",
  },
  granularBox: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    borderRadius: "8px",
    padding: "14px",
  },
  macroBox: {
    backgroundColor: "rgba(148, 163, 184, 0.05)",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "14px",
  },
  boxTitle: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    fontWeight: "600",
    color: "#f8fafc",
    marginBottom: "6px",
  },
  boxText: {
    color: "#94a3b8",
    fontSize: "12px",
    lineHeight: "1.5",
    margin: 0,
  },
  actionSection: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "auto",
  },
  actionTitle: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.5px",
    marginBottom: "2px",
  },
  primaryActionBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    padding: "11px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  secondaryActionBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    border: "1px solid #475569",
    borderRadius: "6px",
    padding: "11px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  tertiaryActionBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "transparent",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "10px 14px",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background 0.2s",
  },
};
