import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { db } from '../db/connection.js';
import { isCutOrExcludedCategory, isCardCutOrExcluded } from '../services/archidektSync.js';

describe('Archidekt Cut Cards & Category Filter', () => {
  describe('isCutOrExcludedCategory', () => {
    it('should identify standard cut and sideboard category names', () => {
      expect(isCutOrExcludedCategory('Cut Cards')).toBe(true);
      expect(isCutOrExcludedCategory('cut cards')).toBe(true);
      expect(isCutOrExcludedCategory('Cut')).toBe(true);
      expect(isCutOrExcludedCategory('cuts')).toBe(true);
      expect(isCutOrExcludedCategory('Sideboard')).toBe(true);
      expect(isCutOrExcludedCategory('sideboard')).toBe(true);
      expect(isCutOrExcludedCategory('Maybeboard')).toBe(true);
      expect(isCutOrExcludedCategory('Considering')).toBe(true);
      expect(isCutOrExcludedCategory('Cut 2024')).toBe(true);
      expect(isCutOrExcludedCategory('Recent Cut')).toBe(true);
    });

    it('should return false for regular deck categories', () => {
      expect(isCutOrExcludedCategory('Commander')).toBe(false);
      expect(isCutOrExcludedCategory('Ramp')).toBe(false);
      expect(isCutOrExcludedCategory('Removal')).toBe(false);
      expect(isCutOrExcludedCategory('Card Advantage')).toBe(false);
      expect(isCutOrExcludedCategory('Lands')).toBe(false);
      expect(isCutOrExcludedCategory(null)).toBe(false);
      expect(isCutOrExcludedCategory('')).toBe(false);
    });

    it('should honor custom excludedCategoryNames set (e.g. from includedInDeck: false)', () => {
      const customExcluded = new Set(['tokens', 'custom-board']);
      expect(isCutOrExcludedCategory('Tokens', customExcluded)).toBe(true);
      expect(isCutOrExcludedCategory('Custom-Board', customExcluded)).toBe(true);
      expect(isCutOrExcludedCategory('Mainboard', customExcluded)).toBe(false);
    });
  });

  describe('isCardCutOrExcluded', () => {
    it('should identify a card with a cut category in item.categories', () => {
      const itemWithCutCat = {
        label: ',#656565',
        categories: ['Creatures', 'Cut Cards'],
        card: { oracleCard: { name: 'Birds of Paradise' } }
      };
      expect(isCardCutOrExcluded(itemWithCutCat)).toBe(true);
    });

    it('should identify a card with a cut category as an object with name', () => {
      const itemWithObjCat = {
        label: '',
        categories: [{ name: 'Sideboard' }],
        card: { oracleCard: { name: 'Rest in Peace' } }
      };
      expect(isCardCutOrExcluded(itemWithObjCat)).toBe(true);
    });

    it('should identify a card whose label color tag is named Cut', () => {
      const itemWithCutLabel = {
        label: 'Cut Cards,#ff0000',
        categories: ['Instants'],
        card: { oracleCard: { name: 'Opt' } }
      };
      expect(isCardCutOrExcluded(itemWithCutLabel)).toBe(true);
    });

    it('should return false for active deck cards', () => {
      const normalItem = {
        label: 'Default color tag',
        categories: ['Commander', 'Creatures'],
        card: { oracleCard: { name: 'The Ur-Dragon' } }
      };
      expect(isCardCutOrExcluded(normalItem)).toBe(false);
    });
  });

  describe('Deck Options API: exclude_side_and_maybeboards', () => {
    it('should update and retrieve exclude_side_and_maybeboards preference', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({ email: 'cutcardsuser@example.com', username: 'CutCardsUser', password: 'password123' });
      expect(regRes.status).toBe(200);
      const token = regRes.body.token;
      const userId = regRes.body.user.id;

      const deckId = 'arch_deck_98765';
      await db('user_archidekt_decks').insert({
        user_id: userId,
        deck_id: deckId,
        deck_name: 'Dragon Tribal',
        status: 'active',
        source: 'archidekt',
        exclude_side_and_maybeboards: true,
        cards: JSON.stringify(['The Ur-Dragon', 'Sol Ring', 'Command Tower'])
      });

      // Fetch saved decks
      const getRes = await request(app)
        .get('/api/archidekt/decks')
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.length).toBe(1);
      expect(getRes.body[0].exclude_side_and_maybeboards).toBe(1); // SQLite boolean 1

      // Update option to false
      const putRes = await request(app)
        .put(`/api/archidekt/decks/${deckId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ exclude_side_and_maybeboards: false });

      expect(putRes.status).toBe(200);

      const deckInDb = await db('user_archidekt_decks')
        .where({ user_id: userId, deck_id: deckId })
        .first();
      expect(deckInDb.exclude_side_and_maybeboards).toBe(0);
    });
  });

  describe('Deck Updater with Excluded Cut Cards', () => {
    it('should only analyze cards present in user_archidekt_decks.cards (excluding cuts)', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({ email: 'updatercut@example.com', username: 'UpdaterCutUser', password: 'password123' });
      expect(regRes.status).toBe(200);
      const token = regRes.body.token;
      const userId = regRes.body.user.id;

      const deckId = 'arch_deck_cuts_test';
      // Store a deck whose active cards DO NOT contain the cut card 'Cancel'
      // Active cards contain 'Counterspell' and lands
      await db('user_archidekt_decks').insert({
        user_id: userId,
        deck_id: deckId,
        deck_name: 'Control Deck',
        commander: 'Baral, Chief of Compliance',
        status: 'active',
        source: 'archidekt',
        exclude_side_and_maybeboards: true,
        cards: JSON.stringify(['Baral, Chief of Compliance', 'Counterspell', 'Island'])
      });

      const analyzeRes = await request(app)
        .get('/api/deck-updater/analyze-all')
        .set('Authorization', `Bearer ${token}`);

      expect(analyzeRes.status).toBe(200);
      expect(analyzeRes.body.length).toBe(1);
      const deckResult = analyzeRes.body[0];
      expect(deckResult.deck_id).toBe(deckId);

      // Verify that 'Cancel' (which was cut and therefore omitted from cards)
      // was not analyzed or suggested for replacement
      const upgradedCards = (deckResult.strictlyBetter || []).map(u => u.currentCard);
      expect(upgradedCards).not.toContain('Cancel');
    });
  });
});
