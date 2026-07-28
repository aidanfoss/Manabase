import fs from 'fs';
import { parseImportInput } from './frontend/src/utils/csvImporter.js';

const txt = fs.readFileSync('./ManaBox_Collection.csv', 'utf8');
const cards = parseImportInput(txt);

const vacuums = cards.filter(c => c.card_name === 'Ghost Vacuum');
console.log("Ghost Vacuums parsed:");
console.log(JSON.stringify(vacuums, null, 2));
