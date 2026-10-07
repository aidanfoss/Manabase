import axios from "axios";
import { db } from "../db/connection.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STRICTLY_BETTER_FILE = path.join(__dirname, "../data/strictly_better_cache.json");

let strictlyBetterCache = null;
let isFetchingCache = false;

/**
 * Downloads all pages from strictlybetter.eu/api/obsoletes and saves them.
 * This is done in the background to avoid rate limits and slow requests.
 */
export async function syncStrictlyBetterData() {
  if (isFetchingCache) return;
  isFetchingCache = true;

  try {
    console.log("Starting strictly better sync...");
    let allObsoletes = [];
    let page = 1;
    let totalPages = 1;

    // Fetch first page to get total pages
    const firstPage = await axios.get(`https://www.strictlybetter.eu/api/obsoletes?page=${page}`);
    totalPages = firstPage.data.last_page;
    allObsoletes = allObsoletes.concat(firstPage.data.data);

    // Limit to 50 pages for now to avoid taking too long during initial boot
    const limit = Math.min(totalPages, 50); 
    for (page = 2; page <= limit; page++) {
      const res = await axios.get(`https://www.strictlybetter.eu/api/obsoletes?page=${page}`);
      allObsoletes = allObsoletes.concat(res.data.data);
    }

    fs.writeFileSync(STRICTLY_BETTER_FILE, JSON.stringify(allObsoletes, null, 2));
    strictlyBetterCache = allObsoletes;
    console.log(`Synced ${allObsoletes.length} strictly better relationships.`);
  } catch (error) {
    console.error("Failed to sync strictly better data:", error.message);
  } finally {
    isFetchingCache = false;
  }
}

/**
 * Loads the strictly better cache from disk.
 */
function loadStrictlyBetterCache() {
  if (strictlyBetterCache) return strictlyBetterCache;
  if (fs.existsSync(STRICTLY_BETTER_FILE)) {
    try {
      strictlyBetterCache = JSON.parse(fs.readFileSync(STRICTLY_BETTER_FILE, "utf-8"));
      return strictlyBetterCache;
    } catch (e) {
      console.error("Error loading strictly better cache", e);
    }
  } else {
    // Start background sync if file doesn't exist
    syncStrictlyBetterData();
  }
  return [];
}

/**
 * Finds strictly better upgrades for a given list of card names.
 */
export function getStrictlyBetterUpgrades(deckCardNames) {
  const cache = loadStrictlyBetterCache();
  const upgrades = [];
  const deckSet = new Set();
  deckCardNames.forEach(c => {
    const lower = c.toLowerCase();
    deckSet.add(lower);
    if (lower.includes('//')) {
      deckSet.add(lower.split('//')[0].trim());
    }
  });

  for (const obsolete of cache) {
    if (!obsolete.inferiors || !obsolete.superiors) continue;
    
    // Only care about upvotes > downvotes (allows variations through)
    if (obsolete.upvotes <= obsolete.downvotes) continue;

    for (const inferior of obsolete.inferiors) {
      const inferiorName = inferior.name;
      if (deckSet.has(inferiorName.toLowerCase())) {
        // Find superiors
        const superiorNames = obsolete.superiors.map(s => s.name);
        // Only suggest if the superior isn't ALREADY in the deck
        const newSuperiors = superiorNames.filter(s => !deckSet.has(s.toLowerCase()));
        
        if (newSuperiors.length > 0) {
          upgrades.push({
            currentCard: inferiorName,
            strictlyBetterCards: newSuperiors,
            upvotes: obsolete.upvotes
          });
        }
      }
    }
  }

  // Deduplicate by currentCard
  const uniqueUpgrades = {};
  for (const u of upgrades) {
    if (!uniqueUpgrades[u.currentCard]) {
      uniqueUpgrades[u.currentCard] = u;
    } else {
      uniqueUpgrades[u.currentCard].strictlyBetterCards.push(...u.strictlyBetterCards);
      uniqueUpgrades[u.currentCard].strictlyBetterCards = [...new Set(uniqueUpgrades[u.currentCard].strictlyBetterCards)];
    }
  }

  return Object.values(uniqueUpgrades).sort((a, b) => b.upvotes - a.upvotes);
}

/**
 * Fetches EDHRec suggestions (New Cards and Top/High Synergy Cards) for a commander.
 */
export async function getEDHRecSuggestions(commanderName, deckCardNames) {
  if (!commanderName) return { newCards: [], highSynergy: [] };

  // Format commander name for EDHRec (lowercase, spaces to dashes, remove punctuation)
  let formattedCommander = commanderName.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");

  try {
    const url = `https://json.edhrec.com/pages/commanders/${formattedCommander}.json`;
    const response = await axios.get(url);
    const cardLists = response.data.container.json_dict.cardlists;

    const deckSet = new Set();
    deckCardNames.forEach(c => {
      const lower = c.toLowerCase();
      deckSet.add(lower);
      if (lower.includes('//')) {
        deckSet.add(lower.split('//')[0].trim());
      }
    });

    let newCards = [];
    let highSynergy = [];

    for (const list of cardLists) {
      const header = list.header?.toLowerCase();

      if (header === "new cards") {
        newCards = list.cardviews
          .filter(c => !deckSet.has(c.name.toLowerCase()))
          .map(c => ({ name: c.name, synergy: c.synergy, url: c.url }));
      } else if (header === "high synergy cards" || header === "top cards" || header === "high lift cards") {
        // Collect these into highSynergy, deduplicating just in case
        const mapped = list.cardviews
          .filter(c => !deckSet.has(c.name.toLowerCase()))
          .map(c => ({ name: c.name, synergy: c.synergy || c.lift, url: c.url }));

        for (const card of mapped) {
          if (!highSynergy.some(c => c.name === card.name)) {
            highSynergy.push(card);
          }
        }
      }
    }

    // Sort highSynergy by synergy/lift score descending
    highSynergy.sort((a, b) => (b.synergy || 0) - (a.synergy || 0));

    return { newCards, highSynergy };
  } catch (error) {
    console.error(`Failed to fetch EDHRec data for ${commanderName}:`, error.message);
    return { newCards: [], highSynergy: [] };
  }
}
