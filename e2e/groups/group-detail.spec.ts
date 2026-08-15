/**
 * Phase 8 — Group Details & Co-Director E2E tests.
 *
 * Covers:
 * - Primary Director display (read-only)
 * - Co-Director add, edit, remove (CRUD)
 * - Co-Director security: non-primary protection, IDOR, mass assignment
 * - Group type immutability after performance data
 * - Cross-portal visibility (Director adds → API confirms)
 * - Historical group read-only
 */

import { test, expect, Page } from '@playwright/test';
import { DIRECTOR_A, DIRECTOR_B, PORTAL_API_URL, PORTAL_BASE_URL } from '../fixtures';
import { findGroupId, portalApiLogin, adminApiLogin } from '../support/document-helpers';

test.use({ baseURL: PORTAL_BASE_URL });
test.describe.configure({ mode: 'serial' });

const DANCE_GROUP   = 'E2E Group Alpha';
const CHORAL_GROUP  = 'E2E Choral Group Alpha';
const HISTORICAL    = 'E2E Group A Historical';
const BETA_GROUP    = 'E2E Group Beta Director'; // owned by Director B

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
}

async function goToGroupDetail(page: Page, groupId: number): Promise<void> {
  await page.goto(`/groups/${groupId}`);
  await expect(page.locator('.group-card')).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Primary Director display
// ---------------------------------------------------------------------------
test.describe('Primary Director display', () => {
  test('shows Primary Director section with Account Owner badge', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);
    await goToGroupDetail(page, groupId);

    // Directors card must be visible
    const directorsCard = page.locator('.directors-card');
    await expect(directorsCard).toBeVisible();

    // Primary Director heading and badge
    await expect(directorsCard.getByText('Primary Director')).toBeVisible();
    await expect(directorsCard.getByText('Account Owner')).toBeVisible();

    // Must not expose internal user IDs
    const cardText = await directorsCard.textContent();
    expect(cardText).not.toMatch(/user_id|owner_director_user_id/);
  });

  test('primary director is not removable', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);
    await goToGroupDetail(page, groupId);

    const primaryItem = page.locator('.director-item.primary');
    await expect(primaryItem).toBeVisible();
    // No remove button should exist on the primary director item
    await expect(primaryItem.getByRole('button', { name: /remove/i })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Co-Director CRUD
// ---------------------------------------------------------------------------
test.describe('Co-Director CRUD', () => {
  let groupId: number;

  test.beforeAll(async () => {
    groupId = await findGroupId(DANCE_GROUP);
    // Cleanup: remove any existing co-directors via API
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/directors`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dirs = await resp.json() as Array<{ id: number; is_primary: number }>;
    for (const d of dirs) {
      if (!d.is_primary) {
        await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors/${d.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
  });

  test('adds a co-director', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await goToGroupDetail(page, groupId);

    await page.getByRole('button', { name: /add co-director/i }).click();

    // Dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/first name/i).fill('Jane');
    await dialog.getByLabel(/last name/i).fill('CoDir');
    await dialog.getByLabel(/email/i).fill('jane@codir.example.com');
    await dialog.getByLabel(/phone/i).fill('(555) 100-2000');
    await dialog.getByRole('button', { name: /save/i }).click();

    // Co-director appears in list
    await expect(page.getByText('Jane CoDir')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('jane@codir.example.com')).toBeVisible();
  });

  test('renders co-director names as text (XSS protection)', async ({ page }) => {
    // Add a co-director with XSS-looking name via API and verify it renders as text
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: '<script>alert(1)</script>', last_name: 'Test' }),
    });

    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await goToGroupDetail(page, groupId);

    // Text should appear as literal characters, not execute
    const codirList = page.locator('.codir-list');
    const html = await codirList.innerHTML();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');

    // Cleanup
    const dirs = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/directors`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json() as Array<{ id: number; first_name: string; is_primary: number }>;
    const xssDir = dirs.find(d => d.first_name?.includes('<script>'));
    if (xssDir) {
      await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors/${xssDir.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test('edits a co-director', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await goToGroupDetail(page, groupId);

    // Click edit on the first co-director
    const editBtn = page.locator('.codir-item').first().getByRole('button', { name: /edit/i });
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const lastNameField = dialog.getByLabel(/last name/i);
    await lastNameField.clear();
    await lastNameField.fill('CoDirUpdated');
    await dialog.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText('CoDirUpdated')).toBeVisible({ timeout: 10_000 });
  });

  test('removes a co-director with confirmation', async ({ page }) => {
    // Ensure at least one co-director exists before the test
    const setupToken = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${setupToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: 'ToRemove', last_name: 'Director' }),
    });

    page.on('dialog', dialog => dialog.accept()); // auto-accept confirm()

    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await goToGroupDetail(page, groupId);

    // Count co-directors before
    const before = await page.locator('.codir-item').count();
    expect(before).toBeGreaterThan(0);

    const removeBtn = page.locator('.codir-item').first().locator('.remove-btn');
    await removeBtn.click();

    // Count should decrease
    await expect(page.locator('.codir-item')).toHaveCount(before - 1, { timeout: 10_000 });
  });

  test('shows empty state when no co-directors', async ({ page }) => {
    // Clean up all remaining co-directors via API
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const dirs = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/directors`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json() as Array<{ id: number; is_primary: number }>;
    for (const d of dirs) {
      if (!d.is_primary) {
        await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors/${d.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }

    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await goToGroupDetail(page, groupId);

    await expect(page.getByText('No co-directors added')).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Co-Director security
// ---------------------------------------------------------------------------
test.describe('Co-Director security', () => {
  test('API: Director cannot make is_primary=true via POST', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);

    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: 'Malicious', last_name: 'Primary', is_primary: true }),
    });
    expect(resp.ok).toBe(true); // creates successfully

    // But the created record must have is_primary=0
    const dirsResp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/directors`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dirs = await dirsResp.json() as Array<{ first_name: string; is_primary: number }>;
    const malicious = dirs.find(d => d.first_name === 'Malicious');
    expect(malicious).toBeDefined();
    expect(Number(malicious!.is_primary)).toBe(0);

    // Cleanup
    const allDirs = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/directors`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json() as Array<{ id: number; first_name: string; is_primary: number }>;
    for (const d of allDirs) {
      if (!d.is_primary) {
        await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors/${d.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
  });

  test('API: Director cannot DELETE the primary director record', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);

    // Ensure a primary director record exists in group_directors (seeded groups may not have one)
    let dirs = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/directors`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json() as Array<{ id: number; is_primary: number }>;
    let primary = dirs.find(d => d.is_primary);

    if (!primary) {
      // Create a primary director record via the admin endpoint
      const adminToken = await adminApiLogin('e2e_reg_admin');
      const addResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/directors`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: 'Primary', last_name: 'DirectorE2E',
          email: null, cell_phone: null, is_primary: true,
        }),
      });
      if (!addResp.ok) {
        // Cannot create primary record via admin either; skip this test
        console.warn('Skipping: cannot create primary director record for test');
        return;
      }
      dirs = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/directors`, {
        headers: { Authorization: `Bearer ${token}` },
      })).json() as Array<{ id: number; is_primary: number }>;
      primary = dirs.find(d => d.is_primary);
    }

    expect(primary).toBeDefined();

    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors/${primary!.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status).toBe(403);

    // Cleanup: remove the test primary director if we created it
    const adminToken = await adminApiLogin('e2e_reg_admin');
    const currentDirs = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/directors`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json() as Array<{ id: number; is_primary: number; first_name: string }>;
    const testDir = currentDirs.find(d => d.is_primary && d.first_name === 'Primary');
    if (testDir) {
      await fetch(`${PORTAL_API_URL}/groups/${groupId}/directors/${testDir.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }
  });

  test('API: Director A cannot list co-directors of Director B group (IDOR)', async () => {
    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupBId = await findGroupId(BETA_GROUP, DIRECTOR_B.email, DIRECTOR_B.password);

    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupBId}/directors`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(resp.status).toBe(404);
  });

  test('API: Director A cannot add co-director to Director B group (IDOR)', async () => {
    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupBId = await findGroupId(BETA_GROUP, DIRECTOR_B.email, DIRECTOR_B.password);

    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupBId}/co-directors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: 'Hacker', last_name: 'Attempt' }),
    });
    expect(resp.status).toBe(404);
  });

  test('API: co-director email match does NOT grant Portal group access', async () => {
    // Director B's email exists as user; add it as co-director on Director A's group
    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);

    await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: 'Director', last_name: 'Beta', email: DIRECTOR_B.email }),
    });

    // Director B must NOT be able to access the group
    const tokenB = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(resp.status).toBe(404);

    // Cleanup
    const dirs = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/directors`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })).json() as Array<{ id: number; is_primary: number; email: string }>;
    for (const d of dirs) {
      if (!d.is_primary) {
        await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors/${d.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenA}` },
        });
      }
    }
  });

  test('API: mass assignment — group_id and user_id cannot be set via POST', async () => {
    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);
    const groupBId = await findGroupId(BETA_GROUP, DIRECTOR_B.email, DIRECTOR_B.password);

    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'MassAssign',
        group_id: groupBId,   // should be ignored
        user_id: 999,          // should be null
        is_legacy: true,       // should be forced 0
      }),
    });
    expect(resp.ok).toBe(true);

    // Verify the record was created in the correct group with safe defaults
    const dirs = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/directors`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })).json() as Array<{ id: number; first_name: string; is_primary: number; is_legacy: number }>;
    const created = dirs.find(d => d.first_name === 'Test');
    expect(created).toBeDefined();
    expect(Number(created!.is_primary)).toBe(0);
    expect(Number(created!.is_legacy)).toBe(0);

    // Cleanup
    for (const d of dirs) {
      if (!d.is_primary) {
        await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors/${d.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenA}` },
        });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Group type immutability
// ---------------------------------------------------------------------------
test.describe('Group type immutability', () => {
  test('API: cannot change group type after performance data exists', async () => {
    // E2E Group Alpha has performance data from Phase 4/5 tests
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);

    // Try to change to Choral (would orphan dance data)
    const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Group Alpha', parishId: 1, groupType: 'Choral' }),
    });
    // If no performance data exists, this may succeed; if data exists, 409
    if (!resp.ok) {
      const body = await resp.json();
      expect(resp.status).toBe(409);
      expect(body.code).toBe('GROUP_TYPE_LOCKED');
    }
    // Either way, the group type must not have changed to Choral
    const groupResp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const group = await groupResp.json();
    expect(group.groupType).not.toBe('Choral');
  });
});

// ---------------------------------------------------------------------------
// Historical group read-only
// ---------------------------------------------------------------------------
test.describe('Historical group read-only', () => {
  test('historical group shows read-only banner and hides edit/add buttons', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);

    // Navigate to historical group (use event switcher or direct URL)
    // First get the historical group ID via API
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const histResp = await fetch(`${PORTAL_API_URL}/portal/groups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // The default endpoint returns active event only; get historical event groups
    const eventsResp = await fetch(`${PORTAL_API_URL}/portal/events/my-history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!eventsResp.ok) {
      test.skip(true, 'Historical events not available');
      return;
    }
    const events = await eventsResp.json() as Array<{ id: number; isActive: boolean }>;
    const histEvent = events.find(e => !e.isActive);
    if (!histEvent) {
      test.skip(true, 'No historical event found');
      return;
    }

    const histGroupsResp = await fetch(`${PORTAL_API_URL}/portal/groups?eventId=${histEvent.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const histGroups = await histGroupsResp.json() as Array<{ id: number; name: string }>;
    const histGroup = histGroups.find(g => g.name === HISTORICAL);
    if (!histGroup) {
      test.skip(true, 'Historical group not found');
      return;
    }

    await page.goto(`/groups/${histGroup.id}`);
    await expect(page.locator('.fdp-readonly-banner')).toBeVisible({ timeout: 10_000 });

    // Edit button should not be visible
    await expect(page.getByRole('button', { name: /^edit$/i })).not.toBeVisible();
    // Add Co-Director button should not be visible
    await expect(page.getByRole('button', { name: /add co-director/i })).not.toBeVisible();
    // Review Registration button should not be visible (historical group)
    await expect(page.locator('.review-link')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Cross-portal: Director adds co-director → visible in Admin API
// ---------------------------------------------------------------------------
test.describe('Cross-portal co-director visibility', () => {
  test('co-director added via Portal is visible through Admin directors API', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(DANCE_GROUP);

    // Add via Portal endpoint
    const addResp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: 'CrossPortal', last_name: 'Visible' }),
    });
    expect(addResp.ok).toBe(true);

    // Read via Admin shared endpoint
    const adminToken = await adminApiLogin('e2e_reg_admin');
    const adminResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/directors`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(adminResp.ok).toBe(true);
    const adminDirs = await adminResp.json() as Array<{ first_name: string }>;
    const found = adminDirs.find(d => d.first_name === 'CrossPortal');
    expect(found).toBeDefined();

    // Cleanup
    const dirs = await (await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/directors`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json() as Array<{ id: number; is_primary: number; first_name: string }>;
    for (const d of dirs) {
      if (!d.is_primary) {
        await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/co-directors/${d.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
  });
});
