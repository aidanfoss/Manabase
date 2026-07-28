/**
 * scryfall.js
 * ---------------------------------
 * Local Scryfall client wrapping the loaded bulk data.
 * No longer makes live HTTP requests to avoid rate limits.
 */

import fetch from "node-fetch";
import { getLocalCardByName, getLocalCardsBatch } from "../routes/scryfallLocal.js";

function formatCard(card) {
    if (!card) return null;

    const basicTypes = ["Plains", "Island", "Swamp", "Mountain", "Forest"];
    const fetchable = basicTypes.some((b) => (card.type_line || "").includes(b));

    const usd = parseFloat(card.prices?.usd);
    const usdFoil = parseFloat(card.prices?.usd_foil);
    const usdEtched = parseFloat(card.prices?.usd_etched);

    let latestPrice = (!isNaN(usd) && usd > 0) ? usd :
                      (!isNaN(usdFoil) && usdFoil > 0) ? usdFoil :
                      (!isNaN(usdEtched) && usdEtched > 0) ? usdEtched : null;

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
            .filter((v) => isFinite(v) && v > 0);

        if (allPrices.length > 0) lowestPrice = Math.min(...allPrices);
    }

    if (!latestPrice && lowestPrice) {
        latestPrice = lowestPrice;
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
            latest: latestPrice || 0,
            lowest: lowestPrice || 0,
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
        console.warn(`️ Failed to fetch local card "${name}": ${err.message}`);
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

/**
 * Perform a batch price check to the Scryfall API for a list of items.
 * Items format: [{ card_name, set_code, collector_number, is_foil }]
 * Returns array of items updated with a `price` field (number).
 */
export async function fetchBatchPricesFromScryfall(items = []) {
    if (!items || items.length === 0) return [];

    const itemsCopy = items.map(item => ({ ...item }));
    const cardNames = [...new Set(itemsCopy.map(i => i.card_name || i.name).filter(Boolean))];
    
    // Get local cards batch as immediate fallback
    let localBatch = {};
    try {
        localBatch = await getLocalCardsBatch(cardNames);
    } catch (err) {
        console.warn("️ Failed to load local batch for fallback:", err.message);
    }

    const scryfallResultsMap = new Map(); // key -> scryfall card object

    // Primary identifiers (with set code if available)
    const primaryIdentifiers = itemsCopy.map(item => {
        const cardName = item.card_name || item.name;
        const setCode = (item.set_code || "").trim().toLowerCase();
        const collectorNumber = (item.collector_number || "").trim();

        if (setCode && collectorNumber) {
            return { set: setCode, collector_number: collectorNumber };
        } else if (setCode) {
            return { name: cardName, set: setCode };
        } else {
            return { name: cardName };
        }
    });

    const executeQuery = async (identifiersList) => {
        const chunkSize = 75;
        const notFoundList = [];
        for (let i = 0; i < identifiersList.length; i += chunkSize) {
            const chunk = identifiersList.slice(i, i + chunkSize);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            try {
                const res = await fetch("https://api.scryfall.com/cards/collection", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "User-Agent": "Manabase/1.0"
                    },
                    body: JSON.stringify({ identifiers: chunk }),
                    signal: controller.signal
                }).finally(() => clearTimeout(timeoutId));

                if (res.ok) {
                    const body = await res.json();
                    if (body && Array.isArray(body.data)) {
                        body.data.forEach(card => {
                            if (card && card.name) {
                                scryfallResultsMap.set(card.name.toLowerCase(), card);
                                if (card.set && card.collector_number) {
                                    scryfallResultsMap.set(`${card.set.toLowerCase()}:${card.collector_number.toLowerCase()}`, card);
                                }
                                if (card.set) {
                                    scryfallResultsMap.set(`${card.name.toLowerCase()}:${card.set.toLowerCase()}`, card);
                                }
                            }
                        });
                    }
                    if (body && Array.isArray(body.not_found)) {
                        body.not_found.forEach(nf => {
                            if (nf && nf.name) {
                                notFoundList.push(nf.name);
                            }
                        });
                    }
                }
            } catch (err) {
                console.warn(`️ Scryfall API batch collection query failed: ${err.message}`);
            }
        }
        return notFoundList;
    };

    try {
        const notFoundNames = await executeQuery(primaryIdentifiers);

        // Secondary fallback query by name only for any cards not found by set code
        const unresolvedNames = cardNames.filter(name => !scryfallResultsMap.has(name.toLowerCase()));
        const nameIdentifiersToQuery = [...new Set([...notFoundNames, ...unresolvedNames])].map(name => ({ name }));

        if (nameIdentifiersToQuery.length > 0) {
            await executeQuery(nameIdentifiersToQuery);
        }
    } catch (err) {
        console.warn(`️ Scryfall API batch price check failed: ${err.message}`);
    }

    // Attach prices to each item (printing-specific and market-low)
    return itemsCopy.map(item => {
        const cardName = (item.card_name || item.name || "").toLowerCase();
        const setCode = (item.set_code || "").trim().toLowerCase();
        const collectorNumber = (item.collector_number || "").trim().toLowerCase();
        const isFoil = !!item.is_foil;

        let scryfallCard = null;
        if (setCode && collectorNumber) {
            scryfallCard = scryfallResultsMap.get(`${setCode}:${collectorNumber}`);
        }
        if (!scryfallCard && setCode) {
            scryfallCard = scryfallResultsMap.get(`${cardName}:${setCode}`);
        }
        if (!scryfallCard) {
            scryfallCard = scryfallResultsMap.get(cardName);
        }

        const localCard = localBatch[item.card_name || item.name];

        let resolvedSetCode = (item.set_code || "").trim().toUpperCase();
        let resolvedCollectorNumber = (item.collector_number || "").trim();

        if (scryfallCard && scryfallCard.set) {
            const scryfallSet = scryfallCard.set.toUpperCase();
            if (!setCode || !scryfallResultsMap.get(`${cardName}:${setCode}`)) {
                resolvedSetCode = scryfallSet;
            }
            if (!resolvedCollectorNumber && scryfallCard.collector_number) {
                resolvedCollectorNumber = scryfallCard.collector_number;
            }
        } else if (localCard && localCard.set) {
            if (!resolvedSetCode) {
                resolvedSetCode = localCard.set.toUpperCase();
            }
        }

        let price = 0;
        if (scryfallCard && scryfallCard.prices) {
            const usdFoil = parseFloat(scryfallCard.prices.usd_foil);
            const usd = parseFloat(scryfallCard.prices.usd);
            const usdEtched = parseFloat(scryfallCard.prices.usd_etched);
            const eur = parseFloat(scryfallCard.prices.eur);

            if (isFoil) {
                price = (!isNaN(usdFoil) && usdFoil > 0) ? usdFoil :
                        (!isNaN(usd) && usd > 0) ? usd :
                        (!isNaN(usdEtched) && usdEtched > 0) ? usdEtched :
                        (!isNaN(eur) && eur > 0) ? eur : 0;
            } else {
                price = (!isNaN(usd) && usd > 0) ? usd :
                        (!isNaN(usdFoil) && usdFoil > 0) ? usdFoil :
                        (!isNaN(usdEtched) && usdEtched > 0) ? usdEtched :
                        (!isNaN(eur) && eur > 0) ? eur : 0;
            }
        }

        // Calculate Market Low (lowest price among all available printings)
        let marketLow = 0;
        if (scryfallCard && scryfallCard.prices) {
            const pUsd = parseFloat(scryfallCard.prices.usd);
            const pFoil = parseFloat(scryfallCard.prices.usd_foil);
            const valids = [pUsd, pFoil].filter(p => !isNaN(p) && p > 0);
            if (valids.length > 0) marketLow = Math.min(...valids);
        }

        if (localCard) {
            const formatted = formatCard(localCard);
            const lowest = formatted?.prices?.lowest || formatted?.prices?.latest || 0;
            if (lowest > 0) {
                marketLow = marketLow > 0 ? Math.min(marketLow, lowest) : lowest;
            }
            if (localCard.prints && localCard.prints.length > 0) {
                const printPrices = localCard.prints
                    .map(p => Math.min(parseFloat(p.prices?.usd) || Infinity, parseFloat(p.prices?.usd_foil) || Infinity))
                    .filter(p => isFinite(p) && p > 0);
                if (printPrices.length > 0) {
                    const minPrintPrice = Math.min(...printPrices);
                    marketLow = marketLow > 0 ? Math.min(marketLow, minPrintPrice) : minPrintPrice;
                }
            }
        }

        // Fallback: If printing specific price is 0, fallback to marketLow or market_price
        if (price === 0) {
            price = marketLow;
        }
        if (price === 0 && item.market_price) {
            price = parseFloat(item.market_price) || 0;
        }
        if (marketLow === 0) {
            marketLow = price;
        }

        // Apply proxy override for trades and price fetching
        if (item.is_proxy || item.list_type === 'proxy') {
            price = 0.25;
            marketLow = 0.25;
        }

        return {
            ...item,
            set_code: resolvedSetCode,
            collector_number: resolvedCollectorNumber,
            price: Number(price.toFixed(2)),
            market_price: Number(price.toFixed(2)),
            market_low: Number(marketLow.toFixed(2))
        };
    });
}

export { fetchCardData as getCardWithDetails };

