/**
 * Phase 4 — Director Roster & Chaperone E2E tests.
 *
 * E2E Seed data (FDF_DB_E2E):
 *   - Director A owns E2E Group Alpha, A2, historical group, chaperone validation, deadline groups
 *   - E2E Group Alpha: 3 minors + 1 chaperone (reset helper restores after mutations)
 *   - E2E Chaperone Validation Group: 8 minors + 1 chaperone
 *   - Director B owns E2E Group Beta Director (IDOR)
 *   - Age at FDF is calculated from the event start date (active: 2026-06-01)
 */

import { test, expect, Page } from '@playwright/test';
import {
  PORTAL_BASE_URL,
  PORTAL_API_URL,
  DIRECTOR_A,
  DIRECTOR_B,
  portalApiLogin,
} from '../fixtures';
import {
  E2E_GROUP_NAMES,
  ROSTER_DEADLINE_FUTURE,
  ROSTER_DEADLINE_PAST,
  adminApiLogin,
  clearRosterDeadline,
  findDirectorGroupId,
  findDirectorGroupIdForEvent,
  getDirectorHistoricalEventId,
  resetChaperoneValidationGroup,
  resetGroupAlphaRoster,
  setRosterDeadline,
} from '../support/roster-helpers';

test.use({ baseURL: PORTAL_BASE_URL });

test.beforeAll(async () => {
  await resetGroupAlphaRoster();
  await clearRosterDeadline();
});

// ─── Helper: log in via UI ─────────────────────────────────────────────────
async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
}

// ─── Helper: navigate to a group roster by name ───────────────────────────
async function openRosterForGroup(page: Page, groupName: string) {
  await page.goto('/dashboard');
  await expect(page.locator('.group-card').first()).toBeVisible({ timeout: 12_000 });
  await page.locator('.group-card').filter({ hasText: new RegExp(groupName, 'i') }).click();
  await expect(page).toHaveURL(/\/groups\/\d+/, { timeout: 10_000 });
  await page.locator('.roster-link').click();
  await expect(page).toHaveURL(/\/groups\/\d+\/roster/, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: /participants/i })).toBeVisible({ timeout: 10_000 });
}

// ─── Helper: navigate to Group Alpha roster ────────────────────────────────
async function openRoster(page: Page) {
  await openRosterForGroup(page, E2E_GROUP_NAMES.ALPHA);
}

// ─── Helper: add a participant via dialog ─────────────────────────────────
async function addParticipant(
  page: Page,
  first: string,
  last: string,
  dob: string,
) {
  await page.getByRole('button', { name: /add.*participant/i }).last().click();
  await page.getByLabel(/first name/i).fill(first);
  await page.getByLabel(/last name/i).fill(last);
  // DOB field — fill the date input directly
  await page.locator('input[formcontrolname="date_of_birth"]').fill(dob);
  await page.getByRole('dialog').getByRole('button', { name: /save changes|add participant/i }).click();
}

// ─── Helper: add a chaperone via dialog ───────────────────────────────────
async function addChaperone(
  page: Page,
  first: string,
  last: string,
  phone: string,
  confirm21 = true,
) {
  await page.getByRole('button', { name: /add.*chaperone/i }).last().click();
  await page.getByLabel(/first name/i).fill(first);
  await page.getByLabel(/last name/i).fill(last);
  await page.getByLabel(/phone/i).fill(phone);
  if (confirm21) {
    await page.getByRole('checkbox', { name: /at least 21/i }).check();
  }
  await page.getByRole('dialog').getByRole('button', { name: /save changes|add chaperone/i }).click();
}

// ===========================================================================
// ROSTER NAVIGATION
// ===========================================================================
test.describe('Roster navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
  });

  test('Director opens group and navigates to Roster', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('.group-card').first()).toBeVisible({ timeout: 12_000 });
    await page.locator('.group-card').filter({ hasText: /E2E Group Alpha/i }).click();
    await expect(page).toHaveURL(/\/groups\/\d+/);

    const manageRoster = page.locator('.roster-link');
    await expect(manageRoster).toBeVisible();
    await manageRoster.click();
    await expect(page).toHaveURL(/\/groups\/\d+\/roster/);
    await expect(page.getByRole('heading', { name: /participants/i })).toBeVisible();
  });

  test('Roster page shows seeded participants', async ({ page }) => {
    await openRoster(page);
    await expect(page.getByText(/Anna/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Nikos/)).toBeVisible();
    await expect(page.getByText(/Maria/)).toBeVisible();
  });

  test('Dashboard group card shows roster status', async ({ page }) => {
    await page.goto('/dashboard');
    // After adding members from seed the card should show member count
    const card = page.locator('.group-card').filter({ hasText: /E2E Group Alpha/i });
    await expect(card).toBeVisible();
    // Roster status area is present
    await expect(card.locator('.roster-status')).toBeVisible({ timeout: 8_000 });
  });

  test('Group detail shows roster summary above Manage Roster button', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('.group-card').filter({ hasText: /E2E Group Alpha/i }).click();
    await expect(page.locator('.roster-nav')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.roster-link')).toBeVisible();
  });
});

