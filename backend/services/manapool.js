import fetch from "node-fetch";

export async function optimizeManaPoolCart(cardItems = [], options = {}) {
    if (!Array.isArray(cardItems) || cardItems.length === 0) {
        return {
            error: "No card items provided for optimization",
            totals: { subtotal_cents: 0, shipping_cents: 0, buyer_fee_cents: 0, total_cents: 0, seller_count: 0 }
        };
    }

    const payload = {
        cart: cardItems.map(item => {
            const cardName = typeof item === "string" ? item : (item.card_name || item.name || item.title || "");
            const quantity = typeof item === "object" ? (item.quantity || item.qty || item.count || 1) : 1;
            const isFoil = typeof item === "object" ? Boolean(item.isFoil || item.is_foil || item.finish === "foil") : false;

            return {
                quantity_requested: quantity,
                type: "mtg_single",
                name: cardName,
                language_ids: options.languages || ["EN"],
                finish_ids: isFoil ? ["FO", "EF"] : ["NF"],
                condition_ids: options.conditions || ["NM", "LP", "MP"]
            };
        }).filter(item => Boolean(item.name)),
        model: options.model || "lowest_price",
        destination_country: options.destinationCountry || "US"
    };

    try {
        const res = await fetch("https://manapool.com/api/v1/buyer/optimizer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            try {
                const parsedErr = JSON.parse(errText);
                if (res.status === 409) {
                    const unavailableNames = (parsedErr.details || [])
                        .map(d => d.item?.name)
                        .filter(Boolean);
                    const nameStr = unavailableNames.length > 0 ? `: ${unavailableNames.join(", ")}` : "";
                    return { error: `One or more cards currently out of stock on ManaPool marketplace${nameStr}`, status: 409, totals: null };
                }
                return { error: parsedErr.message || `ManaPool API error (${res.status})`, totals: null };
            } catch (e) {
                return { error: `ManaPool API error (${res.status}): ${errText}`, totals: null };
            }
        }

        const rawText = await res.text();
        const lines = rawText.trim().split("\n").filter(Boolean);
        const parsedChunks = lines.map(line => {
            try { return JSON.parse(line); } catch (e) { return null; }
        }).filter(Boolean);

        if (parsedChunks.length === 0) {
            return { error: "No optimization results returned from ManaPool API", totals: null };
        }

        const finalResult = parsedChunks[parsedChunks.length - 1];
        const totals = finalResult.totals || {};

        return {
            success: true,
            subtotal: (totals.subtotal_cents / 100).toFixed(2),
            shipping: (totals.shipping_cents / 100).toFixed(2),
            fees: (totals.buyer_fee_cents / 100).toFixed(2),
            total: (totals.total_cents / 100).toFixed(2),
            sellerCount: totals.seller_count || 0,
            itemCount: cardItems.length,
            cart: finalResult.cart || [],
            rawTotals: totals
        };

    } catch (err) {
        console.error("⚠️ Error calling ManaPool optimizer:", err.message);
        return { error: err.message, totals: null };
    }
}
