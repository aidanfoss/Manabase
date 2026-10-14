import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { db } from '../db/connection.js';
import jwt from 'jsonwebtoken';
import { recordFeatureUsage } from '../services/analyticsService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

describe('Analytics & Usage Tracking API', () => {
  let regularUserToken;
  let regularUserId;
  let adminToken;

  beforeEach(async () => {
    regularUserId = 'user_' + Date.now().toString(16);
    const testEmail = `analytics_${Date.now()}@example.com`;
    const testUsername = `analytictester_${Date.now()}`;

    await db('users').insert({
      id: regularUserId,
      email: testEmail,
      username: testUsername,
      password_hash: 'dummyhash'
    });

    regularUserToken = jwt.sign(
      { id: regularUserId, email: testEmail, username: testUsername },
      JWT_SECRET
    );

    // Main admin token
    adminToken = jwt.sign(
      { id: 'admin-id', email: 'quantumaidan@gmail.com', username: 'admin' },
      JWT_SECRET
    );
  });

  describe('GET /api/analytics/taxonomy', () => {
    it('returns the registered feature taxonomy', async () => {
      const res = await request(app).get('/api/analytics/taxonomy');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.taxonomy).toHaveProperty('deckbuilder');
      expect(res.body.taxonomy.deckbuilder).toHaveProperty('category');
    });
  });

  describe('POST /api/analytics/batch (guest & authenticated)', () => {
    it('accepts a batch of events from an unauthenticated guest', async () => {
      const res = await request(app)
        .post('/api/analytics/batch')
        .send({
          events: [
            {
              feature_name: 'land_presets',
              action: 'view',
              metadata: { presetId: 'fetchland-base' }
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.count).toBe(1);

      // Verify guest record was created
      const event = await db('analytics_events')
        .where({ feature_name: 'land_presets', is_guest: true })
        .first();
      expect(event).toBeDefined();
      expect(event.user_id).toBeNull();
    });

    it('accepts a batch of events from an authenticated user', async () => {
      const res = await request(app)
        .post('/api/analytics/batch')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          events: [
            {
              feature_name: 'deck_updater',
              action: 'scan_deck',
              metadata: { deckId: 'deck-123' }
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.count).toBe(1);

      // Verify user event was recorded
      const event = await db('analytics_events')
        .where({ feature_name: 'deck_updater', user_id: regularUserId })
        .first();
      expect(event).toBeDefined();
      expect(event.is_guest).toBe(0);

      // Verify monthly roll-up entry
      const monthly = await db('user_feature_monthly')
        .where({ feature_name: 'deck_updater', user_id: regularUserId })
        .first();
      expect(monthly).toBeDefined();
      expect(monthly.usage_count).toBeGreaterThanOrEqual(1);
    });

    it('gracefully handles empty batches or invalid payloads', async () => {
      const emptyRes = await request(app)
        .post('/api/analytics/batch')
        .send({ events: [] });
      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body.count).toBe(0);

      const invalidRes = await request(app)
        .post('/api/analytics/batch')
        .send({ events: [{ feature_name: 'bad*characters!#$', action: 'ok' }] });
      expect(invalidRes.status).toBe(200);
      expect(invalidRes.body.count).toBe(0);
    });
  });

  describe('recordFeatureUsage server-side helper', () => {
    it('successfully records backend-initiated events', async () => {
      const success = await recordFeatureUsage(
        regularUserId,
        'custom_packages',
        'create_package',
        { name: 'My Package' }
      );
      expect(success).toBe(true);

      const monthly = await db('user_feature_monthly')
        .where({ feature_name: 'custom_packages', user_id: regularUserId })
        .first();
      expect(monthly).toBeDefined();
    });
  });

  describe('GET /api/analytics/stats & prune candidates', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/analytics/stats');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin users with 403', async () => {
      const res = await request(app)
        .get('/api/analytics/stats')
        .set('Authorization', `Bearer ${regularUserToken}`);
      expect(res.status).toBe(403);
    });

    it('returns full feature usage stats and prune candidates to admin', async () => {
      const res = await request(app)
        .get('/api/analytics/stats?days=30')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.stats).toHaveProperty('prune_candidates');
      expect(res.body.stats).toHaveProperty('feature_stats');
      expect(Array.isArray(res.body.stats.feature_stats)).toBe(true);
      expect(res.body.stats.feature_stats.length).toBeGreaterThan(0);

      // Features that have 0 usage should be flagged as prune candidates
      const pruneCandidates = res.body.stats.prune_candidates;
      expect(Array.isArray(pruneCandidates)).toBe(true);
      expect(pruneCandidates.some(c => c.is_prune_candidate)).toBe(true);
    });
  });

  describe('GET /api/analytics/feature-users/:featureName', () => {
    it('returns user drilldown for a specific feature', async () => {
      // Ensure feature usage is recorded for this user
      await recordFeatureUsage(regularUserId, 'deck_updater', 'scan_deck');

      const res = await request(app)
        .get('/api/analytics/feature-users/deck_updater')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.feature).toBe('deck_updater');
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.some(u => u.id === regularUserId)).toBe(true);
    });
  });
});
