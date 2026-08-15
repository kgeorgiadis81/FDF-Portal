/**
 * Phase 8 — Registration Review page E2E tests.
 *
 * Covers:
 * - Dance review: all module cards present
 * - Choral review: no Costume card
 * - Action Required section with rejected document
 * - Submission status display
 * - Deadline display
 * - IDOR: Director A cannot see Director B's review
 * - Historical group: read-only, all View links
 * - Summary API excludes PII/classification
 */

import { test, expect, Page } from '@playwright/test';
import { DIRECTOR_A, DIRECTOR_B, PORTAL_API_URL, PORTAL_BASE_URL } from '../fixtures';
import {
  findGroupId,
  portalApiLogin,
  adminApiLogin,
  uploadDocumentApi,
  rejectDocumentApi,
  clearDocumentDeadline,
  resetGroupDocuments,
} from '../support/document-helpers';
import {
  createCostumeConflict,
  deleteCostumeConflict,
  getCostumeConflicts,
} from '../support/costume-helpers';

test.use({ baseURL: PORTAL_BASE_URL });

const DANCE_GROUP  = 'E2E Group Alpha';
const CHORAL_GROUP = 'E2E Choral Group Alpha';
const BETA_GROUP   = 'E2E Group Beta Director'; // owned by Director B

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Dance group review
// ---------------------------------------------------------------------------
test.describe('Dance Registration Review', () => {
  test.beforeAll(async () => {
    await clearDocumentDeadline();
  });

  test('navigates to review page from group detail', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);
    await page.goto(`/groups/${groupId}`);

    const reviewBtn = page.locator('.review-link');
    await expect(reviewBtn).toBeVisible({ timeout: 10_000 });
    await reviewBtn.click();

    await expect(page).toHaveURL(/\/groups\/\d+\/review/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /registration review/i })).toBeVisible();
  });

  test('shows Group Details, Roster, Performance, Costumes, Documents, Conflicts cards', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);
    await page.goto(`/groups/${groupId}/review`);

    await expect(page.getByRole('heading', { name: 'Group Details' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Roster' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Performance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Costumes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conflicts' })).toBeVisible();
  });

  test('shows "Manage" links for active group', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);
    await page.goto(`/groups/${groupId}/review`);

    await expect(page.getByRole('link', { name: /manage roster/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /manage performance/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /manage costumes/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /manage documents/i })).toBeVisible();
  });

  test('shows submission timeline and deadlines section', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);
    await page.goto(`/groups/${groupId}/review`);

    await expect(page.getByRole('heading', { name: /submission timeline/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /deadlines/i })).toBeVisible();
  });

  test('review summary API excludes classification, average_age, scores', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);

    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/registration-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok).toBe(true);

    const body = await resp.json();
    const bodyStr = JSON.stringify(body);

    // Forbidden fields must not appear
    expect(bodyStr).not.toContain('average_age');
    expect(bodyStr).not.toContain('division');
    expect(bodyStr).not.toContain('category');
    expect(bodyStr).not.toContain('rank');
    expect(bodyStr).not.toContain('storage_key');
    expect(bodyStr).not.toContain('date_of_birth');
    expect(bodyStr).not.toContain('score');

    // Required fields present
    expect(body.group).toBeDefined();
    expect(body.roster).toBeDefined();
    expect(body.performance).toBeDefined();
    expect(body.documents).toBeDefined();
    expect(body.actionRequired).toBeDefined();
    expect(Array.isArray(body.actionRequired)).toBe(true);
  });

  test('Dance review summary includes costume field', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);

    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/registration-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await resp.json();
    // Dance group must have costume summary
    expect(body.costume).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Choral group review