// ===========================================================================
// PARTICIPANT CRUD
// ===========================================================================
test.describe('Participant CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await resetGroupAlphaRoster();
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openRoster(page);
  });

  test('Add participant — happy path', async ({ page }) => {
    const uniqueFirst = `Eleni${Date.now()}`;
    const before = await page.locator('.participants-table .table-row[role="row"]').count();

    await addParticipant(page, uniqueFirst, 'Nikolaou', '2010-07-14');

    // Row or card for the new participant should appear
    await expect(page.getByText(new RegExp(uniqueFirst))).toBeVisible({ timeout: 10_000 });
    const after = await page.locator('.participants-table .table-row[role="row"]').count();
    expect(after).toBeGreaterThan(before);
  });

  test('Age at FDF is displayed and not editable', async ({ page }) => {
    // Anna DOB 2012-05-15 → age relative to event start 2026-06-01 ≈ 14.04
    await expect(page.locator('[role="row"]').filter({ hasText: /Anna/ })).toBeVisible({ timeout: 10_000 });
    const annaRow = page.locator('[role="row"]').filter({ hasText: /Anna/ });
    const ageCell = annaRow.locator('[data-label="Age at FDF"]');
    await expect(ageCell).toBeVisible();
    await expect(ageCell).toHaveText(/\d/);
    await expect(ageCell.locator('input')).toHaveCount(0);
  });

  test('Edit participant updates data and refreshes summary', async ({ page }) => {
    await page.getByRole('button', { name: /edit anna/i }).click();

    const lastNameField = page.getByLabel(/last name/i);
    await lastNameField.clear();
    await lastNameField.fill('Papadimitriou-Edited');
    await page.getByRole('dialog').getByRole('button', { name: /save changes|add participant/i }).click();

    await expect(page.getByText(/Papadimitriou-Edited/)).toBeVisible({ timeout: 8_000 });
  });

  test('Delete participant shows confirmation and removes row', async ({ page }) => {
    // Add a participant to delete (use a name without "delete"/"remove" to avoid aria-label clashes)
    await addParticipant(page, 'Cleanup', 'TestUser', '2009-11-03');
    await expect(page.getByText(/Cleanup/)).toBeVisible({ timeout: 8_000 });

    const row = page.locator('.participants-table .table-row[role="row"]').filter({ hasText: /Cleanup/ });
    await page.getByRole('button', { name: /remove cleanup/i }).click();

    // Confirmation dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Remove Cleanup TestUser/i)).toBeVisible();
    await page.getByRole('dialog').getByRole('button').last().click();

    await expect(page.locator('.participants-table .table-row[role="row"]').filter({ hasText: /Cleanup/ })).not.toBeVisible({ timeout: 8_000 });
  });
});

