import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { db } from '../db/connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Gluntch Test', () => {
  it('should generate the correct proxy manifest after importing chosen art', async () => {
    // 1. Make a new user called gluntchlover
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'gluntchlover@example.com', username: 'gluntchlover', password: 'password123' });
    expect(regRes.status).toBe(200);
    const token = regRes.body.token;
    const userId = regRes.body.user.id;

    // 2. Make a new playgroup called GluntchSolo
    const pgRes = await request(app)
      .post('/api/playgroups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'GluntchSolo' });
    expect(pgRes.status).toBe(200);
    const playgroupId = pgRes.body.id;

    // 3. Have the user add the 4 cards to their proxy order.
    // Proxy orders draw from wishlist.
    await db('user_cards').insert([
      {
        user_id: userId,
        card_name: 'Gluntch, the Bestower',
        list_type: 'wishlist',
        set_code: 'CLB',
        is_foil: false,
        quantity: 1
      },
      {
        user_id: userId,
        card_name: 'Wear // Tear',
        list_type: 'wishlist',
        set_code: 'DGM',
        is_foil: false,
        quantity: 1
      },
      {
        user_id: userId,
        card_name: 'Generous Gift',
        list_type: 'wishlist',
        set_code: 'MH1',
        is_foil: false,
        quantity: 1
      },
      {
        user_id: userId,
        card_name: 'Stroke of Midnight',
        list_type: 'wishlist',
        set_code: 'WOE',
        is_foil: false,
        quantity: 1
      }
    ]);

    // We also need to set the user's default card back if they have one,
    // though tests/gluntchChosenArt.xml specifies <cardback>1LrVX0pUcye9n_0RtaDNVl2xPrQgn7CYf</cardback>.
    // Usually the backend just serves the proxy arts, the frontend builds the XML.
    // Let's upload the xml art
    const chosenArtXmlPath = path.resolve(__dirname, '../../tests/gluntchChosenArt.xml');
    const chosenArtXml = fs.readFileSync(chosenArtXmlPath, 'utf8');

    const importRes = await request(app)
      .post('/api/user/proxy-arts/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ xml: chosenArtXml });
    expect(importRes.status).toBe(200);

    // Now let's fetch the group wishlist
    const wlRes = await request(app)
      .get(`/api/playgroups/${playgroupId}/wishlist`)
      .set('Authorization', `Bearer ${token}`);
    expect(wlRes.status).toBe(200);
    const printQueue = wlRes.body;
    
    // We expect 4 items
    expect(printQueue.length).toBe(4);
    
    // The items will be returned in insertion order (created_at asc)
    const gluntch = printQueue[0];
    const wearTear = printQueue[1];
    const genGift = printQueue[2];
    const stroke = printQueue[3];
    
    // Check if the art was successfully applied for all
    expect(gluntch.card_name).toBe('Gluntch, the Bestower');
    expect(gluntch.mpcfill_id).toBe('1YhletqWHezOcrsXSE-Tw2_Tcq4uufeeb');
    expect(gluntch.mpcfill_name).toBe('Gluntch the Bestower.jpg');
    expect(gluntch.mpcfill_query).toBe('gluntch bestower');

    expect(wearTear.card_name).toBe('Wear // Tear');
    expect(wearTear.mpcfill_id).toBe('1RLjaV74Hj-QX3rd7BXNJnIdQUmfmxktl');
    expect(wearTear.mpcfill_name).toBe('Wear _ Tear (3).png');
    expect(wearTear.mpcfill_query).toBe('wear tear');

    expect(genGift.card_name).toBe('Generous Gift');
    expect(genGift.mpcfill_id).toBe('15tDzRAfBE2giqjFQm0RhjPauQiiA8Hi_');
    expect(genGift.mpcfill_name).toBe('Generous Gift (Borderless Ron Spears).jpg');
    expect(genGift.mpcfill_query).toBe('generous gift');

    expect(stroke.card_name).toBe('Stroke of Midnight');
    expect(stroke.mpcfill_id).toBe('1XLjHFNLK80BI4Efd8EJie4NTC4KzpnB4');
    expect(stroke.mpcfill_name).toBe('Stroke of Midnight (Memoories of Nibelheim).jpg');
    expect(stroke.mpcfill_query).toBe('stroke of midnight');

    // 4. Export the entire proxy manifest (mimic frontend logic to assemble XML)
    const escapeXml = (str) => {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };

    let cardsXml = '';
    printQueue.forEach((card, index) => {
      cardsXml += `        <card>
            <id>${card.mpcfill_id}</id>
            <slots>${index}</slots>
            <name>${escapeXml(card.mpcfill_name)}</name>
            <query>${escapeXml(card.mpcfill_query)}</query>
        </card>\n`;
    });

    let generatedXml = `<order>
    <details>
        <quantity>4</quantity>
        <bracket>18</bracket>
        <stock>(S30) Standard Smooth</stock>
        <foil>false</foil>
    </details>
    <fronts>
${cardsXml.trimEnd()}
    </fronts>
    <cardback>1LrVX0pUcye9n_0RtaDNVl2xPrQgn7CYf</cardback>
</order>`;

    // 5. It should match tests/gluntchOutputTest.xml
    const outputTestPath = path.resolve(__dirname, '../../tests/gluntchOutputTest.xml');
    const expectedXml = fs.readFileSync(outputTestPath, 'utf8');

    // Normalize newlines for strict comparison
    const normalizeStr = (str) => str.replace(/\r\n/g, '\n').trim();
    
    // Save to disk for manual inspection
    fs.writeFileSync(path.resolve(__dirname, 'glutchOutput.xml'), generatedXml);
    
    expect(normalizeStr(generatedXml)).toBe(normalizeStr(expectedXml));
  });
});
