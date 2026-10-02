import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/client";
import {
  Globe2,
  TrendingUp,
  BarChart3,
  Scale,
  Play,
  Pause,
  RotateCcw,
  Search,
  Filter,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from "lucide-react";
import { WorldMap } from "../components/map/WorldMap";
import { CountryMapDrawer } from "../components/map/CountryMapDrawer";

export const GlobalMapPage = () => {
  // State for Map Data
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Controls
  const [selectedYear, setSelectedYear] = useState(""); // "" means all years
  const [activeMetric, setActiveMetric] = useState("total_trade"); // "total_trade" | "trade_balance" | "exports" | "imports"
  const [selectedCountry, setSelectedCountry] = useState(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Timeline Auto-Play Animation State
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef(null);

  // Available Years
  const availableYears = mapData?.available_years || [
    2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
  ];

  // Fetch Map Data
  const fetchMapData = useCallback(async (year) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (year) {
        params.year = year;
      }
      const res = await api.get("/map/countries", { params });
      setMapData(res.data);
    } catch (err) {
      console.error("Failed to load geospatial map data:", err);
      setError("Unable to load global map data. Please check network connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMapData(selectedYear);
  }, [selectedYear, fetchMapData]);

  // Timeline Auto-Play Loop
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setSelectedYear((currentYear) => {
          const years = [
            2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
          ];
          const currInt = currentYear ? parseInt(currentYear, 10) : 2013;
          const nextIdx = years.indexOf(currInt) + 1;
          if (nextIdx >= years.length) {
            setIsPlaying(false);
            return years[0].toString();
          }
          return years[nextIdx].toString();
        });
      }, 1400);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    }

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying]);

  const togglePlay = () => {
    if (!isPlaying && !selectedYear) {
      setSelectedYear("2014");
    }
    setIsPlaying(!isPlaying);
  };

  // Search Results Filtering
  const filteredCountries = (mapData?.countries || []).filter((c) => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return (
      c.country_name.toLowerCase().includes(q) ||
      c.iso_code.toLowerCase().includes(q)
    );
  });

  const handleSelectSearchCountry = (country) => {
    setSelectedCountry(country);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return "$0.00";
    const abs = Math.abs(val);
    const sign = val < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)} T`;
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)} B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)} M`;
    return `${sign}$${abs.toFixed(2)}`;
  };

  const summary = mapData?.summary;

  return (
    <div style={styles.container}>
      {/* Page Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.subBadge}>GEOSPATIAL INTELLIGENCE</span>
            <span style={styles.scopeBadge}>
              <Globe2 size={11} color="#38bdf8" /> 190 Sovereign Nations • Pure Macro Trade
            </span>
          </div>
          <h1 style={styles.title}>Global Trade Map Explorer</h1>
          <p style={styles.description}>
            Interactive choropleth visualization of international merchandise flows,
            bilateral trade balances, and commodity specializations across 190+ countries (2014–2025).
          </p>
        </div>
      </div>

      {/* Scope Info Callout */}
      <div style={styles.scopeNotice}>
        <div style={styles.noticeIcon}>
          <Info size={16} color="#3b82f6" />
        </div>
        <div style={styles.noticeContent}>
          <strong>Macroeconomic Trade Intelligence:</strong> Official UN Comtrade merchandise trade volumes and bilateral balances
          are analyzed across all <strong>190 sovereign reporting nations</strong> from 2014 to 2025.
        </div>
      </div>

      {/* Top Controls Toolbar */}
      <div style={styles.toolbar}>
        {/* Metric Selector Pills */}
        <div style={styles.metricButtonGroup}>
          <button
            style={activeMetric === "total_trade" ? styles.metricBtnActive : styles.metricBtn}
            onClick={() => setActiveMetric("total_trade")}
          >
            <BarChart3 size={15} />
            <span>Total Trade Volume</span>
          </button>
          <button
            style={activeMetric === "trade_balance" ? styles.metricBtnActive : styles.metricBtn}
            onClick={() => setActiveMetric("trade_balance")}
          >
            <Scale size={15} />
            <span>Trade Balance (Surplus/Deficit)</span>
          </button>
          <button
            style={activeMetric === "exports" ? styles.metricBtnActive : styles.metricBtn}
            onClick={() => setActiveMetric("exports")}
          >
            <ArrowUpRight size={15} color="#10b981" />
            <span>Exports</span>
          </button>
          <button
            style={activeMetric === "imports" ? styles.metricBtnActive : styles.metricBtn}
            onClick={() => setActiveMetric("imports")}
          >
            <ArrowDownRight size={15} color="#38bdf8" />
            <span>Imports</span>
          </button>
        </div>

        {/* Timeline & Year Controls */}
        <div style={styles.timelineGroup}>
          <button
            style={isPlaying ? styles.playBtnActive : styles.playBtn}
            onClick={togglePlay}
            title={isPlaying ? "Pause Timeline Playback" : "Play Historical Timeline (2014-2025)"}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? "Pause" : "Play Timeline"}</span>
          </button>

          <div style={styles.yearSelectWrapper}>
            <span style={styles.yearLabel}>Year:</span>
            <select
              style={styles.yearSelect}
              value={selectedYear}
              onChange={(e) => {
                setIsPlaying(false);
                setSelectedYear(e.target.value);
              }}
            >
              <option value="">All Years (Cumulative)</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr.toString()}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Country Search Bar */}
        <div style={styles.searchWrapper}>
          <Search size={15} color="#94a3b8" style={styles.searchIcon} />
          <input
            type="text"
            data-testid="search-input"
            style={styles.searchInput}
            placeholder="Search country or ISO (e.g. IND, Brazil)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
          />

          {showSearchResults && filteredCountries.length > 0 && (
            <div style={styles.searchDropdown} data-testid="search-dropdown">
              {filteredCountries.slice(0, 8).map((c) => (
                <div
                  key={c.iso_code}
                  data-testid={`search-item-${c.iso_code}`}
                  style={styles.searchItem}
                  onClick={() => handleSelectSearchCountry(c)}
                >
                  <span style={styles.searchItemName}>{c.country_name}</span>
                  <span style={styles.searchItemIso}>{c.iso_code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Global Summary KPI Header */}
      {summary && (
        <div style={styles.kpiRow} data-testid="kpi-summary-row">
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Global Total Trade</div>
            <div style={styles.kpiValue}>{formatCurrency(summary.total_global_trade)}</div>
            <div style={styles.kpiSub}>
              {selectedYear ? `Full Year ${selectedYear}` : "2014–2025 Cumulative"}
            </div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Global Exports</div>
            <div style={{ ...styles.kpiValue, color: "#10b981" }}>
              {formatCurrency(summary.total_global_exports)}
            </div>
            <div style={styles.kpiSub}>Aggregate outbound merchandise</div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Global Imports</div>
            <div style={{ ...styles.kpiValue, color: "#38bdf8" }}>
              {formatCurrency(summary.total_global_imports)}
            </div>
            <div style={styles.kpiSub}>Aggregate inbound merchandise</div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Net Trade Balance</div>
            <div
              style={{
                ...styles.kpiValue,
                color: summary.global_trade_balance >= 0 ? "#10b981" : "#f43f5e",
              }}
            >
              {formatCurrency(summary.global_trade_balance)}
            </div>
            <div style={styles.kpiSub}>
              {summary.global_trade_balance >= 0 ? "Global Surplus" : "Global Net Deficit"}
            </div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Active Economies</div>
            <div style={styles.kpiValue}>
              {summary.countries_with_data} <span style={styles.kpiMuted}>/ 190</span>
            </div>
            <div style={styles.kpiSub}>100% Macro Coverage</div>
          </div>
        </div>
      )}

      {/* Active Legend Bar */}
      <div style={styles.legendContainer}>
        <div style={styles.legendTitle}>
          <span>Color Scale:</span>
          <strong>
            {activeMetric === "total_trade" && "Total Trade Volume (Dark Navy → Bright Cyan)"}
            {activeMetric === "trade_balance" && "Trade Balance (Green Surplus → Red Deficit)"}
            {activeMetric === "exports" && "Merchandise Exports (Emerald Gradient)"}
            {activeMetric === "imports" && "Merchandise Imports (Blue Gradient)"}
          </strong>
        </div>

        <div style={styles.legendBarWrapper}>
          {activeMetric === "trade_balance" ? (
            <div style={styles.divergingLegend}>
              <span style={styles.legendText}>Deficit (-$100B+)</span>
              <div style={styles.gradientDiverging} />
              <span style={styles.legendText}>Neutral ($0)</span>
              <div style={styles.gradientDivergingSurplus} />
              <span style={styles.legendText}>Surplus (+$100B+)</span>
            </div>
          ) : (
            <div style={styles.sequentialLegend}>
              <span style={styles.legendText}>Low Volume</span>
              <div
                style={{
                  ...styles.gradientSequential,
                  background:
                    activeMetric === "exports"
                      ? "linear-gradient(to right, #a7f3d0, #10b981, #047857)"
                      : activeMetric === "imports"
                      ? "linear-gradient(to right, #bfdbfe, #3b82f6, #1d4ed8)"
                      : "linear-gradient(to right, #bae6fd, #38bdf8, #0284c7, #0369a1)",
                }}
              />
              <span style={styles.legendText}>High Volume ($1T+)</span>
            </div>
          )}
        </div>
      </div>

      {/* Main World Map Component */}
      <div style={styles.mapSection}>
        {loading && (
          <div style={styles.loadingOverlay}>
            <div style={styles.spinner} />
            <span>Updating geospatial visualization...</span>
          </div>
        )}

        <WorldMap
          countriesData={mapData?.countries || []}
          activeMetric={activeMetric}
          selectedCountryIso={selectedCountry?.iso_code}
          onSelectCountry={(country) => setSelectedCountry(country)}
        />
      </div>

      {/* Selected Country Details Drawer */}
      {selectedCountry && (
        <CountryMapDrawer
          country={selectedCountry}
          selectedYear={selectedYear}
          onClose={() => setSelectedCountry(null)}
        />
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: "24px 32px",
    maxWidth: "1600px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    color: "#f8fafc",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  badgeRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
  },
  subBadge: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#60a5fa",
    letterSpacing: "1px",
  },
  scopeBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    color: "#fbbf24",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    fontSize: "11px",
    fontWeight: "600",
    padding: "2px 8px",
    borderRadius: "4px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "800",
    color: "#f8fafc",
    margin: "0 0 6px 0",
  },
  description: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: 0,
    maxWidth: "900px",
    lineHeight: "1.5",
  },
  scopeNotice: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "12px",
    color: "#cbd5e1",
  },
  noticeIcon: {
    flexShrink: 0,
  },
  noticeContent: {
    lineHeight: "1.4",
  },
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
    backgroundColor: "#0f172a",
    padding: "14px",
    borderRadius: "10px",
    border: "1px solid #1e293b",
  },
  metricButtonGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  metricBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#1e293b",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  metricBtnActive: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "1px solid #3b82f6",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(37, 99, 235, 0.4)",
  },
  timelineGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  playBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    border: "1px solid #475569",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  playBtnActive: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#e11d48",
    color: "#ffffff",
    border: "1px solid #f43f5e",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(225, 29, 72, 0.4)",
  },
  yearSelectWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  yearLabel: {
    fontSize: "12px",
    color: "#94a3b8",
    fontWeight: "500",
  },
  yearSelect: {
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "7px 10px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    outline: "none",
  },
  searchWrapper: {
    position: "relative",
    width: "280px",
  },
  searchIcon: {
    position: "absolute",
    left: "10px",
    top: "10px",
  },
  searchInput: {
    width: "100%",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 12px 8px 32px",
    fontSize: "12px",
    outline: "none",
    boxSizing: "border-box",
  },
  searchDropdown: {
    position: "absolute",
    top: "38px",
    left: 0,
    right: 0,
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "6px",
    zIndex: 100,
    boxShadow: "0 8px 20px rgba(0, 0, 0, 0.6)",
    maxHeight: "220px",
    overflowY: "auto",
  },
  searchItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "9px 12px",
    cursor: "pointer",
    borderBottom: "1px solid #1e293b",
    fontSize: "12px",
    transition: "background 0.15s",
  },
  searchItemName: {
    color: "#f8fafc",
    fontWeight: "500",
  },
  searchItemIso: {
    color: "#94a3b8",
    fontSize: "11px",
    backgroundColor: "#1e293b",
    padding: "1px 5px",
    borderRadius: "3px",
  },
  searchGranularTag: {
    marginLeft: "auto",
    color: "#f59e0b",
    fontSize: "10px",
    fontWeight: "600",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    padding: "1px 5px",
    borderRadius: "3px",
  },
  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
  },
  kpiCard: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  kpiLabel: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  kpiValue: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#f8fafc",
  },
  kpiMuted: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#64748b",
  },
  kpiSub: {
    fontSize: "11px",
    color: "#64748b",
  },
  legendContainer: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "12px",
    gap: "10px",
  },
  legendTitle: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#94a3b8",
  },
  legendBarWrapper: {
    display: "flex",
    alignItems: "center",
  },
  sequentialLegend: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  gradientSequential: {
    width: "160px",
    height: "10px",
    borderRadius: "5px",
  },
  divergingLegend: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  gradientDiverging: {
    width: "70px",
    height: "10px",
    borderRadius: "5px 0 0 5px",
    background: "linear-gradient(to right, #e11d48, #f43f5e, #334155)",
  },
  gradientDivergingSurplus: {
    width: "70px",
    height: "10px",
    borderRadius: "0 5px 5px 0",
    background: "linear-gradient(to right, #334155, #10b981, #059669)",
  },
  legendText: {
    fontSize: "11px",
    color: "#94a3b8",
  },
  mapSection: {
    position: "relative",
    width: "100%",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11, 19, 41, 0.75)",
    backdropFilter: "blur(4px)",
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    color: "#38bdf8",
    fontSize: "13px",
    fontWeight: "600",
    borderRadius: "12px",
  },
  spinner: {
    width: "28px",
    height: "28px",
    border: "3px solid rgba(56, 189, 248, 0.2)",
    borderTop: "3px solid #38bdf8",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
