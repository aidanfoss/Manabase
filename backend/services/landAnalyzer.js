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

// Explicit color mappings for cycles with colorless color_identity (fetches, landscapes, etc.) and standard duals
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

  // Shocklands
  "blood crypt": ["B", "R"],
  "breeding pool": ["U", "G"],
  "godless shrine": ["W", "B"],
  "hallowed fountain": ["W", "U"],
  "overgrown tomb": ["B", "G"],
  "sacred foundry": ["W", "R"],
  "steam vents": ["U", "R"],
  "stomping ground": ["R", "G"],
  "temple garden": ["W", "G"],
  "watery grave": ["U", "B"],

  // Crowd / Bondlands
  "sea of clouds": ["W", "U"],
  "morphic pool": ["U", "B"],
  "luxury suite": ["B", "R"],
  "spire garden": ["R", "G"],
  "bountiful promenade": ["W", "G"],
  "undergrowth stadium": ["B", "G"],
  "spectator seating": ["W", "R"],
  "training center": ["U", "R"],
  "vault of champions": ["W", "B"],
  "rejuvenating springs": ["U", "G"],

  // Guildgates
  "azorius guildgate": ["W", "U"],
  "dimir guildgate": ["U", "B"],
  "rakdos guildgate": ["B", "R"],
  "gruul guildgate": ["R", "G"],
  "selesnya guildgate": ["W", "G"],
  "orzhov guildgate": ["W", "B"],
  "izzet guildgate": ["U", "R"],
  "golgari guildgate": ["B", "G"],
  "boros guildgate": ["W", "R"],
  "simic guildgate": ["U", "G"],

  // Ravnica Bouncelands
  "azorius chancery": ["W", "U"],
  "dimir aqueduct": ["U", "B"],
  "rakdos carnarium": ["B", "R"],
  "gruul turf": ["R", "G"],
  "selesnya sanctuary": ["W", "G"],
  "orzhov basilica": ["W", "B"],
  "izzet boilerworks": ["U", "R"],
  "golgari rot farm": ["B", "G"],
  "boros garrison": ["W", "R"],
  "simic growth chamber": ["U", "G"],

  // Painlands
  "adarkar wastes": ["W", "U"],
  "underground river": ["U", "B"],
  "sulfurous springs": ["B", "R"],
  "karplusan forest": ["R", "G"],
  "brushland": ["W", "G"],
  "caves of koilos": ["W", "B"],
  "shivan reef": ["U", "R"],
  "llanowar wastes": ["B", "G"],
  "battlefield forge": ["W", "R"],
  "yavimaya coast": ["U", "G"],

  // Fastlands
  "seachrome coast": ["W", "U"],
  "darkslick shores": ["U", "B"],
  "blackcleave cliffs": ["B", "R"],
  "copperline gorge": ["R", "G"],
  "razorverge thicket": ["W", "G"],
  "concealed courtyard": ["W", "B"],
  "spirebluff canal": ["U", "R"],
  "blooming marsh": ["B", "G"],
  "inspiring vantage": ["W", "R"],
  "botanical sanctum": ["U", "G"],

  // Slowlands
  "deserted beach": ["W", "U"],
  "shipwreck marsh": ["U", "B"],
  "haunted ridge": ["B", "R"],
  "rockfall vale": ["R", "G"],
  "overgrown farmland": ["W", "G"],
  "shattered sanctum": ["W", "B"],
  "shattered sanctuary": ["W", "B"],
  "stormcarved coast": ["U", "R"],
  "deathcap glade": ["B", "G"],
  "sundown pass": ["W", "R"],
  "dreamroot cascade": ["U", "G"],

  // Checklands
  "glacial fortress": ["W", "U"],
  "drowned catacomb": ["U", "B"],
  "dragonskull summit": ["B", "R"],
  "rootbound crag": ["R", "G"],
  "sunpetal grove": ["W", "G"],
  "isolated chapel": ["W", "B"],
  "sulfur falls": ["U", "R"],
  "woodland cemetery": ["B", "G"],
  "clifftop retreat": ["W", "R"],
  "hinterland harbor": ["U", "G"],

  // Gainlands / Refuges
  "tranquil cove": ["W", "U"],
  "dismal backwater": ["U", "B"],
  "bloodfell caves": ["B", "R"],
  "rugged highlands": ["R", "G"],
  "blossoming sands": ["W", "G"],
  "scoured barrens": ["W", "B"],
  "swiftwater cliffs": ["U", "R"],
  "jungle hollow": ["B", "G"],
  "wind-scarred crag": ["W", "R"],
  "thornwood falls": ["U", "G"],

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
  "ziatora's proving ground": ["B", "R", "G"],

  // Hybrid Filterlands
  "cascade bluffs": ["U", "R"],
  "fetid heath": ["W", "B"],
  "fire-lit thicket": ["R", "G"],
  "flooded grove": ["U", "G"],
  "graven cairns": ["B", "R"],
  "mystic gate": ["W", "U"],
  "rugged prairie": ["W", "R"],
  "sunken ruins": ["U", "B"],
  "twilight mire": ["B", "G"],
  "wooded bastion": ["W", "G"],

  // Horizon lands
  "fiery islet": ["U", "R"],
  "horizon canopy": ["W", "G"],
  "nurturing peatland": ["B", "G"],
  "silent clearing": ["W", "B"],
  "sunbaked canyon": ["W", "R"],
  "waterlogged grove": ["U", "G"],
  "grove of the burnwillows": ["R", "G"],

  // Verges
  "blazemire verge": ["B", "R"],
  "bleachbone verge": ["W", "B"],
  "floodfarm verge": ["W", "U"],
  "gloomlake verge": ["U", "B"],
  "hushwood verge": ["W", "G"],
  "riverpyre verge": ["U", "R"],
  "sunbillow verge": ["W", "R"],
  "thornspire verge": ["R", "G"],
  "wastewood verge": ["B", "G"],
  "willowrush verge": ["U", "G"],

  // Pathways (including MDFC split notation)
  "barkchannel pathway": ["G", "U"],
  "barkchannel pathway // tidechannel pathway": ["G", "U"],
  "tidechannel pathway": ["G", "U"],
  "blightstep pathway": ["B", "R"],
  "blightstep pathway // searstep pathway": ["B", "R"],
  "searstep pathway": ["B", "R"],
  "branchloft pathway": ["G", "W"],
  "branchloft pathway // boulderloft pathway": ["G", "W"],
  "boulderloft pathway": ["G", "W"],
  "brightclimb pathway": ["W", "B"],
  "brightclimb pathway // grimclimb pathway": ["W", "B"],
  "grimclimb pathway": ["W", "B"],
  "clearwater pathway": ["U", "B"],
  "clearwater pathway // murkwater pathway": ["U", "B"],
  "murkwater pathway": ["U", "B"],
  "cragcrown pathway": ["R", "G"],
  "cragcrown pathway // timbercrown pathway": ["R", "G"],
  "timbercrown pathway": ["R", "G"],
  "darkbore pathway": ["B", "G"],
  "darkbore pathway // slitherbore pathway": ["B", "G"],
  "slitherbore pathway": ["B", "G"],
  "hengegate pathway": ["W", "U"],
  "hengegate pathway // mistgate pathway": ["W", "U"],
  "mistgate pathway": ["W", "U"],
  "needleverge pathway": ["R", "W"],
  "needleverge pathway // pillarverge pathway": ["R", "W"],
  "pillarverge pathway": ["R", "W"],
  "riverglide pathway": ["U", "R"],
  "riverglide pathway // lavaglide pathway": ["U", "R"],
  "lavaglide pathway": ["U", "R"],

  // Surveil lands
  "commercial district": ["R", "G"],
  "elegant parlor": ["W", "R"],
  "hedge maze": ["U", "G"],
  "lush portico": ["W", "G"],
  "raucous theater": ["B", "R"],
  "shadowy backstreet": ["W", "B"],
  "thundering falls": ["U", "R"],
  "undercity sewers": ["U", "B"],
  "underground morgue": ["B", "G"],

  // Tango / Battle lands
  "canopy vista": ["W", "G"],
  "cinder glade": ["R", "G"],
  "prairie stream": ["W", "U"],
  "smoldering marsh": ["B", "R"],
  "sunken hollow": ["U", "B"],

  // Reveal / Snarl lands
  "choked estuary": ["U", "B"],
  "foreboding ruins": ["B", "R"],
  "fortified village": ["W", "G"],
  "game trail": ["R", "G"],
  "port town": ["W", "U"],
  "frostboil snarl": ["U", "R"],
  "furycalm snarl": ["W", "R"],
  "necroblossom snarl": ["B", "G"],
  "shineshadow snarl": ["W", "B"],
  "vineglimmer snarl": ["U", "G"],

  // Utility lands
  "alchemist's refuge": ["U", "G"],
  "desolate lighthouse": ["U", "R"],
  "grim backwoods": ["B", "G"],
  "slayers' stronghold": ["W", "R"],
  "vault of the archangel": ["W", "B"],
  "gavony township": ["W", "G"],
  "kessig wolf run": ["R", "G"],
  "moorland haunt": ["W", "U"],
  "nephalia drownyard": ["U", "B"],
  "stensia bloodhall": ["B", "R"],

  // Artifact lands
  "ancient den": ["W"],
  "great furnace": ["R"],
  "seat of the synod": ["U"],
  "tree of tales": ["G"],
  "vault of whispers": ["B"],
  "darksteel citadel": [],

  // Vivid lands
  "vivid crag": ["R"],
  "vivid creek": ["U"],
  "vivid grove": ["G"],
  "vivid marsh": ["B"],
  "vivid meadow": ["W"],

  // Strixhaven Campuses
  "quandrix campus": ["U", "G"],
  "prismari campus": ["U", "R"],
  "silverquill campus": ["W", "B"],
  "lorehold campus": ["W", "R"],
  "witherbloom campus": ["B", "G"]
};

