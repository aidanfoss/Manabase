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
});
