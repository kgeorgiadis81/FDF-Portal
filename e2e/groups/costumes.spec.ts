import { test, expect, Page } from '@playwright/test';
import {
  E2E_COSTUME_GROUPS,
  findGroupId,
  getSemiFinalPerformanceId,
  getFinalPerformanceId,
  getCostumes,
  getCostumeContext,
  getCostumeConflicts,
  resourceTypeIdByCode,
  setCostumeDeadline,
  clearCostumeDeadline,
  COSTUME_DEADLINE_PAST,
  submitCostumeRegistration,
  createCostumeConflict,
  deleteCostumeConflict,
} from '../support/costume-helpers';
import { DIRECTOR_A, DIRECTOR_B, portalApiLogin, PORTAL_BASE_URL, PORTAL_API_URL } from '../fixtures';
import { getDirectorHistoricalEventId, findDirectorGroupIdForEvent } from '../support/roster-helpers';

test.use({ baseURL: PORTAL_BASE_URL });

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
}

async function openCostumesForGroup(page: Page, groupName: string): Promise<void> {
  const groupId = await findGroupId(groupName);
  await page.goto(`/groups/${groupId}/costumes`);
  await expect(page).toHaveURL(/\/groups\/\d+\/costumes/);
  await expect(page.getByRole('heading', { name: 'Costumes' })).toBeVisible();
}

async function fillCostumeForm(page: Page, sectionLabel: string, opts: {
  region: string;
  village: string;
  resource: string;
  wonAward: 'Yes' | 'No';
  purchasedMost: 'Yes' | 'No';
  purchasedAny: 'Yes' | 'No';
}): Promise<void> {
  const section = page.locator('.costume-section').filter({ hasText: sectionLabel });
  await section.getByLabel('Region').fill(opts.region);
  await section.getByLabel('Village').fill(opts.village);
  await section.locator('mat-select[formcontrolname="resource_type_id"] .mat-mdc-select-trigger').click({ force: true });
  await page.locator('mat-option').filter({ hasText: opts.resource }).click();
  await section.getByRole('group', { name: 'Has this costume ever won an award?' })
    .getByRole('radio', { name: opts.wonAward, exact: true }).click();
  await section.getByRole('group', { name: 'Did you purchase most or all of the costume?' })
    .getByRole('radio', { name: opts.purchasedMost, exact: true }).click();
  await section.getByRole('group', { name: 'Did you purchase any parts of the costume?' })
    .getByRole('radio', { name: opts.purchasedAny, exact: true }).click();
}

test.describe('Costume page navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
  });

  test('Dance group shows Costumes page with rounds and gender sections', async ({ page }) => {
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.A2);
    await page.goto(`/groups/${groupId}/costumes`);
    await expect(page).toHaveURL(/\/groups\/\d+\/costumes/);
    await expect(page.getByRole('heading', { name: 'Costumes' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Semi-Final' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Final', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: "Men's Costume", exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: "Women's Costume", exact: true })).toBeVisible();
  });
});

test.describe('Choral costume exclusion', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
  });

  test('Choral group does not show Costumes navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('.group-card').filter({ hasText: E2E_COSTUME_GROUPS.CHORAL }).click();
    await expect(page.getByRole('link', { name: /Manage Costumes/i })).not.toBeVisible();
  });

  test('Direct costume route redirects for choral group', async ({ page }) => {
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.CHORAL);
    await page.goto(`/groups/${groupId}/costumes`);
    await expect(page).not.toHaveURL(/\/costumes/);
  });

  test('Choral costume API mutation rejected', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.CHORAL, DIRECTOR_A.email, DIRECTOR_A.password);
    const resp = await fetch(`http://localhost:3501/portal/groups/${groupId}/costume-context`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBe(403);
  });
});

test.describe('Semi-Final Men\'s costume', () => {
  test('Save via API and verify in UI after reload', async ({ page }) => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.A2);
    const perfId = await getSemiFinalPerformanceId(groupId, token);
    const borrowedId = await resourceTypeIdByCode(groupId, 'BORROWED', token);

    const existing = await getCostumes(groupId, perfId, token);
    const men = existing.find((c) => c.gender === 'MEN');
    const url = men
      ? `${PORTAL_API_URL}/groups/${groupId}/performances/${perfId}/costumes/${men.id}`
      : `${PORTAL_API_URL}/groups/${groupId}/performances/${perfId}/costumes`;
    const method = men ? 'PUT' : 'POST';
    const payload = men
      ? { region: 'Epirus', village: 'Zagori', resource_type_id: borrowedId, has_won_award: true, purchased_most_or_all: false, purchased_any_parts: true }
      : { gender: 'MEN', region: 'Epirus', village: 'Zagori', resource_type_id: borrowedId, has_won_award: true, purchased_most_or_all: false, purchased_any_parts: true };

    const resp = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect([200, 201]).toContain(resp.status);

    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await page.goto(`/groups/${groupId}/costumes`);
    const mensSection = page.locator('.costume-section').filter({
      has: page.getByRole('heading', { name: "Men's Costume", exact: true }),
    });
    await expect(mensSection.getByText('Epirus')).toBeVisible();
    await expect(mensSection.getByText('Zagori')).toBeVisible();
    await expect(mensSection.getByText('Borrowed')).toBeVisible();

    await page.reload();
    await expect(mensSection.getByText('Epirus')).toBeVisible();
    await expect(mensSection.getByText('Borrowed')).toBeVisible();
  });
});