export const FALLBACK_LAND_CYCLES = [
  {
    id: "cycle-fetchland",
    name: "Fetchlands",
    tier: "top",
    speed: "untapped",
    cards: [
      { name: "Polluted Delta" }, { name: "Wooded Foothills" }, { name: "Scalding Tarn" },
      { name: "Flooded Strand" }, { name: "Bloodstained Mire" }, { name: "Misty Rainforest" },
      { name: "Arid Mesa" }, { name: "Marsh Flats" }, { name: "Verdant Catacombs" }, { name: "Windswept Heath" }
    ]
  },
  {
    id: "cycle-rav-shockland",
    name: "Shocklands",
    tier: "top",
    speed: "untapped",
    cards: [
      { name: "Blood Crypt" }, { name: "Overgrown Tomb" }, { name: "Steam Vents" },
      { name: "Stomping Ground" }, { name: "Watery Grave" }, { name: "Breeding Pool" },
      { name: "Godless Shrine" }, { name: "Hallowed Fountain" }, { name: "Sacred Foundry" }, { name: "Temple Garden" }
    ]
  },
  {
    id: "cycle-bondland",
    name: "Crowd / Bondlands",
    tier: "top",
    speed: "untapped",
    cards: [
      { name: "Sea of Clouds" }, { name: "Morphic Pool" }, { name: "Luxury Suite" },
      { name: "Spire Garden" }, { name: "Bountiful Promenade" }, { name: "Undergrowth Stadium" },
      { name: "Spectator Seating" }, { name: "Training Center" }, { name: "Vault of Champions" }, { name: "Rejuvenating Springs" }
    ]
  },
  {
    id: "cycle-painland",
    name: "Painlands",
    tier: "mid",
    speed: "untapped",
    cards: [
      { name: "Karplusan Forest" }, { name: "Sulfurous Springs" }, { name: "Underground River" },
      { name: "Yavimaya Coast" }, { name: "Caves of Koilos" }, { name: "Llanowar Wastes" },
      { name: "Battlefield Forge" }, { name: "Brushland" }, { name: "Adarkar Wastes" }, { name: "Shivan Reef" }
    ]
  },
  {
    id: "cycle-abu-dual-land",
    name: "Original ABU Dual Lands",
    tier: "top",
    speed: "untapped",
    cards: [
      { name: "Badlands" }, { name: "Bayou" }, { name: "Plateau" }, { name: "Savannah" },
      { name: "Scrubland" }, { name: "Taiga" }, { name: "Tropical Island" }, { name: "Tundra" },
      { name: "Underground Sea" }, { name: "Volcanic Island" }
    ]
  },
  {
    id: "cycle-guildgate",
    name: "Guildgates",
    tier: "bottom",
    speed: "tapped",
    cards: [
      { name: "Gruul Guildgate" }, { name: "Rakdos Guildgate" }, { name: "Dimir Guildgate" },
      { name: "Azorius Guildgate" }, { name: "Selesnya Guildgate" }, { name: "Golgari Guildgate" },
      { name: "Izzet Guildgate" }, { name: "Boros Guildgate" }, { name: "Orzhov Guildgate" }, { name: "Simic Guildgate" }
    ]
  },
  {
    id: "cycle-rav-bounceland",
    name: "Ravnica Bouncelands",
    tier: "bottom",
    speed: "tapped",
    cards: [
      { name: "Gruul Turf" }, { name: "Rakdos Carnarium" }, { name: "Dimir Aqueduct" },
      { name: "Azorius Chancery" }, { name: "Selesnya Sanctuary" }, { name: "Golgari Rot Farm" },
      { name: "Izzet Boilerworks" }, { name: "Boros Garrison" }, { name: "Orzhov Basilica" }, { name: "Simic Growth Chamber" }
    ]
  },
  {
    id: "cycle-ktk-gainland",
    name: "Gainlands / Refuges",
    tier: "bottom",
    speed: "tapped",
    cards: [
      { name: "Rugged Highlands" }, { name: "Bloodfell Caves" }, { name: "Dismal Backwater" },
      { name: "Tranquil Cove" }, { name: "Blossoming Sands" }, { name: "Jungle Hollow" },
      { name: "Swiftwater Cliffs" }, { name: "Wind-Scarred Crag" }, { name: "Scoured Barrens" }, { name: "Thornwood Falls" }
    ]
  },
  {
    id: "cycle-stx-campus",
    name: "Strixhaven Campuses",
    tier: "bottom",
    speed: "tapped",
    cards: [
      { name: "Quandrix Campus" }, { name: "Prismari Campus" }, { name: "Silverquill Campus" },
      { name: "Lorehold Campus" }, { name: "Witherbloom Campus" }
    ]
  },
  {
    id: "cycle-ala-panorama",
    name: "Shards Panoramas",
    tier: "bottom",
    speed: "untapped",
    cards: [
      { name: "Jund Panorama" }, { name: "Grixis Panorama" }, { name: "Esper Panorama" },
      { name: "Bant Panorama" }, { name: "Naya Panorama" }
    ]
  },
  {
    id: "cycle-slowland",
    name: "Slowlands",
    tier: "mid",
    speed: "conditional",
    cards: [
      { name: "Deserted Beach" }, { name: "Shipwreck Marsh" }, { name: "Haunted Ridge" },
      { name: "Rockfall Vale" }, { name: "Overgrown Farmland" }, { name: "Shattered Sanctuary" },
      { name: "Stormcarved Coast" }, { name: "Deathcap Glade" }, { name: "Sundown Pass" },
      { name: "Dreamroot Cascade" }
    ]
  },
  {
    id: "cycle-fastland",
    name: "Fastlands",
    tier: "mid",
    speed: "conditional",
    cards: [
      { name: "Seachrome Coast" }, { name: "Darkslick Shores" }, { name: "Blackcleave Cliffs" },
      { name: "Copperline Gorge" }, { name: "Razorverge Thicket" }, { name: "Concealed Courtyard" },
      { name: "Spirebluff Canal" }, { name: "Blooming Marsh" }, { name: "Inspiring Vantage" },
      { name: "Botanical Sanctum" }
    ]
  },
  {
    id: "cycle-checkland",
    name: "Checklands",
    tier: "mid",
    speed: "conditional",
    cards: [
      { name: "Glacial Fortress" }, { name: "Drowned Catacomb" }, { name: "Dragonskull Summit" },
      { name: "Rootbound Crag" }, { name: "Sunpetal Grove" }, { name: "Isolated Chapel" },
      { name: "Sulfur Falls" }, { name: "Woodland Cemetery" }, { name: "Clifftop Retreat" },
      { name: "Hinterland Harbor" }
    ]
  }
];

