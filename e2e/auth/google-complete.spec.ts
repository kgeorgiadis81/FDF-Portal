import { test, expect } from '@playwright/test';
import { PORTAL_BASE_URL } from '../fixtures';

test.use({ baseURL: PORTAL_BASE_URL });

test.describe('Google complete profile', () => {
  test('direct visit without in-memory credential redirects to login', async ({ page }) => {
    await page.goto('/auth/google-complete');
    await expect(page).toHaveURL(/auth\/login/, { timeout: 8_000 });
  });

  test('history state does not retain a Google credential', async ({ page }) => {
    await page.goto('/auth/login');
    await page.goto('/auth/google-complete');
    await expect(page).toHaveURL(/auth\/login/, { timeout: 8_000 });
    const historyHasCredential = await page.evaluate(() => {
      const raw = JSON.stringify(history.state ?? {});
      return raw.includes('credential') || raw.includes('eyJ');
    });
    expect(historyHasCredential).toBe(false);
  });
});
