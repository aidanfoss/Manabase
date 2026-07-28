import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = ms => new Promise(res => setTimeout(res, ms));

const tiers = {
  top: [
    'otag:cycle-abu-dual-land',
    'otag:cycle-fetchland',
    'otag:cycle-rav-shockland',
    'otag:cycle-painland',
    'otag:cycle-horizon-land',
    'otag:cycle-bondland'
  ],
  mid: [
    'otag:cycle-fastland',
    'otag:cycle-slowland',
    'otag:cycle-checkland',
    'otag:cycle-reveal-land',
    'otag:cycle-pathway',
    'otag:cycle-tangoland',
    'otag:cycle-hybrid-filterland',
    'otag:cycle-ody-filterland',
    'otag:cycle-rav-bounceland',
    'otag:cycle-dual-surveil-land',
    'otag:cycle-dual-creatureland',
    'otag:cycle-restless-land',
    'otag:cycle-verge',
    'otag:cycle-tor-tainted-land',
    'otag:cycle-isd-allied-utilityland',
    'otag:cycle-dka-enemy-utilityland',
    'otag:cycle-mrd-artifact-land',
    'otag:cycle-mh2-bridge',
    'otag:cycle-mh3-landscape'
  ],
  bottom: [
    'otag:tricycle-land',
    'otag:cycle-triland',
    'otag:cycle-block-ths-scry-land',
    'otag:cycle-cycling-land',
    'otag:cycle-dual-cycling-land',
    'otag:cycle-guildgate',
    'otag:cycle-clb-thriving-gate',
    'otag:cycle-jmp-thriving-land',
    'otag:cycle-ktk-gainland',
    'otag:cycle-tmt-gainland',
    'otag:cycle-msh-gainland',
    'otag:cycle-dual-tapland',
    'otag:cycle-tla-c-tapland',
    'otag:cycle-snc-c-tapland',
    'otag:cycle-khm-snow-tapland',
    'otag:cycle-csp-snow-tapland',
    'otag:cycle-stx-campus',
    'otag:cycle-ala-panorama',
    'otag:cycle-lrw-vivid-land',
    'otag:cycle-zen-refugeland',
    'otag:cycle-otj-pingland'
  ]
};

function formatName(tag) {
  // e.g. otag:cycle-shock-land -> Shock Land
  let name = tag.replace('otag:cycle-', '').replace('otag:', '').replace('is:', '').replace('t:', '').replace(' t:land', '').trim();
  return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function fetchTagCards(query) {
  const cards = [];
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;

  while (url) {
// console.log(`Fetching ${url}`);
    // Wait 500ms between requests to avoid 429
    await new Promise(r => setTimeout(r, 500));
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ManabaseApp/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!res.ok) {
        if (res.status === 429) {
            console.warn(`️ Rate limited (429). Waiting 15 seconds...`);
            await new Promise(r => setTimeout(r, 15000));
            continue; // retry same url
        }
        if (res.status === 404) {
            console.warn(`️ Query ${query} not found on scryfall (404)`);
            return [];
        }
        console.error(` Error fetching ${url}: ${res.status} ${res.statusText}`);
        break;
    }
    const data = await res.json();
    for (const card of data.data) {
        // Handle DFCs by taking the front face name
        const name = card.name.split(' // ')[0];
        if (!cards.includes(name)) {
            cards.push(name);
        }
    }
    url = data.has_more ? data.next_page : null;
    await delay(100); // Respect Scryfall's 10 req/sec limit
  }
  return cards;
}

async function main() {
  const results = [];
  for (const [tier, tags] of Object.entries(tiers)) {
    for (const tag of tags) {
      const cards = await fetchTagCards(tag);
      if (cards.length > 0) {
        results.push({
          id: tag.replace('otag:', '').replace(/[^a-zA-Z0-9-]/g, '-'),
          name: formatName(tag),
          tier: tier,
          cards: cards
        });
      }
    }
  }

  const outPath = path.resolve(__dirname, '../data/landcycles.json');
  await fs.writeFile(outPath, JSON.stringify(results, null, 2));
// console.log(` Saved ${results.length} cycles to ${outPath}`);
}

main().catch(console.error);
