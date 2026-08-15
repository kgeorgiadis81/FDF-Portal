import { test, expect, Page } from '@playwright/test';
import {
  DIRECTOR_A,
  DIRECTOR_B,
  portalApiLogin,
  PORTAL_API_URL,
  PORTAL_BASE_URL,
} from '../fixtures';
import {
  E2E_PERFORMANCE_GROUPS,
  findGroupId,
  setPerformanceDeadline,
  clearPerformanceDeadline,
  PERFORMANCE_DEADLINE_PAST,
  getPerformanceData,
  getSemiFinalPerformanceId,
  getFinalPerformanceId,
  createPerformanceEntry,
  reorderPerformanceEntries,
  assignMusician,
  searchMusicianIds,
  deletePerformanceEntry,
  clearPerformanceMusicians,
} from '../support/performance-helpers';
import { getDirectorHistoricalEventId, findDirectorGroupIdForEvent } from '../support/roster-helpers';

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

test.describe('Performance navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
  });

  test('Dance group shows Semi-Final and Final rounds', async ({ page }) => {
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.A2);
    await expect(page.getByRole('tab', { name: 'Semi-Final' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Final', exact: true })).toBeVisible();
  });
});

test.describe('Dance entry CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.A2);
  });

  test('Add, edit, and delete a dance', async ({ page }) => {
    const danceName = `E2E Dance ${Date.now()}`;
    await page.getByRole('button', { name: 'Add Dance' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Dance Name').fill(danceName);
    await page.getByLabel('Region').fill('Macedonia');
    await page.getByLabel('Village').fill('Test Village');
    await page.getByRole('checkbox', { name: 'Live Music' }).check();
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(danceName).first()).toBeVisible();

    const entryCard = page.locator('.entry-card').filter({ hasText: danceName });
    await entryCard.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const updated = `${danceName} Updated`;
    await page.getByLabel('Dance Name').fill(updated);
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(updated).first()).toBeVisible();

    await entryCard.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(updated).first()).not.toBeVisible();
  });
});

test.describe('Choral performance', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.CHORAL);
  });

  test('Shows songs UI without dance-only fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Songs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Song' })).toBeVisible();
    await expect(page.getByText('Musicians')).not.toBeVisible();
    await expect(page.getByText('Region')).not.toBeVisible();
  });

  test('Add song with liturgical classification', async ({ page }) => {
    const songName = `E2E Song ${Date.now()}`;
    await page.getByRole('button', { name: 'Add Song' }).click();
    await page.getByLabel('Song Name').fill(songName);
    await page.getByLabel('Secular / Liturgical').locator('..').click();
    await page.getByRole('option', { name: 'Liturgical' }).click();
    await page.getByRole('checkbox', { name: 'Recorded Music' }).check();
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(songName).first()).toBeVisible();
    await expect(page.getByText('Recorded Music · Liturgical').first()).toBeVisible();
  });
});

test.describe('Performance submission', () => {
  test('Submit records submitted_at and allows editing before deadline', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.A2);

    const danceName = `Submit Dance ${Date.now()}`;
    await page.getByRole('button', { name: 'Add Dance' }).click();
    await page.getByLabel('Dance Name').fill(danceName);
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.getByRole('button', { name: 'Submit Performance Information' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Submit Performance Information' }).click();
    await expect(page.getByText(/Submitted:/)).toBeVisible();

    const entryCard = page.locator('.entry-card').filter({ hasText: danceName });
    await entryCard.getByRole('button', { name: 'Edit' }).click();
    const edited = `${danceName} Edited`;
    await page.getByLabel('Dance Name').fill(edited);
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(edited).first()).toBeVisible();
  });
});

test.describe('Historical performance — read-only', () => {
  test('Historical performance is read-only in UI', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await page.goto('/dashboard');

    await expect(page.locator('mat-select')).toBeVisible({ timeout: 10_000 });
    await page.locator('mat-select').click();
    await page.locator('mat-option').filter({ hasText: /Historical Event 2025/i }).click();

    const historicalCard = page.locator('.group-card').filter({ hasText: E2E_PERFORMANCE_GROUPS.A_HISTORICAL });
    await expect(historicalCard).toBeVisible({ timeout: 8_000 });
    await historicalCard.click();
    await page.locator('.performance-link').click();

    await expect(page.getByText(/past event.*read only/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: 'Add Dance' })).not.toBeVisible();
  });

  test('Historical performance API mutation rejected', async () => {
    const historicalEventId = await getDirectorHistoricalEventId();
    const groupId = await findDirectorGroupIdForEvent(E2E_PERFORMANCE_GROUPS.A_HISTORICAL, historicalEventId);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const data = await getPerformanceData(groupId, token) as { performances: Array<{ id: number }> };
    const perfId = data.performances[0]?.id;
    expect(perfId).toBeTruthy();

    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${perfId}/entries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Blocked Dance' }),
    });
    expect(resp.status).toBe(403);
  });
});

