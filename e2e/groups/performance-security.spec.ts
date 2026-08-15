import { test, expect } from '@playwright/test';
import { DIRECTOR_A, DIRECTOR_B, PORTAL_API_URL, portalApiLogin } from '../fixtures';
import {
  E2E_PERFORMANCE_GROUPS,
  findGroupId,
  getPerformanceData,
  getSemiFinalPerformanceId,
  getFinalPerformanceId,
  createPerformanceEntry,
  assignMusician,
  assignInstrument,
  getInstrumentsCatalog,
  submitPerformanceRegistration,
  getPerformanceContext,
  searchMusicianIds,
} from '../support/performance-helpers';

test.describe('Performance mass assignment protection', () => {
  test('Entry create ignores non_scorable, score, and division fields', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const perfId = await getSemiFinalPerformanceId(groupId, token);

    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${perfId}/entries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Mass Assign Dance ${Date.now()}`,
        non_scorable: 1,
        score: 99,
        division: 'HACKED',
        category: 'HACKED',
        event_id: 9999,
        group_id: 9999,
        owner_director_user_id: 9999,
        judge_id: 9999,
        type: 'Choral',
      }),
    });
    expect(resp.status).toBe(201);
    const created = await resp.json() as { id: number; name: string; division?: string; score?: number };
    expect(created.name).toMatch(/Mass Assign Dance/);
    expect(created.division).toBeUndefined();
    expect(created.score).toBeUndefined();

    const data = await getPerformanceData(groupId, token);
    const perf = data.performances.find((p) => p.id === perfId)!;
    const entry = perf.entries.find((e) => e.id === created.id);
    expect(entry?.name).toBe(created.name);
    expect(entry).not.toHaveProperty('non_scorable');
  });

  test('Dance group rejects choral entry payload fields on create', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const perfId = await getSemiFinalPerformanceId(groupId, token);

    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${perfId}/entries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Dance Only ${Date.now()}`,
        choral_classification: 'LITURGICAL',
      }),
    });
    expect(resp.status).toBe(201);
    const created = await resp.json() as { choral_classification?: string };
    expect(created.choral_classification).toBeUndefined();
  });

  test('Choral group rejects dance-only region on stored entry', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.CHORAL);
    const perfId = await getSemiFinalPerformanceId(groupId, token);

    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${perfId}/entries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Choral Only ${Date.now()}`,
        choral_classification: 'SECULAR',
        region: 'Injected Region',
        village: 'Injected Village',
        is_acapella: true,
      }),
    });
    expect(resp.status).toBe(201);
    const created = await resp.json() as { region?: string; village?: string; is_acapella?: boolean };
    expect(created.region).toBeUndefined();
    expect(created.village).toBeUndefined();
    expect(created.is_acapella).toBeUndefined();
  });

  test('Submission endpoint ignores client-supplied submitted_at and submitted_by', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const perfId = await getSemiFinalPerformanceId(groupId, token);
    await createPerformanceEntry(groupId, perfId, { name: `Submit Guard ${Date.now()}` }, token);

    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/submissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        submission_type: 'DANCE_PERFORMANCE',
        submitted_at: '1999-01-01T00:00:00Z',
        submitted_by_user_id: 9999,
        group_id: 9999,
      }),
    });
    expect(resp.status).toBe(201);

    const subsResp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const subs = await subsResp.json() as Array<{
      submission_type: string;
      submitted_at: string;
      submitted_by_user_id: number;
    }>;
    const danceSub = subs.find((s) => s.submission_type === 'DANCE_PERFORMANCE');
    expect(danceSub?.submitted_at).toBeTruthy();
    expect(danceSub!.submitted_at.startsWith('1999-')).toBe(false);
    expect(danceSub!.submitted_by_user_id).not.toBe(9999);
  });

  test('Choral group rejects DANCE_PERFORMANCE submission type', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.CHORAL);
    const resp = await submitPerformanceRegistration(groupId, 'DANCE_PERFORMANCE', token);
    expect(resp.status).toBe(400);
    const body = await resp.json() as { error: string };
    expect(body.error).toMatch(/does not match group type/i);
  });

  test('Dance group rejects CHORAL_PERFORMANCE submission type', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const resp = await submitPerformanceRegistration(groupId, 'CHORAL_PERFORMANCE', token);
    expect(resp.status).toBe(400);
  });

  test('Logistics patch ignores performance time and group_order', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const perfId = await getSemiFinalPerformanceId(groupId, token);
    const before = await getPerformanceData(groupId, token);
    const beforePerf = before.performances.find((p) => p.id === perfId)!;

    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${perfId}/logistics`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        additional_props: `Props ${Date.now()}`,
        date_time: '2099-12-31 23:59:59',
        group_order: 999,
        time_penalty_percentage: 50,
      }),
    });
    expect(resp.status).toBe(200);

    const after = await getPerformanceData(groupId, token);
    const afterPerf = after.performances.find((p) => p.id === perfId)!;
    expect(afterPerf.date_time).toBe(beforePerf.date_time);
  });
});

