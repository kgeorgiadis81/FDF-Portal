import { test, expect, Page } from '@playwright/test';
import { DIRECTOR_A, PORTAL_API_URL, PORTAL_BASE_URL, portalApiLogin } from '../fixtures';
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
  updatePerformanceEntry,
  deletePerformanceEntry,
  reorderPerformanceEntries,
  submitPerformanceRegistration,
  getPerformanceContext,
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

test.describe('Choral rounds', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.CHORAL);
  });

  test('Shows Semi-Final and Final rounds', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Semi-Final' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Final', exact: true })).toBeVisible();
  });

  test('Does not show dance-only fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Songs' })).toBeVisible();
    await expect(page.getByText('Musicians & Instruments')).not.toBeVisible();
    await expect(page.getByText('Region', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Village', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Acapella')).not.toBeVisible();
    await expect(page.getByText('Dancer(s) Singing')).not.toBeVisible();
    await expect(page.getByText('Musician(s) Singing')).not.toBeVisible();
    await expect(page.getByText('Individual Singing')).not.toBeVisible();
  });
});

test.describe('Choral song CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.CHORAL);
  });

  test('Create song with SECULAR classification persists after reload', async ({ page }) => {
    const songName = `E2E Choral Create ${Date.now()}`;
    await page.getByRole('button', { name: 'Add Song' }).click();
    await page.getByLabel('Song Name').fill(songName);
    await page.getByLabel('Secular / Liturgical').locator('..').click();
    await page.getByRole('option', { name: 'Secular' }).click();
    await page.getByRole('checkbox', { name: 'Live Music' }).check();
    await page.getByRole('checkbox', { name: 'Recorded Music' }).check();
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(songName).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(songName).first()).toBeVisible();
    await expect(page.getByText(/Live Music.*Recorded Music.*Secular/i).first()).toBeVisible();

    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.CHORAL);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const perfId = await getSemiFinalPerformanceId(groupId, token);
    const data = await getPerformanceData(groupId, token);
    const entry = data.performances.find((p) => p.id === perfId)?.entries.find((e) => e.name === songName);
    expect(entry).toBeTruthy();
    expect(entry!.choral_classification).toBe('SECULAR');
    expect(entry!.uses_live_music).toBe(true);
    expect(entry!.uses_recorded_music).toBe(true);
  });

  test('Edit song SECULAR to LITURGICAL persists after reload', async ({ page }) => {
    const songName = `E2E Choral Edit ${Date.now()}`;
    await page.getByRole('button', { name: 'Add Song' }).click();
    await page.getByLabel('Song Name').fill(songName);
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(songName).first()).toBeVisible();

    const entryCard = page.locator('.entry-card').filter({ hasText: songName }).first();
    await entryCard.locator('.entry-actions').getByRole('button', { name: 'Edit' }).click();
    const updated = `${songName} Updated`;
    await page.getByLabel('Song Name').fill(updated);
    await page.getByLabel('Secular / Liturgical').locator('..').click();
    await page.getByRole('option', { name: 'Liturgical' }).click();
    await page.getByRole('checkbox', { name: 'Live Music' }).uncheck();
    await page.getByRole('checkbox', { name: 'Recorded Music' }).check();
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(updated).first()).toBeVisible();
    await expect(page.getByText('Recorded Music · Liturgical').first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(updated).first()).toBeVisible();

    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.CHORAL);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const perfId = await getSemiFinalPerformanceId(groupId, token);
    const data = await getPerformanceData(groupId, token);
    const entry = data.performances.find((p) => p.id === perfId)?.entries.find((e) => e.name === updated);
    expect(entry?.choral_classification).toBe('LITURGICAL');
    expect(entry?.uses_live_music).toBe(false);
    expect(entry?.uses_recorded_music).toBe(true);
  });

  test('Delete song removes entry without affecting other rounds', async ({ page }) => {
    const ts = Date.now();
    const semiName = `E2E Choral Delete Semi ${ts}`;
    const finalName = `E2E Choral Delete Final ${ts}`;

    await page.getByRole('button', { name: 'Add Song' }).click();
    await page.getByLabel('Song Name').fill(semiName);
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(semiName).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Final', exact: true }).click();
    await page.getByRole('button', { name: 'Add Song' }).click();
    await page.getByLabel('Song Name').fill(finalName);
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(finalName).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Semi-Final' }).click();
    const semiCard = page.locator('.entry-card').filter({ hasText: semiName }).first();
    await semiCard.locator('.entry-actions').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('.entry-card').filter({ hasText: semiName })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Final', exact: true }).click();
    await expect(page.getByText(finalName).first()).toBeVisible();
  });
});