const KNOWN_COMMANDER_COLORS = {
  "grand warlord radha": ["R", "G"],
  "atraxa, praetors' voice": ["W", "U", "B", "G"],
  "edgar markov": ["R", "W", "B"],
  "the ur-dragon": ["W", "U", "B", "R", "G"],
  "lathril, blade of the elves": ["B", "G"],
  "krenko, mob boss": ["R"],
  "korvold, fae-cursed king": ["B", "R", "G"],
  "miirym, sentinel wyrm": ["G", "U", "R"],
  "wilhelt, the rotcleaver": ["U", "B"],
  "prosper, tome-bound": ["B", "R"],
  "yuriko, the tiger's shadow": ["U", "B"],
  "nine-fingers keene": ["B", "G", "U"]
};

const BASIC_LAND_COLORS = {
  forest: ["G"],
  mountain: ["R"],
  plains: ["W"],
  island: ["U"],
  swamp: ["B"],
  "snow-covered forest": ["G"],
  "snow-covered mountain": ["R"],
  "snow-covered plains": ["W"],
  "snow-covered island": ["U"],
  "snow-covered swamp": ["B"]
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

// Common aliases and display names for MTG land cycles
export const CYCLE_ALIASES = {
  "shocklands": "cycle-rav-shockland",
  "shockland": "cycle-rav-shockland",
  "shocks": "cycle-rav-shockland",
  "fetchlands": "cycle-fetchland",
  "fetchland": "cycle-fetchland",
  "fetches": "cycle-fetchland",
  "bondlands": "cycle-bondland",
  "bondland": "cycle-bondland",
  "crowd lands": "cycle-bondland",
  "crowd / bondlands": "cycle-bondland",
  "painlands": "cycle-painland",
  "painland": "cycle-painland",
  "slowlands": "cycle-slowland",
  "slowland": "cycle-slowland",
  "fastlands": "cycle-fastland",
  "fastland": "cycle-fastland",
  "surveil lands": "cycle-dual-surveil-land",
  "surveil land": "cycle-dual-surveil-land",
  "dual surveil lands": "cycle-dual-surveil-land",
  "checklands": "cycle-checkland",
  "checkland": "cycle-checkland",
  "filterlands": "cycle-hybrid-filterland",
  "hybrid filterlands": "cycle-hybrid-filterland",
  "pathways": "cycle-pathway",
  "pathway": "cycle-pathway",
  "verges": "cycle-verge",
  "verge": "cycle-verge",
  "horizon lands": "cycle-horizon-land",
  "horizon canopy lands": "cycle-horizon-land",
  "triomes": "tricycle-land",
  "tangolands": "cycle-tangoland",
  "battle lands": "cycle-tangoland",
  "tango / battle lands": "cycle-tangoland",
  "landscapes": "cycle-mh3-landscape",
  "mh3 landscapes": "cycle-mh3-landscape",
  "bouncelands": "cycle-rav-bounceland",
  "ravnica bouncelands": "cycle-rav-bounceland",
  "scry lands": "cycle-block-ths-scry-land",
  "temple lands": "cycle-block-ths-scry-land",
  "scry / temple lands": "cycle-block-ths-scry-land",
  "gainlands": "cycle-ktk-gainland",
  "gainlands / refuges": "cycle-ktk-gainland",
  "campuses": "cycle-stx-campus",
  "strixhaven campuses": "cycle-stx-campus",
  "guildgates": "cycle-guildgate",
  "abu duals": "cycle-abu-dual-land",
  "og duals": "cycle-abu-dual-land",
  "original abu dual lands": "cycle-abu-dual-land"
};

/**
 * Robustly checks if a cycle object or ID matches any entry in a cycle Set.
 * Supports exact IDs, exact names, aliases, singular/plural, and trimmed forms.
 */
export function isCycleInSet(cycleDataOrId, cycleSet) {
  if (!cycleDataOrId || !cycleSet || cycleSet.size === 0) return false;
  const cycleId = typeof cycleDataOrId === "string"
    ? cycleDataOrId.toLowerCase().trim()
    : (cycleDataOrId.id || cycleDataOrId.cycleId || "").toLowerCase().trim();
  const cycleName = typeof cycleDataOrId === "object"
    ? (cycleDataOrId.name || cycleDataOrId.cycleName || "").toLowerCase().trim()
    : "";

  if (cycleId && cycleSet.has(cycleId)) return true;
  if (cycleName && cycleSet.has(cycleName)) return true;

  // Check alias lookup
  for (const [alias, canonicalId] of Object.entries(CYCLE_ALIASES)) {
    if (cycleSet.has(alias) && (cycleId === canonicalId || cycleName.includes(alias))) {
      return true;
    }
    if ((cycleId === alias || cycleName === alias) && cycleSet.has(canonicalId)) {
      return true;
    }
  }

  // Singular/plural checks (e.g. "painlands" vs "painland")
  const stripS = s => (s.endsWith("s") ? s.slice(0, -1) : s);
  const addS = s => (s.endsWith("s") ? s : s + "s");

  if (cycleName && (cycleSet.has(stripS(cycleName)) || cycleSet.has(addS(cycleName)))) return true;
  if (cycleId && (cycleSet.has(stripS(cycleId)) || cycleSet.has(addS(cycleId)))) return true;

  // Match without "cycle-" prefix (e.g. "fetchland" matches "cycle-fetchland")
  const idWithoutPrefix = cycleId.replace(/^cycle-/, "");
  if (
    idWithoutPrefix &&
    (cycleSet.has(idWithoutPrefix) || cycleSet.has(stripS(idWithoutPrefix)) || cycleSet.has(addS(idWithoutPrefix)))
  ) {
    return true;
  }

  for (const item of cycleSet) {
    const itemWithoutPrefix = item.replace(/^cycle-/, "");
    if (cycleId === item || (idWithoutPrefix && idWithoutPrefix === itemWithoutPrefix)) return true;
    if (cycleName && (cycleName.includes(item) || item.includes(cycleName))) return true;
  }

  return false;
}

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
      console.error("[LandAnalyzer] Error loading land cycles from file, using fallback catalog:", e);
    }
  }
  return FALLBACK_LAND_CYCLES;
}

