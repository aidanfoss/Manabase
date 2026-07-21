x kill porimport fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readJsonSafe } from "../utils/safeJson.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = path.join(__dirname, "colors");

// Create colors directory if it doesn't exist
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created colors directory: ${dir}`);

    // Create some default color data files
    const defaultColors = {
        'w': {
            name: 'White',
            staples: ['Swords to Plowshares', 'Path to Exile', 'Teferi\'s Protection'],
            description: 'White color identity cards'
        },
        'u': {
            name: 'Blue',
            staples: ['Counterspell', 'Brainstorm', 'Force of Will'],
            description: 'Blue color identity cards'
        },
        'b': {
            name: 'Black',
            staples: ['Dark Ritual', 'Reanimate', 'Entomb'],
            description: 'Black color identity cards'
        },
        'r': {
            name: 'Red',
            staples: ['Lightning Bolt', 'Faithless Looting', 'Wheel of Fortune'],
            description: 'Red color identity cards'
        },
        'g': {
            name: 'Green',
            staples: ['Green Sun\'s Zenith', 'Eternal Witness', 'Worldly Tutor'],
            description: 'Green color identity cards'
        },
        'wu': {
            name: 'Azorius',
            staples: ['Supreme Verdict', 'The Wandering Emperor', 'Teferi, Hero of Dominaria'],
            description: 'White/Blue color identity cards'
        },
        'wb': {
            name: 'Orzhov',
            staples: ['Kaya\'s Guile', 'Anguished Unmaking', 'Vindicate'],
            description: 'White/Black color identity cards'
        },
        'ub': {
            name: 'Dimir',
            staples: ['Jace, the Mind Sculptor', 'Force of Negation', 'Drown in the Loch'],
            description: 'Blue/Black color identity cards'
        },
        'ur': {
            name: 'Izzet',
            staples: ['Expressive Iteration', 'Lightning Bolt', 'Counterspell'],
            description: 'Blue/Red color identity cards'
        },
        'ug': {
            name: 'Simic',
            staples: ['Growth Spiral', 'Kinnan, Bonder Prodigy', 'Thrasios, Triton Hero'],
            description: 'Blue/Green color identity cards'
        },
        'br': {
            name: 'Rakdos',
            staples: ['Kolaghan\'s Command', 'Dreadbore', 'Terminate'],
            description: 'Black/Red color identity cards'
        },
        'bg': {
            name: 'Golgari',
            staples: ['Assassin\'s Trophy', 'Grisly Salvage', 'Meren of Clan Nel Toth'],
            description: 'Black/Green color identity cards'
        },
        'rg': {
            name: 'Gruul',
            staples: ['Domri, Anarch of Bolas', 'Wrenn and Six', 'Bloodbraid Elf'],
            description: 'Red/Green color identity cards'
        },
        'rw': {
            name: 'Boros',
            staples: ['Nahiri, the Harbinger', 'Gideon of the Trials', 'Lightning Helix'],
            description: 'Red/White color identity cards'
        },
        'gw': {
            name: 'Selesnya',
            staples: ['Trostani Discordant', 'Mirari\'s Wake', 'Aura Shards'],
            description: 'Green/White color identity cards'
        },
        'wubrg': {
            name: 'WUBRG',
            staples: ['Bring to Light', 'Conflux', 'Transguild Courier'],
            description: 'Five-color cards'
        }
    };

    // Write default color files
    for (const [code, data] of Object.entries(defaultColors)) {
        const filePath = path.join(dir, `${code}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    console.log(`✅ Created ${Object.keys(defaultColors).length} default color files`);
}

const colors = [];

if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    for (const file of files) {
        const jsonPath = path.join(dir, file);
        const data = readJsonSafe(jsonPath, {});
        const name =
            data.name ||
            file
                .replace(/\.json$/i, "")
                .toUpperCase();

        colors.push({
            name,
            code: file.replace(/\.json$/i, ""), // e.g. 'wb', 'w', 'wubrg'
            staples: data.staples || [],
            description: data.description || "",
            ...data
        });
    }
} else {
    console.warn(`⚠️ colors folder not found: ${dir}`);
}

export default colors;