test.describe('Choral song reorder', () => {
  test('Reorder via Move up persists after reload', async ({ page }) => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.CHORAL);
    const perfId = await getFinalPerformanceId(groupId, token);
    const data = await getPerformanceData(groupId, token);
    const perf = data.performances.find((p) => p.id === perfId);
    for (const entry of perf?.entries ?? []) {
      await deletePerformanceEntry(groupId, perfId, entry.id, token);
    }

    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.CHORAL);
    await page.getByRole('tab', { name: 'Final', exact: true }).click();

    const ts = Date.now();
    for (const label of ['Song Alpha', 'Song Beta', 'Song Gamma']) {
      await page.getByRole('button', { name: 'Add Song' }).click();
      await page.getByLabel('Song Name').fill(`${label} ${ts}`);
      await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }

    const alphaLabel = `Song Alpha ${ts}`;
    const alphaCard = page.locator('.entry-card').filter({ hasText: alphaLabel }).first();
    await alphaCard.locator('.entry-actions').getByRole('button', { name: 'Move down' }).click();
    await expect(page.locator('.entry-card').filter({ hasText: alphaLabel }).first()).toContainText(alphaLabel);
    await page.locator('.entry-card').filter({ hasText: alphaLabel }).first()
      .locator('.entry-actions').getByRole('button', { name: 'Move down' }).click();

    const cards = page.locator('.entry-card').filter({ hasText: ts.toString() });
    await expect(cards.nth(0)).toContainText(`Song Beta ${ts}`, { timeout: 10000 });
    await expect(cards.nth(1)).toContainText(`Song Gamma ${ts}`);
    await expect(cards.nth(2)).toContainText(`Song Alpha ${ts}`);

    await page.reload();
    await page.getByRole('tab', { name: 'Final', exact: true }).click();
    const reloaded = page.locator('.entry-card').filter({ hasText: ts.toString() });
    await expect(reloaded.nth(0)).toContainText(`Song Beta ${ts}`);
    await expect(reloaded.nth(2)).toContainText(`Song Alpha ${ts}`);
  });

  test('API reorder preserves entry IDs and changes only entry_order', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.CHORAL);
    const perfId = await getFinalPerformanceId(groupId, token);
    const before = await getPerformanceData(groupId, token);
    const existingIds = before.performances.find((p) => p.id === perfId)?.entries.map((e) => e.id) ?? [];

    const ts = Date.now();
    const e1 = await createPerformanceEntry(groupId, perfId, { name: `Choral A ${ts}`, choral_classification: 'SECULAR' }, token);
    const e2 = await createPerformanceEntry(groupId, perfId, { name: `Choral B ${ts}`, choral_classification: 'LITURGICAL' }, token);
    const e3 = await createPerformanceEntry(groupId, perfId, { name: `Choral C ${ts}`, choral_classification: 'SECULAR' }, token);

    const newOrder = [...existingIds, e3.id, e1.id, e2.id];
    const reordered = await reorderPerformanceEntries(groupId, perfId, newOrder, token);
    const ours = reordered.filter((e) => [e1.id, e2.id, e3.id].includes(e.id));
    expect(ours.map((e) => e.id)).toEqual([e3.id, e1.id, e2.id]);
    expect(new Set(ours.map((e) => e.id)).size).toBe(3);
  });
});

test.describe('Choral mobile ordering', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Move down reorders songs on mobile', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.CHORAL);

    const ts = Date.now();
    for (const label of ['Mobile A', 'Mobile B']) {
      await page.getByRole('button', { name: 'Add Song' }).click();
      await page.getByLabel('Song Name').fill(`${label} ${ts}`);
      await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    }

    const firstCard = page.locator('.entry-card').filter({ hasText: `Mobile A ${ts}` });
    await firstCard.getByRole('button', { name: 'Move down' }).click();
    const cards = page.locator('.entry-card').filter({ hasText: ts.toString() });
    await expect(cards.nth(0)).toContainText(`Mobile B ${ts}`);
  });
});

test.describe('Choral submission', () => {
  test('Submit records CHORAL_PERFORMANCE and allows editing after submission', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.CHORAL);

    const semiName = `Choral Submit Semi ${Date.now()}`;
    await page.getByRole('button', { name: 'Add Song' }).click();
    await page.getByLabel('Song Name').fill(semiName);
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();

    await page.getByRole('tab', { name: 'Final', exact: true }).click();
    const finalName = `Choral Submit Final ${Date.now()}`;
    await page.getByRole('button', { name: 'Add Song' }).click();
    await page.getByLabel('Song Name').fill(finalName);
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();

    await page.getByLabel('Music / Audio Needs').fill('Choral wireless mics');
    await page.getByRole('button', { name: 'Save AV Information' }).click();
    await expect(page.getByText('AV information saved')).toBeVisible();

    await page.getByRole('button', { name: 'Submit Performance Information' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Submit Performance Information' }).click();
    await expect(page.getByText(/Submitted:/)).toBeVisible();

    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.CHORAL);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const ctx = await getPerformanceContext(groupId, token);
    expect(ctx.submissionType).toBe('CHORAL_PERFORMANCE');
    expect(ctx.submission?.submitted_at).toBeTruthy();

    const subsResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const subs = await subsResp.json() as Array<{ submission_type: string; submitted_at: string }>;
    const choralSub = subs.find((s) => s.submission_type === 'CHORAL_PERFORMANCE');
    expect(choralSub?.submitted_at).toBeTruthy();

    await page.getByRole('tab', { name: 'Semi-Final' }).click();
    const entryCard = page.locator('.entry-card').filter({ hasText: semiName });
    await entryCard.getByRole('button', { name: 'Edit' }).click();
    const edited = `${semiName} Edited`;
    await page.getByLabel('Song Name').fill(edited);
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(edited).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(/Submitted:/)).toBeVisible();
    await expect(page.getByText(edited).first()).toBeVisible();
  });
});

test.describe('Choral deadline enforcement', () => {
  test.afterAll(async () => {
    await clearPerformanceDeadline('CHORAL_PERFORMANCE');
  });

  test('Closed choral deadline rejects API mutation', async () => {
    await setPerformanceDeadline('CHORAL_PERFORMANCE', PERFORMANCE_DEADLINE_PAST);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.CHORAL);
    const perfId = await getSemiFinalPerformanceId(groupId, token);

    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${perfId}/entries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Late Song', choral_classification: 'SECULAR' }),
    });
    expect(resp.status).toBe(403);
  });
});