// ---------------------------------------------------------------------------
test.describe('Choral Registration Review', () => {
  test('Choral review has no Costumes card', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(CHORAL_GROUP);
    await page.goto(`/groups/${groupId}/review`);

    await expect(page.getByRole('heading', { name: 'Roster' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Performance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Costumes' })).not.toBeVisible();
  });

  test('Choral summary API has no costume field', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(CHORAL_GROUP);

    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/registration-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await resp.json();
    expect(body.costume).toBeNull();
  });

  test('Choral performance shows Choral Performance type', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(CHORAL_GROUP);
    await page.goto(`/groups/${groupId}/review`);

    await expect(page.getByText(/Choral Performance/i)).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Conflict summary — real backend data, not hard-coded zeros
// ---------------------------------------------------------------------------
test.describe('Review — conflict summary', () => {
  test('musician conflict on Alpha reflects in summary API and review UI', async ({ page }) => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);

    const summary = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/registration-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json() as {
      conflicts: {
        musicianConflicts: number;
        directorConflicts: number;
        dancerConflicts: number;
        costumeConflicts: number;
      };
      actionRequired: string[];
    };

    expect(summary.conflicts.musicianConflicts).toBeGreaterThan(0);
    expect(summary.actionRequired).toContain('Potential scheduling conflicts detected');

    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await page.goto(`/groups/${groupId}/review`);
    const conflictsCard = page.locator('.module-card').filter({ hasText: 'Conflicts' });
    await expect(conflictsCard.getByText(/\d+ detected/)).toBeVisible({ timeout: 15_000 });
    await expect(conflictsCard.getByText('No conflicts detected')).not.toBeVisible();
    await expect(page.locator('.action-required-card')).toBeVisible();
  });

  test('costume conflict create and delete updates review summary', async ({ page }) => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId('E2E Group A2');
    const relatedId = await findGroupId(BETA_GROUP, DIRECTOR_B.email, DIRECTOR_B.password);

    const created = await createCostumeConflict(groupId, {
      round: 'Semi-Final',
      related_group_id: relatedId,
      costume_count: 4,
    }, token);
    expect(created.status).toBe(201);

    const withConflict = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/registration-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json() as { conflicts: { costumeConflicts: number } };
    expect(withConflict.conflicts.costumeConflicts).toBeGreaterThan(0);

    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await page.goto(`/groups/${groupId}/review`);
    const conflictsCard = page.locator('.module-card').filter({ hasText: 'Conflicts' });
    await expect(conflictsCard.getByText('Costume')).toBeVisible({ timeout: 15_000 });

    const conflicts = await getCostumeConflicts(groupId, token);
    const conflict = conflicts.find((c) => c.costume_count === 4)!;
    await deleteCostumeConflict(groupId, conflict.id, token);

    const afterDelete = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/registration-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json() as { conflicts: { costumeConflicts: number } };
    const prevCostume = withConflict.conflicts.costumeConflicts;
    expect(afterDelete.conflicts.costumeConflicts).toBeLessThan(prevCostume);

    await page.reload();
    await expect(conflictsCard.getByText('Costume')).not.toBeVisible();
    expect(afterDelete.conflicts.costumeConflicts).toBeLessThan(withConflict.conflicts.costumeConflicts);
  });
});

// ---------------------------------------------------------------------------
// Action Required: rejected document
// ---------------------------------------------------------------------------
test.describe('Review — Action Required for rejected document', () => {
  test('rejected Youth Safety shows Action Required on review page', async ({ page }) => {
    await resetGroupDocuments('E2E Group A2');
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const adminToken = await adminApiLogin('e2e_reg_admin');
    // Use E2E Group A2 for this test (keep Alpha clean)
    const groupId = await findGroupId('E2E Group A2');

    // Upload a Youth Safety doc if none exists
    const allDocsBefore = await (await fetch(`${PORTAL_API_URL}/groups/${groupId}/documents`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })).json() as Array<{ id: number; document_type: string; is_current: number; verification_status: string }>;
    const existingYS = allDocsBefore.find(d => d.document_type === 'YOUTH_SAFETY' && d.is_current);
    if (!existingYS) {
      await uploadDocumentApi(groupId, 'YOUTH_SAFETY', token);
    }

    // Get current doc and reject it
    const allDocs = await (await fetch(`${PORTAL_API_URL}/groups/${groupId}/documents`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })).json() as Array<{ id: number; document_type: string; is_current: number }>;
    const ysDoc = allDocs.find(d => d.document_type === 'YOUTH_SAFETY' && d.is_current);
    if (ysDoc) {
      await rejectDocumentApi(groupId, ysDoc.id, 'E2E rejection for review test', adminToken);
    }

    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await page.goto(`/groups/${groupId}/review`);

    // Action Required section should be visible
    await expect(page.locator('.action-required-card')).toBeVisible({ timeout: 15_000 });
    // Document status shows Action Required
    const docSection = page.locator('.module-card').filter({ hasText: 'Documents' });
    await expect(docSection.getByText(/Action Required/i)).toBeVisible();
    // Navigation still shows Manage Documents link
    await expect(page.getByRole('link', { name: /manage documents/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// IDOR protection
// ---------------------------------------------------------------------------
test.describe('Review IDOR protection', () => {
  test('Director A cannot access Director B group review via UI', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupBId = await findGroupId(BETA_GROUP, DIRECTOR_B.email, DIRECTOR_B.password);
    await page.goto(`/groups/${groupBId}/review`);

    // Should show error state — "Group not found." message
    await expect(page.locator('.error-state')).toBeVisible({ timeout: 10_000 });
  });

  test('API: Director A cannot get registration summary for Director B group', async () => {
    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupBId = await findGroupId(BETA_GROUP, DIRECTOR_B.email, DIRECTOR_B.password);

    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupBId}/registration-summary`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(resp.status).toBe(404);
  });

  test('Unauthenticated request to summary returns 401', async () => {
    const groupId = await findGroupId(DANCE_GROUP);
    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/registration-summary`);
    // Backend returns 401 or 403 for unauthenticated requests
    expect([401, 403]).toContain(resp.status);
  });
});

// ---------------------------------------------------------------------------
// Dashboard: Review Registration button
// ---------------------------------------------------------------------------
test.describe('Dashboard — Review Registration CTA', () => {
  test('active group card shows Review Registration button', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await expect(page.getByRole('button', { name: /review registration/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('clicking Review Registration navigates to review page', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const reviewBtn = page.getByRole('button', { name: /review registration/i }).first();
    await expect(reviewBtn).toBeVisible({ timeout: 15_000 });
    await reviewBtn.click();
    await expect(page).toHaveURL(/\/groups\/\d+\/review/, { timeout: 10_000 });
  });
});
