// frontend/src/data/landCyclesConfig.js

export const BUDGET_TIERS = [
  {
    id: "ultra_budget",
    label: "Ultra Budget (< $1.00)",
    shortLabel: "< $1",
    maxPrice: 1.0,
    description: "Budget-friendly duals, landscapes, panoramas, and bouncelands"
  },
  {
    id: "budget",
    label: "Budget Conscious (< $3.50)",
    shortLabel: "< $3.50",
    maxPrice: 3.5,
    description: "Painlands, checklands, reveal lands, filter lands, tango lands"
  },
  {
    id: "mid",
    label: "Mid Power (< $10.00)",
    shortLabel: "< $10",
    maxPrice: 10.0,
    description: "Fastlands, slowlands, pathways, verges, horizon lands, bondlands"
  },
  {
    id: "high",
    label: "High Power (< $25.00)",
    shortLabel: "< $25",
    maxPrice: 25.0,
    description: "Shocklands, fetchlands, triomes, surveil lands"
  },
  {
    id: "all",
    label: "Unlimited / All",
    shortLabel: "No Limit",
    maxPrice: null,
    description: "No price caps (includes high-end staples and optional vintage duals)"
  }
];

export const LAND_CYCLE_CATEGORIES = {
  fast_duals: {
    id: "fast_duals",
    label: "Fast & Untapped Duals",
    description: "Enters untapped immediately or with common board states"
  },
  utility_fixing: {
    id: "utility_fixing",
    label: "Utility, Surveil & Tri-Lands",
    description: "Provides card selection, cycling, or 3-color fixing"
  },
  budget_tempo: {
    id: "budget_tempo",
    label: "Budget & Tapped Fixers",
    description: "Enters tapped in exchange for affordability or life/scry benefits"
  }
};

