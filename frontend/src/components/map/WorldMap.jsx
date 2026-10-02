import React, { useState, useMemo, useRef, useCallback } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import worldGeoJson from "../../data/world-countries.json";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { MapTooltip } from "./MapTooltip";

export const WorldMap = ({
  countriesData = [],
  activeMetric = "total_trade", // "total_trade" | "trade_balance" | "exports" | "imports"
  selectedCountryIso = null,
  onSelectCountry,
}) => {
  // Pan and Zoom State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Hover & Tooltip State
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const svgRef = useRef(null);

  // Map Countries by ISO code for fast lookup
  const countriesByIso = useMemo(() => {
    const map = new Map();
    countriesData.forEach((c) => {
      map.set(c.iso_code, c);
    });
    return map;
  }, [countriesData]);

  // Pre-calculate projection and SVG paths
  const projection = useMemo(() => {
    return geoNaturalEarth1().scale(153).translate([480, 255]);
  }, []);

  const featurePaths = useMemo(() => {
    const pathGen = geoPath().projection(projection);
    return worldGeoJson.features.map((feature) => ({
      feature,
      iso: feature.id,
      name: feature.properties?.name || "Unknown",
      isMicro: feature.properties?.is_micro || false,
      d: pathGen(feature),
    }));
  }, [projection]);

  // Dynamic Color Quantiles for Active Metric
  const colorScales = useMemo(() => {
    const values = [];
    countriesData.forEach((c) => {
      if (activeMetric === "trade_balance") {
        values.push(c.trade_balance);
      } else {
        const val = c[activeMetric] || 0;
        if (val > 0) values.push(val);
      }
    });

    values.sort((a, b) => a - b);
    return values;
  }, [countriesData, activeMetric]);

  // Compute fill color for a given country ISO
  const getCountryFill = useCallback(
    (iso) => {
      const data = countriesByIso.get(iso);
      if (!data || data.total_trade === 0) {
        return "#1e293b"; // Muted Slate (No Data)
      }

      if (activeMetric === "trade_balance") {
        const bal = data.trade_balance;
        if (Math.abs(bal) < 1e-4) return "#334155";
        if (bal > 0) {
          // Surplus (Greens)
          if (bal > 1e11) return "#059669"; // > $100B
          if (bal > 2e10) return "#10b981"; // > $20B
          if (bal > 5e9) return "#34d399"; // > $5B
          return "#6ee7b7";
        } else {
          // Deficit (Reds)
          const absBal = Math.abs(bal);
          if (absBal > 1e11) return "#e11d48"; // > $100B
          if (absBal > 2e10) return "#f43f5e"; // > $20B
          if (absBal > 5e9) return "#fb7185"; // > $5B
          return "#fda4af";
        }
      }

      if (activeMetric === "exports") {
        const val = data.exports || 0;
        if (val > 1e12) return "#047857"; // > $1T
        if (val > 2e11) return "#059669"; // > $200B
        if (val > 5e10) return "#10b981"; // > $50B
        if (val > 1e10) return "#34d399"; // > $10B
        if (val > 1e9) return "#6ee7b7";  // > $1B
        return "#a7f3d0";
      }

      if (activeMetric === "imports") {
        const val = data.imports || 0;
        if (val > 1e12) return "#1d4ed8"; // > $1T
        if (val > 2e11) return "#2563eb"; // > $200B
        if (val > 5e10) return "#3b82f6"; // > $50B
        if (val > 1e10) return "#60a5fa"; // > $10B
        if (val > 1e9) return "#93c5fd";  // > $1B
        return "#bfdbfe";
      }

      // Default: Total Trade Volume (Sequential Blues/Cyans)
      const tot = data.total_trade || 0;
      if (tot > 2e12) return "#0284c7"; // > $2T
      if (tot > 5e11) return "#0369a1"; // > $500B
      if (tot > 1e11) return "#0284c7"; // > $100B
      if (tot > 2e10) return "#38bdf8"; // > $20B
      if (tot > 5e9) return "#7dd3fc";  // > $5B
      return "#bae6fd";
    },
    [countriesByIso, activeMetric]
  );

  // Zoom / Pan Handlers
  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.35, 8));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.35, 0.9));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleCountryHover = (iso, name) => {
    const data = countriesByIso.get(iso) || {
      iso_code: iso,
      country_name: name,
      total_trade: 0,
      exports: 0,
      imports: 0,
      trade_balance: 0,
      trade_balance_status: "No Data",
      has_granular_data: false,
    };
    setHoveredCountry(data);
  };

  const handleCountryLeave = () => {
    setHoveredCountry(null);
  };

  const handleCountryClick = (iso, name) => {
    const data = countriesByIso.get(iso) || {
      iso_code: iso,
      country_name: name,
      total_trade: 0,
      exports: 0,
      imports: 0,
      trade_balance: 0,
      trade_balance_status: "No Data",
      has_granular_data: false,
    };
    if (onSelectCountry) {
      onSelectCountry(data);
    }
  };

  return (
    <div style={styles.mapWrapper}>
      {/* Map Control Toolbar */}
      <div style={styles.controlsBar}>
        <div style={styles.zoomButtonGroup}>
          <button style={styles.controlBtn} onClick={handleZoomIn} title="Zoom In (+)">
            <ZoomIn size={16} />
          </button>
          <button style={styles.controlBtn} onClick={handleZoomOut} title="Zoom Out (-)">
            <ZoomOut size={16} />
          </button>
          <button style={styles.controlBtn} onClick={handleReset} title="Reset View">
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div
        style={{
          ...styles.svgContainer,
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setHoveredCountry(null);
        }}
      >
        <svg
          ref={svgRef}
          data-testid="world-map-svg"
          viewBox="0 0 960 500"
          style={styles.svg}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background Ocean Fill */}
          <rect width="960" height="500" fill="#0b1329" />

          {/* Map Group with Pan & Zoom Transform */}
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{ transition: isDragging ? "none" : "transform 0.15s ease-out" }}
          >
            {featurePaths.map(({ iso, name, d, isMicro }) => {
              if (!d) return null;
              const isSelected = selectedCountryIso === iso;
              const isHovered = hoveredCountry?.iso_code === iso;
              const fillColor = getCountryFill(iso);

              return (
                <path
                  key={iso}
                  data-testid={`country-path-${iso}`}
                  data-country-path="true"
                  data-iso={iso}
                  d={d}
                  fill={isHovered ? "#38bdf8" : fillColor}
                  stroke={isSelected ? "#ffffff" : isHovered ? "#38bdf8" : "#334155"}
                  strokeWidth={
                    isSelected
                      ? 2.2 / zoom
                      : isHovered
                      ? 1.4 / zoom
                      : 0.6 / zoom
                  }
                  strokeLinejoin="round"
                  style={{
                    cursor: "pointer",
                    transition: "fill 0.15s ease, stroke 0.15s ease",
                  }}
                  onMouseEnter={() => handleCountryHover(iso, name)}
                  onMouseLeave={handleCountryLeave}
                  onClick={() => handleCountryClick(iso, name)}
                />
              );
            })}
          </g>
        </svg>
      </div>

      {/* Floating Tooltip */}
      {hoveredCountry && (
        <MapTooltip
          country={hoveredCountry}
          position={mousePos}
          activeMetric={activeMetric}
        />
      )}
    </div>
  );
};

const styles = {
  mapWrapper: {
    position: "relative",
    width: "100%",
    height: "560px",
    backgroundColor: "#0b1329",
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid #1e293b",
    boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.4)",
  },
  controlsBar: {
    position: "absolute",
    top: "16px",
    left: "16px",
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  zoomButtonGroup: {
    display: "flex",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    backdropFilter: "blur(6px)",
    borderRadius: "8px",
    border: "1px solid #334155",
    overflow: "hidden",
  },
  controlBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: "#cbd5e1",
    padding: "8px 10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRight: "1px solid #334155",
    transition: "background 0.15s, color 0.15s",
  },
  legendBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    border: "1px solid rgba(245, 158, 11, 0.35)",
    color: "#fbbf24",
    fontSize: "11px",
    fontWeight: "600",
    padding: "6px 10px",
    borderRadius: "6px",
    backdropFilter: "blur(6px)",
  },
  svgContainer: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  svg: {
    width: "100%",
    height: "100%",
    userSelect: "none",
  },
};
