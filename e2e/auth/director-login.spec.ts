import { test, expect } from '@playwright/test';
import { PORTAL_BASE_URL, DIRECTOR_A } from '../fixtures';

test.use({ baseURL: PORTAL_BASE_URL });

test.describe('Director login', () => {
  test('shows login form', async ({ page }) => {
    await page.goto('/auth/login');
    const logo = page.getByRole('img', { name: /fdf logo/i });
    await expect(logo).toBeVisible();
    await expect.poll(async () => logo.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    // Use exact label to avoid matching the "Show password" toggle button aria-label
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create account/i })).toBeVisible();
  });

  test('rejects invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.locator('input[autocomplete="current-password"]').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('.form-error')).toBeVisible({ timeout: 8_000 });
    // Must not reveal whether account exists
    const errorText = await page.locator('.form-error').textContent();
    expect(errorText).not.toMatch(/account.*exists/i);
    expect(errorText).not.toMatch(/password.*wrong/i);
  });

  test('shows generic error for unknown email', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill('nobody@nonexistent.example.com');
    await page.locator('input[autocomplete="current-password"]').fill('SomePassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('.form-error')).toContainText(/invalid email or password/i, { timeout: 8_000 });
  });

  test('verified director can login and lands on dashboard', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(DIRECTOR_A.email);
    await page.locator('input[autocomplete="current-password"]').fill(DIRECTOR_A.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
    // "My Groups" appears in both nav and h2 — use heading role to disambiguate
    await expect(page.getByRole('heading', { name: /my groups/i })).toBeVisible({ timeout: 8_000 });
  });

  test('toggle password visibility', async ({ page }) => {
    await page.goto('/auth/login');
    const pwInput = page.locator('input[autocomplete="current-password"]');
    await pwInput.fill('mypassword');
    await expect(pwInput).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /show password/i }).click();
    await expect(pwInput).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: /hide password/i }).click();
    await expect(pwInput).toHaveAttribute('type', 'password');
  });

  test('logout clears session and returns to login', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(DIRECTOR_A.email);
    await page.locator('input[autocomplete="current-password"]').fill(DIRECTOR_A.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });

    // Open account menu and sign out
    await page.getByRole('button', { name: /account menu/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/auth\/login/, { timeout: 10_000 });

    // Navigating to dashboard should redirect to login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/auth\/login/, { timeout: 8_000 });
  });
});

test.describe('Password reset flow', () => {
  test('forgot password page shows generic message', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.getByLabel(/email/i).fill('nobody@example.com');
    await page.getByRole('button', { name: /send reset/i }).click();
    await expect(page.getByText(/instructions have been sent/i)).toBeVisible({ timeout: 8_000 });
  });

  test('reset password with invalid token shows error', async ({ page }) => {
    await page.goto('/auth/reset-password?token=invalid_token_xyz');
    // Form appears but error shows on submit
    await page.locator('input[formcontrolname="newPassword"]').fill('NewPassword123!');
    await page.locator('input[formcontrolname="confirmPassword"]').fill('NewPassword123!');
    await page.getByRole('button', { name: /reset password/i }).click();
    await expect(page.locator('.error-box, .form-error')).toBeVisible({ timeout: 8_000 });
  });

  test('reset password mismatched passwords shows validation error', async ({ page }) => {
    await page.goto('/auth/reset-password?token=some_token');
    await page.locator('input[formcontrolname="newPassword"]').fill('NewPassword123!');
    await page.locator('input[formcontrolname="confirmPassword"]').fill('DifferentPass!');
    await page.getByRole('button', { name: /reset password/i }).click();
    await expect(page.locator('mat-error')).toBeVisible();
  });
});

test.describe('Security: Role enforcement', () => {
  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/auth\/login/, { timeout: 8_000 });
  });

  test('unauthenticated access to groups redirects to login', async ({ page }) => {
    await page.goto('/groups/1');
    await expect(page).toHaveURL(/auth\/login/, { timeout: 8_000 });
  });
});

function makeUnsignedJwt(expOffsetSeconds: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ exp })}.sig`;
}

async function seedDirectorSession(
  page: import('@playwright/test').Page,
  token: string
) {
  await page.addInitScript((value) => {
    sessionStorage.setItem('fdp_token', value);
    sessionStorage.setItem('fdp_role', 'Director');
    sessionStorage.setItem('fdp_roles', JSON.stringify(['Director']));
    sessionStorage.setItem('fdp_name', 'Director Alpha');
    sessionStorage.setItem('fdp_id', '1');
  }, token);
}

test.describe('Director session expiry', () => {
  test('expired JWT redirects to login instead of an empty dashboard', async ({ page }) => {
    await seedDirectorSession(page, makeUnsignedJwt(-120));
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/auth\/login/);
    await expect(page.getByText(/session has expired/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /my groups/i })).toHaveCount(0);
  });

  test('401 from API redirects to login with a session expired message', async ({ page }) => {
    await seedDirectorSession(page, makeUnsignedJwt(3600));
    await page.route('**/portal/**', async (route) => {
      if (route.request().url().includes('/portal/auth/login')) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/auth\/login/, { timeout: 10_000 });
    await expect(page.getByText(/session has expired/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /my groups/i })).toHaveCount(0);
  });
});
