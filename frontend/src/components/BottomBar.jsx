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

  return (
    <div className="bottom-bar">
      <div className="bottom-bar-content">
        <span>💰 <b>Total Value:</b> ${totals.totalValue.toFixed(2)}</span>
        <span>|</span>
        <span>🌍 <b>Lands:</b> {totals.landCount}</span>
        <span>|</span>
        <span>🧩 <b>Non-Lands:</b> {totals.nonLandCount}</span>
        <span>|</span>
        <span>📦 <b>Total:</b> {totals.totalCount}</span>
      </div>
    </div>
  );
}
