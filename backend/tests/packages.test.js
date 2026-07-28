import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { db } from '../db/connection.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

describe('Packages API', () => {
  let token;
  let userId;

  beforeEach(async () => {
    await db('packages').del();
    await db('users').del();

    const [user] = await db('users').insert({
      email: 'testpackage@example.com',
      username: 'testpackage',
      password_hash: 'hash'
    }).returning('*');
    
    userId = user.id;
    token = jwt.sign({ id: userId, email: user.email }, JWT_SECRET);
  });

  it('should create an empty package and return cards as an empty array', async () => {
    const response = await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Empty Package',
        cards: [],
        visibility: 'me'
      });
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('name', 'Empty Package');
    // This is the bug we are testing
    expect(Array.isArray(response.body.cards)).toBe(true, "cards should be an array, not a string");
    expect(response.body.cards.length).toBe(0);
  });
});
