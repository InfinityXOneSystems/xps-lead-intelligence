# Testing Strategy

**Version**: 1.0  
**Last Updated**: 2026-03-15

This document defines the required test coverage, test patterns, and passing criteria for the XPS Lead Intelligence platform.

---

## Test Infrastructure

| Layer | Framework | Location | Run Command |
|-------|-----------|----------|-------------|
| Backend unit | Jest + ts-jest + supertest | `backend/src/__tests__/` | `cd backend && npm test` |
| Backend lint | ESLint | `backend/src/` | `cd backend && npm run lint` |
| Frontend lint | next lint | `frontend/src/` | `cd frontend && npm run lint` |
| E2E | Playwright | `e2e/tests/` | `cd e2e && npx playwright test` |

### Environment Setup
- `JWT_SECRET` is pre-set in `backend/jest.setup.js` via `setupFiles`
- No external services needed for unit tests (Prisma is mocked)
- E2E tests require running Postgres + Redis + backend + frontend

---

## Backend Unit Tests (Jest)

**Location**: `backend/src/__tests__/*.test.ts`  
**Requirement**: 50/50 pass, 0 failures  
**Run**: `cd backend && npm test`

### Current Test Files

| File | Tests | Coverage |
|------|-------|---------|
| `api.test.ts` | Leads, scraper, stats, health routes | Happy path + error paths |
| `auth.test.ts` | OAuth routes, JWT verify, Railway token | Happy path + validation |
| `auto-recommend.test.ts` | `/api/agent/recommend` | Happy path + LLM mock |
| `email.test.ts` | Email template + campaign routes | CRUD + error paths |
| `lead-scoring.test.ts` | Lead scoring algorithm | Multiple score scenarios |

### Required Test Pattern
```typescript
import request from 'supertest';
import express from 'express';
import myRouter from '../routes/my-feature';

// Mock Prisma — never test DB internals
jest.mock('../db/prisma', () => ({
  prisma: {
    myModel: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'cuid123' }),
    }
  }
}));

const app = express();
app.use(express.json());
app.use('/api/my-feature', myRouter);

describe('GET /api/my-feature', () => {
  it('returns 200 with empty array', async () => {
    const res = await request(app).get('/api/my-feature');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 500 on database error', async () => {
    const { prisma } = require('../db/prisma');
    prisma.myModel.findMany.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/my-feature');
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
```

### Every New Route Must Have
1. ✅ Happy path test (2xx response + correct shape)
2. ✅ Error path test (500 on DB failure)
3. ✅ Auth validation test (401 without token, for protected routes)
4. ✅ Input validation test (400 for invalid input, where applicable)

---

## Backend Lint + TypeCheck

**Requirement**: 0 ESLint errors, 0 TypeScript errors

```bash
# Lint
cd backend && npm run lint     # Must exit 0, 0 errors

# TypeCheck
cd backend && npx tsc --noEmit # Must exit 0
```

---

## Frontend Lint + Build

**Requirement**: 0 ESLint errors, build must succeed

```bash
# Lint
cd frontend && npm run lint    # Must exit 0, 0 errors

# Build
cd frontend && npm run build   # Must exit 0
```

---

## E2E Tests (Playwright)

**Location**: `e2e/tests/*.spec.ts`  
**Run**: `cd e2e && npx playwright test`  
**When**: On push to `main` only (not PRs — requires running services)

### Prerequisites
Running services:
- Postgres on port 5432
- Redis on port 6379
- Backend on port 4000 (`NODE_ENV=test`, `JWT_SECRET=test_secret_for_e2e`)
- Frontend on port 3000

### Current E2E Tests (`layout.spec.ts`)
- `renders 3-column layout` — verifies main UI structure loads
- `light/dark mode toggle works` — verifies theme switching
- `navigates to Leads section` — Leads CRM panel renders + search input visible
- `navigates to Agent chat interface` — Agent chat + input visible
- `agent chat interface has input and send button` — can type in agent input
- `navigates to admin settings` — Settings panel renders
- `navigates to Leads CRM section` — LeadsCRM renders
- `navigates to Live Scraper section` — LiveScraper renders
- `navigates to Email Outreach section` — EmailTemplates renders
- `navigates to Social Agent section` — SocialMediaAgent renders
- `navigates to Social CRM section` — SocialCRM renders
- `agent chat has auto-recommend panel` — Agent loads with suggestions area

### Adding New E2E Tests
```typescript
import { test, expect } from '@playwright/test';

test('new feature renders correctly', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /my feature/i }).click();
  await expect(page.getByText(/expected text/i)).toBeVisible();
});
```

---

## Scraper Tests

The scraper is tested via integration in `api.test.ts`:
- `POST /api/leads/scrape` — triggers scraping job, verifies job creation
- Error path: invalid URL → 400 response

Scraper resilience requirements:
- Timeout after 15 seconds per URL (already enforced in `scraper.ts`)
- Returns partial results on error (does not throw)
- Deduplicates leads by email (enforced by unique index)

---

## Agent Tests

Agent behavior is tested via mocked Groq responses in `api.test.ts`:
- `POST /api/agent/chat` — verifies response shape
- Auto-recommend: `GET /api/agent/recommend` — verifies suggestion format

For new agent tools:
1. Add tool to `agent-tools.ts`
2. Add happy-path test that mocks the external call
3. Add error-path test that verifies graceful degradation

---

## Database Tests

Database models are tested indirectly via route tests with mocked Prisma. There are no direct DB integration tests (they require a live Postgres connection).

For CI migration validation:
```yaml
# In ci.yml (e2e job)
- name: Run Migrations
  env:
    DATABASE_URL: ******localhost:5432/xps_leads_test
  run: npx prisma migrate deploy
```

---

## What Must Pass Before Deployment

### Required for all PRs (enforced in `ci.yml`)
| Check | Criteria |
|-------|----------|
| Backend lint | 0 errors |
| Frontend lint | 0 errors |
| Backend typecheck | 0 errors |
| Backend unit tests | 50/50 pass |
| Backend build | exits 0 |
| Frontend build | exits 0 |

### Required for push to `main` only (enforced in `deploy.yml` e2e job)
| Check | Criteria |
|-------|----------|
| Playwright E2E | All tests pass |
| Migration apply | exits 0 |

### Deployment is BLOCKED if
- Any unit test fails
- TypeScript has errors
- ESLint has errors
- Either build fails
- E2E tests fail (on main push)

---

## Test Coverage Thresholds

Defined in `backend/jest.config.js`:
```
branches:   40%
functions:  40%
lines:      40%
statements: 40%
```

These are minimum thresholds. New code should aim for 70%+ coverage on critical paths (auth, leads, agent orchestration).