/**
 * Parses commander names (handles partner / background commanders) and extracts color identity.
 * Gracefully falls back to inferring deck colors from deck cards when no commander is defined.
 */
function extractCommanderColors(commanderName, cardMap, deckCardNames) {
  const colors = new Set();
  if (
    !commanderName ||
    typeof commanderName !== "string" ||
    !commanderName.trim() ||
    ["none", "unknown", "n/a", "no commander", "null", "undefined"].includes(commanderName.trim().toLowerCase())
  ) {
    return inferDeckColors(deckCardNames, cardMap);
  }

  // Check known commander colors first
  const lowerCmd = commanderName.toLowerCase().trim();
  if (KNOWN_COMMANDER_COLORS[lowerCmd]) {
    return [...KNOWN_COMMANDER_COLORS[lowerCmd]];
  }

  // Handle partner commanders e.g. "Thrasios, Triton Hero / Tymna the Weaver" or "Thrasios, Triton Hero // Tymna the Weaver"
  const parts = commanderName.split(/\s*(?:\/|\/\/|\+)\s*/).map(p => p.trim()).filter(Boolean);
  let foundAny = false;

  for (const part of parts) {
    const partLower = part.toLowerCase();
    if (KNOWN_COMMANDER_COLORS[partLower]) {
      foundAny = true;
      KNOWN_COMMANDER_COLORS[partLower].forEach(c => colors.add(c.toUpperCase()));
      continue;
    }
    const card = cardMap.get(partLower);
    if (card && Array.isArray(card.color_identity)) {
      foundAny = true;
      card.color_identity.forEach(c => colors.add(c.toUpperCase()));
    }
  }

  if (foundAny) {
    return Array.from(colors).sort();
  }

  return inferDeckColors(deckCardNames, cardMap);
}

