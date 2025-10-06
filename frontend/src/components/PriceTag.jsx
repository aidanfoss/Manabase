// components/PriceTag.jsx
import React, { useState, useEffect } from "react";
import { getCardPrices } from "@/utils/getCardPrices";

export default function PriceTag({ cardName }) {
    const [prices, setPrices] = useState({});
    const [lowest, setLowest] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        getCardPrices(cardName).then(({ prices, lowest }) => {
            setPrices(prices);
            setLowest(lowest);
        });
    }, [cardName]);

    if (!lowest) return null;

    return (
        <div
            className="absolute bottom-2 right-2 bg-blue-500/90 text-white text-xs px-2 py-1 rounded-md shadow-md
                 transform transition-transform duration-200 origin-bottom-right group-hover:scale-110"
            onMouseEnter={() => setShowDetails(true)}
            onMouseLeave={() => setShowDetails(false)}
            style={{ pointerEvents: "auto" }}
        >
            ${lowest.toFixed(2)}

            {showDetails && (
                <div className="absolute bottom-full right-0 mb-2 w-40 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-2 z-50">
                    <p className="font-semibold mb-1">{cardName}</p>
                    {Object.entries(prices).map(([k, v]) =>
                        v ? (
                            <div key={k} className="flex justify-between">
                                <span>{k.replace("usd", "USD ").replace("_", " ").trim()}</span>
                                <span>${v.toFixed(2)}</span>
                            </div>
                        ) : null
                    )}
                </div>
            )}
        </div>
    );
}
