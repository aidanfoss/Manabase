
import { initDB } from './db/connection.js';
import { fetchCardData } from './services/scryfall.js';

async function test() {
    await initDB();
    const c1 = await fetchCardData('Xorn');
    console.log('Xorn:', c1?.image);
    const c2 = await fetchCardData('Niv-Mizzet, Parun');
    console.log('Niv-Mizzet:', c2?.image);
    process.exit(0);
}
test();

