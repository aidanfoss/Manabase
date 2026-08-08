import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { db } from '../db/connection.js';
import { disableUserMoxfieldDecksAndClearItems, parseMoxfieldDeckId } from '../services/moxfieldSync.js';

describe('Moxfield Support & Sync Lifecycle', () => {
  it('should parse Moxfield deck IDs and URLs correctly', () => {
    expect(parseMoxfieldDeckId('oEWXWHM5eEGMmopExLWRCA')).toBe('oEWXWHM5eEGMmopExLWRCA');
    expect(parseMoxfieldDeckId('https://moxfield.com/decks/oEWXWHM5eEGMmopExLWRCA')).toBe('oEWXWHM5eEGMmopExLWRCA');
    expect(parseMoxfieldDeckId('https://www.moxfield.com/decks/oEWXWHM5eEGMmopExLWRCA/primer')).toBe('oEWXWHM5eEGMmopExLWRCA');
  });

  it('should update Moxfield tag mappings for authenticated user', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'moxfielduser@example.com', username: 'MoxfieldUser', password: 'password123' });
    expect(regRes.status).toBe(200);
    const token = regRes.body.token;

    const configRes = await request(app)
      .put('/api/moxfield/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ tag_mappings: { Mainboard: 'owned', Wishlist: 'wishlist' } });

    expect(configRes.status).toBe(200);
    expect(configRes.body.message).toContain('updated');

    const userInDb = await db('users').where({ id: regRes.body.user.id }).first();
    const mappings = typeof userInDb.moxfield_tag_mappings === 'string'
      ? JSON.parse(userInDb.moxfield_tag_mappings)
      : userInDb.moxfield_tag_mappings;
    expect(mappings.Mainboard).toBe('owned');
  });

  it('should manage saved Moxfield decks in DB and clear on proxy list clear', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'moxfielddeck@example.com', username: 'MoxfieldDeckUser', password: 'password123' });
    expect(regRes.status).toBe(200);
    const token = regRes.body.token;
    const userId = regRes.body.user.id;

    const deckId = 'mox_deck_123';
    await db('user_archidekt_decks').insert({
      user_id: userId,
      deck_id: deckId,
      deck_name: 'Moxfield Commander Deck',
      status: 'active',
      source: 'moxfield',
      commander: 'Atraxa, Praetors Voice'
    });

    await db('user_archidekt_deck_items').insert([
      { user_id: userId, deck_id: deckId, card_name: 'Rhystic Study', list_type: 'owned', set_code: 'WOT', is_foil: true, quantity: 1, source: 'moxfield' },
      { user_id: userId, deck_id: deckId, card_name: 'Cyclonic Rift', list_type: 'wishlist', set_code: 'RTR', is_foil: false, quantity: 1, source: 'moxfield' }
    ]);

    await db('user_cards').insert([
      { user_id: userId, card_name: 'Rhystic Study', list_type: 'owned', set_code: 'WOT', is_foil: true, card_condition: 'NM', card_language: 'EN', quantity: 1 },
      { user_id: userId, card_name: 'Cyclonic Rift', list_type: 'wishlist', set_code: 'RTR', is_foil: false, card_condition: 'NM', card_language: 'EN', quantity: 1 }
    ]);

    // Test GET /api/moxfield/decks
    const decksRes = await request(app)
      .get('/api/moxfield/decks')
      .set('Authorization', `Bearer ${token}`);

    expect(decksRes.status).toBe(200);
    expect(decksRes.body.length).toBe(1);
    expect(decksRes.body[0].deck_name).toBe('Moxfield Commander Deck');
    expect(decksRes.body[0].source).toBe('moxfield');

    // Test clearing Moxfield decks via disable service
    await disableUserMoxfieldDecksAndClearItems(userId);

    const deckAfter = await db('user_archidekt_decks').where({ user_id: userId, deck_id: deckId }).first();
    expect(deckAfter.status).toBe('disabled');

    const itemsAfter = await db('user_archidekt_deck_items').where({ user_id: userId, source: 'moxfield' });
    expect(itemsAfter.length).toBe(0);
  });
});
