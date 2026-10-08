import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { db } from '../db/connection.js';

describe('Deck Updater Routes & Dismissals', () => {
  let token;
  let userId;

  beforeEach(async () => {
    await db('user_deck_dismissals').del();
    await db('user_archidekt_decks').del();

    const email = `dismissuser_${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      username: `User_${Date.now()}`,
      password: 'password123'
    });
    token = regRes.body.token;
    userId = regRes.body.user?.id || 1;
  });

  it('should fetch dismissals list without being intercepted by /:deckId route', async () => {
    // 1. Initially dismissals should be empty array and return 200 (not 404 Deck not found)
    const res = await request(app)
      .get('/api/deck-updater/dismissals')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('should support dismissing and undismissing suggestions', async () => {
    // 1. Dismiss a strictly better suggestion
    const dismissRes = await request(app)
      .post('/api/deck-updater/dismiss')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deck_id: '24659911',
        suggestion_id: 'strictly_better:Ankle Biter'
      });

    expect(dismissRes.status).toBe(200);
    expect(dismissRes.body.success).toBe(true);

    // 2. Fetch dismissals
    const listRes = await request(app)
      .get('/api/deck-updater/dismissals')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(String(listRes.body[0].deck_id)).toBe('24659911');
    expect(listRes.body[0].suggestion_id).toBe('strictly_better:Ankle Biter');

    // 3. Undismiss the suggestion
    const undismissRes = await request(app)
      .post('/api/deck-updater/undismiss')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deck_id: '24659911',
        suggestion_id: 'strictly_better:Ankle Biter'
      });

    expect(undismissRes.status).toBe(200);
    expect(undismissRes.body.success).toBe(true);

    // 4. Verify dismissals list is empty again
    const finalListRes = await request(app)
      .get('/api/deck-updater/dismissals')
      .set('Authorization', `Bearer ${token}`);

    expect(finalListRes.status).toBe(200);
    expect(finalListRes.body.length).toBe(0);
  });

  describe('Land Preferences API Pipeline', () => {
    it('should return default land preferences when none have been saved', async () => {
      const res = await request(app)
        .get('/api/deck-updater/land-preferences')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.preferences).toBeDefined();
      expect(res.body.preferences.budgetTier).toBe('all');
      expect(res.body.preferences.excludeReservedList).toBe(true);
      expect(res.body.preferences.excludeTapped).toBe(true);
      expect(res.body.preferences.likedCycles).toEqual([]);
      expect(res.body.preferences.dislikedCycles).toEqual([]);
    });

    it('should save and update land preferences via PUT and retrieve them via GET', async () => {
      const newPrefs = {
        budgetTier: 'budget',
        maxPricePerLand: 3.5,
        excludeReservedList: true,
        excludeTapped: true,
        likedCycles: ['cycle-fetchland', 'cycle-rav-shockland'],
        dislikedCycles: ['cycle-guildgate']
      };

      // 1. Save preferences via PUT /api/deck-updater/land-preferences
      const putRes = await request(app)
        .put('/api/deck-updater/land-preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ preferences: newPrefs });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.preferences.budgetTier).toBe('budget');
      expect(putRes.body.preferences.maxPricePerLand).toBe(3.5);
      expect(putRes.body.preferences.likedCycles).toEqual(['cycle-fetchland', 'cycle-rav-shockland']);
      expect(putRes.body.preferences.dislikedCycles).toEqual(['cycle-guildgate']);

      // 2. Fetch preferences via GET
      const getRes = await request(app)
        .get('/api/deck-updater/land-preferences')
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.preferences.budgetTier).toBe('budget');
      expect(getRes.body.preferences.maxPricePerLand).toBe(3.5);
      expect(getRes.body.preferences.likedCycles).toEqual(['cycle-fetchland', 'cycle-rav-shockland']);
      expect(getRes.body.preferences.dislikedCycles).toEqual(['cycle-guildgate']);

      // 3. Update existing preferences with flat body payload
      const updateRes = await request(app)
        .put('/api/deck-updater/land-preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({
          budgetTier: 'high',
          maxPricePerLand: 25.0,
          excludeReservedList: false,
          excludeTapped: false,
          likedCycles: ['cycle-bondland'],
          dislikedCycles: []
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.preferences.budgetTier).toBe('high');
      expect(updateRes.body.preferences.excludeReservedList).toBe(false);

      // 4. Verify updated values persisted
      const getUpdatedRes = await request(app)
        .get('/api/deck-updater/land-preferences')
        .set('Authorization', `Bearer ${token}`);

      expect(getUpdatedRes.status).toBe(200);
      expect(getUpdatedRes.body.preferences.budgetTier).toBe('high');
      expect(getUpdatedRes.body.preferences.excludeReservedList).toBe(false);
      expect(getUpdatedRes.body.preferences.likedCycles).toEqual(['cycle-bondland']);
    });

    it('should save land preferences via POST /api/deck-updater/land-preferences', async () => {
      const postRes = await request(app)
        .post('/api/deck-updater/land-preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({
          preferences: {
            budgetTier: 'ultra_budget',
            maxPricePerLand: 1.0,
            excludeReservedList: true,
            excludeTapped: true,
            likedCycles: [],
            dislikedCycles: []
          }
        });

      expect(postRes.status).toBe(200);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.preferences.budgetTier).toBe('ultra_budget');
    });

    it('should route /analyze-lands correctly without being intercepted by /:deckId', async () => {
      // 1. Create a test deck
      await db('user_archidekt_decks').insert({
        user_id: userId,
        deck_id: '99999',
        deck_name: 'Test Radha Deck',
        commander: 'Grand Warlord Radha',
        cards: JSON.stringify(['Forest', 'Mountain', 'Gruul Turf', 'Gruul Guildgate']),
        source: 'archidekt'
      });

      // 2. Call GET /api/deck-updater/analyze-lands?deckId=99999
      const res = await request(app)
        .get('/api/deck-updater/analyze-lands?deckId=99999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cuts).toBeDefined();
      expect(res.body.adds).toBeDefined();
      expect(res.body.colorIdentity).toBeDefined();
      expect(res.body.preferencesApplied).toBeDefined();
    });

    it('should analyze all decks with custom preferences via POST /analyze-all', async () => {
      await db('user_archidekt_decks').insert({
        user_id: userId,
        deck_id: '88888',
        deck_name: 'Test Radha Deck',
        commander: 'Grand Warlord Radha',
        cards: JSON.stringify(['Forest', 'Mountain', 'Gruul Turf', 'Gruul Guildgate']),
        source: 'archidekt'
      });

      const res = await request(app)
        .post('/api/deck-updater/analyze-all')
        .set('Authorization', `Bearer ${token}`)
        .send({
          preferences: {
            budgetTier: 'ultra_budget',
            maxPricePerLand: 1.0,
            excludeReservedList: true,
            excludeTapped: true
          }
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].deck_id).toBe('88888');
      expect(res.body[0].landUpgrades).toBeDefined();
      expect(res.body[0].landUpgrades.preferencesApplied.budgetTier).toBe('ultra_budget');
    });
  });
});
