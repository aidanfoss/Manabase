import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { db } from '../db/connection.js';

describe('Trade API History & Ledger', () => {
  it('should calculate ledger debt correctly when User A trades a card to User B for nothing', async () => {
    // 1. Register User A (Me) and User B (Zach)
    const userA = { email: 'me@example.com', username: 'me', password: 'password123' };
    const userB = { email: 'zach@example.com', username: 'zach', password: 'password123' };

    const regA = await request(app).post('/api/auth/register').send(userA);
    const regB = await request(app).post('/api/auth/register').send(userB);

    const tokenA = regA.body.token;
    const userBId = regB.body.user.id;

    // Add card with market price $5.00 to User A's tradelist
    await db('user_cards').insert({
      user_id: regA.body.user.id,
      card_name: 'Sol Ring',
      list_type: 'tradelist',
      quantity: 1,
      market_price: 5.00
    });

    // 2. Propose trade: User A offers Sol Ring ($5), demands nothing ($0) from Zach
    const propRes = await request(app)
      .post('/api/trade/propose')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        partnerId: userBId,
        offer: [{ card_name: 'Sol Ring', quantity: 1, set_code: 'C21', is_foil: false }],
        demand: []
      });

    expect(propRes.status).toBe(200);

    const trade = await db('trades').first();
    expect(trade).toBeDefined();

    // Mark trade as completed
    await db('trades').where({ id: trade.id }).update({ status: 'completed' });

    // 3. Fetch Ledger for User A
    const ledgerRes = await request(app)
      .get('/api/trade/ledger')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(ledgerRes.status).toBe(200);
    expect(ledgerRes.body).toHaveLength(1);

    const zachLedger = ledgerRes.body[0];
    expect(zachLedger.partner_username).toBe('zach');
    expect(zachLedger.total_given_value).toBeGreaterThan(0);
    expect(zachLedger.total_received_value).toBe(0);
    expect(zachLedger.net_balance).toBeGreaterThan(0);
    expect(zachLedger.status_text).toContain('zach owes you');

    // 4. Fetch Trade History for User A
    const historyRes = await request(app)
      .get('/api/trade/history')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body).toHaveLength(1);
    expect(historyRes.body[0].partner_username).toBe('zach');
    expect(historyRes.body[0].offer).toHaveLength(1);
    expect(historyRes.body[0].offer[0].card_name).toBe('Sol Ring');
  });

  it('should find trade matches from another user\'s owned collection for cards on wishlist', async () => {
    const userA = { email: 'wishA@example.com', username: 'wishA', password: 'password123' };
    const userB = { email: 'ownedB@example.com', username: 'ownedB', password: 'password123' };

    const regA = await request(app).post('/api/auth/register').send(userA);
    const regB = await request(app).post('/api/auth/register').send(userB);

    const tokenA = regA.body.token;
    const userAId = regA.body.user.id;
    const userBId = regB.body.user.id;

    // User A adds "Mox Diamond" to wishlist
    await db('user_cards').insert({
      user_id: userAId,
      card_name: 'Mox Diamond',
      list_type: 'wishlist',
      quantity: 1,
      any_printing: true
    });

    // User B adds "Mox Diamond" to owned collection (NOT tradelist)
    await db('user_cards').insert({
      user_id: userBId,
      card_name: 'Mox Diamond',
      list_type: 'owned',
      quantity: 1,
      set_code: 'STH'
    });

    // Fetch trade matches for User A
    const matchesRes = await request(app)
      .get('/api/trade/matches')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(matchesRes.status).toBe(200);
    const userBMatch = matchesRes.body.find(m => m.user.id === userBId);
    expect(userBMatch).toBeDefined();
    expect(userBMatch.youWant).toHaveLength(1);
    expect(userBMatch.youWant[0].card_name).toBe('Mox Diamond');

    // Fetch User B's inventory via trade API
    const invRes = await request(app)
      .get(`/api/trade/inventory/${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(invRes.status).toBe(200);
    const ownedCard = invRes.body.find(c => c.card_name === 'Mox Diamond' && c.list_type === 'owned');
    expect(ownedCard).toBeDefined();
  });

  it('should list active outbound trades correctly for sender', async () => {
    const userA = { email: 'activea@example.com', username: 'activea', password: 'password123' };
    const userB = { email: 'activeb@example.com', username: 'activeb', password: 'password123' };

    const regA = await request(app).post('/api/auth/register').send(userA);
    const regB = await request(app).post('/api/auth/register').send(userB);

    const tokenA = regA.body.token;
    const tokenB = regB.body.token;
    const userBId = regB.body.user.id;

    // User A proposes trade to User B
    const propRes = await request(app)
      .post('/api/trade/propose')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        partnerId: userBId,
        offer: [{ card_name: 'Counterspell', quantity: 1, set_code: 'EMA', is_foil: true }],
        demand: [{ card_name: 'Mana Drain', quantity: 1, set_code: 'CMR', is_foil: false }]
      });

    expect(propRes.status).toBe(200);

    // Fetch active trades for User A (sender) -> Should be outbound
    const activeResA = await request(app)
      .get('/api/trade/active')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(activeResA.status).toBe(200);
    expect(activeResA.body).toHaveLength(1);
    expect(activeResA.body[0].is_outbound).toBe(true);
    expect(activeResA.body[0].partner_username).toBe('activeb');
    expect(activeResA.body[0].offer[0].card_name).toBe('Counterspell');
    expect(activeResA.body[0].demand[0].card_name).toBe('Mana Drain');

    // Fetch active trades for User B (receiver) -> Should be inbound
    const activeResB = await request(app)
      .get('/api/trade/active')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(activeResB.status).toBe(200);
    expect(activeResB.body).toHaveLength(1);
    expect(activeResB.body[0].is_outbound).toBe(false);
    expect(activeResB.partner_username || activeResB.body[0].partner_username).toBe('activea');
  });

  it('should query Scryfall prices and store them in trade_items on trade proposal', async () => {
    const userA = { email: 'pricechecka@example.com', username: 'pricechecka', password: 'password123' };
    const userB = { email: 'pricecheckb@example.com', username: 'pricecheckb', password: 'password123' };

    const regA = await request(app).post('/api/auth/register').send(userA);
    const regB = await request(app).post('/api/auth/register').send(userB);

    const tokenA = regA.body.token;
    const userBId = regB.body.user.id;

    const propRes = await request(app)
      .post('/api/trade/propose')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        partnerId: userBId,
        offer: [{ card_name: 'Sol Ring', set_code: 'C21', quantity: 1, is_foil: false }],
        demand: [{ card_name: 'Command Tower', set_code: 'C21', quantity: 1, is_foil: false }]
      });

    expect(propRes.status).toBe(200);

    const trade = await db('trades').first();
    const items = await db('trade_items').where({ trade_id: trade.id });

    expect(items).toHaveLength(2);
    items.forEach(item => {
      expect(typeof item.price).toBe('number');
      expect(item.price).toBeGreaterThan(0);
    });
  });

  it('should create inbound trade offers for DevUser and verify active trades & pending counts', async () => {
    const devUser = { email: 'devuser_trade@example.com', username: 'DevUser', password: 'password123' };
    const partnerUser = { email: 'trader1@example.com', username: 'TraderOne', password: 'password123' };

    const regDev = await request(app).post('/api/auth/register').send(devUser);
    const regPartner = await request(app).post('/api/auth/register').send(partnerUser);

    const tokenDev = regDev.body.token;
    const tokenPartner = regPartner.body.token;
    const devUserId = regDev.body.user.id;

    // Partner proposes an inbound trade offer to DevUser
    const propRes = await request(app)
      .post('/api/trade/propose')
      .set('Authorization', `Bearer ${tokenPartner}`)
      .send({
        partnerId: devUserId,
        offer: [{ card_name: 'Cyclonic Rift', quantity: 1, set_code: 'RTR', is_foil: false }],
        demand: [{ card_name: 'Rhystic Study', quantity: 1, set_code: 'PCY', is_foil: false }]
      });

    expect(propRes.status).toBe(200);

    // Fetch active trades for DevUser -> Should list inbound trade from TraderOne
    const activeResDev = await request(app)
      .get('/api/trade/active')
      .set('Authorization', `Bearer ${tokenDev}`);

    expect(activeResDev.status).toBe(200);
    expect(activeResDev.body.length).toBeGreaterThanOrEqual(1);

    const inboundOffer = activeResDev.body.find(t => t.partner_username === 'TraderOne');
    expect(inboundOffer).toBeDefined();
    expect(inboundOffer.is_outbound).toBe(false);
    expect(inboundOffer.offer[0].card_name).toBe('Rhystic Study');
    expect(inboundOffer.demand[0].card_name).toBe('Cyclonic Rift');

    // Fetch pending count for DevUser -> Should return pending count >= 1
    const pendingRes = await request(app)
      .get('/api/trade/pending-count')
      .set('Authorization', `Bearer ${tokenDev}`);

    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.count).toBeGreaterThanOrEqual(1);
  });
});
