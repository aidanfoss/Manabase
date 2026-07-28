import fetch from "node-fetch";

async function findCategories() {
    const res = await fetch("https://www.lotusvault.com/advanced_search.aspx", {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    });

    const html = await res.text();
// console.log("HTML length:", html.length);

    // Look for category select or category options
    const optionRegex = /<option[^>]*value=["']([0-9]+)["'][^>]*>([\s\S]*?)<\/option>/gi;
    const matches = [...html.matchAll(optionRegex)];

// console.log("Categories found:");
    matches.forEach(m => {
        const val = m[1];
        const text = m[2].replace(/&nbsp;/g, ' ').trim();
        if (text.toLowerCase().includes("magic") || text.toLowerCase().includes("singles") || text.toLowerCase().includes("card")) {
// console.log(`  ID: ${val} -> ${text}`);
        }
    });
}

findCategories().catch(console.error);