export const LAND_CYCLES_CATALOG = [
  {
    id: "cycle-fetchland",
    name: "Fetchlands",
    category: "fast_duals",
    speed: "untapped",
    tier: "top",
    typicalPrice: "$10 - $25",
    sampleCards: ["Polluted Delta", "Wooded Foothills", "Scalding Tarn", "Flooded Strand", "Bloodstained Mire", "Misty Rainforest"]
  },
  {
    id: "cycle-rav-shockland",
    name: "Shocklands",
    category: "fast_duals",
    speed: "untapped",
    tier: "top",
    typicalPrice: "$8 - $18",
    sampleCards: ["Blood Crypt", "Overgrown Tomb", "Steam Vents", "Stomping Ground", "Watery Grave", "Breeding Pool"]
  },
  {
    id: "cycle-bondland",
    name: "Crowd / Bondlands",
    category: "fast_duals",
    speed: "untapped",
    tier: "top",
    typicalPrice: "$6 - $14",
    sampleCards: ["Sea of Clouds", "Morphic Pool", "Luxury Suite", "Spire Garden", "Bountiful Promenade", "Undergrowth Stadium"]
  },
  {
    id: "cycle-dual-surveil-land",
    name: "Dual Surveil Lands",
    category: "utility_fixing",
    speed: "tapped",
    tier: "top",
    typicalPrice: "$7 - $15",
    sampleCards: ["Commercial District", "Hedge Maze", "Raucous Theater", "Thundering Falls", "Undercity Sewers", "Underground Mortuary"]
  },
  {
    id: "cycle-painland",
    name: "Painlands",
    category: "fast_duals",
    speed: "untapped",
    tier: "mid",
    typicalPrice: "$1 - $4",
    sampleCards: ["Karplusan Forest", "Sulfurous Springs", "Underground River", "Yavimaya Coast", "Caves of Koilos", "Llanowar Wastes"]
  },
  {
    id: "cycle-slowland",
    name: "Slowlands",
    category: "fast_duals",
    speed: "conditional",
    tier: "mid",
    typicalPrice: "$3 - $8",
    sampleCards: ["Rockfall Vale", "Shipwreck Marsh", "Haunted Ridge", "Overgrown Farmland", "Deserted Beach", "Deathcap Glade"]
  },
  {
    id: "cycle-fastland",
    name: "Fastlands",
    category: "fast_duals",
    speed: "conditional",
    tier: "mid",
    typicalPrice: "$2 - $6",
    sampleCards: ["Copperline Gorge", "Blackcleave Cliffs", "Darkslick Shores", "Seachrome Coast", "Razorverge Thicket", "Blooming Marsh"]
  },
  {
    id: "cycle-hybrid-filterland",
    name: "Hybrid Filterlands",
    category: "utility_fixing",
    speed: "untapped",
    tier: "mid",
    typicalPrice: "$2 - $5",
    sampleCards: ["Fire-Lit Thicket", "Sunken Ruins", "Graven Cairns", "Cascade Bluffs", "Twilight Mire", "Mystic Gate"]
  },
  {
    id: "cycle-pathway",
    name: "Pathways (Modal DFC)",
    category: "fast_duals",
    speed: "untapped",
    tier: "mid",
    typicalPrice: "$4 - $9",
    sampleCards: ["Cragcrown Pathway", "Clearwater Pathway", "Blightstep Pathway", "Barkchannel Pathway", "Branchloft Pathway"]
  },
  {
    id: "cycle-checkland",
    name: "Checklands",
    category: "utility_fixing",
    speed: "conditional",
    tier: "mid",
    typicalPrice: "$1.50 - $4",
    sampleCards: ["Rootbound Crag", "Dragonskull Summit", "Drowned Catacomb", "Glacial Fortress", "Sunpetal Grove", "Sulfur Falls"]
  },
  {
    id: "cycle-verge",
    name: "Verges",
    category: "fast_duals",
    speed: "untapped",
    tier: "mid",
    typicalPrice: "$4 - $12",
    sampleCards: ["Thornspire Verge", "Blazemire Verge", "Floodfarm Verge", "Gloomlake Verge", "Hushwood Verge", "Sunbillow Verge"]
  },
  {
    id: "cycle-horizon-land",
    name: "Horizon Canopy Lands",
    category: "utility_fixing",
    speed: "untapped",
    tier: "mid",
    typicalPrice: "$3 - $8",
    sampleCards: ["Horizon Canopy", "Fiery Islet", "Nurturing Peatland", "Silent Clearing", "Sunbaked Canyon", "Waterlogged Grove"]
  },
  {
    id: "tricycle-land",
    name: "Triomes (Ikoria & Capenna)",
    category: "utility_fixing",
    speed: "tapped",
    tier: "mid",
    typicalPrice: "$10 - $18",
    sampleCards: ["Ziatora's Proving Ground", "Jetmir's Garden", "Raffine's Tower", "Xander's Lounge", "Spara's Headquarters", "Ketria Triome"]
  },
  {
    id: "cycle-tangoland",
    name: "Tango / Battle Lands",
    category: "utility_fixing",
    speed: "conditional",
    tier: "mid",
    typicalPrice: "$0.40 - $1.50",
    sampleCards: ["Cinder Glade", "Smoldering Marsh", "Sunken Hollow", "Canopy Vista", "Prairie Stream"]
  },
  {
    id: "cycle-mh3-landscape",
    name: "MH3 Landscapes",
    category: "utility_fixing",
    speed: "untapped",
    tier: "mid",
    typicalPrice: "$0.20 - $0.50",
    sampleCards: ["Foreboding Landscape", "Bountiful Landscape", "Contaminated Landscape", "Perilous Landscape", "Seething Landscape"]
  },
  {
    id: "cycle-ody-filterland",
    name: "Odyssey Filterlands",
    category: "utility_fixing",
    speed: "untapped",
    tier: "mid",
    typicalPrice: "$0.30 - $1.00",
    sampleCards: ["Mossfire Valley", "Shadowblood Ridge", "Darkwater Catacombs", "Skycloud Expanse", "Sungrass Prairie"]
  },
  {
    id: "cycle-reveal-land",
    name: "Reveal / Snarl Lands",
    category: "budget_tempo",
    speed: "conditional",
    tier: "mid",
    typicalPrice: "$0.30 - $0.80",
    sampleCards: ["Game Trail", "Foreboding Ruins", "Choked Estuary", "Port Town", "Fortified Village", "Frostboil Snarl"]
  },
  {
    id: "cycle-tor-tainted-land",
    name: "Tainted Lands",
    category: "budget_tempo",
    speed: "conditional",
    tier: "mid",
    typicalPrice: "$0.25 - $0.60",
    sampleCards: ["Tainted Peak", "Tainted Wood", "Tainted Isle", "Tainted Field"]
  },
  {
    id: "cycle-restless-land",
    name: "Restless Creaturelands",
    category: "utility_fixing",
    speed: "tapped",
    tier: "mid",
    typicalPrice: "$0.50 - $2.00",
    sampleCards: ["Restless Ridgeline", "Restless Vents", "Restless Cottage", "Restless Spire", "Restless Anchorage", "Restless Prairie"]
  },
  {
    id: "cycle-rav-bounceland",
    name: "Ravnica Bouncelands",
    category: "budget_tempo",
    speed: "tapped",
    tier: "bottom",
    typicalPrice: "$0.20 - $0.60",
    sampleCards: ["Gruul Turf", "Rakdos Carnarium", "Dimir Aqueduct", "Azorius Chancery", "Selesnya Sanctuary", "Golgari Rot Farm"]
  },
  {
    id: "cycle-block-ths-scry-land",
    name: "Scry / Temple Lands",
    category: "budget_tempo",
    speed: "tapped",
    tier: "bottom",
    typicalPrice: "$0.20 - $0.50",
    sampleCards: ["Temple of Abandon", "Temple of Malice", "Temple of Deceit", "Temple of Enlightenment", "Temple of Plenty"]
  },
  {
    id: "cycle-mrd-artifact-land",
    name: "Artifact Lands",
    category: "utility_fixing",
    speed: "untapped",
    tier: "mid",
    typicalPrice: "$0.50 - $2.00",
    sampleCards: ["Great Furnace", "Tree of Tales", "Vault of Whispers", "Seat of the Synod", "Ancient Den"]
  },
  {
    id: "cycle-ala-panorama",
    name: "Shards Panoramas",
    category: "budget_tempo",
    speed: "untapped",
    tier: "bottom",
    typicalPrice: "$0.20 - $0.40",
    sampleCards: ["Jund Panorama", "Grixis Panorama", "Esper Panorama", "Bant Panorama", "Naya Panorama"]
  },
  {
    id: "cycle-guildgate",
    name: "Guildgates",
    category: "budget_tempo",
    speed: "tapped",
    tier: "bottom",
    typicalPrice: "$0.15 - $0.30",
    sampleCards: ["Gruul Guildgate", "Rakdos Guildgate", "Dimir Guildgate", "Azorius Guildgate", "Selesnya Guildgate"]
  },
  {
    id: "cycle-ktk-gainland",
    name: "Gainlands / Refuges",
    category: "budget_tempo",
    speed: "tapped",
    tier: "bottom",
    typicalPrice: "$0.10 - $0.25",
    sampleCards: ["Rugged Highlands", "Bloodfell Caves", "Dismal Backwater", "Tranquil Cove", "Blossoming Sands", "Jungle Hollow"]
  },
  {
    id: "cycle-stx-campus",
    name: "Strixhaven Campuses",
    category: "budget_tempo",
    speed: "tapped",
    tier: "bottom",
    typicalPrice: "$0.15 - $0.30",
    sampleCards: ["Quandrix Campus", "Prismari Campus", "Silverquill Campus", "Lorehold Campus", "Witherbloom Campus"]
  },
  {
    id: "cycle-abu-dual-land",
    name: "Original ABU Dual Lands (Reserved List)",
    category: "fast_duals",
    speed: "untapped",
    tier: "top",
    typicalPrice: "$400 - $800+",
    sampleCards: ["Taiga", "Badlands", "Underground Sea", "Volcanic Island", "Tropical Island", "Tundra", "Bayou", "Savannah", "Scrubland", "Plateau"]
  }
];
