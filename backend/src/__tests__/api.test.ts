/**
 * API endpoint integration tests using real Express app.
 * Database calls are mocked via jest.mock so no actual DB needed.
 */
import express from 'express';
import request from 'supertest';

// Mock all DB and service dependencies before importing routes
jest.mock('../db/prisma', () => ({
  prisma: {
    lead: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'test-id', ...args.data, leadScore: 0, outreachStatus: 'NOT_CONTACTED', status: 'NEW', createdAt: new Date(), updatedAt: new Date() })),
      update: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data })),
      delete: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'test-id', ...args.create })),
      aggregate: jest.fn().mockResolvedValue({ _avg: { leadScore: 50 } }),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    scrapingJob: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'job-1', source: 'test', status: 'PENDING' }),
      update: jest.fn().mockResolvedValue({}),
    },
    emailTemplate: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'tmpl-1', ...args.data })),
      update: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data })),
      delete: jest.fn().mockResolvedValue({}),
    },
    emailCampaign: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'camp-1', ...args.data })),
      update: jest.fn().mockResolvedValue({}),
    },
    emailSend: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'send-1' }),
    },
    socialAccount: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'acct-1', ...args.create })),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
    },
    socialPost: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'post-1', ...args.data })),
      update: jest.fn().mockResolvedValue({}),
    },
    socialInboundMessage: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'msg-1', ...args.create })),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    calendarFollowup: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'cal-1' }),
    },
    connector: { findMany: jest.fn().mockResolvedValue([]) },
    adminConfig: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

jest.mock('../services/scraper', () => ({
  startScrapingJob: jest.fn().mockResolvedValue('mock-job-id'),
}));

jest.mock('../services/groq', () => ({
  chatCompletion: jest.fn().mockResolvedValue('{"subject":"test","bodyHtml":"<p>test</p>","bodyText":"test"}'),
}));

jest.mock('../services/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));

import leadsRouter from '../routes/leads';
import emailRouter from '../routes/email';
import socialRouter from '../routes/social';
import outreachRouter from '../routes/outreach';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/leads', leadsRouter);
  app.use('/api/email', emailRouter);
  app.use('/api/social', socialRouter);
  app.use('/api/outreach', outreachRouter);
  return app;
}

const app = buildApp();

// ── Leads API ─────────────────────────────────────────────────────────────────
describe('GET /api/leads', () => {
  it('returns 200 with leads array', async () => {
    const res = await request(app).get('/api/leads');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('leads');
    expect(Array.isArray(res.body.leads)).toBe(true);
  });
});

describe('GET /api/leads/stats', () => {
  it('returns 200 with stats', async () => {
    const res = await request(app).get('/api/leads/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('avgScore');
  });
});

describe('POST /api/leads', () => {
  it('creates a lead with email', async () => {
    const res = await request(app).post('/api/leads').send({ email: 'test@example.com', businessName: 'Acme Roofing' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('rejects creation without email', async () => {
    const res = await request(app).post('/api/leads').send({ businessName: 'No Email' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /api/leads/scrape', () => {
  it('starts a scraping job', async () => {
    const res = await request(app).post('/api/leads/scrape').send({ source: 'yelp:roofers:Dallas TX' });
    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('jobId');
  });

  it('rejects without source', async () => {
    const res = await request(app).post('/api/leads/scrape').send({});
    expect(res.status).toBe(400);
  });
});

// ── Email API ─────────────────────────────────────────────────────────────────
describe('GET /api/email/templates', () => {
  it('returns 200 with templates array', async () => {
    const res = await request(app).get('/api/email/templates');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('templates');
  });
});

describe('POST /api/email/templates', () => {
  it('creates a template', async () => {
    const res = await request(app).post('/api/email/templates').send({
      name: 'Test Template',
      subject: 'Hello {{businessName}}',
      bodyHtml: '<p>Hello {{ownerName}}</p>',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('rejects without required fields', async () => {
    const res = await request(app).post('/api/email/templates').send({ name: 'Missing fields' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/email/templates/generate', () => {
  it('generates a template via LLM', async () => {
    const res = await request(app).post('/api/email/templates/generate').send({ purpose: 'cold outreach for roofing' });
    expect(res.status).toBe(200);
  });

  it('rejects without purpose', async () => {
    const res = await request(app).post('/api/email/templates/generate').send({});
    expect(res.status).toBe(400);
  });
});

// ── Social API ────────────────────────────────────────────────────────────────
describe('GET /api/social/accounts', () => {
  it('returns 200 with accounts', async () => {
    const res = await request(app).get('/api/social/accounts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accounts');
  });
});

describe('POST /api/social/accounts', () => {
  it('creates a social account', async () => {
    const res = await request(app).post('/api/social/accounts').send({ platform: 'TWITTER', handle: 'testhandle' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  it('rejects without platform or handle', async () => {
    const res = await request(app).post('/api/social/accounts').send({ platform: 'TWITTER' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/social/generate', () => {
  it('generates social content', async () => {
    const { chatCompletion } = jest.requireMock('../services/groq') as { chatCompletion: jest.Mock };
    chatCompletion.mockResolvedValueOnce('{"content":"Test post #test","hashtags":["#test"]}');
    const res = await request(app).post('/api/social/generate').send({ platform: 'TWITTER', topic: 'lead generation tips' });
    expect(res.status).toBe(200);
  });
});

// ── Outreach / Utility API ────────────────────────────────────────────────────
describe('GET /api/outreach/health/deep', () => {
  it('returns health check object', async () => {
    const res = await request(app).get('/api/outreach/health/deep');
    expect([200, 207]).toContain(res.status);
    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('database');
    expect(res.body.checks).toHaveProperty('llm');
  });
});

describe('POST /api/outreach/recommend', () => {
  it('returns recommendations', async () => {
    const { chatCompletion } = jest.requireMock('../services/groq') as { chatCompletion: jest.Mock };
    chatCompletion.mockResolvedValueOnce(JSON.stringify([{ id: '1', text: 'Test', category: 'action', priority: 'high' }]));
    const res = await request(app).post('/api/outreach/recommend').send({ section: 'agent', messages: [] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recommendations');
  });
});
