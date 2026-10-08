import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LANDCYCLES_FILE = path.join(__dirname, "../data/landcycles.json");
const SCRYFALL_CACHE_FILE = path.join(__dirname, "../data/scryfall-parsed-cache.json");

let landcyclesCache = null;
let scryfallMapCache = null;
let scryfallArrayCache = null;

// Explicit color mappings for cycles with colorless color_identity (fetches, landscapes, etc.)
export const LAND_COLOR_REQUIREMENTS = {
  // Fetchlands (exact 2 fetched colors)
  "arid mesa": ["W", "R"],
  "bloodstained mire": ["B", "R"],
  "flooded strand": ["W", "U"],
  "marsh flats": ["W", "B"],
  "misty rainforest": ["U", "G"],
  "polluted delta": ["U", "B"],
  "scalding tarn": ["U", "R"],
  "verdant catacombs": ["B", "G"],
  "windswept heath": ["W", "G"],
  "wooded foothills": ["R", "G"],
  "prismatic vista": [],
  "fabled passage": [],

  // MH3 Landscapes (3 colors)
  "bountiful landscape": ["W", "U", "G"],
  "contaminated landscape": ["U", "B", "R"],
  "deceptive landscape": ["G", "W", "U"],
  "foreboding landscape": ["B", "R", "G"],
  "perilous landscape": ["R", "G", "W"],
  "seething landscape": ["B", "R", "G"],
  "shattered landscape": ["W", "B", "R"],
  "sheltering landscape": ["G", "W", "B"],
  "tranquil landscape": ["W", "U", "B"],
  "twisted landscape": ["U", "B", "G"],

  // ABU Dual Lands (OG Duals)
  "badlands": ["B", "R"],
  "bayou": ["B", "G"],
  "plateau": ["W", "R"],
  "savannah": ["W", "G"],
  "scrubland": ["W", "B"],
  "taiga": ["R", "G"],
  "tropical island": ["U", "G"],
  "tundra": ["W", "U"],
  "underground sea": ["U", "B"],
  "volcanic island": ["U", "R"],

  // Shards Panoramas (3 colors)
  "bant panorama": ["G", "W", "U"],
  "esper panorama": ["W", "U", "B"],
  "grixis panorama": ["U", "B", "R"],
  "jund panorama": ["B", "R", "G"],
  "naya panorama": ["R", "G", "W"],

  // Triomes & New Capenna 3-color lands
  "indatha triome": ["W", "B", "G"],
  "ketria triome": ["G", "U", "R"],
  "raugrin triome": ["U", "R", "W"],
  "savai triome": ["R", "W", "B"],
  "zagoth triome": ["B", "G", "U"],
  "jetmir's garden": ["R", "G", "W"],
  "raffine's tower": ["W", "U", "B"],
  "spara's headquarters": ["G", "W", "U"],
  "xander's lounge": ["U", "B", "R"],
  "ziatora's proving ground": ["B", "R", "G"]
};

// Reserved List lands (OG ABU Duals, etc.)
export const RESERVED_LIST_LANDS = new Set([
  "badlands",
  "bayou",
  "plateau",
  "savannah",
  "scrubland",
  "taiga",
  "tropical island",
  "tundra",
  "underground sea",
  "volcanic island",
  "lake of the dead",
  "volrath's stronghold",
  "diamond valley",
  "bazaar of baghdad",
  "the tabernacle at pendrell vale",
  "scorched ruins",
  "city of shadows"
]);

// Cycle priority scores for sorting recommendations (higher = higher recommendation priority)
export const CYCLE_PRIORITY_SCORES = {
  "cycle-rav-shockland": 100,
  "cycle-abu-dual-land": 98,
  "cycle-bondland": 95,
  "cycle-fetchland": 90,
  "cycle-dual-surveil-land": 88,
  "cycle-painland": 85,
  "cycle-slowland": 82,
  "cycle-fastland": 80,
  "cycle-hybrid-filterland": 78,
  "cycle-pathway": 76,
  "cycle-checkland": 75,
  "cycle-verge": 74,
  "cycle-horizon-land": 72,
  "tricycle-land": 70,
  "cycle-tangoland": 68,
  "cycle-mh3-landscape": 65,
  "cycle-ody-filterland": 60,
  "cycle-reveal-land": 58,
  "cycle-tor-tainted-land": 55,
  "cycle-restless-land": 52,
  "cycle-rav-bounceland": 45,
  "cycle-block-ths-scry-land": 40,
  "cycle-ala-panorama": 35,
  "cycle-mrd-artifact-land": 30
};

