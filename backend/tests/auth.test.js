import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { db } from '../db/connection.js';
import { findOrCreateSSOUser } from '../routes/auth.js';

describe('Auth API', () => {
  const testUser = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.username).toBe(testUser.username);
    });

    it('should fail to register a user with an existing email', async () => {
      await request(app).post('/api/auth/register').send(testUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'Email already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login an existing user successfully', async () => {
      await request(app).post('/api/auth/register').send(testUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should fail to login with wrong password', async () => {
      await request(app).post('/api/auth/register').send(testUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should fail to login an unregistered user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });
  });

  describe('GET /api/auth/providers', () => {
    it('should return available SSO providers configuration status', async () => {
      const response = await request(app).get('/api/auth/providers');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('google');
      expect(response.body).toHaveProperty('discord');
      expect(response.body).toHaveProperty('devMode');
    });
  });

  describe('SSO User Management & Endpoints', () => {
    it('should create a new SSO user via findOrCreateSSOUser', async () => {
      const ssoUser = await findOrCreateSSOUser({
        email: 'sso_google@example.com',
        username: 'GoogleGamer',
        providerId: 'google_112233',
        providerName: 'google',
        avatarUrl: 'https://example.com/avatar.jpg',
      });

      expect(ssoUser).toBeDefined();
      expect(ssoUser.email).toBe('sso_google@example.com');
      expect(ssoUser.username).toBe('GoogleGamer');
      expect(ssoUser.google_id).toBe('google_112233');
      expect(ssoUser.avatar_url).toBe('https://example.com/avatar.jpg');
    });

    it('should link provider ID to an existing email user', async () => {
      // Register standard user first
      await request(app).post('/api/auth/register').send({
        email: 'existing@example.com',
        username: 'ExistingUser',
        password: 'password123',
      });

      // User logs in via Discord with matching email
      const linkedUser = await findOrCreateSSOUser({
        email: 'existing@example.com',
        username: 'DiscordName',
        providerId: 'discord_998877',
        providerName: 'discord',
        avatarUrl: 'https://cdn.discordapp.com/avatar.png',
      });

      expect(linkedUser.email).toBe('existing@example.com');
      expect(linkedUser.username).toBe('ExistingUser'); // keeps original username
      expect(linkedUser.discord_id).toBe('discord_998877');
    });

    it('should execute dev Google SSO login in dev environment', async () => {
      const response = await request(app).post('/api/auth/google').send({});
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('google_dev@manabase.com');
    });

    it('should execute dev Discord SSO login in dev environment', async () => {
      const response = await request(app).post('/api/auth/discord').send({});
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('discord_dev@manabase.com');
    });
  });
});
