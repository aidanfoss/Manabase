import React, { useEffect, useState } from "react";

// === Helper: Fetch and cache the cheapest USD-based printing ===
const priceCache = {}; // in-memory cache

function loadCacheFromStorage() {
    try {
        const cached = localStorage.getItem("scryfallPriceCache");
        if (cached) {
            const parsed = JSON.parse(cached);
            const now = Date.now();
            for (const [k, v] of Object.entries(parsed)) {
                if (now - v.timestamp < 24 * 60 * 60 * 1000) {
                    priceCache[k] = v.data;
                }
            }
        }
    } catch (err) {
        console.warn("Failed to load cache:", err);
    }
}

function saveCacheToStorage() {
    try {
        const data = {};
        const now = Date.now();
        for (const [k, v] of Object.entries(priceCache)) {
            data[k] = { data: v, timestamp: now };
        }
        localStorage.setItem("scryfallPriceCache", JSON.stringify(data));
    } catch (err) {
        console.warn("Failed to save cache:", err);
    }
}

// Load cache immediately
loadCacheFromStorage();

async function getCardPrices(cardName) {
    if (priceCache[cardName]) return priceCache[cardName];

    async function fetchPrintings() {
        const res = await fetch(
            `https://api.scryfall.com/cards/search?q=unique%3Aprints+%21${encodeURIComponent(cardName)}`
        );
        if (!res.ok) throw new Error("Failed to fetch printings");
        const data = await res.json();
        return data.data;
    }

    try {
        const res = await fetch(
            `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`
        );
        const main = await res.json();

        const printings = [main, ...(await fetchPrintings())];

        let cheapest = null;
        let cheapestPrice = Infinity;
        let cheapestPrices = {};
        let cheapestSet = "";
        let cheapestImage = main.image_uris?.normal || null;

        for (const p of printings) {
            if (!p || !p.prices) continue;
            const { usd, usd_foil, usd_etched } = p.prices;
            const validPrices = [usd, usd_foil, usd_etched]
                .map((v) => (v ? parseFloat(v) : null))
                .filter((v) => v !== null);
            if (!validPrices.length) continue;

            const localMin = Math.min(...validPrices);
            if (localMin < cheapestPrice) {
                cheapestPrice = localMin;
                cheapest = p;
                cheapestSet = p.set_name;
                cheapestImage = p.image_uris?.normal || p.image_uris?.large || cheapestImage;
                cheapestPrices = {
                    usd: usd ? parseFloat(usd) : null,
                    usdFoil: usd_foil ? parseFloat(usd_foil) : null,
                    usdEtched: usd_etched ? parseFloat(usd_etched) : null,
                };
            }
        }

        if (!cheapest) return { prices: {}, lowest: null };

        const result = {
            prices: cheapestPrices,
            lowest: cheapestPrice,
            set: cheapestSet,
            image: cheapestImage,
        };

        priceCache[cardName] = result;
        saveCacheToStorage();
        return result;
    } catch (err) {
        console.error(`Failed to fetch prices for ${cardName}:`, err);
        return { prices: {}, lowest: null };
    }
}

