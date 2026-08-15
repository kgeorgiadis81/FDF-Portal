import { test, expect } from '@playwright/test';
import { DIRECTOR_A, DIRECTOR_B, PORTAL_API_URL, portalApiLogin } from '../fixtures';
import {
  E2E_COSTUME_GROUPS,
  findGroupId,
  getSemiFinalPerformanceId,
  getFinalPerformanceId,
  getCostumes,
  createCostumeConflict,
  searchRelatedGroups,
  resourceTypeIdByCode,
  submitCostumeRegistration,
  getCostumeConflicts,
} from '../support/costume-helpers';
import { getDirectorHistoricalEventId, findDirectorGroupIdForEvent } from '../support/roster-helpers';

test.describe('Costume IDOR protection', () => {
  test('Director A cannot read or mutate Director B costumes', async () => {
    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const tokenB = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
    const groupB = await findGroupId(E2E_COSTUME_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);
    const perfId = await getSemiFinalPerformanceId(groupB, tokenB);
    const borrowedId = await resourceTypeIdByCode(groupB, 'BORROWED', tokenB);

    const createResp = await fetch(`${PORTAL_API_URL}/groups/${groupB}/performances/${perfId}/costumes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gender: 'MEN', region: 'B Region', village: 'B Village',
        resource_type_id: borrowedId, has_won_award: false,
        purchased_most_or_all: false, purchased_any_parts: false,
      }),
    });
    let costumeId: number;
    if (createResp.status === 201) {
      ({ id: costumeId } = await createResp.json());
    } else if (createResp.status === 409) {
      const listResp = await fetch(`${PORTAL_API_URL}/groups/${groupB}/performances/${perfId}/costumes`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const costumes = await listResp.json() as Array<{ id: number; gender: string }>;
      costumeId = costumes.find((c) => c.gender === 'MEN')!.id;
    } else {
      expect(createResp.status).toBe(201);
      return;
    }

    const readResp = await fetch(`${PORTAL_API_URL}/groups/${groupB}/performances/${perfId}/costumes`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(readResp.status).toBe(403);

    const updateResp = await fetch(
      `${PORTAL_API_URL}/groups/${groupB}/performances/${perfId}/costumes/${costumeId}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: 'Hacked' }),
      },
    );
    expect(updateResp.status).toBe(403);

    const submitResp = await fetch(`${PORTAL_API_URL}/groups/${groupB}/submissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission_type: 'COSTUME' }),
    });
    expect(submitResp.status).toBe(403);
  });
});

test.describe('Costume conflict security', () => {
  test('Self-conflict rejected', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.ALPHA);
    const result = await createCostumeConflict(groupId, {
      round: 'Semi-Final',
      related_group_id: groupId,
      costume_count: 2,
    }, token);
    expect(result.status).toBe(400);
  });

  test('Cross-event conflict rejected', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const activeGroupId = await findGroupId(E2E_COSTUME_GROUPS.ALPHA);
    const histEventId = await getDirectorHistoricalEventId();
    const histGroupId = await findDirectorGroupIdForEvent(E2E_COSTUME_GROUPS.A_HISTORICAL, histEventId);

    const result = await createCostumeConflict(activeGroupId, {
      round: 'Semi-Final',
      related_group_id: histGroupId,
      costume_count: 1,
    }, token);
    expect(result.status).toBe(400);
  });

  test('Invalid costume_count rejected', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.ALPHA);
    const relatedId = await findGroupId(E2E_COSTUME_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);

    for (const count of [0, -1, 1.5]) {
      const result = await createCostumeConflict(groupId, {
        round: 'Semi-Final',
        related_group_id: relatedId,
        costume_count: count,
      }, token);
      expect(result.status).toBe(400);
    }
  });

  test('Related group selector does not leak PII', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.ALPHA);
    const options = await searchRelatedGroups(groupId, 'Beta', token);
    expect(options.length).toBeGreaterThan(0);
    const json = JSON.stringify(options);
    expect(json).not.toMatch(/date_of_birth|email|phone|roster|password/i);
    for (const opt of options) {
      expect(opt).toHaveProperty('id');
      expect(opt).toHaveProperty('name');
      expect(opt).toHaveProperty('display_label');
      expect(opt).not.toHaveProperty('owner_director_user_id');
      expect(opt).not.toHaveProperty('director_email');
    }
  });
});

test.describe('Choral costume API rejection', () => {
  test('Choral group costume mutation rejected', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.CHORAL);
    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/costume-conflicts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ round: 'Semi-Final', related_group_id: 1, costume_count: 1 }),
    });
    expect(resp.status).toBe(403);
  });
});

test.describe('Costume mass assignment', () => {
  test('Cannot target arbitrary performance_id on another group', async () => {
    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const tokenB = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
    const groupA = await findGroupId(E2E_COSTUME_GROUPS.A2);
    const groupB = await findGroupId(E2E_COSTUME_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);
    const perfB = await getSemiFinalPerformanceId(groupB, tokenB);
    const borrowedId = await resourceTypeIdByCode(groupA, 'BORROWED', tokenA);

    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupA}/performances/${perfB}/costumes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gender: 'MEN', region: 'Hack', group_id: groupB, event_id: 999,
        resource_type_id: borrowedId,
      }),
    });
    expect(resp.status).toBe(404);
  });

  test('Stored XSS in region renders safely', async ({ page }) => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.A2);
    const perfId = await getSemiFinalPerformanceId(groupId, token);
    const borrowedId = await resourceTypeIdByCode(groupId, 'BORROWED', token);
    const xss = '<script>alert(1)</script>';

    const existing = await getCostumes(groupId, perfId, token);
    const womenCostume = existing.find((c) => c.gender === 'WOMEN');
    const url = womenCostume
      ? `${PORTAL_API_URL}/groups/${groupId}/performances/${perfId}/costumes/${womenCostume.id}`
      : `${PORTAL_API_URL}/groups/${groupId}/performances/${perfId}/costumes`;
    const method = womenCostume ? 'PUT' : 'POST';
    const body = womenCostume
      ? { region: xss, village: xss, resource_type_id: borrowedId, has_won_award: false, purchased_most_or_all: false, purchased_any_parts: false }
      : { gender: 'WOMEN', region: xss, village: xss, resource_type_id: borrowedId, has_won_award: false, purchased_most_or_all: false, purchased_any_parts: false };

    const resp = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect([200, 201]).toContain(resp.status);

    const alerts: string[] = [];
    page.on('dialog', (d) => { alerts.push(d.message()); d.dismiss(); });

    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(DIRECTOR_A.email);
    await page.locator('input[autocomplete="current-password"]').fill(DIRECTOR_A.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
    await page.goto(`/groups/${groupId}/costumes`);
    await expect(page.locator('body')).toContainText(xss);
    await page.waitForTimeout(500);
    expect(alerts).toHaveLength(0);
  });
});

test.describe('Costume uniqueness', () => {
  test('Duplicate performance+gender returns 409', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_COSTUME_GROUPS.A2);
    const perfId = await getFinalPerformanceId(groupId, token);
    const borrowedId = await resourceTypeIdByCode(groupId, 'BORROWED', token);
    const payload = {
      gender: 'WOMEN', region: 'Unique Test', resource_type_id: borrowedId,
      has_won_award: false, purchased_most_or_all: false, purchased_any_parts: false,
    };

    const first = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performances/${perfId}/costumes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect([201, 409]).toContain(first.status);

    const second = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performances/${perfId}/costumes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(second.status).toBe(409);
  });
});
