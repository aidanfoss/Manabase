import fetch from "node-fetch";

// In-memory cache for LotusVault results with 1-hour TTL
const lotusCache = new Map();
const TTL_MS = 60 * 60 * 1000;

export async function scrapeLotusCard(cardName) {
    if (!cardName || typeof cardName !== "string") {
        return { cardName: "", totalFound: 0, items: [] };
    }

    const trimmedName = cardName.trim();
    const cacheKey = trimmedName.toLowerCase();
    const cached = lotusCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < TTL_MS) {
        return cached.data;
    }

    console.log(`🌸 [LotusVault Scraper] Initiating paginated scrape for card: "${trimmedName}"`);
    try {
        const url = `https://www.lotusvault.com/ProductList.aspx?CategoryID=11&SearchText=${encodeURIComponent(trimmedName)}`;
        console.log(`🌸 [LotusVault Scraper] GET Page 1 URL: ${url}`);

        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });

        if (!res.ok) {
            console.error(`❌ [LotusVault Scraper] HTTP error ${res.status} for "${trimmedName}"`);
            return { cardName: trimmedName, totalFound: 0, items: [], error: `HTTP ${res.status}` };
        }

        let currentPageHtml = await res.text();
        const cookies = res.headers.get("set-cookie") || "";
        const items = [];
        const maxPagesToScrape = 3;

        for (let pageNum = 1; pageNum <= maxPagesToScrape; pageNum++) {
            const titleRegex = /<a[^>]*class=["']ProductTitleLink["'][^>]*title=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
            const matches = [...currentPageHtml.matchAll(titleRegex)];
            console.log(`🌸 [LotusVault Scraper] Page ${pageNum}: Found ${matches.length} items`);

            for (let i = 0; i < matches.length; i++) {
                const rawTitle = matches[i][1] || matches[i][2].replace(/&nbsp;/g, ' ').trim();
                const startPos = matches[i].index;
                const endPos = (i + 1 < matches.length) ? matches[i + 1].index : startPos + 3000;
                const block = currentPageHtml.substring(startPos, endPos);

                // Price
                const priceMatch = block.match(/\$([0-9]+\.[0-9]{2})/);
                const price = priceMatch ? parseFloat(priceMatch[1]) : null;

                // Detail link
                const linkMatch = matches[i][0].match(/href=["']([^"']*)["']/i);
                const link = linkMatch ? "https://www.lotusvault.com/" + linkMatch[1] : "";

                // Stock check
                const isButtonDisabled = block.includes("AddToCartButtonDisabled") || block.includes('disabled="disabled"');
                const hasAddToCartBtn = block.includes("AddToCartButton");
                const inStock = !isButtonDisabled && hasAddToCartBtn;

                // Foil check
                const lowerTitle = rawTitle.toLowerCase();
                const isFoil = lowerTitle.includes("(foil)") || lowerTitle.includes("(etched foil)") || lowerTitle.includes("foil");

                // Thumbnail Image
                const imgMatch = block.match(/src=["'](https:\/\/lvcdn\.azureedge\.net\/ProductImages\/[^"']+)["']/i);
                const image = imgMatch ? imgMatch[1] : "";

                console.log(`   [Pg ${pageNum} Item ${i + 1}/${matches.length}] "${rawTitle}"`);
                console.log(`      Price: ${price !== null ? '$' + price.toFixed(2) : 'N/A'} | InStock: ${inStock} | Foil: ${isFoil}`);

                items.push({
                    title: rawTitle,
                    price,
                    inStock,
                    isFoil,
                    link,
                    image
                });
            }

            // Check if next page button exists in currentPageHtml
            const hasNextPage = currentPageHtml.includes(`ctl00$ContentPlaceHolder1$Paging1$PagingButton${pageNum + 1}`) || currentPageHtml.includes(`Paging1$NextButton`);
            if (!hasNextPage || pageNum === maxPagesToScrape) break;

            const viewState = currentPageHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/)?.[1] || "";
            const viewStateGen = currentPageHtml.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/)?.[1] || "";
            const eventVal = currentPageHtml.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/)?.[1] || "";

            const params = new URLSearchParams();
            params.append("__EVENTTARGET", `ctl00$ContentPlaceHolder1$Paging1$PagingButton${pageNum + 1}`);
            params.append("__EVENTARGUMENT", "");
            params.append("__VIEWSTATE", viewState);
            if (viewStateGen) params.append("__VIEWSTATEGENERATOR", viewStateGen);
            if (eventVal) params.append("__EVENTVALIDATION", eventVal);

            const postRes = await fetch(url, {
                method: "POST",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Cookie": cookies
                },
                body: params.toString()
            });

            if (!postRes.ok) break;
            currentPageHtml = await postRes.text();
        }

        const inStockItems = items.filter(it => it.inStock && it.price !== null);
        const cheapestNonFoil = inStockItems.filter(it => !it.isFoil).sort((a, b) => a.price - b.price)[0] || null;
        const cheapestFoil = inStockItems.filter(it => it.isFoil).sort((a, b) => a.price - b.price)[0] || null;
        const cheapestOverall = inStockItems.sort((a, b) => a.price - b.price)[0] || null;

        console.log(`🌸 [LotusVault Scraper] Summary for "${trimmedName}":`);
        console.log(`   Parsed items: ${items.length} | In-stock: ${inStockItems.length}`);
        console.log(`   Cheapest overall: ${cheapestOverall ? '$' + cheapestOverall.price.toFixed(2) + ' (' + cheapestOverall.title + ')' : 'None (Out of Stock)'}`);
        console.log(`   Cheapest non-foil: ${cheapestNonFoil ? '$' + cheapestNonFoil.price.toFixed(2) + ' (' + cheapestNonFoil.title + ')' : 'None'}`);
        console.log(`   Cheapest foil: ${cheapestFoil ? '$' + cheapestFoil.price.toFixed(2) + ' (' + cheapestFoil.title + ')' : 'None'}`);

        const resultData = {
            cardName: trimmedName,
            totalFound: items.length,
            inStockCount: inStockItems.length,
            cheapestPrice: cheapestOverall ? cheapestOverall.price : null,
            cheapestNonFoilPrice: cheapestNonFoil ? cheapestNonFoil.price : null,
            cheapestFoilPrice: cheapestFoil ? cheapestFoil.price : null,
            cheapestItem: cheapestOverall,
            items
        };

        lotusCache.set(cacheKey, { data: resultData, timestamp: Date.now() });
        return resultData;

    } catch (err) {
        console.error(`❌ [LotusVault Scraper] Error scraping LotusVault for "${trimmedName}":`, err.message);
        return { cardName: trimmedName, totalFound: 0, items: [], error: err.message };
    }
}

export async function batchScrapeLotusCards(cardNames = []) {
    const results = {};
    for (const name of cardNames) {
        if (!name) continue;
        results[name] = await scrapeLotusCard(name);
    }
    return results;
}
