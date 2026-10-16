import { test, expect } from '@playwright/test';
import { PORTAL_API_URL, PORTAL_BASE_URL, DIRECTOR_A } from '../fixtures';
import { attachCspViolationCollector, expectNoCspViolations } from '../support/csp-helpers';
import { E2E_DOCUMENT_GROUPS, findGroupId } from '../support/document-helpers';

test.use({ baseURL: PORTAL_BASE_URL });

test.describe('Content-Security-Policy', () => {
  test('login HTML includes a CSP meta tag', async ({ request }) => {
    const html = await (await request.get('/auth/login')).text();
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("default-src 'self'");
    expect(html).toContain("object-src 'none'");
    expect(html).toContain("base-uri 'self'");
    expect(html).toContain('https://accounts.google.com/gsi/client');
  });

  test('login page has no CSP violations', async ({ page }) => {
    await attachCspViolationCollector(page);
    await page.goto('/auth/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectNoCspViolations(page);
  });

  test('dashboard and documents pages have no CSP violations', async ({ page, request }) => {
    let apiUp = false;
    try {
      apiUp = (await request.get(`${PORTAL_API_URL}/health`)).ok();
    } catch {
      apiUp = false;
    }
    test.skip(!apiUp, 'E2E backend is not running');

    await attachCspViolationCollector(page);
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(DIRECTOR_A.email);
    await page.locator('input[autocomplete="current-password"]').fill(DIRECTOR_A.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
    await expectNoCspViolations(page);

    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.ALPHA);
    await page.goto(`/groups/${groupId}/documents`);
    await expect(page.getByRole('heading', { name: 'Registration Documents' })).toBeVisible();
    await expectNoCspViolations(page);

    const viewButton = page.getByRole('button', { name: /view signed roster/i }).first();
    if (await viewButton.isVisible()) {
      const popupPromise = page.waitForEvent('popup', { timeout: 8_000 }).catch(() => null);
      await viewButton.click();
      await popupPromise;
      await expectNoCspViolations(page);
    }
  });
});
