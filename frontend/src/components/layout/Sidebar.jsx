import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  TrendingUp,
  Globe2,
  Map,
  ArrowLeftRight,
  Package,
  Scale,
  BrainCircuit,
  Layers,
  Database,
  FileText,
  Info,
  LogOut,
  User,
  ShieldAlert,
} from "lucide-react";

export const Sidebar = () => {
  const { user, isAdmin, logout } = useAuth();

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard, exact: true },
    { name: "Global Map", path: "/map", icon: Map },
    { name: "Trade Analysis", path: "/trade-analysis", icon: TrendingUp },
    { name: "Country Analysis", path: "/country-analysis", icon: Globe2 },
    { name: "Country Comparison", path: "/country-comparison", icon: ArrowLeftRight },
    { name: "Product Analysis", path: "/product-analysis", icon: Package },
    { name: "Trade Balance", path: "/trade-balance", icon: Scale },
    { name: "Economic Metrics", path: "/economic-metrics", icon: Layers },
    { name: "Prediction", path: "/prediction", icon: BrainCircuit },
  ];

  // Admin-only nav item (rendered conditionally based on role from /api/auth/me)
  const adminNavItems = [
    { name: "Data Management", path: "/data-management", icon: Database, adminOnly: true },
  ];

  const utilityNavItems = [
    { name: "Reports", path: "/reports", icon: FileText },
    { name: "About Project", path: "/about", icon: Info },
  ];

  return (
    <aside style={styles.sidebar}>
      {/* Brand Header */}
      <div style={styles.brand}>
        <Globe2 size={24} color="#3b82f6" />
        <div style={styles.brandText}>
          <span style={styles.brandTitle}>TradeAnalytics</span>
          <span style={styles.brandSub}>UN Comtrade Platform</span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav style={styles.nav}>
        <div style={styles.navGroup}>
          <span style={styles.groupLabel}>ANALYTICS & INSIGHTS</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                style={({ isActive }) => (isActive ? styles.activeLink : styles.navLink)}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Administration Section (Rendered for ADMIN role) */}
        {isAdmin && (
          <div style={styles.navGroup}>
            <span style={styles.groupLabel}>ADMINISTRATION</span>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={({ isActive }) => (isActive ? styles.activeLink : styles.navLink)}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        )}

        <div style={styles.navGroup}>
          <span style={styles.groupLabel}>SYSTEM</span>
          {utilityNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => (isActive ? styles.activeLink : styles.navLink)}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* User Footer & Logout */}
      <div style={styles.footer}>
        <div style={styles.userInfo}>
          <div style={styles.avatar}>
            <User size={16} color="#94a3b8" />
          </div>
          <div style={styles.userMeta}>
            <span style={styles.username}>{user?.username}</span>
            <span style={isAdmin ? styles.adminBadge : styles.userBadge}>
              {user?.role}
            </span>
          </div>
        </div>

        <button onClick={logout} style={styles.logoutBtn} title="Sign Out">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
};

const styles = {
  sidebar: {
    width: "260px",
    minWidth: "260px",
    backgroundColor: "#0d1322",
    borderRight: "1px solid #1e293b",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    position: "sticky",
    top: 0,
    boxSizing: "border-box",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "20px 24px",
    borderBottom: "1px solid #1e293b",
  },
  brandText: {
    display: "flex",
    flexDirection: "column",
  },
  brandTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: "-0.02em",
  },
  brandSub: {
    fontSize: "11px",
    color: "#64748b",
    fontWeight: "500",
  },
  nav: {
    flex: 1,
    padding: "16px 12px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  navGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  groupLabel: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#475569",
    letterSpacing: "0.08em",
    padding: "0 12px 6px 12px",
    textTransform: "uppercase",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 14px",
    borderRadius: "8px",
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: "500",
    transition: "all 0.15s ease",
  },
  activeLink: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 14px",
    borderRadius: "8px",
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    color: "#60a5fa",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: "600",
    borderLeft: "3px solid #3b82f6",
  },
  footer: {
    padding: "16px 20px",
    borderTop: "1px solid #1e293b",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#090d16",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#1e293b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #334155",
  },
  userMeta: {
    display: "flex",
    flexDirection: "column",
  },
  username: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#f8fafc",
  },
  adminBadge: {
    fontSize: "9px",
    fontWeight: "700",
    backgroundColor: "#854d0e",
    color: "#fef08a",
    padding: "1px 5px",
    borderRadius: "4px",
    width: "fit-content",
    marginTop: "2px",
  },
  userBadge: {
    fontSize: "9px",
    fontWeight: "700",
    backgroundColor: "#0369a1",
    color: "#e0f2fe",
    padding: "1px 5px",
    borderRadius: "4px",
    width: "fit-content",
    marginTop: "2px",
  },
  logoutBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: "#f87171",
    cursor: "pointer",
    padding: "6px",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
