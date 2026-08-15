import { test, expect } from '@playwright/test';
import { PORTAL_BASE_URL, getTestEmails, extractLinkFromEmail, extractTokenFromUrl, PORTAL_API_URL } from '../fixtures';

/**
 * Director signup E2E tests.
 *
 * Note: These tests generate unique emails per run to avoid constraint conflicts.
 * The test email provider (NODE_EMAIL_PROVIDER=test) is used — no real emails sent.
 */

const baseURL = PORTAL_BASE_URL;

function uniqueEmail(prefix = 'test') {
  return `${prefix}_${Date.now()}@e2e.test`;
}

test.use({ baseURL });

test.describe('Director signup', () => {
  test('shows signup form with all required fields', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/date of birth/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox')).toBeVisible();
  });

  test('requires consent to create account', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.getByLabel(/first name/i).fill('Test');
    await page.getByLabel(/last name/i).fill('Director');
    await page.getByLabel(/date of birth/i).fill('1985-01-15');
    await page.getByLabel(/email/i).fill(uniqueEmail('signup_noconsent'));
    const pwField = page.locator('input[formcontrolname="password"]');
    const cpwField = page.locator('input[formcontrolname="confirmPassword"]');
    await pwField.fill('TestPassword123!');
    await cpwField.fill('TestPassword123!');
    // Do NOT check consent
    await page.getByRole('button', { name: /create account/i }).click();
    // Should show consent error, not navigate
    await expect(page).toHaveURL(/signup/);
  });

  test('rejects mismatched passwords', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.getByLabel(/first name/i).fill('Test');
    await page.getByLabel(/last name/i).fill('Director');
    await page.getByLabel(/date of birth/i).fill('1985-01-15');
    await page.getByLabel(/email/i).fill(uniqueEmail('signup_pw'));
    await page.locator('input[formcontrolname="password"]').fill('TestPassword123!');
    await page.locator('input[formcontrolname="confirmPassword"]').fill('DifferentPassword!');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/signup/);
  });

  test('rejects short password (< 10 chars)', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.getByLabel(/first name/i).fill('Test');
    await page.getByLabel(/last name/i).fill('Director');
    await page.getByLabel(/date of birth/i).fill('1985-01-15');
    await page.getByLabel(/email/i).fill(uniqueEmail('signup_short'));
    await page.locator('input[formcontrolname="password"]').fill('short');
    await page.locator('input[formcontrolname="confirmPassword"]').fill('short');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/signup/);
  });

  test('successful signup redirects to verify-email page', async ({ page }) => {
    const email = uniqueEmail('signup_ok');
    await page.goto('/auth/signup');
    await page.getByLabel(/first name/i).fill('Test');
    await page.getByLabel(/last name/i).fill('Director');
    await page.getByLabel(/date of birth/i).fill('1985-01-15');
    await page.getByLabel(/email/i).fill(email);
    await page.locator('input[formcontrolname="password"]').fill('ValidPass123!');
    await page.locator('input[formcontrolname="confirmPassword"]').fill('ValidPass123!');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/verify-email/, { timeout: 10_000 });
  });

  test('rejects duplicate email', async ({ page }) => {
    const email = uniqueEmail('signup_dup');
    // First signup
    await page.goto('/auth/signup');
    await page.getByLabel(/first name/i).fill('Test');
    await page.getByLabel(/last name/i).fill('Director');
    await page.getByLabel(/date of birth/i).fill('1985-01-15');
    await page.getByLabel(/email/i).fill(email);
    await page.locator('input[formcontrolname="password"]').fill('ValidPass123!');
    await page.locator('input[formcontrolname="confirmPassword"]').fill('ValidPass123!');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/verify-email/, { timeout: 10_000 });

    // Second signup with same email
    await page.goto('/auth/signup');
    await page.getByLabel(/first name/i).fill('Duplicate');
    await page.getByLabel(/last name/i).fill('Director');
    await page.getByLabel(/date of birth/i).fill('1990-06-01');
    await page.getByLabel(/email/i).fill(email);
    await page.locator('input[formcontrolname="password"]').fill('ValidPass123!');
    await page.locator('input[formcontrolname="confirmPassword"]').fill('ValidPass123!');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /create account/i }).click();
    // Should show error, stay on signup
    await expect(page).toHaveURL(/signup/);
    await expect(page.locator('.form-error')).toBeVisible();
  });
});

test.describe('Email verification flow', () => {
  test('unverified director cannot login and is redirected to verify-email', async ({ page }) => {
    const email = uniqueEmail('unverified');
    // Create unverified account via API (Node 24 native fetch)
    await fetch(`${PORTAL_API_URL}/portal/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Unverified',
        lastName: 'Director',
        dateOfBirth: '1990-01-01',
        email,
        password: 'ValidPass123!',
        confirmPassword: 'ValidPass123!',
        consentAccepted: true,
      }),
    });

    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(email);
    await page.locator('input[autocomplete="current-password"]').fill('ValidPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/verify-email/, { timeout: 10_000 });
  });

  test('verification link from email verifies account', async ({ page }) => {
    const email = uniqueEmail('verify_link');
    const signupResp = await fetch(`${PORTAL_API_URL}/portal/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Verify', lastName: 'Link', dateOfBirth: '1990-01-01',
        email, password: 'ValidPass123!', confirmPassword: 'ValidPass123!', consentAccepted: true,
      }),
    });
    expect(signupResp.ok).toBe(true);

    // Poll test email inbox — async send may lag slightly after signup response
    let emails: Awaited<ReturnType<typeof getTestEmails>> = [];
    for (let i = 0; i < 10; i++) {
      emails = await getTestEmails(email);
      if (emails.length > 0) break;
      await new Promise(r => setTimeout(r, 500));
    }
    expect(emails.length).toBeGreaterThan(0);

    const verifyLink = extractLinkFromEmail(emails[0].htmlContent, '/auth/verify-email');
    expect(verifyLink).not.toBeNull();

    const token = extractTokenFromUrl(verifyLink!);
    expect(token).not.toBeNull();

    // Visit verify link
    await page.goto(`/auth/verify-email?token=${token}`);
    await expect(page.getByText(/email verified/i)).toBeVisible({ timeout: 10_000 });
  });

  test('expired/invalid verification token shows error', async ({ page }) => {
    await page.goto('/auth/verify-email?token=invalid_token_xyz');
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible({ timeout: 10_000 });
  });

  test('resend verification button is available', async ({ page }) => {
    await page.goto('/auth/verify-email?email=test%40e2e.test');
    await expect(page.getByRole('button', { name: /resend/i })).toBeVisible();
  });
});