test.describe('Performance nested IDOR', () => {
  test('Director A cannot mutate Director B performance entry', async () => {
    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const tokenB = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
    const groupB = await findGroupId(E2E_PERFORMANCE_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);
    const perfId = await getSemiFinalPerformanceId(groupB, tokenB);
    const entry = await createPerformanceEntry(groupB, perfId, { name: `B Entry ${Date.now()}` }, tokenB);

    const resp = await fetch(
      `${PORTAL_API_URL}/groups/${groupB}/performance/${perfId}/entries/${entry.id}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Hijacked' }),
      },
    );
    expect(resp.status).toBe(403);
  });

  test('Director A cannot assign musician to Director B performance', async () => {
    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const tokenB = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
    const groupB = await findGroupId(E2E_PERFORMANCE_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);
    const perfId = await getSemiFinalPerformanceId(groupB, tokenB);
    const musicianIds = await searchMusicianIds('E2E Musician', tokenB);

    const resp = await assignMusician(groupB, perfId, musicianIds[0], tokenA);
    expect(resp.status).toBe(403);
  });

  test('Director A cannot assign instrument to Director B performance', async () => {
    const tokenA = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const tokenB = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
    const groupB = await findGroupId(E2E_PERFORMANCE_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);
    const perfId = await getSemiFinalPerformanceId(groupB, tokenB);
    const catalog = await getInstrumentsCatalog(tokenB);
    const drum = catalog.find((i) => i.code === 'DRUM')!;

    const resp = await assignInstrument(groupB, perfId, drum.id, undefined, tokenA);
    expect(resp.status).toBe(403);
  });

  test('Cannot target wrong performance ID on entry create for owned group', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const semiId = await getSemiFinalPerformanceId(groupId, token);
    const finalId = await getFinalPerformanceId(groupId, token);
    expect(semiId).not.toBe(finalId);

    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${finalId}/entries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: `Wrong Round ${Date.now()}` }),
    });
    expect(resp.status).toBe(201);
    const created = await resp.json() as { id: number };
    const data = await getPerformanceData(groupId, token);
    const finalPerf = data.performances.find((p) => p.id === finalId)!;
    expect(finalPerf.entries.some((e) => e.id === created.id)).toBe(true);
    const semiPerf = data.performances.find((p) => p.id === semiId)!;
    expect(semiPerf.entries.some((e) => e.id === created.id)).toBe(false);
  });
});

test.describe('Director-safe performance DTO', () => {
  test('Performance response does not expose division, category, scores, or ranking', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.ALPHA);
    const data = await getPerformanceData(groupId, token);
    const serialized = JSON.stringify(data);

    expect(serialized).not.toMatch(/"division"/);
    expect(serialized).not.toMatch(/"category"/);
    expect(serialized).not.toMatch(/"average_age"/);
    expect(serialized).not.toMatch(/"ranking"/);
    expect(serialized).not.toMatch(/"score"/);
    expect(serialized).not.toMatch(/"judge_comments"/);
    expect(serialized).not.toMatch(/"non_scorable"/);
  });

  test('Performance context does not expose classification fields', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.ALPHA);
    const ctx = await getPerformanceContext(groupId, token);
    const serialized = JSON.stringify(ctx);
    expect(serialized).not.toMatch(/"division"/);
    expect(serialized).not.toMatch(/"category"/);
    expect(serialized).not.toMatch(/"classification"/);
  });
});
