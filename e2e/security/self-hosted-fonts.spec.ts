/**
 * Self-hosted Inter and Material Icons must keep working when Google Fonts is blocked.
 */
import { expect, test, type Page } from '@playwright/test';
import { DIRECTOR_A, PORTAL_BASE_URL } from '../fixtures';
import { E2E_DOCUMENT_GROUPS, findGroupId } from '../support/document-helpers';

test.use({ baseURL: PORTAL_BASE_URL });

const GOOGLE_FONTS = /fonts\.(googleapis|gstatic)\.com/;

async function blockGoogleFonts(page: Page): Promise<string[]> {
  const hits: string[] = [];
  await page.route(GOOGLE_FONTS, (route) => {
    hits.push(route.request().url());
    return route.abort();
  });
  page.on('request', (request) => {
    if (GOOGLE_FONTS.test(request.url()) && !hits.includes(request.url())) {
      hits.push(request.url());
    }
  });
  return hits;
}

async function expectSelfHostedFonts(page: Page): Promise<void> {
  const metrics = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('400 16px Inter'),
      document.fonts.load('500 16px Inter'),
      document.fonts.load('600 16px Inter'),
      document.fonts.load('700 16px Inter'),
      document.fonts.load('24px "Material Icons"'),
    ]);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { error: 'no canvas' };
    }
    ctx.font = '400 32px Inter';
    const regular = ctx.measureText('FDF Portal').width;
    ctx.font = '700 32px Inter';
    const bold = ctx.measureText('FDF Portal').width;
    ctx.font = '24px "Material Icons"';
    const icon = ctx.measureText('home').width;
    const bodyFamily = getComputedStyle(document.body).fontFamily;
    const iconEl = document.querySelector('mat-icon');
    const iconFamily = iconEl ? getComputedStyle(iconEl).fontFamily : '';
    return { regular, bold, icon, bodyFamily, iconFamily };
  });

  expect(metrics.error, 'canvas context').toBeUndefined();
  expect(metrics.bodyFamily).toContain('Inter');
  expect(metrics.bold).toBeGreaterThan(metrics.regular ?? 0);
  expect(metrics.iconFamily).toContain('Material Icons');
  // A loaded ligature is one em wide. Fallback text for "home" is much wider.
  expect(metrics.icon).toBeLessThan(30);
}

test.describe('self-hosted fonts', () => {
  test('HTML does not reference Google Fonts', async ({ request }) => {
    const html = await (await request.get('/auth/login')).text();
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    expect(html).toContain('https://accounts.google.com/gsi/client');
    expect(html).toContain("font-src 'self'");
  });

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    test(`icons and Inter survive a Google Fonts block at ${viewport.width}px`, async ({ page }) => {
      const googleFontRequests = await blockGoogleFonts(page);
      await page.setViewportSize(viewport);

      await page.goto('/auth/login');
      await expect(page.getByRole('button', { name: 'Show password' })).toBeVisible();
      await expectSelfHostedFonts(page);

      await page.getByLabel(/email/i).fill(DIRECTOR_A.email);
      await page.locator('input[autocomplete="current-password"]').fill(DIRECTOR_A.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
      await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
      await expect(page.locator('mat-icon.inline-icon[aria-hidden="true"]').first()).toBeVisible();
      await expectSelfHostedFonts(page);

      const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.ALPHA);
      await page.goto(`/groups/${groupId}`);
      await expect(page.getByRole('heading', { name: E2E_DOCUMENT_GROUPS.ALPHA })).toBeVisible();
      await expectSelfHostedFonts(page);

      await page.goto(`/groups/${groupId}/roster`);
      // The roster route also renders its shell when the roster API returns an error.
      const rosterHeading = page.getByRole('heading', { name: 'Roster' });
      const rosterError = page.getByRole('alert');
      await expect(rosterHeading.or(rosterError)).toBeVisible();
      if (await rosterHeading.isVisible()) {
        await expect(page.getByRole('button', { name: /^Edit / }).first()).toBeVisible();
      }
      await expectSelfHostedFonts(page);

      await page.goto(`/groups/${groupId}/documents`);
      const documentsHeading = page.getByRole('heading', { name: 'Registration Documents' });
      const documentsError = page.getByRole('alert');
      await expect(documentsHeading.or(documentsError)).toBeVisible();
      await expectSelfHostedFonts(page);

      expect(googleFontRequests).toEqual([]);
    });
  }
});
