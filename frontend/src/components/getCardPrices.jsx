// utils/getCardPrices.js
export async function getCardPrices(cardName) {
    const apiUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`Scryfall fetch failed: ${response.status}`);
        const data = await response.json();

        const prices = {
            usd: parseFloat(data.prices.usd) || null,
            usdFoil: parseFloat(data.prices.usd_foil) || null,
            usdEtched: parseFloat(data.prices.usd_etched) || null,
            eur: parseFloat(data.prices.eur) || null,
            tix: parseFloat(data.prices.tix) || null,
        };

        // Find lowest available price (ignores nulls)
        const lowest = Math.min(...Object.values(prices).filter(p => p != null));
        return { prices, lowest, scryfallUri: data.scryfall_uri };
    } catch (err) {
        console.error(err);
        return { prices: {}, lowest: null };
    }
}