test.describe('IDOR security', () => {
  test('Director A cannot access Director B performance via API', async () => {
    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const betaGroupId = await findGroupId(E2E_PERFORMANCE_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);

    const resp = await fetch(`${PORTAL_API_URL}/groups/${betaGroupId}/performance`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(resp.status).toBe(403);
  });
});

test.describe('Deadline enforcement', () => {
  test('Closed deadline rejects API mutation', async () => {
    await setPerformanceDeadline('DANCE_PERFORMANCE', PERFORMANCE_DEADLINE_PAST);
    try {
      const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
      const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.DEADLINE_CLOSED);
      const data = await getPerformanceData(groupId, token) as { performances: Array<{ id: number }> };
      const perfId = data.performances[0].id;

      const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${perfId}/entries`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Late Dance' }),
      });
      expect(resp.status).toBe(403);
    } finally {
      await clearPerformanceDeadline('DANCE_PERFORMANCE');
    }
  });
});

test.describe('Musician selection', () => {
  test('Can search and select E2E musician', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.A2);

    await page.getByLabel('Search musicians').fill('E2E Musician Alpha');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByText('1 of 8 musicians selected')).toBeVisible();
    await expect(page.getByLabel('Selected musicians').getByText('E2E Musician Alpha')).toBeVisible();
  });
});

test.describe('Dance entry reorder', () => {
  test('Reorder preserves entry IDs and order via API', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const perfId = await getFinalPerformanceId(groupId, token);
    const before = await getPerformanceData(groupId, token) as PerformanceApiResponse;
    const existingIds = before.performances.find((p) => p.id === perfId)?.entries.map((e) => e.id) ?? [];

    const ts = Date.now();
    const e1 = await createPerformanceEntry(groupId, perfId, { name: `Reorder A ${ts}` }, token);
    const e2 = await createPerformanceEntry(groupId, perfId, { name: `Reorder B ${ts}` }, token);
    const e3 = await createPerformanceEntry(groupId, perfId, { name: `Reorder C ${ts}` }, token);

    const newOrder = [...existingIds, e3.id, e1.id, e2.id];
    const reordered = await reorderPerformanceEntries(groupId, perfId, newOrder, token);
    const ours = reordered.filter((e) => [e1.id, e2.id, e3.id].includes(e.id));
    expect(ours.map((e) => e.id)).toEqual([e3.id, e1.id, e2.id]);
    expect(ours.map((e) => e.entry_order)).toEqual([
      existingIds.length + 1,
      existingIds.length + 2,
      existingIds.length + 3,
    ]);
  });

  test('Move down updates order in UI', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.A2);
    await page.getByRole('tab', { name: 'Final', exact: true }).click();

    const ts = Date.now();
    for (const label of ['First', 'Second', 'Third']) {
      await page.getByRole('button', { name: 'Add Dance' }).click();
      await page.getByLabel('Dance Name').fill(`${label} ${ts}`);
      await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }

    const thirdCard = page.locator('.entry-card').filter({ hasText: `Third ${ts}` });
    await thirdCard.getByRole('button', { name: 'Move up' }).click();
    await thirdCard.getByRole('button', { name: 'Move up' }).click();

    const cards = page.locator('.entry-card').filter({ hasText: ts.toString() });
    await expect(cards.nth(0)).toContainText(`Third ${ts}`);
    await expect(cards.nth(1)).toContainText(`First ${ts}`);
  });
});

test.describe('Musician limit', () => {
  test('9th musician rejected by API', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const perfId = await getFinalPerformanceId(groupId, token);
    await clearPerformanceMusicians(groupId, perfId, token);
    const musicianIds = await searchMusicianIds('E2E Musician', token);
    expect(musicianIds.length).toBeGreaterThanOrEqual(9);

    for (let i = 0; i < 8; i++) {
      const resp = await assignMusician(groupId, perfId, musicianIds[i], token);
      expect(resp.status).toBe(201);
    }
    const ninth = await assignMusician(groupId, perfId, musicianIds[8], token);
    expect(ninth.status).toBe(400);
    const body = await ninth.json();
    expect(body.error).toMatch(/maximum of 8/i);
  });
});

test.describe('Scored entry protection', () => {
  test('Cannot delete entry with judging scores', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.ALPHA);
    const perfId = await getSemiFinalPerformanceId(groupId, token);
    const data = await getPerformanceData(groupId, token) as {
      performances: Array<{ id: number; entries: Array<{ id: number }> }>;
    };
    const perf = data.performances.find((p) => p.id === perfId)!;
    const scoredEntryId = perf.entries[0]?.id;
    expect(scoredEntryId).toBeTruthy();

    const resp = await deletePerformanceEntry(groupId, perfId, scoredEntryId, token);
    expect(resp.status).toBe(409);
    const body = await resp.json();
    expect(body.error).toMatch(/judging data/i);
  });
});

test.describe('AV logistics', () => {
  test('Saves and reloads dance AV fields', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.A2);

    const props = `E2E Props ${Date.now()}`;
    await page.getByLabel('Additional Props').fill(props);
    await page.getByLabel('Music / Audio Needs').fill('Wireless mics');
    await page.getByRole('button', { name: 'Save AV Information' }).click();
    await expect(page.getByText('AV information saved')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Additional Props')).toHaveValue(props);
    await expect(page.getByLabel('Music / Audio Needs')).toHaveValue('Wireless mics');
  });
});

test.describe('Dashboard performance status', () => {
  test('Group card shows performance status', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await page.goto('/dashboard');
    const card = page.locator('.group-card').filter({ hasText: /E2E Group Alpha/i });
    await expect(card.locator('.performance-status')).toBeVisible();
    await expect(card.getByText(/Performance not submitted|Performance submitted/)).toBeVisible();
  });
});