test.describe('Costume round and gender isolation', () => {
  test('Four costume records remain independent', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.A2);
    const semiId = await getSemiFinalPerformanceId(groupId, token);
    const finalId = await getFinalPerformanceId(groupId, token);
    const borrowedId = await resourceTypeIdByCode(groupId, 'BORROWED', token);
    const rentedId = await resourceTypeIdByCode(groupId, 'RENTED', token);
    const madeId = await resourceTypeIdByCode(groupId, 'MADE', token);
    const purchasedId = await resourceTypeIdByCode(groupId, 'PURCHASED', token);

    async function upsert(perfId: number, gender: 'MEN' | 'WOMEN', region: string, resourceId: number) {
      const existing = (await getCostumes(groupId, perfId, token)).find((c) => c.gender === gender);
      const url = existing
        ? `${PORTAL_API_URL}/groups/${groupId}/performances/${perfId}/costumes/${existing.id}`
        : `${PORTAL_API_URL}/groups/${groupId}/performances/${perfId}/costumes`;
      const resp = await fetch(url, {
        method: existing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(existing
          ? { region, resource_type_id: resourceId, has_won_award: false, purchased_most_or_all: false, purchased_any_parts: false }
          : { gender, region, resource_type_id: resourceId, has_won_award: false, purchased_most_or_all: false, purchased_any_parts: false }),
      });
      expect([200, 201]).toContain(resp.status);
    }

    await upsert(semiId, 'MEN', 'SF Men', borrowedId);
    await upsert(semiId, 'WOMEN', 'SF Women', rentedId);
    await upsert(finalId, 'MEN', 'Final Men', madeId);
    await upsert(finalId, 'WOMEN', 'Final Women', purchasedId);

    const semiCostumes = await getCostumes(groupId, semiId, token);
    const finalCostumes = await getCostumes(groupId, finalId, token);
    expect(semiCostumes.find((c) => c.gender === 'MEN')?.region).toBe('SF Men');
    expect(semiCostumes.find((c) => c.gender === 'WOMEN')?.region).toBe('SF Women');
    expect(finalCostumes.find((c) => c.gender === 'MEN')?.region).toBe('Final Men');
    expect(finalCostumes.find((c) => c.gender === 'WOMEN')?.region).toBe('Final Women');
  });
});

test.describe('Costume conflicts', () => {
  test('Create and delete costume conflict via API with UI verification', async ({ page }) => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.ALPHA);
    const relatedId = await findGroupId(E2E_COSTUME_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);

    const created = await createCostumeConflict(groupId, {
      round: 'Semi-Final',
      related_group_id: relatedId,
      costume_count: 7,
    }, token);
    expect(created.status).toBe(201);

    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await page.goto(`/groups/${groupId}/costumes`);
    await expect(page.getByText('7 costumes shared')).toBeVisible();

    const conflicts = await getCostumeConflicts(groupId, token);
    const conflict = conflicts.find((c) => c.costume_count === 7)!;
    await deleteCostumeConflict(groupId, conflict.id, token);

    await page.reload();
    await expect(page.getByText('7 costumes shared')).not.toBeVisible();
  });
});

test.describe('Costume submission', () => {
  test('Submit records submitted_at and allows pre-deadline editing', async ({ page }) => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.A2);
    expect(await submitCostumeRegistration(groupId, token)).toBe(201);

    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await page.goto(`/groups/${groupId}/costumes`);
    await expect(page.getByText(/Submitted:/)).toBeVisible({ timeout: 10_000 });

    const mensSection = page.locator('.costume-section').filter({
      has: page.getByRole('heading', { name: "Men's Costume", exact: true }),
    });
    await mensSection.getByRole('button', { name: 'Edit' }).click();
    await mensSection.getByLabel('Region').fill('Post Submit Edit');
    await mensSection.getByRole('button', { name: 'Save' }).click();
    await page.reload();
    await expect(page.getByText('Post Submit Edit')).toBeVisible();
    await expect(page.getByText(/Submitted:/)).toBeVisible();
  });
});

test.describe('Costume deadline', () => {
  test('Closed deadline shows read-only state', async ({ page }) => {
    await setCostumeDeadline(COSTUME_DEADLINE_PAST);
    try {
      await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
      await openCostumesForGroup(page, E2E_COSTUME_GROUPS.DEADLINE_CLOSED);

      await expect(page.getByText('Costume editing is closed')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Costume Information' })).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Submit Costume Information' })).not.toBeVisible();

      const groupId = await findGroupId(E2E_COSTUME_GROUPS.DEADLINE_CLOSED);
      const perfId = await getSemiFinalPerformanceId(groupId);
      const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
      const borrowedId = await resourceTypeIdByCode(groupId, 'BORROWED', token);
      const result = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performances/${perfId}/costumes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ gender: 'MEN', region: 'X', resource_type_id: borrowedId }),
      });
      expect(result.status).toBe(403);
    } finally {
      await clearCostumeDeadline();
    }
  });
});

test.describe('Historical costume read-only', () => {
  test('Historical dance group shows read-only costumes', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const histEventId = await getDirectorHistoricalEventId();
    const groupId = await findDirectorGroupIdForEvent(E2E_COSTUME_GROUPS.A_HISTORICAL, histEventId);
    await page.goto(`/groups/${groupId}/costumes`);
    await expect(page.getByText('Past Event — Read Only')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Costume Information' })).not.toBeVisible();

    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const perfId = await getSemiFinalPerformanceId(groupId, token);
    const borrowedId = await resourceTypeIdByCode(groupId, 'BORROWED', token);
    const resp = await fetch(`http://localhost:3501/groups/${groupId}/performances/${perfId}/costumes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ gender: 'MEN', region: 'Hack', resource_type_id: borrowedId }),
    });
    expect(resp.status).toBe(403);
  });
});
