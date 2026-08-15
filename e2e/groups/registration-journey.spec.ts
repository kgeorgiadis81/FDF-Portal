/**
 * Phase 8.1 — Full registration journey E2E tests (Dance + Choral).
 */
import { test, expect, Page } from '@playwright/test';
import { DIRECTOR_A, PORTAL_API_URL, PORTAL_BASE_URL } from '../fixtures';
import {
  findGroupId,
  portalApiLogin,
  adminApiLogin,
  uploadDocumentApi,
  verifyDocumentApi,
  createTestPdfBuffer,
  clearDocumentDeadline,
  resetGroupDocuments,
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

test.describe('Dance full registration journey', () => {
  test.beforeAll(async () => {
    await clearDocumentDeadline();
    await resetGroupDocuments(JOURNEY_DANCE);
  });

  test('complete Dance flow through Registration Review with admin document verification', async ({ page }) => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const adminToken = await adminApiLogin('e2e_reg_admin');
    const groupId = await findGroupId(JOURNEY_DANCE);

    // Co-Director
    const coResp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Journey',
        last_name: 'CoDirector',
        email: 'journey.co@e2e.test',
        cell_phone: '555-0707',
      }),
    });
    expect(coResp.status).toBe(201);

    // Roster submit (seeded members + chaperone)
    await submitRosterApi(groupId, token);

    // Performance entries + submit
    const semiId = await getSemiFinalPerformanceId(groupId, token);
    const finalId = await getFinalPerformanceId(groupId, token);
    await createPerformanceEntry(groupId, semiId, {
      name: 'Journey Semi Dance',
      region: 'Epirus',
      village: 'Journey Village',
      uses_live_music: true,
    }, token);
    await createPerformanceEntry(groupId, finalId, {
      name: 'Journey Final Dance',
      region: 'Epirus',
      village: 'Journey Village',
      uses_recorded_music: true,
    }, token);
    expect((await submitPerformanceRegistration(groupId, 'DANCE_PERFORMANCE', token)).status).toBe(201);

    // Costumes + submit
    const borrowedId = await resourceTypeIdByCode(groupId, 'BORROWED', token);
    const rentedId = await resourceTypeIdByCode(groupId, 'RENTED', token);
    for (const [perfId, gender, region, resId] of [
      [semiId, 'MEN', 'Journey SF Men', borrowedId],
      [semiId, 'WOMEN', 'Journey SF Women', rentedId],
      [finalId, 'MEN', 'Journey Final Men', borrowedId],
      [finalId, 'WOMEN', 'Journey Final Women', rentedId],
    ] as const) {
      const existing = (await getCostumes(groupId, perfId, token)).find((c) => c.gender === gender);
      if (!existing) {
        await createCostume(groupId, perfId, {
          gender,
          region,
          resource_type_id: resId,
          has_won_award: false,
          purchased_most_or_all: false,
          purchased_any_parts: false,
        }, token);
      }
    }
    expect(await submitCostumeRegistration(groupId, token)).toBe(201);

    // Documents
    const rosterUpload = await uploadDocumentApi(
      groupId, 'SIGNED_ROSTER', token,
      createTestPdfBuffer('JOURNEY ROSTER'), 'journey-roster.pdf',
    );
    const youthUpload = await uploadDocumentApi(
      groupId, 'YOUTH_SAFETY', token,
      createTestPdfBuffer('JOURNEY YOUTH'), 'journey-youth.pdf',
    );

    // Review before admin verification
    const summaryBefore = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/registration-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json() as {
      roster: { submittedAt: string | null };
      performance: { submittedAt: string | null };
      costume: { submittedAt: string | null } | null;
      documents: { signedRoster: { status: string }; youthSafety: { status: string } };
      conflicts: Record<string, number>;
      actionRequired: string[];
    };
    expect(summaryBefore.roster.submittedAt).toBeTruthy();
    expect(summaryBefore.performance.submittedAt).toBeTruthy();
    expect(summaryBefore.costume?.submittedAt).toBeTruthy();
    expect(summaryBefore.documents.signedRoster.status).toBe('PENDING');
    expect(summaryBefore.documents.youthSafety.status).toBe('PENDING');
    const bodyStr = JSON.stringify(summaryBefore);
    expect(bodyStr).not.toContain('average_age');
    expect(bodyStr).not.toContain('storage_key');
    expect(bodyStr).not.toContain('date_of_birth');

    await loginAs(page);
    await page.goto(`/groups/${groupId}/review`);
    await expect(page.getByRole('heading', { name: 'Roster' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Costumes' })).toBeVisible();
    await expect(page.getByText('Submitted').first()).toBeVisible();

    // Admin verifies documents
    await verifyDocumentApi(groupId, rosterUpload.id, adminToken);
    await verifyDocumentApi(groupId, youthUpload.id, adminToken);

    const summaryAfter = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/registration-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json() as {
      documents: { signedRoster: { status: string }; youthSafety: { status: string } };
    };
    expect(summaryAfter.documents.signedRoster.status).toBe('VERIFIED');
    expect(summaryAfter.documents.youthSafety.status).toBe('VERIFIED');

    await page.reload();
    await expect(page.getByText('Verified').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Choral full registration journey', () => {
  test.beforeAll(async () => {
    await resetGroupDocuments(JOURNEY_CHORAL);
  });

  test('complete Choral flow — no Costumes module on Review', async ({ page }) => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(JOURNEY_CHORAL);

    await submitRosterApi(groupId, token);

    const semiId = await getSemiFinalPerformanceId(groupId, token);
    const finalId = await getFinalPerformanceId(groupId, token);
    await createPerformanceEntry(groupId, semiId, {
      name: 'Journey Choral Semi',
      choral_classification: 'LITURGICAL',
    }, token);
    await createPerformanceEntry(groupId, finalId, {
      name: 'Journey Choral Final',
      choral_classification: 'SECULAR',
    }, token);
    expect((await submitPerformanceRegistration(groupId, 'CHORAL_PERFORMANCE', token)).status).toBe(201);

    await uploadDocumentApi(groupId, 'SIGNED_ROSTER', token, createTestPdfBuffer('CHORAL ROSTER'));
    await uploadDocumentApi(groupId, 'YOUTH_SAFETY', token, createTestPdfBuffer('CHORAL YOUTH'));

    const summary = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/registration-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json() as {
      costume: null;
      performance: { submissionType: string; submittedAt: string | null };
      roster: { submittedAt: string | null };
      documents: unknown;
      conflicts: unknown;
    };
    expect(summary.costume).toBeNull();
    expect(summary.roster.submittedAt).toBeTruthy();
    expect(summary.performance.submittedAt).toBeTruthy();
    expect(summary.performance.submissionType).toBe('CHORAL_PERFORMANCE');
    expect(summary.documents).toBeDefined();
    expect(summary.conflicts).toBeDefined();

    await loginAs(page);
    await page.goto(`/groups/${groupId}/review`);
    await expect(page.getByRole('heading', { name: 'Group Details' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Roster' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Performance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conflicts' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Costumes' })).not.toBeVisible();
    await expect(page.getByText(/Choral Performance/i)).toBeVisible();
  });
});