// ===========================================================================
// AGE VALIDATION
// ===========================================================================
test.describe('Age validation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openRoster(page);
  });

  test('Rejects participant younger than 4 at FDF (DOB too recent)', async ({ page }) => {
    // Event start 2026-06-01; DOB 2024-01-01 → age < 4 at FDF
    await page.getByRole('button', { name: /add.*participant/i }).last().click();
    await page.getByLabel(/first name/i).fill('TooYoung');
    await page.getByLabel(/last name/i).fill('Child');
    await page.locator('input[formcontrolname="date_of_birth"]').fill('2024-01-01');
    await page.getByRole('dialog').getByRole('button', { name: /save changes|add participant/i }).click();

    // Either inline validation or server error should mention minimum age
    await expect(
      page.getByText(/minimum age|younger than|must be at least 4/i),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('Rejects future date of birth', async ({ page }) => {
    await page.getByRole('button', { name: /add.*participant/i }).last().click();
    await page.getByLabel(/first name/i).fill('Future');
    await page.getByLabel(/last name/i).fill('Person');
    await page.locator('input[formcontrolname="date_of_birth"]').fill('2030-06-15');
    await page.getByRole('dialog').getByRole('button', { name: /save changes|add participant/i }).click();

    await expect(
      page.getByText(/future|cannot be in the future|invalid/i),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('Valid participant near minimum age boundary is accepted', async ({ page }) => {
    // Age 4 at FDF: DOB = event start 2026-06-01 minus 4 years
    await addParticipant(page, 'MinAge', 'Boundary', '2022-06-01');
    await expect(page.getByText(/MinAge/)).toBeVisible({ timeout: 10_000 });
  });
});

// ===========================================================================
// CHAPERONE CALCULATION
// ===========================================================================
test.describe('Chaperone requirement calculation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openRoster(page);
  });

  test('Shows required chaperones for existing minors (seeded: 3 minors → 1 required)', async ({
    page,
  }) => {
    // Group Alpha seed: 3 minor members → ceil(3/7) = 1 required
    await expect(page.getByText(/required chaperones/i).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/3/).first()).toBeVisible(); // 3 participants under 18
    await expect(page.locator('.chaperone-requirement').first()).toContainText('1');
  });

  test('Shows chaperone requirement satisfied when enough chaperones provided', async ({ page }) => {
    // Seed: 1 chaperone provided, 1 required
    await expect(
      page.getByText(/chaperone requirement satisfied/i),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('Shows chaperone shortage warning when more are needed', async ({ page }) => {
    // Delete the seeded chaperone and check the warning
    const chapCard = page.locator('.chaperone-card').filter({ hasText: /Stavros/ });
    await chapCard.getByRole('button', { name: /remove chaperone/i }).click();
    await page.getByRole('dialog').getByRole('button').last().click();

    await expect(
      page.getByText(/additional chaperone/i),
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ===========================================================================
// CHAPERONE CRUD
// ===========================================================================
test.describe('Chaperone CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openRoster(page);
  });

  test('Add chaperone — happy path with 21+ confirmation', async ({ page }) => {
    await addChaperone(page, 'Giorgos', 'Alexiou', '555-9876', true);
    await expect(page.getByText(/Giorgos/)).toBeVisible({ timeout: 8_000 });
  });

  test('Edit chaperone updates phone number', async ({ page }) => {
    // Edits Giorgos (added by the previous test in this block)
    const chapCard = page.locator('.chaperone-card').filter({ hasText: /Giorgos/ });
    await expect(chapCard).toBeVisible({ timeout: 8_000 });
    await chapCard.getByRole('button', { name: /edit chaperone/i }).click();

    const phoneField = page.getByLabel(/phone/i);
    await phoneField.clear();
    await phoneField.fill('555-0199');
    await page.getByRole('dialog').getByRole('button', { name: /save changes|add chaperone/i }).click();

    await expect(page.getByText(/555-0199/)).toBeVisible({ timeout: 8_000 });
  });

  test('Delete chaperone shows confirmation dialog', async ({ page }) => {
    await addChaperone(page, 'TempChap', 'TestChap', '555-1234', true);
    await expect(page.getByText(/TempChap/)).toBeVisible({ timeout: 8_000 });

    const chapCard = page.locator('.chaperone-card').filter({ hasText: /TempChap/ });
    await chapCard.getByRole('button', { name: /remove chaperone/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button').last().click();
    await expect(page.locator('.chaperone-card').filter({ hasText: /TempChap/ })).not.toBeVisible({ timeout: 8_000 });
  });

  test('21+ confirmation checkbox is not pre-checked when adding new chaperone', async ({ page }) => {
    await page.getByRole('button', { name: /add.*chaperone/i }).last().click();
    const checkbox = page.getByRole('checkbox', { name: /at least 21/i });
    await expect(checkbox).not.toBeChecked();
    // Close dialog
    await page.keyboard.press('Escape');
  });
});

// ===========================================================================
// ROSTER SUBMISSION
// ===========================================================================
test.describe('Roster submission', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openRoster(page);
  });

  test('Submit Roster button is visible for valid roster', async ({ page }) => {
    await expect(page.getByRole('button', { name: /submit roster/i })).toBeVisible({ timeout: 8_000 });
  });

  test('Roster summary shows correct counts before submission', async ({ page }) => {
    const summarySection = page.locator('.submit-section, [aria-labelledby="submit-heading"]');
    await expect(summarySection).toBeVisible({ timeout: 8_000 });
    await expect(summarySection.getByText(/participants/i)).toBeVisible();
    await expect(summarySection.getByText(/required chaperones/i)).toBeVisible();
  });

  test('Submit shows confirmation dialog then records submitted_at', async ({ page }) => {
    await page.getByRole('button', { name: /submit roster/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/submit roster\?/i)).toBeVisible();
    await page.getByRole('dialog').getByRole('button').last().click();

    // submitted_at display should appear after submission
    await expect(page.getByText(/submitted:/i)).toBeVisible({ timeout: 10_000 });
  });

  test('Editing remains allowed after submission (deadline not set)', async ({ page }) => {
    await clearRosterDeadline();
    // Ensure roster is submitted first
    const isSubmitted = await page.getByText(/submitted:/i).isVisible().catch(() => false);
    if (!isSubmitted) {
      await page.getByRole('button', { name: /submit roster/i }).click();
      await page.getByRole('dialog').getByRole('button').last().click();
      await expect(page.getByText(/submitted:/i)).toBeVisible({ timeout: 10_000 });
    }

    // Add Participant button should remain enabled (no deadline lock)
    await expect(page.getByRole('button', { name: /add.*participant/i }).last()).toBeEnabled();
  });

});

// ===========================================================================
// INSUFFICIENT CHAPERONE — DEDICATED FIXTURE
// ===========================================================================
test.describe('Insufficient chaperone validation', () => {
  test.beforeEach(async () => {
    await resetChaperoneValidationGroup();
  });

  test('Cannot submit with insufficient chaperones — dedicated fixture', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openRosterForGroup(page, E2E_GROUP_NAMES.CHAPERONE_VALIDATION);

    await expect(page.getByText(/8/).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.chaperone-requirement').first()).toContainText('2');
    await expect(page.getByText(/1 additional chaperone/i)).toBeVisible({ timeout: 8_000 });

    const submitBtn = page.getByRole('button', { name: /submit roster/i });
    await expect(submitBtn).toBeDisabled();

    const groupId = await findDirectorGroupId(E2E_GROUP_NAMES.CHAPERONE_VALIDATION);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const apiResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/submissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ submission_type: 'ROSTER' }),
    });
    expect(apiResp.status).toBe(400);
    const body = await apiResp.json() as { error?: string };
    expect(body.error).toMatch(/chaperone/i);
  });

  test('Add second chaperone then submit succeeds — dedicated fixture', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openRosterForGroup(page, E2E_GROUP_NAMES.CHAPERONE_VALIDATION);

    await addChaperone(page, 'SecondChap', 'ValidGuard', '555-9999', true);
    await expect(page.getByText(/chaperone requirement satisfied/i)).toBeVisible({ timeout: 8_000 });

    await page.getByRole('button', { name: /submit roster/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button').last().click();
    await expect(page.getByText(/submitted:/i)).toBeVisible({ timeout: 10_000 });
  });
});

// ===========================================================================
// HISTORICAL EVENT — READ-ONLY
// ===========================================================================
test.describe('Historical event — read-only', () => {
  test('Historical event roster is read-only in the UI', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await page.goto('/dashboard');

    await expect(page.locator('mat-select')).toBeVisible({ timeout: 10_000 });
    await page.locator('mat-select').click();
    await page.locator('mat-option').filter({ hasText: /Historical Event 2025/i }).click();

    await expect(page.getByRole('link', { name: /register a group/i })).not.toBeVisible();
    const historicalCard = page.locator('.group-card').filter({ hasText: /E2E Group A Historical/i });
    await expect(historicalCard).toBeVisible({ timeout: 8_000 });
    await historicalCard.click();
    await expect(page).toHaveURL(/\/groups\/\d+/);

    await page.locator('.roster-link').click();
    await expect(page).toHaveURL(/\/groups\/\d+\/roster/);

    await expect(page.getByText(/past event.*read only/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/HistAnna/)).toBeVisible();
    await expect(page.getByRole('button', { name: /add.*participant/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /add.*chaperone/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /submit roster/i })).not.toBeVisible();
  });

  test('Historical roster API mutations are rejected for owner Director', async () => {
    const historicalEventId = await getDirectorHistoricalEventId();
    const groupId = await findDirectorGroupIdForEvent(E2E_GROUP_NAMES.A_HISTORICAL, historicalEventId);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const rosterResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/roster`, { headers });
    expect(rosterResp.status).toBe(200);

    const postResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/roster`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ first_name: 'Hack', last_name: 'Hist', date_of_birth: '2010-01-01' }),
    });
    expect(postResp.status).toBe(403);

    const members = (await rosterResp.json() as { members: Array<{ id: number; date_of_birth: string }> }).members;
    if (members.length > 0) {
      const member = members[0];
      const patchResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/roster/${member.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          first_name: 'Hack',
          last_name: 'Hist',
          date_of_birth: member.date_of_birth,
        }),
      });
      expect(patchResp.status).toBe(403);

      const delResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/roster/${member.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(delResp.status).toBe(403);
    }

    const chapPost = await fetch(`${PORTAL_API_URL}/groups/${groupId}/chaperones`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ first_name: 'Bad', last_name: 'Chap', is_21_or_older_confirmed: true }),
    });
    expect(chapPost.status).toBe(403);

    const submitResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/submissions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ submission_type: 'ROSTER' }),
    });
    expect(submitResp.status).toBe(403);
  });

  test('Historical event blocks edit even when no roster deadline is configured', async () => {
    const historicalEventId = await getDirectorHistoricalEventId();
    const groupId = await findDirectorGroupIdForEvent(E2E_GROUP_NAMES.A_HISTORICAL, historicalEventId);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);

    const ctxResp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/roster-context`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ctxResp.status).toBe(200);
    const ctx = await ctxResp.json() as {
      deadline: { can_edit: boolean; deadline_date: string | null };
      group: { isActive: boolean };
    };
    expect(ctx.group.isActive).toBe(false);
    expect(ctx.deadline.deadline_date).toBeNull();
    expect(ctx.deadline.can_edit).toBe(false);
  });
});

// ===========================================================================
// IDOR — DIRECTOR A CANNOT ACCESS DIRECTOR B'S GROUP
// ===========================================================================
test.describe('IDOR security', () => {
  let dirBGroupId: number;

  test.beforeAll(async () => {
    // Resolve Director B's group ID via API
    const token = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
    const resp = await fetch(`${PORTAL_API_URL}/portal/groups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // /portal/groups returns a raw array
    const data = await resp.json() as Array<{ id: number; name: string }>;
    const betaGroup = data.find(g => g.name === E2E_GROUP_NAMES.BETA_DIRECTOR);
    if (!betaGroup) throw new Error('E2E Group Beta Director not found for Director B');
    dirBGroupId = betaGroup.id;
  });

  test('Director A cannot view Director B roster via UI URL', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await page.goto(`/groups/${dirBGroupId}/roster`);

    // Should be redirected away or show an error — not Director B's roster
    await expect(page.locator('.error-state')).toBeVisible({ timeout: 10_000 });
  });

  test('Director A cannot GET Director B roster via API', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const resp = await fetch(`${PORTAL_API_URL}/groups/${dirBGroupId}/roster`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([403, 404]).toContain(resp.status);
  });

  test('Director A cannot POST participant to Director B group via API', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const resp = await fetch(`${PORTAL_API_URL}/groups/${dirBGroupId}/roster`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ first_name: 'Hack', last_name: 'Attempt', date_of_birth: '2010-01-01' }),
    });
    expect([403, 404]).toContain(resp.status);
  });

  test('Director A cannot DELETE participant from Director B group via API', async () => {
    // Get Director B's members first (as Director B)
    const tokenB = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
    const membersResp = await fetch(`${PORTAL_API_URL}/groups/${dirBGroupId}/roster`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const membersData = await membersResp.json() as { members?: Array<{ id: number }> };
    const members = membersData.members ?? [];

    if (members.length === 0) {
      // Nothing to delete — just verify GET is denied
      const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
      const resp = await fetch(`${PORTAL_API_URL}/groups/${dirBGroupId}/roster`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      expect([403, 404]).toContain(resp.status);
      return;
    }

    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const resp = await fetch(`${PORTAL_API_URL}/groups/${dirBGroupId}/roster/${members[0].id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect([403, 404]).toContain(resp.status);
  });

  test('Director A cannot submit Director B roster via API', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const resp = await fetch(`${PORTAL_API_URL}/groups/${dirBGroupId}/submissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ submission_type: 'ROSTER' }),
    });
    expect([403, 404]).toContain(resp.status);
  });
});