/**
 * Fallback to infer deck colors from distinct deck cards (basics, duals, fetches, known cards, and cached scryfall data).
 */
function inferDeckColors(deckCardNames, cardMap) {
  const colors = new Set();
  if (!Array.isArray(deckCardNames) || deckCardNames.length === 0) {
    return [];
  }

  for (const name of deckCardNames) {
    if (!name || typeof name !== "string") continue;
    const lower = name.toLowerCase().trim();
    if (BASIC_LAND_COLORS[lower]) {
      BASIC_LAND_COLORS[lower].forEach(c => colors.add(c));
      continue;
    }
    if (LAND_COLOR_REQUIREMENTS[lower]) {
      LAND_COLOR_REQUIREMENTS[lower].forEach(c => colors.add(c));
      continue;
    }
    if (KNOWN_COMMANDER_COLORS[lower]) {
      KNOWN_COMMANDER_COLORS[lower].forEach(c => colors.add(c));
      continue;
    }
    const card = cardMap.get(lower);
    if (card && Array.isArray(card.color_identity)) {
      card.color_identity.forEach(c => colors.add(c.toUpperCase()));
    }
  }
  return Array.from(colors).sort();
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
 * Checks if a candidate land's colors match the color requirement of at least one cut land.
 * Supports exact dual color matches, mono-color inclusions, multi-color subsets, and rainbow lands.
 */
export function doesLandMatchAnyCut(cardColors, cutColorProfiles, deckColors = []) {
  if (!cutColorProfiles || cutColorProfiles.length === 0) {
    return true; // No cuts to match against; any on-color candidate is eligible
  }

  const sortedCard = [...(cardColors || [])].sort();

  for (const cutColors of cutColorProfiles) {
    const sortedCut = [...(cutColors || [])].sort();

    // 1. Cut land is rainbow/any-color (0 required colors or covers full deck colors)
    if (sortedCut.length === 0) {
      return true;
    }

    // 2. Candidate land is rainbow (0 required colors, e.g. Command Tower, Mana Confluence)
    if (sortedCard.length === 0) {
      return true;
    }

    // 3. Exact color match (e.g. dual land ["G", "R"] matches cut ["G", "R"])
    if (sortedCard.length === sortedCut.length) {
      if (sortedCard.every((c, i) => c === sortedCut[i])) {
        return true;
      }
    }

    // 4. Cut is mono-color (1 color), candidate produces that color
    if (sortedCut.length === 1 && sortedCard.includes(sortedCut[0])) {
      return true;
    }

    // 5. Cut is 3+ colors (tri-land), candidate produces a non-empty subset
    if (sortedCut.length >= 3 && sortedCard.length > 0 && sortedCard.length <= sortedCut.length) {
      if (sortedCard.every(c => sortedCut.includes(c))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Core land analyzer function supporting user preferences, budget tiers, and deduplicated recommendations.
 *
 * @param {string} commanderName - Commander name (or combined partner names)
 * @param {string[]} deckCardNames - Array of card names in the deck
 * @param {object} [options={}] - Custom configuration/preferences
 * @param {string} [options.budgetTier='all'] - 'all' | 'high' | 'mid' | 'budget' | 'ultra_budget'
 * @param {number|null} [options.maxPricePerLand=null] - Maximum USD price per land
 * @param {boolean} [options.suggestCheapestLikedAlternative=false] - Prioritize lowest price among alternatives in liked cycles
 * @param {boolean} [options.preferHighestTierLiked=true] - Prioritize higher tier cycles (top > mid > bottom)
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
  const rawMaxPrice = options.maxPricePerLand;
  const hasValidMaxPrice =
    rawMaxPrice !== null &&
    rawMaxPrice !== undefined &&
    rawMaxPrice !== "" &&
    !isNaN(Number(rawMaxPrice));

  const budgetThreshold = hasValidMaxPrice
    ? parseFloat(rawMaxPrice)
    : BUDGET_TIER_THRESHOLDS[budgetTier] || Infinity;

  const isBudgetRestricted = budgetTier !== "all" || budgetThreshold < 100;
  const excludeReservedList =
    options.excludeReservedList !== undefined
      ? !!options.excludeReservedList
      : isBudgetRestricted; // default true if budget-conscious, false if unlimited

  const excludeTapped = options.excludeTapped !== undefined ? !!options.excludeTapped : true;

  const suggestCheapestLikedAlternative =
    options.suggestCheapestLikedAlternative !== undefined
      ? !!options.suggestCheapestLikedAlternative
      : false;

  const preferHighestTierLiked =
    options.preferHighestTierLiked !== undefined
      ? !!options.preferHighestTierLiked
      : true;

  const likedCyclesSet = new Set(
    (options.likedCycles || []).map(c => (typeof c === "string" ? c.toLowerCase() : ""))
  );
  const dislikedCyclesSet = new Set(
    (options.dislikedCycles || []).map(c => (typeof c === "string" ? c.toLowerCase() : ""))
  );

  const maxSuggestions = options.maxSuggestions || 14;

  console.log(`[LandAnalyzer] analyzeLands started for commander='${commanderName || "unknown"}' (deck cards: ${deckCardNames?.length || 0})`, {
    budgetTier,
    budgetThreshold: isFinite(budgetThreshold) ? budgetThreshold : null,
    suggestCheapestLikedAlternative,
    preferHighestTierLiked,
    excludeReservedList,
    excludeTapped,
    likedCycles: Array.from(likedCyclesSet),
    dislikedCycles: Array.from(dislikedCyclesSet)
  });

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
    const isBasicLand = !!BASIC_LAND_COLORS[lower];
    const isLand =
      isBasicLand ||
      (card && card.type_line && card.type_line.includes("Land")) ||
      cycleLookup.has(lower) ||
      LAND_COLOR_REQUIREMENTS[lower] !== undefined;

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
    const isDislikedCycle = isCycleInSet(cycleData, dislikedCyclesSet);
    const isLikedCycle = isCycleInSet(cycleData, likedCyclesSet);

    let cutReason = null;

    if (isDislikedCycle) {
      cutReason = `Disliked cycle (${cycleData ? cycleData.cycleName : "Unknown"})`;
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
      (cycleData.cycleName.toLowerCase().includes("gainland") ||
        cycleData.cycleName.toLowerCase().includes("tapland") ||
        cycleData.cycleName.toLowerCase().includes("campus") ||
        cycleData.cycleName.toLowerCase().includes("refugeland"))
    ) {
      cutReason = `Enters tapped (${cycleData.cycleName})`;
    }

    if (cutReason) {
      seenCutNames.add(lower);
      const reqColors = getLandRequiredColors(card ? card.name : name, card);
      cuts.push({
        name: card ? card.name : name,
        reason: cutReason,
        cycle: cycleData ? cycleData.cycleName : null,
        tier: cycleData ? cycleData.tier : "bottom",
        image_uri: card?.image_uris?.normal || card?.card_faces?.[0]?.image_uris?.normal || null,
        colors: reqColors
      });
    }
  }

  // Extract cut color profiles for color-matched recommendations
  const cutColorProfiles = cuts.map(cut => {
    const cutCard = cardMap.get(cut.name.toLowerCase());
    const colors = getLandRequiredColors(cut.name, cutCard);
    return [...colors].sort();
  });

  // 5. Identify Suggested Adds (Deduplicated, Color-Matching, Budget-Conscious)
  const candidateAdds = [];
  const seenAddNames = new Set();
  const isLikedCyclesSpecified = Array.isArray(options.likedCycles);
  const hasLikedCycles = likedCyclesSet.size > 0;

  for (const cycle of landCycles) {
    // Check if this cycle is disliked / excluded
    if (isCycleInSet(cycle, dislikedCyclesSet)) {
      continue;
    }

    // Check Reserved List exclusion
    const cycleIdLower = (cycle.id || "").toLowerCase();
    if (excludeReservedList && cycleIdLower.includes("abu-dual")) {
      continue;
    }

    const isExplicitlyLiked = isCycleInSet(cycle, likedCyclesSet);

    // If liked cycles are specified:
    // When the user has liked cycles (hasLikedCycles), ONLY recommend lands from those liked cycles!
    // When the user explicitly specified an empty liked cycles list (isLikedCyclesSpecified && !hasLikedCycles),
    // no lands are recommended as upgrades since the user has no liked cycles selected.
    if (hasLikedCycles && !isExplicitlyLiked) {
      continue;
    }
    if (isLikedCyclesSpecified && !hasLikedCycles) {
      continue;
    }

    // Check Tapped exclusion
    if (
      excludeTapped &&
      cycle.tier === "bottom" &&
      !isExplicitlyLiked
    ) {
      continue;
    }

    const cards = Array.isArray(cycle.cards) ? cycle.cards : [];

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

      // Color compatibility check (strict on-color with deck)
      if (!isLandColorCompatible(cardName, card, deckColors)) {
        continue;
      }

      // If cuts exist, suggest the land in each cycle that matches the cut land's color
      const cardColors = getLandRequiredColors(cardName, card);
      if (cuts.length > 0 && !doesLandMatchAnyCut(cardColors, cutColorProfiles, deckColors)) {
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
        price: priceNum,
        isLikedCycle: isExplicitlyLiked,
        colors: cardColors
      });
    }
  }

  // Sort candidate adds based on user preferences:
  // 1. preferHighestTierLiked: prioritize top tier (always untapped) > mid tier (conditionally untapped) > bottom tier (always tapped)
  // 2. suggestCheapestLikedAlternative: prioritize lowest market price
  // 3. Cycle priority score & price tie-breaker
  const TIER_RANKS = {
    top: 3,     // always untapped
    mid: 2,     // conditionally untapped
    bottom: 1   // always tapped
  };

  candidateAdds.sort((a, b) => {
    // 1. Tier preference (always untapped > conditionally untapped > always tapped)
    if (preferHighestTierLiked) {
      const rankA = TIER_RANKS[a.tier] || 2;
      const rankB = TIER_RANKS[b.tier] || 2;
      if (rankA !== rankB) {
        return rankB - rankA;
      }
    }

    // 2. Cheapest alternative preference
    if (suggestCheapestLikedAlternative) {
      const priceA = a.price !== null && a.price !== undefined && !isNaN(a.price) ? a.price : Infinity;
      const priceB = b.price !== null && b.price !== undefined && !isNaN(b.price) ? b.price : Infinity;
      if (priceA !== priceB) {
        return priceA - priceB;
      }
    }

    // 3. Fall back to priority score descending
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }

    // 4. Fall back to price if priority is equal
    const priceA = a.price !== null && a.price !== undefined && !isNaN(a.price) ? a.price : Infinity;
    const priceB = b.price !== null && b.price !== undefined && !isNaN(b.price) ? b.price : Infinity;
    return priceA - priceB;
  });

  const adds = candidateAdds.slice(0, maxSuggestions);

  console.log(`[LandAnalyzer] analyzeLands completed for '${commanderName || "unknown"}': ${adds.length} adds, ${cuts.length} cuts, colors=[${deckColors.join(", ")}]`);

  return {
    cuts,
    adds,
    colorIdentity: deckColors,
    preferencesApplied: {
      budgetTier,
      budgetThreshold: isFinite(budgetThreshold) ? budgetThreshold : null,
      suggestCheapestLikedAlternative,
      preferHighestTierLiked,
      excludeReservedList,
      excludeTapped,
      likedCyclesCount: likedCyclesSet.size,
      dislikedCyclesCount: dislikedCyclesSet.size
    }
  };
}
