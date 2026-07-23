import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('Playgroup Private Invites API', () => {
  let userAToken;
  let userBToken;
  let playgroupId;

  beforeEach(async () => {
    // Setup User A, User B, and a Playgroup created by User A
    const resA = await request(app).post('/api/auth/register').send({
      email: 'pg_creator@example.com',
      username: 'PGCreator',
      password: 'password123'
    });
    userAToken = resA.body.token;

    const resB = await request(app).post('/api/auth/register').send({
      email: 'pg_invitee@example.com',
      username: 'PGInvitee',
      password: 'password123'
    });
    userBToken = resB.body.token;

    const groupRes = await request(app)
      .post('/api/playgroups')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Private Pod' });
    playgroupId = groupRes.body.id;
  });

  it('should generate an invite link for a playgroup member', async () => {
    const res = await request(app)
      .post(`/api/playgroups/${playgroupId}/invite`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.playgroup_id).toBe(playgroupId);
  });

  it('should reject invite generation for a non-member', async () => {
    const res = await request(app)
      .post(`/api/playgroups/${playgroupId}/invite`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Only playgroup members');
  });

  it('should fetch public invite details using a valid invite token', async () => {
    const genRes = await request(app)
      .post(`/api/playgroups/${playgroupId}/invite`)
      .set('Authorization', `Bearer ${userAToken}`);
    const token = genRes.body.token;

    const res = await request(app)
      .get(`/api/playgroups/invites/${token}`);

    expect(res.status).toBe(200);
    expect(res.body.playgroup_name).toBe('Private Pod');
    expect(res.body.inviter_username).toBe('PGCreator');
  });

  it('should reject joining by raw playgroup ID without invite token', async () => {
    const res = await request(app)
      .post('/api/playgroups/join')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ playgroup_id: playgroupId });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('invite link/token is required');
  });

  it('should allow User B to join playgroup using valid invite token', async () => {
    const genRes = await request(app)
      .post(`/api/playgroups/${playgroupId}/invite`)
      .set('Authorization', `Bearer ${userAToken}`);
    const token = genRes.body.token;

    const joinRes = await request(app)
      .post('/api/playgroups/join')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ invite_token: token });

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.success).toBe(true);
    expect(joinRes.body.name).toBe('Private Pod');

    const listRes = await request(app)
      .get('/api/playgroups')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.some(g => g.id === playgroupId)).toBe(true);
  });
});
