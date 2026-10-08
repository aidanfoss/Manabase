import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LANDCYCLES_FILE = path.join(__dirname, "../data/landcycles.json");
const SCRYFALL_CACHE_FILE = path.join(__dirname, "../data/scryfall-parsed-cache.json");

let landcyclesCache = null;
let scryfallCache = null;

function loadScryfallCache() {
  if (scryfallCache) return scryfallCache;
  if (fs.existsSync(SCRYFALL_CACHE_FILE)) {
    try {
      scryfallCache = JSON.parse(fs.readFileSync(SCRYFALL_CACHE_FILE, "utf-8"));
      return scryfallCache;
    } catch (e) {
      console.error("Error loading scryfall cache in landAnalyzer", e);
    }
  }
  return [];
}

function loadLandcycles() {
  if (landcyclesCache) return landcyclesCache;
  if (fs.existsSync(LANDCYCLES_FILE)) {
    try {
      landcyclesCache = JSON.parse(fs.readFileSync(LANDCYCLES_FILE, "utf-8"));
      return landcyclesCache;
    } catch (e) {
      console.error("Error loading land cycles", e);
    }
  }
  return [];
}

export function analyzeLands(commanderName, deckCardNames) {
  console.log(`[LandAnalyzer] Analyzing for commander: ${commanderName}`);
  const cardsCache = loadScryfallCache();
  const landCycles = loadLandcycles();

  // Create lookup for cycles
  const cycleLookup = {};
  landCycles.forEach(cycle => {
    cycle.cards.forEach(cardName => {
      cycleLookup[cardName.toLowerCase()] = {
        cycleName: cycle.name,
        tier: cycle.tier,
        id: cycle.id
      };
    });
  });

  // Ensure card names subset
  const deckSet = new Set(deckCardNames.map(n => n.toLowerCase()));
  console.log(`[LandAnalyzer] Deck has ${deckSet.size} unique cards.`);

  // Find the commander
  let commanderIdentity = new Set();
  const commanderCard = cardsCache.find(c => c.name.toLowerCase() === (commanderName || '').toLowerCase());
  console.log(`[LandAnalyzer] Commander card found: ${!!commanderCard}`);

  if (commanderCard && commanderCard.color_identity) {
    commanderCard.color_identity.forEach(color => commanderIdentity.add(color));
  } else {
    // If no commander, compute identity from the deck
    cardsCache.forEach(c => {
      if (deckSet.has(c.name.toLowerCase()) && c.color_identity) {
        c.color_identity.forEach(color => commanderIdentity.add(color));
      }
    });
  }

  // Colorless commanders have size 0 identity, which is tricky. Let's make an array to easily pass around.
  const deckColors = Array.from(commanderIdentity);
  console.log(`[LandAnalyzer] Detected colors: ${deckColors.join(', ')}`);

  const deckLands = [];
  cardsCache.forEach(c => {
    if (deckSet.has(c.name.toLowerCase()) && c.type_line && c.type_line.includes("Land")) {
      deckLands.push(c);
    }
  });
  console.log(`[LandAnalyzer] Found ${deckLands.length} lands in deck: ${deckLands.map(l => l.name).join(', ')}`);

  const cuts = [];
  const adds = [];

  // Identify cuts
  deckLands.forEach(land => {
    const cycleData = cycleLookup[land.name.toLowerCase()];
    console.log(`[LandAnalyzer] Land: ${land.name}, cycleData: ${!!cycleData}`);

    if (cycleData && cycleData.tier === "bottom") {
      cuts.push({
        name: land.name,
        reason: `bottom tier land cycle (${cycleData.cycleName})`,
        image_uri: land.image_uris ? land.image_uris.normal : null
      });
    } else if (land.type_line && land.type_line.includes("Gate") && !commanderCard?.name?.includes("Nine-Fingers")) {
       cuts.push({
         name: land.name,
         reason: "enters tapped / Guildgate",
         image_uri: land.image_uris ? land.image_uris.normal : null
       });
    }
  });

  // Identify adds
  // We want to suggest lands from "top" tier cycles
  // if their color identity is a subset of the deck's color identity.
  const topCycles = landCycles.filter(c => c.tier === "top" && c.cards && c.cards.length > 0);

  topCycles.forEach(cycle => {
    cycle.cards.forEach(cardName => {
      // Find card in cache
      const cardRef = cardsCache.find(c => c.name.toLowerCase() === cardName.toLowerCase());
      if (!cardRef) return;

      // If already in deck, skip
      if (deckSet.has(cardName.toLowerCase())) return;

      // Check color identity: card color identity must be subset of deck color identity
      let isSubset = true;
      if (cardRef.color_identity && cardRef.color_identity.length > 0) {
        for (const ci of cardRef.color_identity) {
          if (!deckColors.includes(ci)) {
            isSubset = false;
            break;
          }
        }
      } else if (cardRef.oracle_text || cardRef.type_line) {
         // for fetch lands and similar, they don't have color identity (they're colorless)
         // we might need to look at what they produce or fetch
         const magicColors = ['white', 'blue', 'black', 'red', 'green', 'plains', 'island', 'swamp', 'mountain', 'forest'];
         const text = ((cardRef.oracle_text || '') + ' ' + (cardRef.type_line || '')).toLowerCase();
         // Basic matching for fetchlands: if it name-drops basic types the deck doesn't have, it's probably wrong.
         let matchingWords = 0;
         let mismatchingWords = 0;
         const typeMap = { 'plains': 'W', 'island': 'U', 'swamp': 'B', 'mountain': 'R', 'forest': 'G' };
         for (const [word, color] of Object.entries(typeMap)) {
           if (text.includes(word)) {
             if (deckColors.includes(color)) matchingWords++;
             else mismatchingWords++;
           }
         }

         // If it specifically references basic types and NONE are in our deck, drop it.
         if (mismatchingWords > 0 && matchingWords === 0 && cycle.name.toLowerCase().includes('fetch')) {
           isSubset = false;
         }
      }

      if (isSubset) {
        adds.push({
          name: cardRef.name,
          cycle: cycle.name,
          tier: cycle.tier,
          image_uri: cardRef.image_uris ? cardRef.image_uris.normal : null
        });
      }
    });
  });

  return { cuts, adds, colorIdentity: deckColors };
}
