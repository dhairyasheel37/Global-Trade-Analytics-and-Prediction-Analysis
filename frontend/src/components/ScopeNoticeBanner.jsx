import React, { useState, useEffect } from "react";
import { Info, X } from "lucide-react";
import api from "../api/client";

export default function ScopeNoticeBanner() {
  const [showNotice, setShowNotice] = useState(true);
  const [noticeText, setNoticeText] = useState(
    "Granular partner- and product-level data is available for 4 of 190 reporters (China, Germany, India, USA), covering 5 partner countries and 4 product categories. The remaining 186 reporters have only aggregate World/TOTAL data."
  );

  useEffect(() => {
    let mounted = true;
    const fetchScope = async () => {
      try {
        const res = await api.get("/dashboard/scope");
        if (mounted && res.data) {
          if (!res.data.granular_reporters_count) {
            setShowNotice(false);
            return;
          }
          if (res.data.notice) {
            setNoticeText(res.data.notice);
          } else if (res.data.granular_reporters_count) {
            const repList = (res.data.granular_reporters || []).join(", ");
            setNoticeText(
              `Granular partner- and product-level data is available for ${res.data.granular_reporters_count} of ${res.data.total_reporters_count} reporters (${repList}), covering ${res.data.distinct_partners_count} partner countries and ${res.data.distinct_products_count} HS product categories. The remaining ${res.data.aggregate_only_reporters_count} reporters have only aggregate World/TOTAL data.`
            );
          }
        }
      } catch (err) {
        // graceful fallback to static verified message
      }
    };
    fetchScope();
    return () => {
      mounted = false;
    };
  }, []);

  if (!showNotice) return null;

  return (
    <div style={styles.noticeBanner} data-testid="scope-notice-banner">
      <div style={styles.noticeContent}>
        <Info size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
        <span style={styles.noticeText} data-testid="scope-notice-text">
          <strong style={{ color: "#38bdf8", marginRight: "6px" }}>Dataset Scope Notice:</strong>
          {noticeText}
        </span>
      </div>
      <button onClick={() => setShowNotice(false)} style={styles.closeNoticeBtn} title="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}

const styles = {
  noticeBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(14, 165, 233, 0.08)",
    border: "1px solid rgba(56, 189, 248, 0.25)",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "20px",
    gap: "12px",
    boxSizing: "border-box",
    maxWidth: "100%",
  },
  noticeContent: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    flex: 1,
    minWidth: 0,
  },
  noticeText: {
    color: "#cbd5e1",
    fontSize: "13px",
    lineHeight: "1.5",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  closeNoticeBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
    transition: "color 0.15s ease",
    flexShrink: 0,
  },
};
