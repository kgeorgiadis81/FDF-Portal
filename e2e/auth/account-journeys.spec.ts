import { test, expect, type Page, type Route } from '@playwright/test';
import {
  DIRECTOR_A,
  PORTAL_API_URL,
  PORTAL_BASE_URL,
  extractLinkFromEmail,
  extractTokenFromUrl,
  getTestEmails,
  portalApiLogin,
} from '../fixtures';

test.use({ baseURL: PORTAL_BASE_URL });

const PASSWORD = 'ValidPass123!';

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}@e2e.test`;
}

async function signup(email: string) {
  const response = await fetch(`${PORTAL_API_URL}/portal/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Journey',
      lastName: 'Director',
      dateOfBirth: '1990-01-01',
      email,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      consentAccepted: true,
    }),
  });
  expect(response.ok).toBe(true);
}

async function waitForEmail(email: string, pathPrefix: string) {
  let emails: Awaited<ReturnType<typeof getTestEmails>> = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    emails = await getTestEmails(email);
    const match = emails.find((message) => extractLinkFromEmail(message.htmlContent, pathPrefix));
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email for ${email} containing ${pathPrefix}`);
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test.describe('Account journeys', () => {
  test('password reset lets the director sign in with the new password', async ({ page }) => {
    const email = uniqueEmail('reset');
    await signup(email);
    const verifyMessage = await waitForEmail(email, '/auth/verify-email');
    const verifyToken = extractTokenFromUrl(extractLinkFromEmail(verifyMessage.htmlContent, '/auth/verify-email')!);
    const verified = await fetch(`${PORTAL_API_URL}/portal/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verifyToken }),
    });
    expect(verified.ok).toBe(true);

    const forgot = await fetch(`${PORTAL_API_URL}/portal/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    expect(forgot.ok).toBe(true);

    const message = await waitForEmail(email, '/auth/reset-password');
    const link = extractLinkFromEmail(message.htmlContent, '/auth/reset-password');
    const token = extractTokenFromUrl(link!);
    expect(token).toBeTruthy();

    const newPassword = 'ResetPass123!';
    await page.goto(`/auth/reset-password?token=${encodeURIComponent(token!)}`);
    await page.locator('input[formcontrolname="newPassword"]').fill(newPassword);
    await page.locator('input[formcontrolname="confirmPassword"]').fill(newPassword);
    await page.getByRole('button', { name: /reset password/i }).click();
    await expect(page.getByText(/password has been reset|password updated|sign in/i).first()).toBeVisible({ timeout: 10_000 });

    await login(page, email, newPassword);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /my groups/i })).toBeVisible();
  });

  test('email verification link marks the account verified', async ({ page }) => {
    const email = uniqueEmail('verify');
    await signup(email);
    const message = await waitForEmail(email, '/auth/verify-email');
    const token = extractTokenFromUrl(extractLinkFromEmail(message.htmlContent, '/auth/verify-email')!);
    expect(token).toBeTruthy();

    await page.goto(`/auth/verify-email?token=${encodeURIComponent(token!)}`);
    await expect(page.getByText(/email verified/i)).toBeVisible({ timeout: 10_000 });

    await login(page, email, PASSWORD);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
    await page.goto('/profile');
    await expect(page.getByText('Verified', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    const sessionToken = await portalApiLogin(email, PASSWORD);
    const profile = await fetch(`${PORTAL_API_URL}/portal/auth/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    expect(profile.ok).toBe(true);
    expect((await profile.json() as { emailVerified: boolean }).emailVerified).toBe(true);
  });

  test('Google sign-in completion test double lands on the dashboard', async ({ page }) => {
    const email = uniqueEmail('google');
    await signup(email);
    const message = await waitForEmail(email, '/auth/verify-email');
    const token = extractTokenFromUrl(extractLinkFromEmail(message.htmlContent, '/auth/verify-email')!);
    await fetch(`${PORTAL_API_URL}/portal/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const sessionToken = await portalApiLogin(email, PASSWORD);

    await page.route('**/portal/auth/google', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requiresProfileCompletion: true,
          googleProfile: {
            providerSubject: 'test-double',
            providerEmail: email,
            suggestedFirstName: 'Google',
            suggestedLastName: 'Director',
          },
        }),
      });
    });
    await page.route('**/portal/auth/google/complete-profile', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: sessionToken,
          role: 'Director',
          roles: ['Director'],
          firstName: 'Google',
          lastName: 'Director',
          requiresConsent: false,
        }),
      });
    });

    await page.goto('/auth/login');
    await page.waitForSelector('fdp-login');
    const triggered = await page.evaluate(() => {
      const host = document.querySelector('fdp-login');
      const ng = (window as unknown as { ng?: { getComponent: (el: Element) => { handleGoogleCredential?: (c: string) => void } } }).ng;
      const component = host && ng?.getComponent(host);
      if (!component || typeof component['handleGoogleCredential'] !== 'function') return false;
      component['handleGoogleCredential']('test-double-credential');
      return true;
    });
    expect(triggered).toBe(true);

    await expect(page).toHaveURL(/google-complete/, { timeout: 10_000 });
    await page.getByRole('textbox', { name: /date of birth/i }).fill('1990-01-01');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /complete setup/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /my groups/i })).toBeVisible();
  });

  test('edited profile values are still there after reload', async ({ page }) => {
    const phone = `555${String(Date.now()).slice(-7)}`;
    await login(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
    await page.goto('/profile');
    await page.getByRole('button', { name: /^edit$/i }).click();
    const phoneInput = page.getByRole('textbox', { name: /phone number/i });
    const original = await phoneInput.inputValue();
    await phoneInput.fill(phone);
    await expect(page.getByText(/changes saved/i)).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.getByText(phone)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /^edit$/i }).click();
    await page.getByRole('textbox', { name: /phone number/i }).fill(original);
    await expect(page.getByText(/changes saved/i)).toBeVisible({ timeout: 10_000 });
  });

  test('a newly registered group appears in My Groups', async ({ page }) => {
    const name = `E2E Journey ${Date.now()}`;
    await login(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
    await page.getByRole('link', { name: /register a group/i }).click();
    await expect(page).toHaveURL(/groups\/new/);
    await page.getByRole('textbox', { name: 'Group name' }).fill(name);
    const parish = page.getByRole('combobox', { name: 'Parish' });
    await parish.click();
    await parish.fill('E2E Parish A');
    await page.getByRole('option', { name: /E2E Parish A/i }).click();
    await page.getByRole('combobox', { name: 'Group type' }).click();
    await page.getByRole('option', { name: 'Dance' }).click();
    await page.getByRole('button', { name: /register group/i }).click();
    await expect(page).toHaveURL(/\/groups\/\d+/, { timeout: 15_000 });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /my groups/i })).toBeVisible();
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
  });
});
