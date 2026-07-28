# Scryfall Tagger Maintenance Guide

This document is intended for future AI agents or developers who need to update or recreate the process of fetching Magic: The Gathering land cycles using the **Scryfall Tagger** taxonomy.

## Context

The `updateLandCycles.js` script populates our database of land cycles by directly querying Scryfall's API using Tagger community tags (e.g., `otag:cycle-shock-land`). Because the community frequently creates new tags for new sets, this list of cycle mother-tags may eventually become outdated.

## How to Discover New Land Cycles

If a user requests you to "add all new cycles" or recreate the process of finding the mother tags, follow this exact workflow:

### 1. Fetch the Oracle Tags Bulk Data
Scryfall's Tagger taxonomy is not exposed via a standard REST endpoint. It is packaged in their Bulk Data system.

1. Fetch the bulk data index: `https://api.scryfall.com/bulk-data` (Make sure to pass a custom `User-Agent` header, e.g. `ManabaseApp/1.0`).
2. Find the object where `type === "oracle_tags"`.
3. Fetch the `download_uri` from that object. This will return a massive JSON array of every tag in the Tagger system.

### 2. Recursively Crawl the Land Cycle Family Tree
Every tag has a `id`, `slug` (the queryable string, e.g., `cycle-shock-land`), and an array of `parent_ids`.

1. Find the absolute mother tag by searching for the tag where `slug === 'cycle-land'`.
2. Extract its `id`.
3. Write a recursive script to find every tag in the massive JSON array that contains this `id` in its `parent_ids` array. 
4. For every child tag you find, take its `id` and repeat the process to find its children, collecting all `slug`s in a `Set` until you've reached the bottom of the tree.
5. *(For reference, a script that does exactly this is preserved below).*

### 3. Update the Implementation
1. Review the generated list of slugs (e.g., `cycle-fetchland`, `cycle-isd-checkland`).
2. Filter the list to pick out the high-level mother tags that span multiple sets, rather than set-specific tags (e.g. prefer `cycle-checkland` over `cycle-isd-checkland`).
3. Inject these slugs into the `tiers` object inside `backend/scripts/updateLandCycles.js` with the `otag:` prefix (e.g., `otag:cycle-checkland`).

### 4. Execute with Rate Limit Backoff
When running `npm run update-cycles`, the script will make dozens of queries to Scryfall. **Scryfall aggressively enforces rate limits (429 Too Many Requests)**.

Ensure `updateLandCycles.js` has the following fail-safes:
- A `500ms` delay between all standard requests.
- A `15000ms` (15 second) exponential backoff pause if a `429` status code is received, followed by retrying the exact same URL. 

---

## Reference Crawler Script

You can run a script similar to this in the `scratch/` directory to automatically extract all cycle tags from Scryfall Tagger:

```javascript
const fs = require('fs/promises');

async function getTags() {
    console.log("Fetching bulk data index...");
    const res = await fetch("https://api.scryfall.com/bulk-data", {
        headers: { 'User-Agent': 'ManabaseApp/1.0', 'Accept': 'application/json' }
    });
    const data = await res.json();
    
    // 1. Locate the oracle tags bulk data
    const tagBulk = data.data.find(d => d.type === "oracle_tags");
    
    console.log("Downloading massive tag list...");
    const tagsRes = await fetch(tagBulk.download_uri, {
        headers: { 'User-Agent': 'ManabaseApp/1.0' }
    });
    const tagList = await tagsRes.json();
    
    // 2. Find the mother of all lands
    const motherTag = tagList.find(t => t.slug === 'cycle-land');
    
    // 3. Recursively map all descendants
    const descendants = new Set();
    const getChildren = (parentId) => {
        const children = tagList.filter(t => t.parent_ids && t.parent_ids.includes(parentId));
        for (const child of children) {
            if (!descendants.has(child.slug)) {
                descendants.add(child.slug);
                getChildren(child.id); // Recurse
            }
        }
    };
    
    getChildren(motherTag.id);
    
    console.log(`Found ${descendants.size} descendant tags.`);
    const output = Array.from(descendants);
    await fs.writeFile("all-cycle-tags.json", JSON.stringify(output, null, 2));
}

getTags();
```
