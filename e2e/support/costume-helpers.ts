/**
 * Phase 6 — Costume registration E2E helpers.
 */
import {
  PORTAL_API_URL,
  DIRECTOR_A,
  DIRECTOR_B,
  portalApiLogin,
} from '../fixtures';
import { adminApiLogin } from './roster-helpers';
import { findGroupId, getSemiFinalPerformanceId, getFinalPerformanceId } from './performance-helpers';

export const E2E_COSTUME_GROUPS = {
  ALPHA: 'E2E Group Alpha',
  A2: 'E2E Group A2',
  CHORAL: 'E2E Choral Group Alpha',
  A_HISTORICAL: 'E2E Group A Historical',
  BETA_DIRECTOR: 'E2E Group Beta Director',
  DEADLINE_OPEN: 'E2E Costume Deadline Open',
  DEADLINE_CLOSED: 'E2E Costume Deadline Closed',
} as const;

export const COSTUME_DEADLINE_FUTURE = '2030-02-05';
export const COSTUME_DEADLINE_PAST = '2020-02-05';

export type CostumeResourceType = { id: number; code: string; label: string };
export type PerformanceCostume = {
  id: number;
  performance_id: number;
  gender: 'MEN' | 'WOMEN';
  region: string | null;
  village: string | null;
  resource_type_id: number | null;
  resource_type_code?: string;
  resource_type_label?: string;
  has_won_award: number | boolean;
  purchased_most_or_all: number | boolean;
  purchased_any_parts: number | boolean;
};
export type CostumeConflict = {
  id: number;
  group_id: number;
  round: string;
  related_group_id: number;
  costume_count: number;
  related_group_name?: string;
  related_parish_name?: string | null;
};

export async function setCostumeDeadline(deadlineDate: string): Promise<void> {
  const token = await adminApiLogin('e2e_reg_admin');
  const resp = await fetch(`${PORTAL_API_URL}/registration/deadlines/COSTUME`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deadline_date: deadlineDate }),
  });
  if (!resp.ok) throw new Error(`Failed to set costume deadline: ${resp.status}`);
}

export async function clearCostumeDeadline(): Promise<void> {
  const token = await adminApiLogin('e2e_reg_admin');
  await fetch(`${PORTAL_API_URL}/registration/deadlines/COSTUME`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getCostumeContext(groupId: number, token?: string) {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/costume-context`, {
    headers: { Authorization: `Bearer ${auth}` },
  });
  if (!resp.ok) throw new Error(`costume-context failed: ${resp.status}`);
  return resp.json();
}

export async function getResourceTypes(groupId: number, token?: string): Promise<CostumeResourceType[]> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/costume-resource-types`, {
    headers: { Authorization: `Bearer ${auth}` },
  });
  if (!resp.ok) throw new Error(`resource types failed: ${resp.status}`);
  return resp.json();
}

export async function getCostumes(
  groupId: number,
  performanceId: number,
  token?: string,
): Promise<PerformanceCostume[]> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(
    `${PORTAL_API_URL}/groups/${groupId}/performances/${performanceId}/costumes`,
    { headers: { Authorization: `Bearer ${auth}` } },
  );
  if (!resp.ok) throw new Error(`getCostumes failed: ${resp.status}`);
  return resp.json();
}

export async function createCostume(
  groupId: number,
  performanceId: number,
  payload: Record<string, unknown>,
  token?: string,
): Promise<{ id: number }> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(
    `${PORTAL_API_URL}/groups/${groupId}/performances/${performanceId}/costumes`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  const body = await resp.json().catch(() => ({}));
  return { ...body, status: resp.status };
}

export async function updateCostume(
  groupId: number,
  performanceId: number,
  costumeId: number,
  payload: Record<string, unknown>,
  token?: string,
): Promise<{ status: number; body: unknown }> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(
    `${PORTAL_API_URL}/groups/${groupId}/performances/${performanceId}/costumes/${costumeId}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  const body = await resp.json().catch(() => ({}));
  return { status: resp.status, body };
}

export async function getCostumeConflicts(groupId: number, token?: string): Promise<CostumeConflict[]> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/costume-conflicts`, {
    headers: { Authorization: `Bearer ${auth}` },
  });
  if (!resp.ok) throw new Error(`costume-conflicts failed: ${resp.status}`);
  return resp.json();
}

export async function createCostumeConflict(
  groupId: number,
  payload: { round: string; related_group_id: number; costume_count: number },
  token?: string,
): Promise<{ status: number; body: unknown }> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/costume-conflicts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await resp.json().catch(() => ({}));
  return { status: resp.status, body };
}

export async function deleteCostumeConflict(
  groupId: number,
  conflictId: number,
  token?: string,
): Promise<number> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/costume-conflicts/${conflictId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth}` },
  });
  return resp.status;
}

export async function submitCostumeRegistration(groupId: number, token?: string): Promise<number> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/submissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ submission_type: 'COSTUME' }),
  });
  return resp.status;
}

export async function searchRelatedGroups(
  groupId: number,
  search = '',
  token?: string,
): Promise<Array<{ id: number; name: string; parish_name: string | null; display_label: string }>> {
  const auth = token ?? await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  const resp = await fetch(`${PORTAL_API_URL}/portal/groups/${groupId}/related-groups${qs}`, {
    headers: { Authorization: `Bearer ${auth}` },
  });
  if (!resp.ok) throw new Error(`related-groups failed: ${resp.status}`);
  return resp.json();
}

export async function resourceTypeIdByCode(
  groupId: number,
  code: string,
  token?: string,
): Promise<number> {
  const types = await getResourceTypes(groupId, token);
  const match = types.find((t) => t.code === code);
  if (!match) throw new Error(`Resource type not found: ${code}`);
  return match.id;
}

export { findGroupId, getSemiFinalPerformanceId, getFinalPerformanceId, DIRECTOR_A, DIRECTOR_B };