// ===========================================================================
// MASS ASSIGNMENT PROTECTION
// ===========================================================================
test.describe('Mass assignment protection', () => {
  test('Cannot inject group_id via POST body', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    // Get Director A's group — /portal/groups returns a raw array
    const groupsResp = await fetch(`${PORTAL_API_URL}/portal/groups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const groupsData = await groupsResp.json() as Array<{ id: number }>;
    const groupId = groupsData[0].id;

    // Include malicious fields in payload
    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/roster`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        first_name: 'MassAssign',
        last_name: 'Test',
        date_of_birth: '2010-01-01',
        // Malicious overrides — must be ignored
        group_id: 9999,
        event_id: 9999,
        age_at_fdf: 99,
        classification: 'HACKED',
        owner_director_user_id: 9999,
      }),
    });

    // Request should succeed (ignoring extra fields) or be rejected
    // It must NOT fail with a database error referencing the injected group_id
    expect([200, 201, 400, 403, 422]).toContain(resp.status);
    if (resp.status === 201 || resp.status === 200) {
      const body = await resp.json() as Record<string, unknown>;
      // Verify the returned member is in the correct group, not 9999
      expect(body['group_id'] ?? groupId).toBe(groupId);
    }
  });
});

// ===========================================================================
// DEADLINE ENFORCEMENT
// ===========================================================================
test.describe('Deadline enforcement', () => {
  test.afterAll(async () => {
    await clearRosterDeadline();
  });

  test('Roster context reports can_edit when no deadline configured', async () => {
    await clearRosterDeadline();
    const groupId = await findDirectorGroupId(E2E_GROUP_NAMES.ALPHA);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const ctxResp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/roster-context`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ctxResp.status).toBe(200);
    const ctx = await ctxResp.json() as { deadline: { can_edit: boolean } };
    expect(ctx.deadline.can_edit).toBe(true);
  });

  test('Portal displays deadline date and effective cutoff', async ({ page }) => {
    await setRosterDeadline(ROSTER_DEADLINE_FUTURE);
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openRosterForGroup(page, E2E_GROUP_NAMES.DEADLINE_OPEN);

    await expect(page.getByText(/roster deadline/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/february 5, 2030/i)).toBeVisible();
    await expect(page.getByText(/you may make changes until/i)).toBeVisible();
    await expect(page.getByText(/february 6, 2030/i)).toBeVisible();
  });

  test('Closed deadline shows read-only UI and rejects API mutation', async ({ page }) => {
    await setRosterDeadline(ROSTER_DEADLINE_PAST);
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openRosterForGroup(page, E2E_GROUP_NAMES.DEADLINE_CLOSED);

    await expect(page.getByText(/roster editing is closed/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Roster Deadline', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /add.*participant/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /submit roster/i })).not.toBeVisible();

    const groupId = await findDirectorGroupId(E2E_GROUP_NAMES.DEADLINE_CLOSED);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const postResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/roster`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ first_name: 'Late', last_name: 'Entry', date_of_birth: '2010-01-01' }),
    });
    expect(postResp.status).toBe(403);
  });

  test('Registration Admin can mutate roster after Director deadline', async () => {
    await setRosterDeadline(ROSTER_DEADLINE_PAST);
    const groupId = await findDirectorGroupId(E2E_GROUP_NAMES.DEADLINE_CLOSED);
    const token = await adminApiLogin('e2e_reg_admin');
    const postResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/roster`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        first_name: 'AdminAdd',
        last_name: 'Override',
        date_of_birth: '2010-03-15',
      }),
    });
    expect(postResp.status).toBe(201);
  });
});

// ===========================================================================
// PII — RESPONSE DOES NOT LEAK FORBIDDEN FIELDS
// ===========================================================================
test.describe('PII / DTO filtering', () => {
  test('Roster response does not include classification, average_age, or ranking', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupsResp = await fetch(`${PORTAL_API_URL}/portal/groups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const groupsData = await groupsResp.json() as Array<{ id: number }>;
    const groupId = groupsData[0].id;

    const rosterResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/roster`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(rosterResp.status).toBe(200);
    const body = await rosterResp.json() as Record<string, unknown>;

    const forbidden = ['classification', 'average_age', 'group_avg_age', 'ranking', 'category_rank', 'division'];
    for (const key of forbidden) {
      expect(JSON.stringify(body)).not.toContain(`"${key}"`);
    }
  });

  test('Roster context does not expose other groups data', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupsResp = await fetch(`${PORTAL_API_URL}/portal/groups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const groupsData = await groupsResp.json() as Array<{ id: number }>;
    const groupId = groupsData[0].id;

    const ctxResp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/roster-context`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = JSON.stringify(await ctxResp.json());
    expect(body).not.toContain('E2E Group Beta Director');
  });
});
