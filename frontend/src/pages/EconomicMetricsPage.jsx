import React, { useState, useEffect, useMemo } from "react";
import api from "../api/client";
import {
  Layers,
  Activity,
  TrendingUp,
  TrendingDown,
  Scale,
  Globe2,
  Grid,
  Filter,
  ArrowUpDown,
  Download,
  Info,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

// Format currency in compact or detailed format
const formatCurrency = (val) => {
  if (val === null || val === undefined) return "$0.00";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)} B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)} M`;
  return `${sign}$${abs.toLocaleString()}`;
};

export const EconomicMetricsPage = () => {
  // Global & filter state
  const [selectedYear, setSelectedYear] = useState(""); // "" means Full History
  const [globalData, setGlobalData] = useState(null);
  const [loadingIndices, setLoadingIndices] = useState(false);

  // Active sub-module tab: "heatmap" | "matrix" | "table"
  const [activeTab, setActiveTab] = useState("heatmap");

  // Heatmap state
  const [heatmapMetric, setHeatmapMetric] = useState("tbi");
  const [heatmapPreset, setHeatmapPreset] = useState("top10");
  const [heatmapData, setHeatmapData] = useState(null);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);

  // Correlation & Bilateral Matrix state
  const [matrixType, setMatrixType] = useState("correlation"); // "correlation" | "bilateral"
  const [corrMetric, setCorrMetric] = useState("trade_balance");
  const [matrixPreset, setMatrixPreset] = useState("top10");
  const [corrData, setCorrData] = useState(null);
  const [bilateralData, setBilateralData] = useState(null);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [hoveredPair, setHoveredPair] = useState(null);

  // Table search & sort state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("rank_by_volume");
  const [sortAsc, setSortAsc] = useState(true);

  // 1. Fetch Global Economic Indices
  const fetchIndices = async () => {
    setLoadingIndices(true);
    try {
      const url = selectedYear
        ? `/economic-metrics/indices?year=${selectedYear}`
        : `/economic-metrics/indices`;
      const res = await api.get(url);
      setGlobalData(res.data);
    } catch (err) {
      console.error("Failed to load economic indices:", err);
    } finally {
      setLoadingIndices(false);
    }
  };

  useEffect(() => {
    fetchIndices();
  }, [selectedYear]);

  // 2. Fetch Heatmap Matrix
  const fetchHeatmap = async () => {
    setLoadingHeatmap(true);
    try {
      const res = await api.get("/economic-metrics/heatmap", {
        params: {
          metric: heatmapMetric,
          preset: heatmapPreset,
          start_year: 2014,
          end_year: 2025,
        },
      });
      setHeatmapData(res.data);
    } catch (err) {
      console.error("Failed to load heatmap:", err);
    } finally {
      setLoadingHeatmap(false);
    }
  };

  useEffect(() => {
    if (activeTab === "heatmap") {
      fetchHeatmap();
    }
  }, [activeTab, heatmapMetric, heatmapPreset]);

  // Heatmap cell hover handlers
  const handleCellMouseEnter = (e, cell) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredCell(cell);
    setTooltipPos({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
    });
  };

  const handleCellMouseLeave = () => {
    setHoveredCell(null);
    setTooltipPos(null);
  };

  // 3. Fetch Correlation or Bilateral Matrix
  const fetchMatrixData = async () => {
    setLoadingMatrix(true);
    try {
      if (matrixType === "correlation") {
        const res = await api.get("/economic-metrics/correlation-matrix", {
          params: {
            metric: corrMetric,
            preset: matrixPreset,
          },
        });
        setCorrData(res.data);
      } else {
        const res = await api.get("/economic-metrics/bilateral-matrix", {
          params: {
            countries: "USA,CHN,DEU,IND,JPN,GBR,FRA,ITA,BRA,CAN",
          },
        });
        setBilateralData(res.data);
      }
    } catch (err) {
      console.error("Failed to load matrix data:", err);
    } finally {
      setLoadingMatrix(false);
    }
  };

  useEffect(() => {
    if (activeTab === "matrix") {
      fetchMatrixData();
    }
  }, [activeTab, matrixType, corrMetric, matrixPreset]);

  // Filter and sort country indices table
  const filteredIndices = useMemo(() => {
    if (!globalData?.indices) return [];
    let list = globalData.indices.filter(
      (c) =>
        c.reporter_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.reporter_iso.toLowerCase().includes(searchTerm.toLowerCase())
    );

    list.sort((a, b) => {
      let vA = a[sortField];
      let vB = b[sortField];
      if (typeof vA === "string") {
        return sortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      return sortAsc ? vA - vB : vB - vA;
    });

    return list;
  }, [globalData, searchTerm, sortField, sortAsc]);

  // Export table data to CSV
  const handleExportCsv = () => {
    if (!filteredIndices.length) return;
    const headers = [
      "Rank",
      "ISO",
      "Country Name",
      "Total Trade ($)",
      "Exports ($)",
      "Imports ($)",
      "Trade Balance ($)",
      "Lafay TBI (-100 to +100)",
      "Revealed Trade Advantage (RTA)",
      "Grubel-Lloyd Index (GLI)",
      "Export Market Share (%)",
      "Import Market Share (%)",
      "Global Trade Openness (%)",
    ];
    const rows = filteredIndices.map((r) => [
      r.rank_by_volume,
      r.reporter_iso,
      `"${r.reporter_name}"`,
      r.total_trade_value,
      r.export_value,
      r.import_value,
      r.trade_balance,
      r.tbi,
      r.rta,
      r.gli,
      r.export_market_share,
      r.import_market_share,
      r.trade_openness_share,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Economic_Metrics_${selectedYear || "Full_History"}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Color mapper helper for heatmap cells
  const getCellColor = (val, metricType, minVal, maxVal, neutralVal) => {
    if (metricType === "tbi") {
      // Diverging from -100 (crimson) to 0 (slate) to +100 (emerald)
      if (val >= 0) {
        const intensity = Math.min(1, val / 60);
        return `rgba(16, 185, 129, ${0.15 + intensity * 0.75})`;
      } else {
        const intensity = Math.min(1, Math.abs(val) / 60);
        return `rgba(239, 68, 68, ${0.15 + intensity * 0.75})`;
      }
    } else if (metricType === "rta") {
      // Neutral = 1.0. <1 red, >1 green
      if (val >= 1.0) {
        const intensity = Math.min(1, (val - 1.0) / 1.5);
        return `rgba(14, 165, 233, ${0.2 + intensity * 0.75})`;
      } else {
        const intensity = Math.min(1, (1.0 - val) / 0.8);
        return `rgba(245, 158, 11, ${0.2 + intensity * 0.75})`;
      }
    } else if (metricType === "export_share") {
      // Sequential blues
      const norm = maxVal > minVal ? (val - minVal) / (maxVal - minVal) : 0.5;
      return `rgba(99, 102, 241, ${0.15 + Math.min(1, norm * 1.5) * 0.8})`;
    } else if (metricType === "trade_balance") {
      // Diverging green/red
      if (val >= 0) {
        return `rgba(16, 185, 129, 0.65)`;
      } else {
        return `rgba(239, 68, 68, 0.65)`;
      }
    } else {
      // growth_rate
      if (val >= 0) {
        return `rgba(16, 185, 129, ${Math.min(0.85, 0.2 + (val / 30) * 0.65)})`;
      } else {
        return `rgba(239, 68, 68, ${Math.min(0.85, 0.2 + (Math.abs(val) / 30) * 0.65)})`;
      }
    }
  };

  // Color mapper for Pearson correlation (-1 to +1)
  const getCorrColor = (r) => {
    if (r >= 0) {
      const intensity = r;
      return `rgba(16, 185, 129, ${0.1 + intensity * 0.85})`;
    } else {
      const intensity = Math.abs(r);
      return `rgba(239, 68, 68, ${0.1 + intensity * 0.85})`;
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Tooltip dynamic coordinates computation for Floating Glassmorphism Tooltip
  let tooltipStyle = {};
  if (tooltipPos) {
    const tooltipWidth = 340;
    // If cell is near the top of the viewport (less than 230px space), display below the cell
    const placeAbove = tooltipPos.top >= 230;

    // Center horizontally over the cell
    let left = tooltipPos.left + tooltipPos.width / 2 - tooltipWidth / 2;
    // Boundary safety: keep within viewport padding
    if (left < 16) left = 16;
    if (
      typeof window !== "undefined" &&
      left + tooltipWidth > window.innerWidth - 16
    ) {
      left = window.innerWidth - tooltipWidth - 16;
    }

    const top = placeAbove ? tooltipPos.top - 10 : tooltipPos.bottom + 10;

    tooltipStyle = {
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      transform: placeAbove ? "translateY(-100%)" : "translateY(0)",
      width: `${tooltipWidth}px`,
      zIndex: 99999,
      pointerEvents: "none",
    };
  }

  return (
    <div style={styles.container}>
      {/* Page Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            <Layers size={26} color="#38bdf8" />
            <h1 style={styles.pageTitle}>
              Economic Metrics & Specialized Trade Indices
            </h1>
          </div>
          <p style={styles.pageSubtitle}>
            Formalized international trade indicators (RCA/RTA, Lafay TBI,
            Grubel-Lloyd Overlap, HHI Concentration) with multi-year heatmaps and
            bilateral cross-country matrices.
          </p>
        </div>

        {/* Global Timeline Filter */}
        <div style={styles.headerControls}>
          <label style={styles.filterLabel}>TIMELINE</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={styles.yearSelect}
          >
            <option value="">Full History (2014–2025 Cumulative)</option>
            {Array.from({ length: 12 }, (_, i) => 2025 - i).map((yr) => (
              <option key={yr} value={yr}>
                Year {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top KPI Scorecards */}
      <div style={styles.kpiGrid}>
        {/* Card 1: HHI Global Export Concentration */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiTitle}>GLOBAL MARKET CONCENTRATION</span>
            <Activity size={18} color="#a855f7" />
          </div>
          <div style={styles.kpiVal}>
            {globalData
              ? globalData.hhi_export_concentration.toLocaleString()
              : "..."}
          </div>
          <div style={styles.kpiSub}>
            <span
              style={{
                ...styles.badge,
                backgroundColor:
                  globalData?.hhi_status === "Unconcentrated / Competitive"
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(245, 158, 11, 0.15)",
                color:
                  globalData?.hhi_status === "Unconcentrated / Competitive"
                    ? "#34d399"
                    : "#fbbf24",
              }}
            >
              {globalData?.hhi_status || "Evaluating..."}
            </span>
            <span style={styles.kpiHint}>HHI &lt; 1,000 = Diversified</span>
          </div>
        </div>

        {/* Card 2: Total Worldwide Trade Turnover */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiTitle}>WORLDWIDE MERCHANDISE TRADE</span>
            <Globe2 size={18} color="#38bdf8" />
          </div>
          <div style={styles.kpiVal}>
            {globalData
              ? formatCurrency(globalData.total_global_trade)
              : "..."}
          </div>
          <div style={styles.kpiSub}>
            <span style={styles.textLight}>
              {globalData?.countries_count || 190} Sovereign Nations
            </span>
            <span style={styles.kpiHint}>100% Macro Bilateral</span>
          </div>
        </div>

        {/* Card 3: Top Global Exporter */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiTitle}>LEADING GLOBAL EXPORTER</span>
            <TrendingUp size={18} color="#10b981" />
          </div>
          <div style={styles.kpiVal}>
            {globalData ? globalData.top_exporter_name : "..."}
          </div>
          <div style={styles.kpiSub}>
            <span style={styles.badgeBlue}>
              {globalData?.top_exporter_share}% Global Share
            </span>
            <span style={styles.kpiHint}>
              ISO: {globalData?.top_exporter_iso}
            </span>
          </div>
        </div>

        {/* Card 4: Mean Global TBI (Balance Equilibrium) */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiTitle}>AVERAGE TRADE BALANCE INDEX</span>
            <Scale size={18} color="#f59e0b" />
          </div>
          <div
            style={{
              ...styles.kpiVal,
              color:
                (globalData?.mean_global_tbi || 0) >= 0 ? "#10b981" : "#ef4444",
            }}
          >
            {globalData ? `${globalData.mean_global_tbi > 0 ? "+" : ""}${globalData.mean_global_tbi}` : "..."}
          </div>
          <div style={styles.kpiSub}>
            <span style={styles.textLight}>Lafay Index (-100 to +100)</span>
            <span style={styles.kpiHint}>Global Net Distribution</span>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div style={styles.tabNav}>
        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "heatmap" ? styles.activeTabBtn : {}),
          }}
          onClick={() => setActiveTab("heatmap")}
        >
          <Grid size={16} />
          <span>Multi-Year Country Heatmap</span>
        </button>

        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "matrix" ? styles.activeTabBtn : {}),
          }}
          onClick={() => setActiveTab("matrix")}
        >
          <Activity size={16} />
          <span>Cross-Country & Bilateral Matrices</span>
        </button>

        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "table" ? styles.activeTabBtn : {}),
          }}
          onClick={() => setActiveTab("table")}
        >
          <Layers size={16} />
          <span>190-Country Indices Explorer</span>
        </button>
      </div>

      {/* TAB 1: Multi-Year Country Heatmap */}
      {activeTab === "heatmap" && (
        <div style={styles.panelCard}>
          {/* Heatmap Control Bar */}
          <div style={styles.heatmapControls}>
            {/* Metric Channel Switcher */}
            <div style={styles.controlGroup}>
              <span style={styles.controlLabel}>HEATMAP METRIC:</span>
              <div style={styles.pillGroup}>
                {[
                  { id: "tbi", label: "Lafay TBI" },
                  { id: "rta", label: "Revealed Advantage (RTA)" },
                  { id: "export_share", label: "Export Market Share" },
                  { id: "trade_balance", label: "Net Trade Balance" },
                  { id: "growth_rate", label: "Annual Growth (YoY)" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setHeatmapMetric(m.id)}
                    style={{
                      ...styles.pillBtn,
                      ...(heatmapMetric === m.id ? styles.activePillBtn : {}),
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Country Group Preset Switcher */}
            <div style={styles.controlGroup}>
              <span style={styles.controlLabel}>COUNTRY PRESET:</span>
              <div style={styles.pillGroup}>
                {[
                  { id: "top10", label: "Top 10" },
                  { id: "top25", label: "Top 25" },
                  { id: "g20", label: "G20" },
                  { id: "brics", label: "BRICS+" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setHeatmapPreset(p.id)}
                    style={{
                      ...styles.pillBtn,
                      ...(heatmapPreset === p.id ? styles.activePillBtn : {}),
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Metric Description Banner */}
          {heatmapData && (
            <div style={styles.metricBanner}>
              <Info size={16} color="#38bdf8" />
              <div>
                <strong style={styles.bannerTitle}>
                  {heatmapData.metric_title} ({heatmapData.unit})
                </strong>
                <p style={styles.bannerText}>
                  {heatmapData.metric_description}
                </p>
              </div>
            </div>
          )}

          {/* Heatmap Grid Component */}
          {loadingHeatmap ? (
            <div style={styles.loadingBox}>
              <RefreshCw size={24} className="animate-spin" color="#38bdf8" />
              <span>Generating multi-dimensional economic heatmap...</span>
            </div>
          ) : heatmapData ? (
            <div style={styles.heatmapWrapper}>
              <div style={styles.heatmapTable}>
                {/* Year Header Row */}
                <div style={styles.heatmapHeaderRow}>
                  <div style={styles.heatmapCountryHeader}>
                    COUNTRY / ECONOMY
                  </div>
                  {heatmapData.years.map((yr) => {
                    const isYearActive = hoveredCell?.year === yr;
                    return (
                      <div
                        key={yr}
                        style={{
                          ...styles.heatmapYearHeader,
                          color: isYearActive ? "#38bdf8" : "#94a3b8",
                          fontWeight: isYearActive ? "800" : "700",
                          textShadow: isYearActive
                            ? "0 0 8px rgba(56, 189, 248, 0.6)"
                            : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {yr}
                      </div>
                    );
                  })}
                  <div style={styles.heatmapSummaryHeader}>AVG / TREND</div>
                </div>

                {/* Country Data Rows */}
                {heatmapData.countries.map((row) => {
                  const isCountryActive =
                    hoveredCell?.country_iso === row.country_iso;
                  return (
                    <div key={row.country_iso} style={styles.heatmapRow}>
                      <div style={styles.countryLabelCell}>
                        <span
                          style={{
                            ...styles.countryIsoBadge,
                            backgroundColor: isCountryActive
                              ? "#0284c7"
                              : "#1e293b",
                            color: isCountryActive ? "#ffffff" : "#94a3b8",
                            boxShadow: isCountryActive
                              ? "0 0 10px rgba(56, 189, 248, 0.4)"
                              : "none",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {row.country_iso}
                        </span>
                        <span
                          style={{
                            ...styles.countryNameText,
                            color: isCountryActive ? "#38bdf8" : "#e2e8f0",
                            fontWeight: isCountryActive ? "700" : "500",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {row.country_name}
                        </span>
                      </div>

                      {row.cells.map((cell) => {
                        const isCellHovered =
                          hoveredCell &&
                          hoveredCell.country_iso === row.country_iso &&
                          hoveredCell.year === cell.year;
                        const bgColor = getCellColor(
                          cell.value,
                          heatmapData.metric,
                          heatmapData.min_value,
                          heatmapData.max_value,
                          heatmapData.neutral_value
                        );
                        return (
                          <div
                            key={cell.year}
                            style={{
                              ...styles.heatmapCell,
                              backgroundColor: bgColor,
                              ...(isCellHovered
                                ? {
                                    outline: "2px solid #38bdf8",
                                    boxShadow:
                                      "0 0 16px rgba(56, 189, 248, 0.95)",
                                    transform: "scale(1.10)",
                                    zIndex: 20,
                                    position: "relative",
                                  }
                                : {}),
                            }}
                            onMouseEnter={(e) => handleCellMouseEnter(e, cell)}
                            onMouseLeave={handleCellMouseLeave}
                          >
                            <span style={styles.cellText}>
                              {cell.display_value}
                            </span>
                          </div>
                        );
                      })}

                      <div style={styles.summaryCell}>
                        <span style={styles.summaryVal}>
                          {row.avg_value > 0 && heatmapData.metric === "tbi"
                            ? `+${row.avg_value}`
                            : row.avg_value}
                        </span>
                        <span style={styles.summarySub}>
                          {formatCurrency(row.total_volume)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Informative helper banner underneath the matrix */}
              <div style={styles.heatmapHintBar}>
                <Sparkles size={14} color="#38bdf8" />
                <span>
                  Hover over any matrix box to inspect real-time bilateral export,
                  import, and net trade balance breakdowns.
                </span>
              </div>

              {/* Suggestion A: Floating Glassmorphism Tooltip attached directly to hovered cell */}
              {hoveredCell && tooltipPos && (
                <div style={{ ...styles.glassTooltip, ...tooltipStyle }}>
                  {/* Header: Country Name + Year + Metric Badge */}
                  <div style={styles.tooltipHeader}>
                    <div style={styles.tooltipTitleCol}>
                      <div style={styles.tooltipCountryRow}>
                        <span style={styles.tooltipIsoBadge}>
                          {hoveredCell.country_iso}
                        </span>
                        <span style={styles.tooltipCountryName}>
                          {hoveredCell.country_name}
                        </span>
                      </div>
                      <span style={styles.tooltipYear}>
                        Year {hoveredCell.year}
                      </span>
                    </div>
                    <div style={styles.tooltipMetricBadge}>
                      <span style={styles.tooltipMetricLabel}>
                        {heatmapData.metric_title}
                      </span>
                      <span style={styles.tooltipMetricVal}>
                        {hoveredCell.display_value}
                      </span>
                    </div>
                  </div>

                  {/* Visual Export vs Import Ratio Bar */}
                  {(() => {
                    const exp = Math.max(0, hoveredCell.export_val || 0);
                    const imp = Math.max(0, hoveredCell.import_val || 0);
                    const tot = exp + imp;
                    const expPct = tot > 0 ? Math.round((exp / tot) * 100) : 50;
                    const impPct = 100 - expPct;
                    return (
                      <div style={styles.ratioBarContainer}>
                        <div style={styles.ratioBarTrack}>
                          <div
                            style={{
                              ...styles.ratioBarExp,
                              width: `${expPct}%`,
                            }}
                          />
                          <div
                            style={{
                              ...styles.ratioBarImp,
                              width: `${impPct}%`,
                            }}
                          />
                        </div>
                        <div style={styles.ratioLabels}>
                          <span style={styles.ratioExpText}>
                            Exports {expPct}%
                          </span>
                          <span style={styles.ratioImpText}>
                            Imports {impPct}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2 Stat Chips: Exports & Imports */}
                  <div style={styles.tooltipGrid}>
                    <div style={styles.tooltipChipGreen}>
                      <div style={styles.chipHeader}>
                        <span style={styles.chipLabel}>EXPORTS (X)</span>
                        <TrendingUp size={13} color="#10b981" />
                      </div>
                      <span style={styles.chipValGreen}>
                        {formatCurrency(hoveredCell.export_val)}
                      </span>
                    </div>

                    <div style={styles.tooltipChipBlue}>
                      <div style={styles.chipHeader}>
                        <span style={styles.chipLabel}>IMPORTS (M)</span>
                        <TrendingDown size={13} color="#38bdf8" />
                      </div>
                      <span style={styles.chipValBlue}>
                        {formatCurrency(hoveredCell.import_val)}
                      </span>
                    </div>
                  </div>

                  {/* Net Balance Pill */}
                  <div
                    style={{
                      ...styles.tooltipBalanceRow,
                      backgroundColor:
                        hoveredCell.balance_val >= 0
                          ? "rgba(16, 185, 129, 0.14)"
                          : "rgba(239, 68, 68, 0.14)",
                      borderColor:
                        hoveredCell.balance_val >= 0
                          ? "rgba(16, 185, 129, 0.35)"
                          : "rgba(239, 68, 68, 0.35)",
                    }}
                  >
                    <div style={styles.balanceLeft}>
                      <Scale
                        size={14}
                        color={
                          hoveredCell.balance_val >= 0 ? "#10b981" : "#ef4444"
                        }
                      />
                      <span style={styles.balanceLabel}>NET BALANCE:</span>
                    </div>
                    <div style={styles.balanceRight}>
                      <span
                        style={{
                          ...styles.balanceVal,
                          color:
                            hoveredCell.balance_val >= 0
                              ? "#34d399"
                              : "#f87171",
                        }}
                      >
                        {hoveredCell.balance_val > 0
                          ? `+${formatCurrency(hoveredCell.balance_val)}`
                          : formatCurrency(hoveredCell.balance_val)}
                      </span>
                      <span
                        style={{
                          ...styles.balanceTag,
                          backgroundColor:
                            hoveredCell.balance_val >= 0
                              ? "#065f46"
                              : "#7f1d1d",
                          color:
                            hoveredCell.balance_val >= 0
                              ? "#6ee7b7"
                              : "#fca5a5",
                        }}
                      >
                        {hoveredCell.balance_val >= 0 ? "Surplus" : "Deficit"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 2: Cross-Country & Bilateral Matrices */}
      {activeTab === "matrix" && (
        <div style={styles.panelCard}>
          {/* Sub-mode switcher */}
          <div style={styles.heatmapControls}>
            <div style={styles.controlGroup}>
              <span style={styles.controlLabel}>MATRIX TYPE:</span>
              <div style={styles.pillGroup}>
                <button
                  onClick={() => setMatrixType("correlation")}
                  style={{
                    ...styles.pillBtn,
                    ...(matrixType === "correlation"
                      ? styles.activePillBtn
                      : {}),
                  }}
                >
                  Cross-Country Synchronization (Pearson Correlation)
                </button>
                <button
                  onClick={() => setMatrixType("bilateral")}
                  style={{
                    ...styles.pillBtn,
                    ...(matrixType === "bilateral" ? styles.activePillBtn : {}),
                  }}
                >
                  Comparative Trade Balance Gap Matrix
                </button>
              </div>
            </div>

            {matrixType === "correlation" && (
              <div style={styles.controlGroup}>
                <span style={styles.controlLabel}>SERIES:</span>
                <select
                  value={corrMetric}
                  onChange={(e) => setCorrMetric(e.target.value)}
                  style={styles.yearSelect}
                >
                  <option value="trade_balance">Net Trade Balance</option>
                  <option value="total_trade">Total Trade Turnover</option>
                  <option value="exports">Outbound Exports</option>
                  <option value="imports">Inbound Imports</option>
                </select>
              </div>
            )}
          </div>

          {/* Matrix Description Banner */}
          <div style={styles.metricBanner}>
            <Activity size={16} color="#38bdf8" />
            <div>
              <strong style={styles.bannerTitle}>
                {matrixType === "correlation"
                  ? "Pearson Trade Cycle Synchronization Matrix"
                  : "Comparative Macroeconomic Trade Balance Gap Matrix"}
              </strong>
              <p style={styles.bannerText}>
                {matrixType === "correlation"
                  ? "Computes pairwise linear correlation coefficients r in [-1.0, +1.0] across annual trade time series (2014-2025). Values near +1 indicate strongly synchronized trade cycles, while negative values indicate counter-cyclical buffers."
                  : "Calculates the structural trade balance disparity between major sovereign trading partners in USD (Bal_A - Bal_B)."}
              </p>
            </div>
          </div>

          {/* Matrix Grid Canvas */}
          {loadingMatrix ? (
            <div style={styles.loadingBox}>
              <RefreshCw size={24} className="animate-spin" color="#38bdf8" />
              <span>Constructing interactive interaction matrix...</span>
            </div>
          ) : matrixType === "correlation" && corrData ? (
            <div style={styles.matrixContainer}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `140px repeat(${corrData.countries.length}, minmax(44px, 1fr))`,
                  gap: "2px",
                  backgroundColor: "#1e293b",
                  padding: "12px",
                  borderRadius: "8px",
                  overflowX: "auto",
                }}
              >
                {/* Header Row */}
                <div style={styles.matrixTopLeft}>ISO \ ISO</div>
                {corrData.countries.map((c) => (
                  <div key={c.iso} style={styles.matrixColHeader} title={c.desc}>
                    {c.iso}
                  </div>
                ))}

                {/* Matrix Rows */}
                {corrData.countries.map((rowC, i) => (
                  <React.Fragment key={rowC.iso}>
                    <div style={styles.matrixRowHeader} title={rowC.desc}>
                      <span style={styles.matrixRowIso}>{rowC.iso}</span>
                      <span style={styles.matrixRowName}>{rowC.desc}</span>
                    </div>

                    {corrData.matrix[i].map((val, j) => {
                      const colC = corrData.countries[j];
                      const isDiag = i === j;
                      const bg = isDiag ? "#0f172a" : getCorrColor(val);
                      return (
                        <div
                          key={colC.iso}
                          style={{
                            ...styles.matrixCell,
                            backgroundColor: bg,
                            border: isDiag ? "1px solid #64748b" : "none",
                          }}
                          onMouseEnter={() =>
                            setHoveredPair({
                              a: rowC,
                              b: colC,
                              val: val,
                              type: "correlation",
                            })
                          }
                          onMouseLeave={() => setHoveredPair(null)}
                        >
                          <span style={styles.matrixCellText}>
                            {val.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* Pair Inspection Detail */}
              {hoveredPair && (
                <div style={styles.hoverDetailCard}>
                  <div style={styles.hoverDetailHeader}>
                    <strong>
                      Pairwise Correlation: {hoveredPair.a.desc} ({hoveredPair.a.iso}) ⟷ {hoveredPair.b.desc} ({hoveredPair.b.iso})
                    </strong>
                    <span style={styles.hoverValueBadge}>
                      r = {hoveredPair.val > 0 ? `+${hoveredPair.val.toFixed(3)}` : hoveredPair.val.toFixed(3)}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                    {hoveredPair.val > 0.7
                      ? "High Positive Synchronization: Both economies exhibit strongly co-moving macroeconomic trade expansions and contractions."
                      : hoveredPair.val < -0.3
                      ? "Counter-Cyclical Divergence: Trade fluctuations in one economy are inversely correlated with the other."
                      : "Independent / Moderate Synchronization."}
                  </p>
                </div>
              )}
            </div>
          ) : matrixType === "bilateral" && bilateralData ? (
            <div style={styles.matrixContainer}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `140px repeat(${bilateralData.countries.length}, minmax(64px, 1fr))`,
                  gap: "2px",
                  backgroundColor: "#1e293b",
                  padding: "12px",
                  borderRadius: "8px",
                  overflowX: "auto",
                }}
              >
                {/* Header Row */}
                <div style={styles.matrixTopLeft}>Target \ Base</div>
                {bilateralData.countries.map((c) => (
                  <div key={c.iso} style={styles.matrixColHeader} title={c.desc}>
                    {c.iso}
                  </div>
                ))}

                {/* Matrix Rows */}
                {bilateralData.countries.map((rowC, i) => (
                  <React.Fragment key={rowC.iso}>
                    <div style={styles.matrixRowHeader} title={rowC.desc}>
                      <span style={styles.matrixRowIso}>{rowC.iso}</span>
                      <span style={styles.matrixRowName}>{rowC.desc}</span>
                    </div>

                    {bilateralData.matrix[i].map((val, j) => {
                      const colC = bilateralData.countries[j];
                      const isDiag = i === j;
                      const bg = isDiag
                        ? "#0f172a"
                        : val >= 0
                        ? "rgba(16, 185, 129, 0.45)"
                        : "rgba(239, 68, 68, 0.45)";
                      return (
                        <div
                          key={colC.iso}
                          style={{
                            ...styles.matrixCell,
                            backgroundColor: bg,
                          }}
                          onMouseEnter={() =>
                            setHoveredPair({
                              a: rowC,
                              b: colC,
                              val: val,
                              type: "gap",
                            })
                          }
                          onMouseLeave={() => setHoveredPair(null)}
                        >
                          <span style={styles.matrixCellTextSmall}>
                            {val === 0 ? "0" : formatCurrency(val)}
                          </span>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {hoveredPair && (
                <div style={styles.hoverDetailCard}>
                  <div style={styles.hoverDetailHeader}>
                    <strong>
                      Comparative Balance Gap: {hoveredPair.a.desc} ({hoveredPair.a.iso}) vs {hoveredPair.b.desc} ({hoveredPair.b.iso})
                    </strong>
                    <span
                      style={{
                        ...styles.hoverValueBadge,
                        backgroundColor:
                          hoveredPair.val >= 0
                            ? "rgba(16, 185, 129, 0.2)"
                            : "rgba(239, 68, 68, 0.2)",
                        color:
                          hoveredPair.val >= 0 ? "#34d399" : "#f87171",
                      }}
                    >
                      Gap: {formatCurrency(hoveredPair.val)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 3: 190-Country Indices Explorer */}
      {activeTab === "table" && (
        <div style={styles.panelCard}>
          {/* Table Header & Search */}
          <div style={styles.tableToolbar}>
            <div style={styles.searchBox}>
              <Search size={16} color="#64748b" />
              <input
                type="text"
                placeholder="Search across all 190 nations by name or ISO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            <button onClick={handleExportCsv} style={styles.exportBtn}>
              <Download size={16} />
              <span>Export Indices (CSV)</span>
            </button>
          </div>

          {/* Table Element */}
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th onClick={() => handleSort("rank_by_volume")} style={styles.thSortable}>
                    <span>RANK</span>
                    <ArrowUpDown size={12} />
                  </th>
                  <th onClick={() => handleSort("reporter_name")} style={styles.thSortable}>
                    <span>ECONOMY</span>
                    <ArrowUpDown size={12} />
                  </th>
                  <th onClick={() => handleSort("total_trade_value")} style={styles.thSortableRight}>
                    <span>TOTAL TRADE</span>
                    <ArrowUpDown size={12} />
                  </th>
                  <th onClick={() => handleSort("export_value")} style={styles.thSortableRight}>
                    <span>EXPORTS (X)</span>
                    <ArrowUpDown size={12} />
                  </th>
                  <th onClick={() => handleSort("import_value")} style={styles.thSortableRight}>
                    <span>IMPORTS (M)</span>
                    <ArrowUpDown size={12} />
                  </th>
                  <th onClick={() => handleSort("trade_balance")} style={styles.thSortableRight}>
                    <span>NET BALANCE</span>
                    <ArrowUpDown size={12} />
                  </th>
                  <th onClick={() => handleSort("tbi")} style={styles.thSortableRight}>
                    <span>LAFAY TBI</span>
                    <ArrowUpDown size={12} />
                  </th>
                  <th onClick={() => handleSort("rta")} style={styles.thSortableRight}>
                    <span>RTA (ADV)</span>
                    <ArrowUpDown size={12} />
                  </th>
                  <th onClick={() => handleSort("gli")} style={styles.thSortableRight}>
                    <span>GLI (OVERLAP)</span>
                    <ArrowUpDown size={12} />
                  </th>
                  <th onClick={() => handleSort("export_market_share")} style={styles.thSortableRight}>
                    <span>EXP SHARE %</span>
                    <ArrowUpDown size={12} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredIndices.map((row) => {
                  const isSurplus = row.trade_balance >= 0;
                  return (
                    <tr key={row.reporter_iso} style={styles.tr}>
                      <td style={styles.tdRank}>#{row.rank_by_volume}</td>
                      <td style={styles.tdName}>
                        <span style={styles.tableIsoBadge}>
                          {row.reporter_iso}
                        </span>
                        <span>{row.reporter_name}</span>
                      </td>
                      <td style={styles.tdRightBold}>
                        {formatCurrency(row.total_trade_value)}
                      </td>
                      <td style={styles.tdRightGreen}>
                        {formatCurrency(row.export_value)}
                      </td>
                      <td style={styles.tdRightBlue}>
                        {formatCurrency(row.import_value)}
                      </td>
                      <td
                        style={{
                          ...styles.tdRightBold,
                          color: isSurplus ? "#10b981" : "#ef4444",
                        }}
                      >
                        {formatCurrency(row.trade_balance)}
                      </td>
                      <td style={styles.tdRight}>
                        <span
                          style={{
                            ...styles.tablePill,
                            backgroundColor:
                              row.tbi >= 0
                                ? "rgba(16, 185, 129, 0.15)"
                                : "rgba(239, 68, 68, 0.15)",
                            color: row.tbi >= 0 ? "#34d399" : "#f87171",
                          }}
                        >
                          {row.tbi > 0 ? `+${row.tbi}` : row.tbi}
                        </span>
                      </td>
                      <td style={styles.tdRight}>
                        <span
                          style={{
                            ...styles.tablePill,
                            backgroundColor:
                              row.rta >= 1.0
                                ? "rgba(14, 165, 233, 0.15)"
                                : "rgba(245, 158, 11, 0.15)",
                            color: row.rta >= 1.0 ? "#38bdf8" : "#fbbf24",
                          }}
                        >
                          {row.rta.toFixed(2)}x
                        </span>
                      </td>
                      <td style={styles.tdRight}>
                        {row.gli.toFixed(2)}
                      </td>
                      <td style={styles.tdRight}>
                        {row.export_market_share.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: "28px 36px",
    backgroundColor: "#090d16",
    minHeight: "100vh",
    color: "#f8fafc",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "16px",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "6px",
  },
  pageTitle: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#ffffff",
    margin: 0,
  },
  pageSubtitle: {
    fontSize: "13.5px",
    color: "#94a3b8",
    margin: 0,
    maxWidth: "800px",
  },
  headerControls: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  filterLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: "0.06em",
  },
  yearSelect: {
    backgroundColor: "#111827",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    outline: "none",
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
    borderRadius: "10px",
    padding: "18px 20px",
  },
  kpiHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  kpiTitle: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: "0.05em",
  },
  kpiVal: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: "6px",
  },
  kpiSub: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "12px",
  },
  kpiHint: {
    fontSize: "11px",
    color: "#64748b",
  },
  textLight: {
    color: "#94a3b8",
  },
  badge: {
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "600",
  },
  badgeBlue: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    color: "#38bdf8",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "600",
  },
  tabNav: {
    display: "flex",
    gap: "8px",
    borderBottom: "1px solid #1f2937",
    marginBottom: "20px",
  },
  tabBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "transparent",
    color: "#94a3b8",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "10px 16px",
    fontSize: "13.5px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  activeTabBtn: {
    color: "#38bdf8",
    borderBottom: "2px solid #38bdf8",
  },
  panelCard: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "20px",
  },
  heatmapControls: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    marginBottom: "16px",
  },
  controlGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  controlLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: "0.05em",
  },
  pillGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  pillBtn: {
    backgroundColor: "#1e293b",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  activePillBtn: {
    backgroundColor: "#0284c7",
    color: "#ffffff",
    border: "1px solid #38bdf8",
  },
  metricBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "12px 16px",
    marginBottom: "18px",
  },
  bannerTitle: {
    fontSize: "13px",
    color: "#f8fafc",
    display: "block",
    marginBottom: "2px",
  },
  bannerText: {
    fontSize: "12px",
    color: "#94a3b8",
    margin: 0,
  },
  loadingBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "60px",
    color: "#94a3b8",
    fontSize: "13px",
  },
  heatmapWrapper: {
    overflowX: "auto",
  },
  heatmapTable: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: "850px",
  },
  heatmapHeaderRow: {
    display: "flex",
    gap: "2px",
    marginBottom: "4px",
  },
  heatmapCountryHeader: {
    width: "180px",
    minWidth: "180px",
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: "0.05em",
    padding: "6px 8px",
  },
  heatmapYearHeader: {
    flex: 1,
    minWidth: "48px",
    textAlign: "center",
    fontSize: "11px",
    fontWeight: "700",
    color: "#94a3b8",
    padding: "6px 2px",
  },
  heatmapSummaryHeader: {
    width: "120px",
    minWidth: "120px",
    textAlign: "right",
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    padding: "6px 8px",
  },
  heatmapRow: {
    display: "flex",
    gap: "2px",
    alignItems: "center",
  },
  countryLabelCell: {
    width: "180px",
    minWidth: "180px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px",
  },
  countryIsoBadge: {
    backgroundColor: "#1e293b",
    color: "#94a3b8",
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 6px",
    borderRadius: "4px",
    fontFamily: "monospace",
  },
  countryNameText: {
    fontSize: "12.5px",
    color: "#e2e8f0",
    fontWeight: "500",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  heatmapCell: {
    flex: 1,
    minWidth: "48px",
    height: "36px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "transform 0.1s",
  },
  cellText: {
    fontSize: "10.5px",
    fontWeight: "600",
    color: "#ffffff",
  },
  summaryCell: {
    width: "120px",
    minWidth: "120px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    padding: "4px 8px",
  },
  summaryVal: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#f8fafc",
  },
  summarySub: {
    fontSize: "10.5px",
    color: "#64748b",
  },
  heatmapHintBar: {
    marginTop: "14px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "#94a3b8",
    padding: "8px 12px",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: "6px",
    border: "1px solid #1e293b",
  },
  glassTooltip: {
    backgroundColor: "rgba(11, 17, 32, 0.95)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: "1px solid rgba(56, 189, 248, 0.4)",
    boxShadow:
      "0 14px 35px -4px rgba(0, 0, 0, 0.75), 0 0 22px rgba(56, 189, 248, 0.2)",
    borderRadius: "12px",
    padding: "14px 16px",
    color: "#f8fafc",
    animation: "fadeIn 0.15s ease-out",
  },
  tooltipHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "10px",
  },
  tooltipTitleCol: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  tooltipCountryRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  tooltipIsoBadge: {
    backgroundColor: "#1e293b",
    color: "#38bdf8",
    fontSize: "10px",
    fontWeight: "800",
    padding: "2px 6px",
    borderRadius: "4px",
    fontFamily: "monospace",
    border: "1px solid rgba(56, 189, 248, 0.25)",
  },
  tooltipCountryName: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#ffffff",
  },
  tooltipYear: {
    fontSize: "11px",
    color: "#94a3b8",
    fontWeight: "600",
  },
  tooltipMetricBadge: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    backgroundColor: "rgba(2, 132, 199, 0.2)",
    border: "1px solid rgba(56, 189, 248, 0.4)",
    borderRadius: "6px",
    padding: "3px 8px",
  },
  tooltipMetricLabel: {
    fontSize: "9.5px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  tooltipMetricVal: {
    fontSize: "13px",
    fontWeight: "800",
    color: "#38bdf8",
  },
  ratioBarContainer: {
    marginBottom: "10px",
  },
  ratioBarTrack: {
    display: "flex",
    height: "6px",
    borderRadius: "3px",
    overflow: "hidden",
    backgroundColor: "#1e293b",
  },
  ratioBarExp: {
    backgroundColor: "#10b981",
    transition: "width 0.2s ease",
  },
  ratioBarImp: {
    backgroundColor: "#38bdf8",
    transition: "width 0.2s ease",
  },
  ratioLabels: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "4px",
  },
  ratioExpText: {
    fontSize: "10px",
    color: "#34d399",
    fontWeight: "600",
  },
  ratioImpText: {
    fontSize: "10px",
    color: "#38bdf8",
    fontWeight: "600",
  },
  tooltipGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginBottom: "8px",
  },
  tooltipChipGreen: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    borderRadius: "8px",
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  tooltipChipBlue: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    border: "1px solid rgba(56, 189, 248, 0.25)",
    borderRadius: "8px",
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  chipHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chipLabel: {
    fontSize: "9.5px",
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: "0.04em",
  },
  chipValGreen: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#10b981",
  },
  chipValBlue: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#38bdf8",
  },
  tooltipBalanceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: "8px",
    padding: "8px 10px",
  },
  balanceLeft: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  balanceLabel: {
    fontSize: "10.5px",
    fontWeight: "700",
    color: "#cbd5e1",
    letterSpacing: "0.03em",
  },
  balanceRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  balanceVal: {
    fontSize: "13px",
    fontWeight: "700",
  },
  balanceTag: {
    fontSize: "10px",
    fontWeight: "700",
    padding: "1px 6px",
    borderRadius: "4px",
    textTransform: "uppercase",
  },
  hoverDetailCard: {
    marginTop: "16px",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "14px 18px",
  },
  hoverDetailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
    fontSize: "13px",
  },
  hoverValueBadge: {
    backgroundColor: "#0284c7",
    color: "#ffffff",
    padding: "3px 10px",
    borderRadius: "4px",
    fontWeight: "700",
    fontSize: "12px",
  },
  hoverMetricsGrid: {
    display: "flex",
    gap: "24px",
    fontSize: "12px",
  },
  hoverLabel: {
    color: "#64748b",
    fontWeight: "600",
    marginRight: "6px",
  },
  hoverValGreen: {
    color: "#10b981",
    fontWeight: "600",
  },
  hoverValBlue: {
    color: "#38bdf8",
    fontWeight: "600",
  },
  matrixContainer: {
    overflowX: "auto",
  },
  matrixTopLeft: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    padding: "4px 8px",
  },
  matrixColHeader: {
    textAlign: "center",
    fontSize: "11px",
    fontWeight: "700",
    color: "#94a3b8",
    padding: "4px",
  },
  matrixRowHeader: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 8px",
  },
  matrixRowIso: {
    backgroundColor: "#0f172a",
    color: "#60a5fa",
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 5px",
    borderRadius: "3px",
  },
  matrixRowName: {
    fontSize: "11.5px",
    color: "#cbd5e1",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  matrixCell: {
    height: "38px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  matrixCellText: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#ffffff",
  },
  matrixCellTextSmall: {
    fontSize: "9.5px",
    fontWeight: "600",
    color: "#ffffff",
  },
  tableToolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 12px",
    minWidth: "320px",
  },
  searchInput: {
    backgroundColor: "transparent",
    border: "none",
    color: "#f8fafc",
    outline: "none",
    fontSize: "13px",
    width: "100%",
  },
  exportBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 14px",
    fontSize: "12.5px",
    fontWeight: "600",
    cursor: "pointer",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12.5px",
  },
  thRow: {
    borderBottom: "1px solid #334155",
  },
  thSortable: {
    padding: "10px 12px",
    textAlign: "left",
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.04em",
    cursor: "pointer",
  },
  thSortableRight: {
    padding: "10px 12px",
    textAlign: "right",
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.04em",
    cursor: "pointer",
  },
  tr: {
    borderBottom: "1px solid #1f2937",
    transition: "background-color 0.15s",
  },
  tdRank: {
    padding: "10px 12px",
    color: "#64748b",
    fontWeight: "700",
    fontSize: "11.5px",
  },
  tdName: {
    padding: "10px 12px",
    color: "#f8fafc",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  tableIsoBadge: {
    backgroundColor: "#1e293b",
    color: "#38bdf8",
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 6px",
    borderRadius: "4px",
    fontFamily: "monospace",
  },
  tdRight: {
    padding: "10px 12px",
    textAlign: "right",
    color: "#cbd5e1",
  },
  tdRightBold: {
    padding: "10px 12px",
    textAlign: "right",
    color: "#ffffff",
    fontWeight: "700",
  },
  tdRightGreen: {
    padding: "10px 12px",
    textAlign: "right",
    color: "#34d399",
  },
  tdRightBlue: {
    padding: "10px 12px",
    textAlign: "right",
    color: "#38bdf8",
  },
  tablePill: {
    padding: "3px 8px",
    borderRadius: "4px",
    fontWeight: "700",
    fontSize: "11px",
  },
};
