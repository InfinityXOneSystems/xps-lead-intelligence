---
applyTo: "**/*.test.ts,**/*.spec.ts,e2e/**"
---
# Test Instructions

## Backend Tests (Jest + supertest)
- Location: `backend/src/__tests__/*.test.ts`
- Run: `cd backend && npm test`
- All 50 tests must pass with 0 failures
- JWT_SECRET is set in `jest.setup.js` — no need to repeat in tests
- Mock Prisma: `jest.mock('../db/prisma', () => ({ prisma: { model: { findMany: jest.fn()... } } }))`
- Test real route logic, not Prisma internals

### Test Pattern
```typescript
import request from 'supertest';
import express from 'express';
import myRouter from '../routes/my-feature';

const app = express();
app.use(express.json());
app.use('/api/my-feature', myRouter);

describe('GET /api/my-feature', () => {
  it('returns 200 with data', async () => {
    const res = await request(app).get('/api/my-feature');
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});
```

## E2E Tests (Playwright)
- Location: `e2e/tests/*.spec.ts`
- Run: `cd e2e && npx playwright test`
- Only run when services are running (postgres + redis + backend + frontend)
- Tests use `BASE_URL` env var (default: `http://localhost:3000`)
- Test navigation, form submissions, and key user flows

### E2E Pattern
```typescript
import { test, expect } from '@playwright/test';

test('navigates to Settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /settings/i }).click();
  await expect(page.getByText(/connect accounts/i)).toBeVisible();
});
```

## What Must Be Tested
- Every new API route: happy path + error path
- Auth flows: token validation, status check
- Critical business logic: lead scoring, email sending
- Security: rate limiting, input validation

## What NOT to Test
- Prisma internals (mock them)
- Third-party SDK internals
- UI styling (test behavior, not appearance)
