import React from "react";

export default function BottomBar({ data }) {
    // Flatten all cards
    const allCards = [...(data.lands || []), ...(data.nonlands || [])];

    // Count totals
    const landCount = data.lands?.length || 0;
    const nonLandCount = data.nonlands?.length || 0;
    const totalCount = landCount + nonLandCount;

    // Sum lowest prices (from card or its prints)
    const totalValue = allCards.reduce((sum, c) => {
        let price = null;
        // try to find numeric price (nonfoil preferred)
        if (c.prices?.usd) price = parseFloat(c.prices.usd);
        else if (c.prices?.usd_foil) price = parseFloat(c.prices.usd_foil);
        else if (c.prints?.[0]?.prices?.usd) price = parseFloat(c.prints[0].prices.usd);
        if (price && !isNaN(price)) sum += price;
        return sum;
    }, 0);

    return (
        <div className="bottom-bar">
            <div className="bottom-bar-content">
                <span>💰 <b>Total Value:</b> ${totalValue.toFixed(2)}</span>
                <span>|</span>
                <span>🌍 <b>Lands:</b> {landCount}</span>
                <span>|</span>
                <span>🧩 <b>Non-Lands:</b> {nonLandCount}</span>
                <span>|</span>
                <span>📦 <b>Total:</b> {totalCount}</span>
            </div>
        </div>
    );
}
