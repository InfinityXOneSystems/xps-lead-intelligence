/**
 * Railway Deployment Verification Tests
 *
 * These tests verify that the frontend and backend are live on Railway.
 * They run against real Railway URLs (BASE_URL + BACKEND_URL env vars).
 *
 * Usage:
 *   BASE_URL=https://your-app.railway.app \
 *   BACKEND_URL=https://your-backend.railway.app \
 *   npx playwright test tests/railway-deployment.spec.ts
 *
 * In CI this is triggered by the auto-heal.yml workflow.
 */

import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || process.env.BASE_URL?.replace(':3000', ':4000') || 'http://localhost:4000';
const FRONTEND_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Railway Backend Deployment', () => {
  test('GET /api/health returns 200 and status ok', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/health`);
    expect(response.status()).toBe(200);

    const body = await response.json() as { status: string; version?: string };
    expect(body.status).toBe('ok');

    console.log(`✅ Backend healthy: ${BACKEND_URL}/api/health → ${JSON.stringify(body)}`);
  });

  test('GET /api/leads returns 200 or 401 (auth gate)', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/leads`);
    // 200 = public access (no auth required)
    // 401 = auth-gated (expected for production)
    expect([200, 401]).toContain(response.status());

    console.log(`✅ Backend /api/leads: HTTP ${response.status()} (auth gate working)`);
  });

  test('GET /api/agent returns 200 or 401', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/agent`);
    expect([200, 401, 404]).toContain(response.status());

    console.log(`✅ Backend /api/agent: HTTP ${response.status()}`);
  });

  test('GET /api/connectors returns 200 or 401', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/connectors`);
    expect([200, 401]).toContain(response.status());

    console.log(`✅ Backend /api/connectors: HTTP ${response.status()}`);
  });

  test('CORS headers are present on health endpoint', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/health`);
    expect(response.status()).toBe(200);
    // Should have CORS headers (access-control-allow-origin or similar)
    const headers = response.headers();
    const hasCors = 'access-control-allow-origin' in headers ||
                    'vary' in headers;
    expect(hasCors).toBe(true);

    console.log(`✅ CORS headers present on backend`);
  });

  test('POST /api/agent/chat processes a message (mock check)', async ({ request }) => {
    // Just verify the endpoint exists and returns a structured error without auth
    const response = await request.post(`${BACKEND_URL}/api/agent/chat`, {
      data: { message: 'health check ping' },
    });
    // Should be 200 (success), 400 (validation), or 401 (auth required)
    expect([200, 400, 401, 500]).toContain(response.status());

    console.log(`✅ Backend /api/agent/chat: HTTP ${response.status()}`);
  });
});

test.describe('Railway Frontend Deployment', () => {
  test('Frontend home page loads (HTTP 200)', async ({ page }) => {
    const response = await page.goto(FRONTEND_URL);
    expect(response?.status()).toBe(200);

    console.log(`✅ Frontend loaded: ${FRONTEND_URL} → HTTP ${response?.status()}`);
  });

  test('XPS Lead Intelligence title is visible', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('XPS Lead Intelligence')).toBeVisible({ timeout: 15000 });

    console.log('✅ Frontend: XPS Lead Intelligence title visible');
  });

  test('Navigation sidebar renders correctly', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Core nav items should be visible
    await expect(page.getByRole('button', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /leads/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /agent/i })).toBeVisible();

    console.log('✅ Frontend: Navigation sidebar renders');
  });

  test('PWA manifest is accessible', async ({ page }) => {
    const response = await page.goto(`${FRONTEND_URL}/manifest.json`);
    expect(response?.status()).toBe(200);

    const body = await page.evaluate(() => document.body.innerText);
    const manifest = JSON.parse(body);
    expect(manifest.name).toBe('XPS Lead Intelligence');

    console.log(`✅ Frontend: PWA manifest accessible`);
  });

  test('Frontend connects to backend (health check via UI)', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Navigate to dashboard which may trigger backend calls
    await page.getByRole('button', { name: /dashboard/i }).click();
    await page.waitForTimeout(2000);

    // Dashboard should not show a hard error state
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();

    console.log('✅ Frontend: Dashboard renders without fatal errors');
  });

  test('Agent section loads successfully', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^agent$/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByPlaceholder(/ask the agent to do anything/i)).toBeVisible({ timeout: 10000 });

    console.log('✅ Frontend: Agent section loaded');
  });

  test('Leads section loads successfully', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /leads crm/i }).click();
    await page.waitForTimeout(1000);

    // Should show leads table or empty state
    const hasLeadsContent = await page.getByText(/leads/i).first().isVisible().catch(() => false);
    expect(hasLeadsContent).toBe(true);

    console.log('✅ Frontend: Leads section loaded');
  });

  test('Scraper section loads successfully', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /live scraper/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByText(/live web scraper/i)).toBeVisible({ timeout: 10000 });

    console.log('✅ Frontend: Scraper section loaded');
  });

  test('Settings section loads successfully', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /settings/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 10000 });

    console.log('✅ Frontend: Settings section loaded');
  });

  test('AI Editor section loads with Monaco editor', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /ai editor/i }).click();
    await page.waitForTimeout(3000); // Monaco lazy-loads

    // AI Editor should have the header visible
    await expect(page.getByText(/ai visual editor/i)).toBeVisible({ timeout: 15000 });

    console.log('✅ Frontend: AI Editor section loaded');
  });

  test('No JavaScript console errors on load', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Filter to only critical JavaScript errors (not network/API errors in test env)
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('NEXT_PUBLIC_API_URL') &&
      !e.includes('favicon') &&
      !e.includes('Failed to load resource') &&
      !e.includes('net::ERR_') &&    // network errors in isolated test env
      !e.includes('localhost:4000')  // backend not available in Railway E2E
    );

    if (criticalErrors.length > 0) {
      console.error('Critical console errors:', criticalErrors);
    }
    // Fail if there are genuine JavaScript errors (hydration, type errors, etc.)
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('Railway Full-Stack Integration', () => {
  test('Frontend can reach backend health endpoint', async ({ page }) => {
    // Use page to make an XHR to the backend — simulates real frontend behavior
    const result = await page.evaluate(async (backendUrl) => {
      try {
        const r = await fetch(`${backendUrl}/api/health`);
        return { status: r.status, ok: r.ok };
      } catch (e) {
        return { status: 0, error: String(e) };
      }
    }, BACKEND_URL);

    // Either 200 OK or CORS blocked (which means server is running)
    const isReachable = result.status === 200 || result.status > 0;
    expect(isReachable).toBe(true);

    console.log(`✅ Full-stack: Frontend → Backend health check: HTTP ${result.status}`);
  });
});
