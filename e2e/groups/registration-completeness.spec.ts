/**
 * D-1 — Director registration completeness signal (hub + My Groups).
 */
import { test, expect, Page } from '@playwright/test';
import { DIRECTOR_A, DIRECTOR_B, PORTAL_API_URL, PORTAL_BASE_URL } from '../fixtures';
import {
  findGroupId,
  portalApiLogin,
  adminApiLogin,
  uploadDocumentApi,
  rejectDocumentApi,
  resetGroupDocuments,
  createTestPdfBuffer,
  clearDocumentDeadline,
  isolateDirectorARegistrationGroup,
  restoreActiveEventGroups,
} from '../support/document-helpers';
import {
  getSemiFinalPerformanceId,
  getFinalPerformanceId,
  createPerformanceEntry,
  submitPerformanceRegistration,
  clearPerformanceMusicians,
} from '../support/performance-helpers';
import {
  getCostumes,
  createCostume,
  submitCostumeRegistration,
  resourceTypeIdByCode,
} from '../support/costume-helpers';

test.use({ baseURL: PORTAL_BASE_URL });

/** Director B owns a single dance group — avoids Director A multi-group conflicts. */
const DANCE_READY_GROUP = 'E2E Group Beta Director';
const CHORAL_READY_GROUP = 'E2E Registration Journey Choral';
const DANCE_GROUP = 'E2E Group Alpha';

async function loginAs(page: Page, director = DIRECTOR_A): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(director.email);
  await page.locator('input[autocomplete="current-password"]').fill(director.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
}

async function submitRosterApi(groupId: number, token: string): Promise<void> {
  const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/submissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ submission_type: 'ROSTER' }),
  });
  expect(resp.status).toBe(201);
}

type MinimalRosterMember = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
};

