/**
 * D-1 — Director registration completeness signal (hub + My Groups).
 */
import { test, expect, Page } from '@playwright/test';
import { DIRECTOR_A, PORTAL_API_URL, PORTAL_BASE_URL } from '../fixtures';
import {
  findGroupId,
  portalApiLogin,
  adminApiLogin,
  uploadDocumentApi,
  rejectDocumentApi,
  resetGroupDocuments,
  createTestPdfBuffer,
  clearDocumentDeadline,
} from '../support/document-helpers';
import {
  getSemiFinalPerformanceId,
  getFinalPerformanceId,
  createPerformanceEntry,
  submitPerformanceRegistration,
} from '../support/performance-helpers';
import {
  getCostumes,
  createCostume,
  submitCostumeRegistration,
  resourceTypeIdByCode,
} from '../support/costume-helpers';

test.use({ baseURL: PORTAL_BASE_URL });

const JOURNEY_DANCE = 'E2E Registration Journey Dance';
const JOURNEY_CHORAL = 'E2E Registration Journey Choral';
const DANCE_GROUP = 'E2E Group Alpha';

async function loginAs(page: Page): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(DIRECTOR_A.email);
  await page.locator('input[autocomplete="current-password"]').fill(DIRECTOR_A.password);
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

async function prepareDanceReadyState(): Promise<number> {
  await clearDocumentDeadline();
  await resetGroupDocuments(JOURNEY_DANCE);
  const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const groupId = await findGroupId(JOURNEY_DANCE);

  await submitRosterApi(groupId, token);

  const semiId = await getSemiFinalPerformanceId(groupId, token);
  const finalId = await getFinalPerformanceId(groupId, token);
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
  test('group hub shows overall Ready and primary review CTA', async ({ page }) => {
    const groupId = await prepareDanceReadyState();
    await loginAs(page);
    await page.goto(`/groups/${groupId}`);

    const hub = page.getByTestId('registration-completeness');
    await expect(hub).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('overall-registration-status')).toHaveText('Ready');
    await expect(hub.getByText('Costumes')).toBeVisible();
    await expect(page.getByTestId('primary-registration-cta')).toHaveText(/Review Registration/i);
  });

  test('My Groups card shows Ready chip for dance journey group', async ({ page }) => {
    await prepareDanceReadyState();
    await loginAs(page);
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="group-card-overall-status"]', { timeout: 20_000 });
    const journeyCard = page.locator('.group-card').filter({ hasText: JOURNEY_DANCE });
    await expect(journeyCard.getByTestId('group-card-overall-status')).toHaveText('Ready', { timeout: 15_000 });
    await expect(journeyCard.getByText(/Costumes · Submitted/)).toBeVisible();
  });
});

test.describe('Registration completeness — Choral without costumes', () => {
  test('choral hub Ready without costumes in checklist', async ({ page }) => {
    await resetGroupDocuments(JOURNEY_CHORAL);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(JOURNEY_CHORAL);

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
