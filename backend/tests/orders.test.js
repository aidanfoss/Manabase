import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('Proxy Orders API (Confirm, History, Restore, Move to Tradelist)', () => {
  it('should confirm order, clear wishlist, store history, restore, and move to tradelist', async () => {
    // 1. Register test user
    const user = { email: 'orderuser@example.com', username: 'OrderUser', password: 'password123' };
    const regRes = await request(app).post('/api/auth/register').send(user);
    expect(regRes.status).toBe(200);
    const token = regRes.body.token;

    // 2. Add cards to user's proxy wishlist
    const cards = [
      { card_name: 'Black Lotus', quantity: 1, is_foil: false },
      { card_name: 'Mox Sapphire', quantity: 1, is_foil: true, set_code: 'LEA' }
    ];

    await request(app)
      .post('/api/lists/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ cards, list_kind: 'proxy_wishlist' });

    // Verify wishlist contains cards
    const initialList = await request(app)
      .get('/api/lists/proxy_wishlist')
      .set('Authorization', `Bearer ${token}`);
    expect(initialList.body.length).toBe(2);

    // 3. Confirm order
    const confirmRes = await request(app)
      .post('/api/proxy-orders/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ unit_cost: 0.25, title: 'My First Test Order' });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.order).toBeDefined();
    expect(confirmRes.body.order.total_cards).toBe(2);
    expect(confirmRes.body.order.total_cost).toBe(0.50);

    const orderId = confirmRes.body.order.id;

    // 4. Verify proxy wishlist is NOW CLEARED
    const clearedList = await request(app)
      .get('/api/lists/proxy_wishlist')
      .set('Authorization', `Bearer ${token}`);
    expect(clearedList.body.length).toBe(0);

    // 5. Check Order History
    const historyRes = await request(app)
      .get('/api/proxy-orders/history')
      .set('Authorization', `Bearer ${token}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.length).toBe(1);
    expect(historyRes.body[0].title).toBe('My First Test Order');
    expect(historyRes.body[0].cards.length).toBe(2);

    // 6. Restore Order back to Wishlist
    const restoreRes = await request(app)
      .post(`/api/proxy-orders/${orderId}/restore`)
      .set('Authorization', `Bearer ${token}`);

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.success).toBe(true);

    // Verify wishlist has restored cards
    const restoredList = await request(app)
      .get('/api/lists/proxy_wishlist')
      .set('Authorization', `Bearer ${token}`);
    expect(restoredList.body.length).toBe(2);

    // 7. Move Cards from Order to Tradelist
    const moveRes = await request(app)
      .post(`/api/proxy-orders/${orderId}/move-to-tradelist`)
      .set('Authorization', `Bearer ${token}`);

    expect(moveRes.status).toBe(200);
    expect(moveRes.body.success).toBe(true);

    // Verify tradelist has cards
    const tradelistRes = await request(app)
      .get('/api/lists/tradelist')
      .set('Authorization', `Bearer ${token}`);
    expect(tradelistRes.body.length).toBe(2);
  });
});
