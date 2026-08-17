/**
 * Contextual help — Director Portal E2E coverage.
 */

import { test, expect, Page } from '@playwright/test';
import { PORTAL_BASE_URL, DIRECTOR_A } from '../fixtures';

test.use({ baseURL: PORTAL_BASE_URL });

async function loginAsDirector(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(DIRECTOR_A.email);
  await page.locator('input[autocomplete="current-password"]').fill(DIRECTOR_A.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
}

async function openHelp(page: Page, label: string) {
  const trigger = page.getByRole('button', { name: `Help for ${label}` });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('dialog', { name: label })).toBeVisible();
}

test.describe('Contextual help', () => {
  test('Tab skips help icons between form fields on Create Group', async ({ page }) => {
    await loginAsDirector(page);
    await page.goto('/groups/new');

    const helpButtons = page.locator('app-context-help button.context-help-btn');
    await expect(helpButtons).not.toHaveCount(0);
    const count = await helpButtons.count();
    for (let i = 0; i < count; i++) {
      await expect(helpButtons.nth(i)).toHaveAttribute('tabindex', '-1');
    }

    await page.getByLabel('Group name').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Parish')).toBeFocused();
  });

  test('keyboard Enter opens help on Create Group — Group Type', async ({ page }) => {
    await loginAsDirector(page);
    await page.goto('/groups/new');
    const trigger = page.getByRole('button', { name: 'Help for Group type' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Group Type' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Group Type' })).toBeHidden();
  });

  test('mouse click opens help on Roster — Date of Birth dialog', async ({ page }) => {
    await loginAsDirector(page);
    await page.goto('/dashboard');
    await page.locator('.group-card').first().click();
    await page.locator('.roster-link').click();
    await page.getByRole('button', { name: /add participant/i }).click();
    await openHelp(page, 'Date of Birth');
    await page.keyboard.press('Escape');
  });

  test('help on mat-select does not open the dropdown', async ({ page }) => {
    await loginAsDirector(page);
    await page.goto('/groups/new');

    await openHelp(page, 'Group type');

    await expect(page.getByRole('listbox', { name: 'Group type' })).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Group Type' })).toBeVisible();
  });

  test('help on parish autocomplete does not open the suggestion panel', async ({ page }) => {
    await loginAsDirector(page);
    await page.goto('/groups/new');

    await openHelp(page, 'Parish');

    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Parish' })).toBeVisible();
  });

  test('mobile touch opens help on Create Group — Group Type', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDirector(page);
    await page.goto('/groups/new');
    await openHelp(page, 'Group type');
    const panel = page.locator('.context-help-panel');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390 + 1);
    }
  });
});
