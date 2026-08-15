import { test, expect, Page } from '@playwright/test';
import { DIRECTOR_A, DIRECTOR_B, PORTAL_BASE_URL, portalApiLogin } from '../fixtures';
import {
  E2E_PERFORMANCE_GROUPS,
  findGroupId,
  getPerformanceConflicts,
  assignMusician,
  getSemiFinalPerformanceId,
  getFinalPerformanceId,
  searchMusicianIds,
} from '../support/performance-helpers';

test.use({ baseURL: PORTAL_BASE_URL });

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
}

async function openPerformanceForGroup(page: Page, groupName: string): Promise<void> {
  await page.goto('/dashboard');
  await page.locator('.group-card').filter({ hasText: groupName }).click();
  await page.locator('.performance-link').click();
  await expect(page).toHaveURL(/\/groups\/\d+\/performance/);
}

test.describe('Musician conflict warnings', () => {
  test('Director A sees musician conflict warning for seeded shared musician', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.ALPHA);

    const warning = page.getByRole('status', { name: 'Scheduling conflict warnings' });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(/Musician scheduling conflict/i);
    await expect(warning).toContainText(/E2E Musician Alpha/i);
    await expect(warning).toContainText(/E2E Group Beta Director/i);
    await expect(warning).not.toContainText(/director\.b@e2e\.test/i);
    await expect(warning).not.toContainText(/date of birth/i);
    await expect(warning).not.toContainText(/555-/);
  });

  test('Director-safe conflict DTO does not expose other-group roster PII', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.ALPHA);
    const conflicts = await getPerformanceConflicts(groupId, 'Semi-Final', token);

    expect(conflicts.musician_conflicts.length).toBeGreaterThan(0);
    const mc = conflicts.musician_conflicts[0];
    expect(mc.musician_name).toMatch(/E2E Musician Alpha/i);
    expect(mc.other_groups.some((g) => g.group_name === 'E2E Group Beta Director')).toBe(true);

    const serialized = JSON.stringify(conflicts);
    expect(serialized).not.toMatch(/@e2e\.test/);
    expect(serialized).not.toMatch(/date_of_birth/);
    expect(serialized).not.toMatch(/email/);
    expect(serialized).not.toMatch(/phone/);
    expect(serialized).not.toMatch(/roster/i);
  });

  test('Same musician in different rounds does not create same-round conflict', async () => {
    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const tokenB = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
    const groupA = await findGroupId(E2E_PERFORMANCE_GROUPS.ALPHA, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupB = await findGroupId(E2E_PERFORMANCE_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);
    const semiA = await getSemiFinalPerformanceId(groupA, tokenA);
    const finalB = await getFinalPerformanceId(groupB, tokenB);
    const musicianIds = await searchMusicianIds('E2E Musician Beta', tokenA);
    expect(musicianIds.length).toBeGreaterThan(0);

    await assignMusician(groupA, semiA, musicianIds[0], tokenA);
    await assignMusician(groupB, finalB, musicianIds[0], tokenB);

    const conflicts = await getPerformanceConflicts(groupA, 'Semi-Final', tokenA);
    const betaConflict = conflicts.musician_conflicts.find((c) =>
      c.musician_name.includes('E2E Musician Beta')
      && c.other_groups.some((g) => g.group_name === 'E2E Group Beta Director'),
    );
    expect(betaConflict).toBeUndefined();
  });
});

test.describe('Director conflict policy', () => {
  test('Dancer and director conflict types are exposed when present in API', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.ALPHA);
    const conflicts = await getPerformanceConflicts(groupId, undefined, token);

    expect(conflicts).toHaveProperty('dancer_conflicts');
    expect(conflicts).toHaveProperty('director_conflicts');
    expect(conflicts).toHaveProperty('musician_conflicts');
    expect(Array.isArray(conflicts.dancer_conflicts)).toBe(true);
    expect(Array.isArray(conflicts.director_conflicts)).toBe(true);
  });
});