// Budget tier price thresholds (USD)
export const BUDGET_TIER_THRESHOLDS = {
  ultra_budget: 1.0,
  budget: 3.5,
  mid: 10.0,
  high: 25.0,
  all: Infinity
};

function loadScryfallData() {
  if (scryfallMapCache && scryfallArrayCache) {
    return { map: scryfallMapCache, array: scryfallArrayCache };
  }

  const map = new Map();
  const array = [];

  if (fs.existsSync(SCRYFALL_CACHE_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(SCRYFALL_CACHE_FILE, "utf-8"));
      if (Array.isArray(raw)) {
        for (const card of raw) {
          if (!card || !card.name) continue;
          const key = card.name.toLowerCase();
          if (!map.has(key)) {
            map.set(key, card);
            array.push(card);
          }
        }
      }
    } catch (e) {
      console.error("Error loading scryfall cache in landAnalyzer", e);
    }
  }

  scryfallMapCache = map;
  scryfallArrayCache = array;
  return { map, array };
}

function loadLandcycles() {
  if (landcyclesCache) return landcyclesCache;
  if (fs.existsSync(LANDCYCLES_FILE)) {
    try {
      landcyclesCache = JSON.parse(fs.readFileSync(LANDCYCLES_FILE, "utf-8"));
      return landcyclesCache;
    } catch (e) {
      console.error("Error loading land cycles in landAnalyzer", e);
    }
  }
  return [];
}

/**
 * Parses commander names (handles partner / background commanders) and extracts color identity.
 */
function extractCommanderColors(commanderName, cardMap, deckCardNames) {
  const colors = new Set();
  if (!commanderName || typeof commanderName !== "string") {
    return inferDeckColors(deckCardNames, cardMap);
  }

  // Handle partner commanders e.g. "Thrasios, Triton Hero / Tymna the Weaver" or "Thrasios, Triton Hero // Tymna the Weaver"
  const parts = commanderName.split(/\s*(?:\/|\/\/|\+)\s*/).map(p => p.trim()).filter(Boolean);
  let foundAny = false;

  for (const part of parts) {
    const card = cardMap.get(part.toLowerCase());
    if (card && Array.isArray(card.color_identity)) {
      foundAny = true;
      card.color_identity.forEach(c => colors.add(c.toUpperCase()));
    }
  }

  if (foundAny) {
    return Array.from(colors);
  }

  return inferDeckColors(deckCardNames, cardMap);
}

/**
 * Fallback to infer deck colors from distinct deck cards.
 */
function inferDeckColors(deckCardNames, cardMap) {
  const colors = new Set();
  for (const name of deckCardNames) {
    const card = cardMap.get(name.toLowerCase());
    if (card && Array.isArray(card.color_identity)) {
      card.color_identity.forEach(c => colors.add(c.toUpperCase()));
    }
  }
  return Array.from(colors);
}

/**
 * Gets the required colors for a land card.
 */
export function getLandRequiredColors(cardName, card) {
  const lower = cardName.toLowerCase();
  if (LAND_COLOR_REQUIREMENTS[lower] !== undefined) {
    return LAND_COLOR_REQUIREMENTS[lower];
  }

  if (card && Array.isArray(card.color_identity) && card.color_identity.length > 0) {
    return card.color_identity.map(c => c.toUpperCase());
  }

  return [];
}

/**
 * Checks if a land's color requirements are a valid subset of the deck's color identity.
 */
export function isLandColorCompatible(cardName, card, deckColors) {
  const reqColors = getLandRequiredColors(cardName, card);

  // Colorless lands (e.g. Reliquary Tower, Command Tower, Prismatic Vista) are always compatible
  if (reqColors.length === 0) {
    return true;
  }

  // Dual or multi-color lands in a 1-color deck: skip dual/multi lands requiring multiple colors
  if (deckColors.length < reqColors.length && reqColors.length > 1) {
    return false;
  }

  // Every required color must be in the deck's color identity
  return reqColors.every(color => deckColors.includes(color));
}

