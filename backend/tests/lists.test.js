import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('Proxy Wishlist & Lists Bulk Import API', () => {
  it('should bulk import cards to proxy wishlist for an authenticated user', async () => {
    // 1. Register test user
    const user = { email: 'proxyuser@example.com', username: 'ProxyUser', password: 'password123' };
    const regRes = await request(app).post('/api/auth/register').send(user);
    expect(regRes.status).toBe(200);
    const token = regRes.body.token;

    // 2. Sample cards payload for proxy wishlist
    const cards = [
      { card_name: 'Sol Ring', quantity: 2, is_foil: true },
      { card_name: 'Cyclonic Rift', quantity: 1, set_code: 'RTR', collector_number: '35' },
      { card_name: 'Rhystic Study', quantity: 1, set_code: 'PCY' }
    ];

    // 3. Bulk import request
    const bulkRes = await request(app)
      .post('/api/lists/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ cards, list_kind: 'proxy_wishlist' });

    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.count).toBe(4); // 2 + 1 + 1 = 4 total items

    // 4. Fetch proxy wishlist to verify items
    const listRes = await request(app)
      .get('/api/lists/proxy_wishlist')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(3); // 3 unique cards

    const solRing = listRes.body.find(c => c.card_name === 'Sol Ring');
    expect(solRing).toBeDefined();
    expect(solRing.quantity).toBe(2);
    expect(solRing.is_foil).toBe(1);

    const rift = listRes.body.find(c => c.card_name === 'Cyclonic Rift');
    expect(rift).toBeDefined();
    expect(rift.set_code).toBe('RTR');
    expect(rift.collector_number).toBe('35');

    // 5. Bulk delete request
    const idsToDelete = [solRing.id, rift.id];
    const deleteRes = await request(app)
      .post('/api/lists/bulk-delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: idsToDelete });

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.count).toBe(2);

    // 6. Verify remaining cards
    const remainingRes = await request(app)
      .get('/api/lists/proxy_wishlist')
      .set('Authorization', `Bearer ${token}`);

    expect(remainingRes.status).toBe(200);
    expect(remainingRes.body.length).toBe(1);
    expect(remainingRes.body[0].card_name).toBe('Rhystic Study');
  });
});
