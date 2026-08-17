import { test, expect } from '@playwright/test';
import { PORTAL_API_URL, PORTAL_BASE_URL, DIRECTOR_PENDING_CONSENT, portalApiLogin } from '../fixtures';

test.use({ baseURL: PORTAL_BASE_URL });

/**
 * Consent flow tests.
 * Backend consent enforcement is also tested in IDOR/security tests.
 */

test.describe('Consent flow', () => {
  test('signup cannot complete without consent checked', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.getByLabel(/first name/i).fill('No');
    await page.getByLabel(/last name/i).fill('Consent');
    await page.locator('input[formcontrolname="dateOfBirth"]').fill('1990-01-01');
    await page.getByLabel(/email/i).fill(`noconsent_${Date.now()}@e2e.test`);
    await page.locator('input[formcontrolname="password"]').fill('ValidPass123!');
    await page.locator('input[formcontrolname="confirmPassword"]').fill('ValidPass123!');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/signup/);
    await expect(page.locator('.consent-error')).toBeVisible();
  });

  test('public config exposes privacy policy URL', async ({ request }) => {
    const response = await request.get(`${PORTAL_API_URL}/portal/auth/public-config`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.requiredConsentVersion).toBeTruthy();
    expect(typeof body.privacyPolicyUrl).toBe('string');
  });

  test('consent page offers explicit decline when consent is required', async ({ page }) => {
    const login = await portalApiLogin(DIRECTOR_PENDING_CONSENT.email, DIRECTOR_PENDING_CONSENT.password);
    await page.addInitScript(({ token, name, id }) => {
      sessionStorage.setItem('fdp_token', token);
      sessionStorage.setItem('fdp_role', 'Director');
      sessionStorage.setItem('fdp_name', name);
      sessionStorage.setItem('fdp_id', String(id));
    }, { token: login, name: DIRECTOR_PENDING_CONSENT.name, id: 0 });

    await page.goto('/consent');
    await expect(page.getByRole('button', { name: /i do not accept/i })).toBeVisible();
  });

  test('decline endpoint records refusal', async ({ request }) => {
    const token = await portalApiLogin(DIRECTOR_PENDING_CONSENT.email, DIRECTOR_PENDING_CONSENT.password);
    const declineResp = await request.post(`${PORTAL_API_URL}/portal/auth/consent/decline`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(declineResp.ok()).toBeTruthy();

    const statusResp = await request.get(`${PORTAL_API_URL}/portal/auth/consent-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(statusResp.ok()).toBeTruthy();
    const status = await statusResp.json();
    expect(status.declined).toBe(true);
    expect(status.accepted).toBe(false);
  });

  test('API rejects protected portal routes without consent', async ({ request }) => {
    const response = await request.get(`${PORTAL_API_URL}/portal/groups`, {
      headers: { Authorization: 'Bearer invalid_token' },
    });
    expect([401, 403]).toContain(response.status());
  });
});