async function seedMinimalRoster(
  groupId: number,
  token: string,
  member: MinimalRosterMember = {
    first_name: 'DanceCompleteness',
    last_name: 'SoloDancer',
    date_of_birth: '2012-06-01',
  },
): Promise<void> {
  const auth = { Authorization: `Bearer ${token}` };
  const rosterResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/roster`, { headers: auth });
  const { members } = await rosterResp.json() as { members: Array<{ id: number }> };
  for (const m of members) {
    await fetch(`${PORTAL_API_URL}/groups/${groupId}/roster/${m.id}`, { method: 'DELETE', headers: auth });
  }
  await fetch(`${PORTAL_API_URL}/groups/${groupId}/roster`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(member),
  });
  const chaps = await (await fetch(`${PORTAL_API_URL}/groups/${groupId}/chaperones`, { headers: auth })).json() as Array<{ id: number }>;
  for (const c of chaps) {
    await fetch(`${PORTAL_API_URL}/groups/${groupId}/chaperones/${c.id}`, { method: 'DELETE', headers: auth });
  }
  await fetch(`${PORTAL_API_URL}/groups/${groupId}/chaperones`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Completeness',
      last_name: 'Chaperone',
      phone: '555-1212',
      is_21_or_older_confirmed: true,
    }),
  });
}

async function prepareDanceReadyState(): Promise<number> {
  await clearDocumentDeadline();
  await resetGroupDocuments(DANCE_READY_GROUP);
  const token = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
  const groupId = await findGroupId(DANCE_READY_GROUP, DIRECTOR_B.email, DIRECTOR_B.password);

  const semiId = await getSemiFinalPerformanceId(groupId, token);
  const finalId = await getFinalPerformanceId(groupId, token);
  await clearPerformanceMusicians(groupId, semiId, token);
  await clearPerformanceMusicians(groupId, finalId, token);

  await seedMinimalRoster(groupId, token);
  await submitRosterApi(groupId, token);

  await createPerformanceEntry(groupId, semiId, {
    name: 'Completeness Semi',
    region: 'Epirus',
    village: 'Village',
    uses_recorded_music: true,
  }, token);
  await createPerformanceEntry(groupId, finalId, {
    name: 'Completeness Final',
    region: 'Epirus',
    village: 'Village',
    uses_recorded_music: true,
  }, token);
  expect((await submitPerformanceRegistration(groupId, 'DANCE_PERFORMANCE', token)).status).toBe(201);

  const borrowedId = await resourceTypeIdByCode(groupId, 'BORROWED', token);
  for (const [perfId, gender] of [
    [semiId, 'MEN'],
    [semiId, 'WOMEN'],
    [finalId, 'MEN'],
    [finalId, 'WOMEN'],
  ] as const) {
    const existing = (await getCostumes(groupId, perfId, token)).find((c) => c.gender === gender);
    if (!existing) {
      await createCostume(groupId, perfId, {
        gender,
        region: 'Region',
        resource_type_id: borrowedId,
        has_won_award: false,
        purchased_most_or_all: false,
        purchased_any_parts: false,
      }, token);
    }
  }
  expect(await submitCostumeRegistration(groupId, token)).toBe(201);

  await uploadDocumentApi(groupId, 'SIGNED_ROSTER', token, createTestPdfBuffer('R'), 'r.pdf');
  await uploadDocumentApi(groupId, 'YOUTH_SAFETY', token, createTestPdfBuffer('Y'), 'y.pdf');

  return groupId;
}

test.describe('Registration completeness — Dance Ready', () => {
  let danceReadyGroupId: number;

  test.beforeAll(async () => {
    danceReadyGroupId = await prepareDanceReadyState();
  });

  test('group hub shows overall Ready and primary review CTA', async ({ page }) => {
    await loginAs(page, DIRECTOR_B);
    await page.goto(`/groups/${danceReadyGroupId}`);

    const hub = page.getByTestId('registration-completeness');
    await expect(hub).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('overall-registration-status')).toHaveText('Ready');
    await expect(hub.getByText('Costumes')).toBeVisible();
    await expect(page.getByTestId('primary-registration-cta')).toHaveText(/Review Registration/i);
  });

  test('My Groups card shows Ready chip for dance journey group', async ({ page }) => {
    await loginAs(page, DIRECTOR_B);
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="group-card-overall-status"]', { timeout: 20_000 });
    const journeyCard = page.locator('.group-card').filter({ hasText: DANCE_READY_GROUP });
    await expect(journeyCard.getByTestId('group-card-overall-status')).toHaveText('Ready', { timeout: 15_000 });
    await expect(journeyCard.getByText(/Costumes · Submitted/)).toBeVisible();
  });
});

test.describe('Registration completeness — rejected document', () => {
  test.beforeAll(async () => {
    await clearDocumentDeadline();
    await resetGroupDocuments(DANCE_GROUP);
  });

  test('hub shows Action required and CTA to Documents', async ({ page }) => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const adminToken = await adminApiLogin('e2e_reg_admin');
    const groupId = await findGroupId(DANCE_GROUP);

    const upload = await uploadDocumentApi(
      groupId,
      'YOUTH_SAFETY',
      token,
      createTestPdfBuffer('REJECT ME'),
      'youth.pdf',
    );
    await rejectDocumentApi(groupId, upload.id, 'E2E completeness rejection', adminToken);

    await loginAs(page);
    await page.goto(`/groups/${groupId}`);
    const hub = page.getByTestId('registration-completeness');
    await expect(hub).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('overall-registration-status')).toHaveText('Action required');
    await expect(page.getByTestId('primary-registration-cta')).toHaveText(/Documents/i);

    await page.getByTestId('primary-registration-cta').click();
    await expect(page).toHaveURL(/\/documents/, { timeout: 10_000 });
  });
});

test.describe('Registration completeness — Choral without costumes', () => {
  test.afterAll(() => {
    restoreActiveEventGroups();
  });

  test('choral hub Ready without costumes in checklist', async ({ page }) => {
    isolateDirectorARegistrationGroup(CHORAL_READY_GROUP);
    await resetGroupDocuments(CHORAL_READY_GROUP);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(CHORAL_READY_GROUP);

    await seedMinimalRoster(groupId, token, {
      first_name: 'ChoralCompleteness',
      last_name: 'SoloSinger',
      date_of_birth: '2013-08-08',
    });
    await submitRosterApi(groupId, token);
    const semiId = await getSemiFinalPerformanceId(groupId, token);
    const finalId = await getFinalPerformanceId(groupId, token);
    await createPerformanceEntry(groupId, semiId, { name: 'Choral Semi', choral_classification: 'LITURGICAL' }, token);
    await createPerformanceEntry(groupId, finalId, { name: 'Choral Final', choral_classification: 'SECULAR' }, token);
    expect((await submitPerformanceRegistration(groupId, 'CHORAL_PERFORMANCE', token)).status).toBe(201);
    await uploadDocumentApi(groupId, 'SIGNED_ROSTER', token, createTestPdfBuffer('CR'));
    await uploadDocumentApi(groupId, 'YOUTH_SAFETY', token, createTestPdfBuffer('CY'));

    await loginAs(page);
    await page.goto(`/groups/${groupId}`);
    const hub = page.getByTestId('registration-completeness');
    await expect(hub).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('overall-registration-status')).toHaveText('Ready');
    await expect(hub.getByText('Costumes')).not.toBeVisible();
    await expect(hub.getByText('Performance')).toBeVisible();
  });
});
