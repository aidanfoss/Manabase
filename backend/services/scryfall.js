/**
 * scryfall.js
 * ---------------------------------
 * Local Scryfall client wrapping the loaded bulk data.
 * No longer makes live HTTP requests to avoid rate limits.
 */

import { getLocalCardByName, getLocalCardsBatch } from "../routes/scryfallLocal.js";

function formatCard(card) {
    if (!card) return null;

    const basicTypes = ["Plains", "Island", "Swamp", "Mountain", "Forest"];
    const fetchable = basicTypes.some((b) => (card.type_line || "").includes(b));

    const latestPrice =
        parseFloat(card.prices?.usd) ||
        parseFloat(card.prices?.usd_foil) ||
        null;

    let lowestPrice = latestPrice;
    
    // Determine lowest price among all printings
    if (card.prints && card.prints.length > 0) {
        const allPrices = card.prints
            .map((p) =>
                Math.min(
                    parseFloat(p.prices?.usd) || Infinity,
                    parseFloat(p.prices?.usd_foil) || Infinity
                )
            )
            .filter((v) => isFinite(v));

        if (allPrices.length > 0) lowestPrice = Math.min(...allPrices);
    }

    const image =
        card.image_uris?.normal ||
        card.card_faces?.[0]?.image_uris?.normal ||
        null;

    return {
        name: card.name,
        oracle_id: card.oracle_id,
        type_line: card.type_line,
        color_identity: card.color_identity ?? [],
        fetchable,
        set: card.set,
        collector_number: card.collector_number,
        image,
        scryfall_uri: card.scryfall_uri,
        uri: card.scryfall_uri,
        url: card.scryfall_uri,
        rulings_uri: card.rulings_uri,
        purchase_uris: card.purchase_uris ?? {},
        prices: {
            latest: latestPrice,
            lowest: lowestPrice,
            usd: card.prices?.usd,
            usd_foil: card.prices?.usd_foil,
        },
        prints_uri: card.prints_search_uri,
        prints: card.prints || [],
    };
}

/** Fetch single card from local data */
export async function fetchCardData(name) {
    try {
        const localCard = await getLocalCardByName(name);
        if (!localCard) return null;
        return formatCard(localCard);
    } catch (err) {
        console.warn(`⚠️ Failed to fetch local card "${name}": ${err.message}`);
        return null;
    }
}

/** Batch helper */
export async function fetchCardsBatch(names = []) {
    const results = [];
    const batch = await getLocalCardsBatch(names);
    
    for (const name of names) {
        const localCard = batch[name];
        if (localCard) {
            results.push(formatCard(localCard));
        }
    }
    return results;
}

export { fetchCardData as getCardWithDetails };