/**
 * Core land analyzer function supporting user preferences, budget tiers, and deduplicated recommendations.
 *
 * @param {string} commanderName - Commander name (or combined partner names)
 * @param {string[]} deckCardNames - Array of card names in the deck
 * @param {object} [options={}] - Custom configuration/preferences
 * @param {string} [options.budgetTier='all'] - 'all' | 'high' | 'mid' | 'budget' | 'ultra_budget'
 * @param {number|null} [options.maxPricePerLand=null] - Maximum USD price per land
 * @param {boolean} [options.excludeReservedList=true] - Exclude ABU Duals and Reserved List lands
 * @param {boolean} [options.excludeTapped=true] - Exclude generic tapped lands from adds, suggest cutting them
 * @param {string[]} [options.likedCycles=[]] - Explicitly included cycle IDs or names
 * @param {string[]} [options.dislikedCycles=[]] - Explicitly excluded cycle IDs or names
 * @param {number} [options.maxSuggestions=14] - Maximum number of suggested adds
 */
export function analyzeLands(commanderName, deckCardNames = [], options = {}) {
  const { map: cardMap } = loadScryfallData();
  const landCycles = loadLandcycles();

  const deckNamesSet = new Set(
    (deckCardNames || []).map(n => (typeof n === "string" ? n.toLowerCase() : ""))
  );

  // Determine preferences with sensible defaults
  const budgetTier = options.budgetTier || "all";
  const budgetThreshold =
    options.maxPricePerLand !== null && options.maxPricePerLand !== undefined
      ? parseFloat(options.maxPricePerLand)
      : BUDGET_TIER_THRESHOLDS[budgetTier] || Infinity;

  const isBudgetRestricted = budgetTier !== "all" || budgetThreshold < 100;
  const excludeReservedList =
    options.excludeReservedList !== undefined
      ? !!options.excludeReservedList
      : isBudgetRestricted; // default true if budget-conscious, false if unlimited

  const excludeTapped = options.excludeTapped !== undefined ? !!options.excludeTapped : true;

  const likedCyclesSet = new Set(
    (options.likedCycles || []).map(c => c.toLowerCase())
  );
  const dislikedCyclesSet = new Set(
    (options.dislikedCycles || []).map(c => c.toLowerCase())
  );

  const maxSuggestions = options.maxSuggestions || 14;

  // 1. Determine Deck Color Identity
  const deckColors = extractCommanderColors(commanderName, cardMap, deckCardNames);

  // 2. Build Cycle Lookup Maps
  // cardLower -> { cycleId, cycleName, tier, fetchable }
  const cycleLookup = new Map();
  for (const cycle of landCycles) {
    const cycleId = (cycle.id || "").toLowerCase();
    const cycleName = (cycle.name || "").toLowerCase();
    const cards = Array.isArray(cycle.cards) ? cycle.cards : [];

    for (const cardItem of cards) {
      const cardName = typeof cardItem === "string" ? cardItem : cardItem?.name;
      if (!cardName) continue;
      const key = cardName.toLowerCase();
      if (!cycleLookup.has(key)) {
        cycleLookup.set(key, {
          cycleId: cycle.id,
          cycleName: cycle.name,
          tier: cycle.tier,
          fetchable: !!cycle.fetchable
        });
      }
    }
  }

  // 3. Identify Unique Lands in the Deck
  const deckLands = [];
  const seenDeckLandNames = new Set();

  for (const rawName of deckCardNames) {
    if (!rawName || typeof rawName !== "string") continue;
    const lower = rawName.toLowerCase();
    if (seenDeckLandNames.has(lower)) continue;

    const card = cardMap.get(lower);
    const isLand =
      (card && card.type_line && card.type_line.includes("Land")) ||
      cycleLookup.has(lower);

    if (isLand) {
      seenDeckLandNames.add(lower);
      deckLands.push({
        name: card ? card.name : rawName,
        lower,
        card
      });
    }
  }

  // 4. Identify Suggested Cuts (Deduplicated)
  const cuts = [];
  const seenCutNames = new Set();

  const isNineFingersKeene =
    commanderName && commanderName.toLowerCase().includes("nine-fingers keene");

  for (const deckLand of deckLands) {
    const { name, lower, card } = deckLand;
    if (seenCutNames.has(lower)) continue;

    const cycleData = cycleLookup.get(lower);
    const cycleIdLower = cycleData ? cycleData.cycleId.toLowerCase() : "";
    const cycleNameLower = cycleData ? cycleData.cycleName.toLowerCase() : "";

    const isDislikedCycle =
      dislikedCyclesSet.has(cycleIdLower) || dislikedCyclesSet.has(cycleNameLower);
    const isLikedCycle =
      likedCyclesSet.has(cycleIdLower) || likedCyclesSet.has(cycleNameLower);

    let cutReason = null;

    if (isDislikedCycle) {
      cutReason = `Disliked cycle (${cycleData.cycleName})`;
    } else if (isLikedCycle) {
      // User explicitly likes this cycle, do not suggest cutting it
      continue;
    } else if (
      cycleData &&
      cycleData.tier === "bottom" &&
      !isLikedCycle
    ) {
      cutReason = `Enters tapped / low tempo (${cycleData.cycleName})`;
    } else if (
      card &&
      card.type_line &&
      card.type_line.includes("Gate") &&
      !isNineFingersKeene
    ) {
      cutReason = "Enters tapped Guildgate";
    } else if (
      excludeTapped &&
      cycleData &&
      (cycleNameLower.includes("gainland") ||
        cycleNameLower.includes("tapland") ||
        cycleNameLower.includes("campus") ||
        cycleNameLower.includes("refugeland"))
    ) {
      cutReason = `Enters tapped (${cycleData.cycleName})`;
    }

    if (cutReason) {
      seenCutNames.add(lower);
      cuts.push({
        name: card ? card.name : name,
        reason: cutReason,
        cycle: cycleData ? cycleData.cycleName : null,
        tier: cycleData ? cycleData.tier : "bottom",
        image_uri: card?.image_uris?.normal || card?.card_faces?.[0]?.image_uris?.normal || null
      });
    }
  }

  // 5. Identify Suggested Adds (Deduplicated, Color-Matching, Budget-Conscious)
  const candidateAdds = [];
  const seenAddNames = new Set();

  for (const cycle of landCycles) {
    const cycleIdLower = (cycle.id || "").toLowerCase();
    const cycleNameLower = (cycle.name || "").toLowerCase();

    // Check if this cycle is disliked / excluded
    if (dislikedCyclesSet.has(cycleIdLower) || dislikedCyclesSet.has(cycleNameLower)) {
      continue;
    }

    // Check Reserved List exclusion
    if (excludeReservedList && cycleIdLower.includes("abu-dual")) {
      continue;
    }

    // Check Tapped exclusion
    if (
      excludeTapped &&
      cycle.tier === "bottom" &&
      !likedCyclesSet.has(cycleIdLower) &&
      !likedCyclesSet.has(cycleNameLower)
    ) {
      continue;
    }

    const cards = Array.isArray(cycle.cards) ? cycle.cards : [];
    const isExplicitlyLiked =
      likedCyclesSet.has(cycleIdLower) || likedCyclesSet.has(cycleNameLower);

    for (const cardItem of cards) {
      const cardName = typeof cardItem === "string" ? cardItem : cardItem?.name;
      if (!cardName) continue;
      const lower = cardName.toLowerCase();

      // Skip if already in deck or already candidate
      if (deckNamesSet.has(lower) || seenAddNames.has(lower)) {
        continue;
      }

      // Check Reserved List on individual card
      if (excludeReservedList && RESERVED_LIST_LANDS.has(lower)) {
        continue;
      }

      const card = cardMap.get(lower);

      // Color compatibility check (strict on-color)
      if (!isLandColorCompatible(cardName, card, deckColors)) {
        continue;
      }

      // Estimate card price for budget checks if available
      const rawPrice = card?.prices?.usd || card?.prices?.usd_foil || null;
      const priceNum = rawPrice ? parseFloat(rawPrice) : null;

      if (priceNum !== null && priceNum > budgetThreshold) {
        // Exceeds user budget threshold
        continue;
      }

      // Calculate priority score for recommendation ordering
      let basePriority = CYCLE_PRIORITY_SCORES[cycle.id] || 50;
      if (cycle.tier === "top") basePriority += 20;
      if (cycle.tier === "bottom") basePriority -= 30;
      if (isExplicitlyLiked) basePriority += 200; // Boost explicitly liked cycles

      seenAddNames.add(lower);
      candidateAdds.push({
        name: card ? card.name : cardName,
        cycle: cycle.name,
        tier: cycle.tier || "mid",
        image_uri: card?.image_uris?.normal || card?.card_faces?.[0]?.image_uris?.normal || null,
        priority: basePriority,
        price: priceNum
      });
    }
  }

  // Sort candidate adds by priority score descending
  candidateAdds.sort((a, b) => b.priority - a.priority);

  const adds = candidateAdds.slice(0, maxSuggestions);

  return {
    cuts,
    adds,
    colorIdentity: deckColors,
    preferencesApplied: {
      budgetTier,
      budgetThreshold: isFinite(budgetThreshold) ? budgetThreshold : null,
      excludeReservedList,
      excludeTapped,
      likedCyclesCount: likedCyclesSet.size,
      dislikedCyclesCount: dislikedCyclesSet.size
    }
  };
}
