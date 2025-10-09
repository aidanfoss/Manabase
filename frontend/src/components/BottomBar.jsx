import React, { useMemo } from "react";
import { resolveDisplayPrice } from "../utils/pricing";

export default function BottomBar({ data }) {
  const all = [...(data.lands || []), ...(data.nonlands || [])];

  const totals = useMemo(() => {
    const landCount = data.lands?.length || 0;
    const nonLandCount = data.nonlands?.length || 0;

    const totalValue = all.reduce((sum, c) => {
      const pr = resolveDisplayPrice(c);
      return sum + (pr ? pr.amount : 0);
    }, 0);

    return {
      landCount,
      nonLandCount,
      totalCount: landCount + nonLandCount,
      totalValue,
    };
  }, [data, all.length]);

  function copyShareLink() {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl);
    alert("🔗 Share link copied to clipboard!");
  }

  return (
    <div className="bottom-bar">
      <div className="bottom-bar-content">
        <span>💰 <b>Total Value:</b> ${totals.totalValue.toFixed(2)}</span>
        <span></span>
        <span>🌍 <b>Lands:</b> {totals.landCount}</span>
        <span></span>
        <span>🧩 <b>Non-Lands:</b> {totals.nonLandCount}</span>
        <span></span>
        <span>📦 <b>Total:</b> {totals.totalCount}</span>

        {/* Inline Share button directly after totals */}
        <button
          className="share-btn"
          onClick={copyShareLink}
          title="Copy share link"
          aria-label="Share"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </button>
      </div>
    </div>
  );
}