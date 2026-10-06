/**
 * E2E Authentication Helpers for Manabase
 */

/**
 * Ensures a valid DevUser session by triggering dev-login or waiting for auto-login
 * @param {import('@playwright/test').Page} page
 */
export async function loginAsDevUser(page) {
  await page.goto('/');

  // If already logged in via dev auto-login
  const userGreeting = page.locator('.nav-user-info, .user-badge, .nav-username, [title="DevUser"]');
  try {
    await userGreeting.first().waitFor({ state: 'visible', timeout: 3000 });
    return;
  } catch {
    // If not auto-logged in, trigger dev-login via API injection into localStorage
  }

  // Obtain token directly from dev-login endpoint
  const response = await page.request.post('/api/auth/dev-login');
  if (response.ok()) {
    const data = await response.json();
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, data);
    await page.reload();
  }
}

/**
 * Clears current session from localStorage
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  await page.evaluate(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  });
  await page.reload();
}