export default function CardDisplay({
    selectedColors,
    activeCycles,
    activeMetas,
    sectionName,
}) {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(false);

    async function fetchCardList(entries) {
        const results = [];
        for (const entry of entries) {
            const name = typeof entry === "string" ? entry : entry.name;
            const note = typeof entry === "object" ? entry.note : null;

            try {
                const res = await fetch(
                    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
                );
                const data = await res.json();
                if (!data.error) {
                    data._note = note;

                    const { prices, lowest, set, image } = await getCardPrices(name);
                    data._lowestUsd = lowest;
                    data._prices = prices;
                    data._lowestSet = set;
                    data._cheapestImage = image;

                    results.push(data);
                }
            } catch (err) {
                console.warn(`Failed to fetch ${name}:`, err);
            }
        }
        return results;
    }

    useEffect(() => {
        async function buildDisplay() {
            setLoading(true);
            let allEntries = [];

            try {
                if (sectionName === "Lands") {
                    for (const cycle of activeCycles) {
                        const res = await fetch(`http://localhost:8080/api/landcycles/${cycle}`);
                        if (!res.ok) continue;
                        const data = await res.json();
                        if (Array.isArray(data.cards)) allEntries.push(...data.cards);
                    }
                }

                if (sectionName === "Staples") {
                    for (const m of activeMetas) {
                        const res = await fetch(`http://localhost:8080/api/metas/${m}`);
                        if (!res.ok) continue;
                        const data = await res.json();
                        if (Array.isArray(data.staples)) allEntries.push(...data.staples);
                    }
                }

                if (sectionName === "Sideboard") {
                    for (const m of activeMetas) {
                        const res = await fetch(`http://localhost:8080/api/metas/${m}`);
                        if (!res.ok) continue;
                        const data = await res.json();
                        if (Array.isArray(data.sideboard)) allEntries.push(...data.sideboard);
                    }
                }

                // Deduplicate
                const uniqueEntries = [];
                const names = new Set();
                for (const entry of allEntries) {
                    const name = typeof entry === "string" ? entry : entry.name;
                    if (!names.has(name)) {
                        names.add(name);
                        uniqueEntries.push(entry);
                    }
                }

                const fetched = await fetchCardList(uniqueEntries);

                const filtered = fetched.filter((c) => {
                    const id = c.color_identity || [];
                    return id.length === 0 || id.every((x) => selectedColors.includes(x));
                });

                setCards(filtered);
            } catch (err) {
                console.error("Error building display:", err);
            } finally {
                setLoading(false);
            }
        }

        buildDisplay();
    }, [selectedColors, activeCycles, activeMetas, sectionName]);

    if (loading)
        return (
            <div className="p-4">
                <h2 className="text-xl font-semibold mb-2 border-b border-gray-700 pb-1">
                    {sectionName}
                </h2>
                <p className="text-center text-sm text-gray-400">
                    Loading {sectionName}...
                </p>
            </div>
        );

    if (!cards.length) return null;

    return (
        <div className="p-4">
            <h2 className="text-xl font-semibold mb-2 border-b border-gray-700 pb-1">
                {sectionName}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {cards.map((c, i) => (
                    <div key={i} className="relative group">
                        {/* === Card Image + Tag wrapper === */}
                        <div className="transition-transform transform group-hover:scale-105">
                            <div className="relative">
                                <a
                                    href={c.scryfall_uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <img
                                        src={c._cheapestImage || c.image_uris?.normal}
                                        alt={c.name}
                                        className="rounded-lg shadow-lg w-full h-auto"
                                    />
                                </a>

                                {/* === Price Tag === */}
                                {c._lowestUsd !== null && c._lowestUsd !== undefined ? (
                                    <div className="absolute bottom-1 right-1 flex flex-col items-end">
                                        <div className="relative group/price z-10">
                                            <div
                                                className="bg-blue-600 bg-opacity-90 text-white text-[10px] px-2 py-[2px] rounded-full font-semibold cursor-help select-none
                                   transform transition-transform duration-200 origin-bottom-right group-hover:scale-105"
                                                title="Prices from Scryfall"
                                            >
                                                ${c._lowestUsd ? c._lowestUsd.toFixed(2) : "—"}
                                            </div>

                                            {c._prices && Object.values(c._prices).some((v) => v) && (
                                                <div className="absolute hidden group-hover/price:block z-30 bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded-md p-2 w-48 bottom-5 right-0 shadow-lg">
                                                    <div className="font-bold mb-1">{c.name}</div>
                                                    {Object.entries(c._prices).map(([k, v]) =>
                                                        v ? (
                                                            <div key={k} className="flex justify-between">
                                                                <span>
                                                                    {k === "usd"
                                                                        ? "Nonfoil"
                                                                        : k === "usdFoil"
                                                                            ? "Foil"
                                                                            : "Etched"}
                                                                </span>
                                                                <span>${v.toFixed(2)}</span>
                                                            </div>
                                                        ) : null
                                                    )}
                                                    {c._lowestSet && (
                                                        <div className="text-gray-400 mt-1">
                                                            Cheapest set: {c._lowestSet}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {/* Card Title Below Image */}
                            <p className="text-center text-sm mt-1">{c.name}</p>
                        </div>

                        {/* === Note Tooltip === */}
                        {c._note && (
                            <div className="absolute top-1 right-1">
                                <div className="relative group/note">
                                    <div className="bg-gray-700 bg-opacity-80 rounded-full w-5 h-5 flex items-center justify-center text-gray-200 text-xs font-bold cursor-help">
                                        ?
                                    </div>
                                    <div className="absolute z-10 hidden group-hover/note:block w-52 text-xs text-gray-200 bg-gray-900 border border-gray-700 rounded-lg p-2 shadow-lg -left-52 top-0">
                                        {c._note}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
