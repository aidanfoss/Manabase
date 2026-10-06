import { test, expect } from '@playwright/test';
import { loginAsDevUser } from './helpers/auth.js';

test.describe('Manabase Smoke & Navigation Suite', () => {
  test('Backend API health check responds', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  test('Frontend landing page loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Manabase/i);

    // Verify global navigation header is present
    const header = page.locator('.global-header-wrapper');
    await expect(header).toBeVisible();
  });

  test('Navigates across primary application views', async ({ page }) => {
    await page.goto('/');

    // Check Builder view
    await page.goto('/builder');
    await expect(page).toHaveURL(/\/builder/);

    // Check Collection view
    await page.goto('/collection');
    await expect(page).toHaveURL(/\/collection/);

    // Check Wishlist view
    await page.goto('/wishlist');
    await expect(page).toHaveURL(/\/wishlist/);

    // Check Trade view
    await page.goto('/trade');
    await expect(page).toHaveURL(/\/trade/);

    // Check Packages view
    await page.goto('/packages');
    await expect(page).toHaveURL(/\/packages/);
  });

  test('DevUser session can be authenticated', async ({ page }) => {
    await loginAsDevUser(page);

    // Verify user is authenticated in the UI
    const navBar = page.locator('.global-header-wrapper');
    await expect(navBar).toBeVisible();
  });
});
