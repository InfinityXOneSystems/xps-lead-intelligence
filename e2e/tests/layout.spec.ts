import { test, expect } from '@playwright/test';

test.describe('XPS Lead Intelligence Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('renders 3-column layout', async ({ page }) => {
    // Check header
    await expect(page.getByText('XPS Lead Intelligence')).toBeVisible();

    // Check left sidebar navigation items
    await expect(page.getByRole('button', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /leads/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /agent/i })).toBeVisible();

    // Check main content area
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('light/dark mode toggle works', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: /toggle theme/i });
    await expect(toggleBtn).toBeVisible();

    // Initially in dark mode - click to switch to light
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // Toggle back
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // Layout should still be intact
    await expect(page.getByText('XPS Lead Intelligence')).toBeVisible();
  });

  test('navigates to Leads section', async ({ page }) => {
    await page.getByRole('button', { name: /leads/i }).click();
    await expect(page.getByText(/leads/i).first()).toBeVisible();
    await expect(page.getByPlaceholder(/search leads/i)).toBeVisible();
  });

  test('navigates to Agent chat interface', async ({ page }) => {
    await page.getByRole('button', { name: /agent/i }).click();
    await expect(page.getByText(/XPS Orchestrator/i)).toBeVisible();
    await expect(page.getByPlaceholder(/message xps orchestrator/i)).toBeVisible();
  });

  test('agent chat interface has input and send button', async ({ page }) => {
    await page.getByRole('button', { name: /agent/i }).click();

    const input = page.getByPlaceholder(/message xps orchestrator/i);
    await expect(input).toBeVisible();
    await input.fill('Hello agent');
    await expect(input).toHaveValue('Hello agent');
  });

  test('navigates to admin settings', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByText(/settings/i).first()).toBeVisible();
  });

  test('navigates to connectors', async ({ page }) => {
    await page.getByRole('button', { name: /connectors/i }).click();
    await expect(page.getByText(/connectors/i).first()).toBeVisible();
    await expect(page.getByText(/GitHub/i)).toBeVisible();
  });

  test('sidebar collapse toggle works', async ({ page }) => {
    // Find collapse button
    const collapseBtn = page.getByRole('button', { name: /collapse sidebar/i });
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();

    // After collapse, expand button should be visible
    const expandBtn = page.getByRole('button', { name: /expand sidebar/i });
    await expect(expandBtn).toBeVisible();

    // Expand it back
    await expandBtn.click();
    await expect(page.getByRole('button', { name: /collapse sidebar/i })).toBeVisible();
  });

  test('right toolbar is visible', async ({ page }) => {
    // Right toolbar should have quick action buttons
    await expect(page.getByRole('button', { name: /ask agent/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /view leads/i })).toBeVisible();
  });

  test('navigates to dashboard from sidebar', async ({ page }) => {
    // Go to leads first
    await page.getByRole('button', { name: /leads/i }).click();
    // Then back to dashboard
    await page.getByRole('button', { name: /dashboard/i }).click();
    await expect(page.getByText('Welcome to XPS Lead Intelligence Platform')).toBeVisible();
  });
});
