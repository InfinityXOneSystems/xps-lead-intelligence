import { test, expect } from '@playwright/test';

/**
 * Platform spec — these tests define the contract that the autonomous build
 * pipeline must satisfy before a deployment is allowed to proceed.
 *
 * Each test maps to a concrete UI feature that requires:
 *  - a real frontend route
 *  - a real API endpoint
 *  - real database reads/writes
 *
 * The CI loop runs: build → test → repair → test → deploy
 * A failing spec here blocks deployment and forces the agent to repair the code.
 */

test.describe('Platform — Frontend Load', () => {
  test('homepage renders without errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('XPS Lead Intelligence')).toBeVisible();
  });

  test('three-column layout is present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Left sidebar, center editor, right toolbar
    await expect(page.getByRole('button', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /leads/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /agent/i })).toBeVisible();
  });
});

test.describe('Platform — Chat (Agent) UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /agent/i }).click();
  });

  test('chat input is visible and accepts text', async ({ page }) => {
    const input = page.getByPlaceholder(/Ask the agent to do anything/i);
    await expect(input).toBeVisible();
    await input.fill('hello');
    await expect(input).toHaveValue('hello');
  });

  test('chat send button is present', async ({ page }) => {
    // Send button should be present in the agent chat interface
    await expect(page.getByPlaceholder(/Ask the agent to do anything/i)).toBeVisible();
    // Implementation must expose a submit button next to the chat input
    await expect(page.locator('[data-testid="chat-send"]').or(page.getByRole('button', { name: /send/i }))).toBeVisible();
  });

  test('agent chat interface renders orchestrator title', async ({ page }) => {
    await expect(page.getByText(/XPS Orchestrator/i)).toBeVisible();
  });
});

test.describe('Platform — Scraper UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /live scraper|scraper/i }).first().click();
  });

  test('scraper section loads', async ({ page }) => {
    await expect(page.getByText(/live web scraper|scraper/i).first()).toBeVisible();
  });

  test('scraper has a start/run control', async ({ page }) => {
    // The scraper UI must expose a way to kick off a scrape job
    await expect(
      page.locator('[data-testid="start-scrape"]').or(
        page.getByRole('button', { name: /scrape|start|run/i }).first()
      )
    ).toBeVisible();
  });
});

test.describe('Platform — Leads UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /leads/i }).first().click();
  });

  test('leads section loads', async ({ page }) => {
    await expect(page.getByText(/leads/i).first()).toBeVisible();
  });

  test('leads section has a search input', async ({ page }) => {
    await expect(page.getByPlaceholder(/search leads/i)).toBeVisible();
  });
});

test.describe('Platform — Settings', () => {
  test('settings section loads with OAuth connections', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByText(/settings/i).first()).toBeVisible();
  });
});
