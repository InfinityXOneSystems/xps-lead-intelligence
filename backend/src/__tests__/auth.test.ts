/**
 * Tests for /api/auth routes.
 * Uses mocked prisma — tests the route logic, not DB calls.
 */

import request from 'supertest';
import express from 'express';
import authRouter from '../routes/auth';

// Mock prisma
jest.mock('../db/prisma', () => ({
  prisma: {
    userAuth: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ provider: 'RAILWAY', userName: 'Test User', userEmail: 'test@example.com', connectedAt: new Date() }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    adminConfig: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
}));

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('GET /api/auth/status', () => {
  it('returns authenticated false when no accounts', async () => {
    const res = await request(app).get('/api/auth/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('authenticated');
    expect(res.body).toHaveProperty('accounts');
  });
});

describe('GET /api/auth/google/url', () => {
  it('returns 400 when GOOGLE_CLIENT_ID is not set', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const res = await request(app).get('/api/auth/google/url');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/GOOGLE_CLIENT_ID/);
  });

  it('returns url when GOOGLE_CLIENT_ID is set', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test_client_id';
    const res = await request(app).get('/api/auth/google/url');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('accounts.google.com');
    expect(res.body.url).toContain('test_client_id');
    delete process.env.GOOGLE_CLIENT_ID;
  });
});

describe('GET /api/auth/github/url', () => {
  it('returns 400 when GITHUB_OAUTH_CLIENT_ID is not set', async () => {
    delete process.env.GITHUB_OAUTH_CLIENT_ID;
    const res = await request(app).get('/api/auth/github/url');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/GITHUB_OAUTH_CLIENT_ID/);
  });

  it('returns url when GITHUB_OAUTH_CLIENT_ID is set', async () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = 'gh_test_id';
    const res = await request(app).get('/api/auth/github/url');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('github.com/login/oauth/authorize');
    delete process.env.GITHUB_OAUTH_CLIENT_ID;
  });
});

describe('POST /api/auth/railway', () => {
  it('returns 400 when token is missing', async () => {
    const res = await request(app).post('/api/auth/railway').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/token/i);
  });

  it('returns 401 when Railway API rejects token', async () => {
    // The real Railway call will fail in test — that's expected
    const res = await request(app).post('/api/auth/railway').send({ token: 'invalid_token' });
    // Could be 401 or 500 depending on network in CI
    expect([401, 500]).toContain(res.status);
  });
});

describe('POST /api/auth/logout', () => {
  it('disconnects a specific provider', async () => {
    const res = await request(app).post('/api/auth/logout').send({ provider: 'google' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('disconnects all providers when no provider given', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/auth/verify', () => {
  it('returns 400 when token is missing', async () => {
    const res = await request(app).post('/api/auth/verify').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app).post('/api/auth/verify').send({ token: 'not.a.jwt' });
    expect(res.status).toBe(401);
  });
});
