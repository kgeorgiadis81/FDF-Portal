/**
 * Phase 5 — Performance registration E2E helpers.
 */
import {
  PORTAL_API_URL,
  DIRECTOR_A,
  DIRECTOR_B,
  portalApiLogin,
} from '../fixtures';
import { adminApiLogin } from './roster-helpers';

export const E2E_PERFORMANCE_GROUPS = {
  ALPHA: 'E2E Group Alpha',
  A2: 'E2E Group A2',
  CHORAL: 'E2E Choral Group Alpha',
  A_HISTORICAL: 'E2E Group A Historical',
  BETA_DIRECTOR: 'E2E Group Beta Director',
  DEADLINE_OPEN: 'E2E Performance Deadline Open',
  DEADLINE_CLOSED: 'E2E Performance Deadline Closed',
} as const;

export const PERFORMANCE_DEADLINE_FUTURE = '2030-02-05';
export const PERFORMANCE_DEADLINE_PAST = '2020-02-05';

export async function setPerformanceDeadline(
  submissionType: 'DANCE_PERFORMANCE' | 'CHORAL_PERFORMANCE',
  deadlineDate: string,
): Promise<void> {
  const token = await adminApiLogin('e2e_reg_admin');
  const resp = await fetch(`${PORTAL_API_URL}/registration/deadlines/${submissionType}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deadline_date: deadlineDate }),
  });
  if (!resp.ok) throw new Error(`Failed to set performance deadline: ${resp.status}`);
}

export async function clearPerformanceDeadline(
  submissionType: 'DANCE_PERFORMANCE' | 'CHORAL_PERFORMANCE',
): Promise<void> {
  const token = await adminApiLogin('e2e_reg_admin');
  await fetch(`${PORTAL_API_URL}/registration/deadlines/${submissionType}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function findGroupId(
  groupName: string,
  email = DIRECTOR_A.email,
  password = DIRECTOR_A.password,
): Promise<number> {
  const token = await portalApiLogin(email, password);
  const resp = await fetch(`${PORTAL_API_URL}/portal/groups`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const groups = await resp.json() as Array<{ id: number; name: string }>;
  const group = groups.find(g => g.name === groupName);
  if (!group) throw new Error(`Group not found: ${groupName}`);
  return group.id;
}

export async function getPerformanceData(groupId: number, token?: string): Promise<unknown> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performance`, {
    headers: { Authorization: `Bearer ${auth}` },
  });
  return resp.json();
}

type PerformanceApiResponse = {
  performances: Array<{
    id: number;
    round: string;
    entries: Array<{ id: number; name: string; entry_order: number }>;
  }>;
};

export async function getSemiFinalPerformanceId(groupId: number, token?: string): Promise<number> {
  const data = await getPerformanceData(groupId, token) as PerformanceApiResponse;
  const perf = data.performances.find((p) => p.round === 'Semi-Final');
  if (!perf) throw new Error('Semi-Final performance not found');
  return perf.id;
}

export async function getFinalPerformanceId(groupId: number, token?: string): Promise<number> {
  const data = await getPerformanceData(groupId, token) as PerformanceApiResponse;
  const perf = data.performances.find((p) => p.round === 'Final');
  if (!perf) throw new Error('Final performance not found');
  return perf.id;
}

export async function createPerformanceEntry(
  groupId: number,
  performanceId: number,
  payload: Record<string, unknown>,
  token?: string,
): Promise<{ id: number; entry_order: number }> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${performanceId}/entries`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw Object.assign(new Error(`createPerformanceEntry failed: ${resp.status}`), { status: resp.status, body });
  }
  return resp.json();
}

export async function reorderPerformanceEntries(
  groupId: number,
  performanceId: number,
  entryIds: number[],
  token?: string,
): Promise<Array<{ id: number; entry_order: number }>> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${performanceId}/entries/reorder`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ entry_ids: entryIds }),
  });
  if (!resp.ok) throw new Error(`reorder failed: ${resp.status}`);
  const data = await resp.json() as { entries: Array<{ id: number; entry_order: number }> };
  return data.entries;
}

export async function assignMusician(
  groupId: number,
  performanceId: number,
  musicianId: number,
  token?: string,
): Promise<Response> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  return fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${performanceId}/musicians`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ musician_id: musicianId }),
  });
}

export async function searchMusicianIds(query: string, token?: string): Promise<number[]> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(`${PORTAL_API_URL}/musicians/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${auth}` },
  });
  const rows = await resp.json() as Array<{ id: number }>;
  return rows.map((r) => r.id);
}

export async function deletePerformanceEntry(
  groupId: number,
  performanceId: number,
  entryId: number,
  token?: string,
): Promise<Response> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  return fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${performanceId}/entries/${entryId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth}` },
  });
}

export async function clearPerformanceMusicians(
  groupId: number,
  performanceId: number,
  token?: string,
): Promise<void> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const data = await getPerformanceData(groupId, auth) as {
    performances: Array<{ id: number; musicians: Array<{ musician_id: number }> }>;
  };
  const perf = data.performances.find((p) => p.id === performanceId);
  if (!perf) return;
  for (const m of perf.musicians ?? []) {
    await fetch(`${PORTAL_API_URL}/groups/${groupId}/performance/${performanceId}/musicians/${m.musician_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth}` },
    });
  }
}

export { DIRECTOR_A, DIRECTOR_B, portalApiLogin, PORTAL_API_URL };
