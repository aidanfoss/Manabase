import { test, expect } from '@playwright/test';
import { loginAsDevUser } from './helpers/auth.js';

test.describe('Friends & Social Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDevUser(page);
    await page.goto('/friends');
    await expect(page).toHaveURL(/\/friends/);

    // Dismiss cookie-consent banner if present
    const acceptBtn = page.locator('button', { hasText: /Got it/i });
    if (await acceptBtn.isVisible()) {
      await acceptBtn.click();
      await expect(acceptBtn).toBeHidden();
    }
  });

  test('Renders Friends page header and tabs', async ({ page }) => {
    // Check main friends container / title
    const headerTitle = page.locator('h1').filter({ hasText: /Friends/i }).first();
    await expect(headerTitle).toBeVisible();

    // Verify tabs exist (Friends, Requests, Messages, Blocked)
    const tabs = page.locator('button.tab-btn');
    await expect(tabs.first()).toBeVisible();
    await expect(tabs.filter({ hasText: /Friends/i }).first()).toBeVisible();
    await expect(tabs.filter({ hasText: /Requests/i }).first()).toBeVisible();
    await expect(tabs.filter({ hasText: /Messages/i }).first()).toBeVisible();
    await expect(tabs.filter({ hasText: /Blocked/i }).first()).toBeVisible();
  });

  test('Switches to Requests tab and displays search user field', async ({ page }) => {
    const requestsTab = page.locator('.tabs-header button.tab-btn, .tab-btn').filter({ hasText: /Requests/i }).first();
    await requestsTab.click();

    // Verify search input for finding users
    const searchInput = page.locator('input[placeholder*="Search users" i], input[placeholder*="username" i]').first();
    await expect(searchInput).toBeVisible();
  });

  test('Switches to Blocked tab', async ({ page }) => {
    const blockedTab = page.locator('.tabs-header button.tab-btn, .tab-btn').filter({ hasText: /Blocked/i }).first();
    await blockedTab.click();

    // Verify blocked view or empty message renders
    const blockedContent = page.locator('text=/Blocked Users|No blocked users/i').first();
    await expect(blockedContent).toBeVisible();
  });

  test('Navigates to Proxy Hub and verifies Friends Proxy Manifest tab', async ({ page }) => {
    await page.goto('/wishlist');
    await expect(page).toHaveURL(/\/wishlist/);

    // Verify Friends Manifest tab exists
    const manifestTab = page.locator('button.tab-btn').filter({ hasText: /Friends Manifest/i }).first();
    await expect(manifestTab).toBeVisible();

    // Click Friends Manifest tab
    await manifestTab.click();
    await expect(page.locator('text=/Friends Proxy Queue|Friends Manifest|Print/i').first()).toBeVisible();
  });
});
