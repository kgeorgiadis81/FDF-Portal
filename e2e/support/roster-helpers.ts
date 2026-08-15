/**
 * Phase 4.1 — deterministic roster E2E helpers and fixture group names.
 */
import {
  PORTAL_API_URL,
  DIRECTOR_A,
  portalApiLogin,
} from '../fixtures';

export const E2E_GROUP_NAMES = {
  ALPHA: 'E2E Group Alpha',
  A2: 'E2E Group A2',
  A_HISTORICAL: 'E2E Group A Historical',
  CHAPERONE_VALIDATION: 'E2E Chaperone Validation Group',
  DEADLINE_OPEN: 'E2E Roster Deadline Open',
  DEADLINE_CLOSED: 'E2E Roster Deadline Closed',
  BETA_DIRECTOR: 'E2E Group Beta Director',
} as const;

/** Deterministic roster deadline dates (America/Los_Angeles event timezone). */
export const ROSTER_DEADLINE_FUTURE = '2030-02-05';
export const ROSTER_DEADLINE_PAST = '2020-02-05';

const E2E_PASSWORD = process.env['E2E_PASSWORD'] ?? 'E2eTest!2026';

export async function adminApiLogin(username: string, password = E2E_PASSWORD): Promise<string> {
  const resp = await fetch(`${PORTAL_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!resp.ok) throw new Error(`Admin login failed: ${resp.status}`);
  const data = await resp.json() as { token: string };
  return data.token;
}

export async function findDirectorGroupId(
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
  if (!group) {
    throw new Error(`E2E fixture group not found: ${groupName}. Run npm run e2e:db:seed.`);
  }
  return group.id;
}

export async function findDirectorGroupIdForEvent(
  groupName: string,
  eventId: number,
): Promise<number> {
  const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(`${PORTAL_API_URL}/portal/groups?eventId=${eventId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const groups = await resp.json() as Array<{ id: number; name: string }>;
  const group = groups.find(g => g.name === groupName);
  if (!group) {
    throw new Error(`E2E fixture group not found for event ${eventId}: ${groupName}`);
  }
  return group.id;
}

export async function getDirectorHistoricalEventId(): Promise<number> {
  const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const resp = await fetch(`${PORTAL_API_URL}/portal/events/my-history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const events = await resp.json() as Array<{ id: number; isActive: boolean }>;
  const past = events.find(e => !e.isActive);
  if (!past) {
    throw new Error('E2E historical event not found for Director A. Run npm run e2e:db:seed.');
  }
  return past.id;
}

export async function setRosterDeadline(deadlineDate: string): Promise<void> {
  const token = await adminApiLogin('e2e_reg_admin');
  const resp = await fetch(`${PORTAL_API_URL}/registration/deadlines/ROSTER`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deadline_date: deadlineDate }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to set roster deadline: ${resp.status}`);
  }
}

export async function clearRosterDeadline(): Promise<void> {
  const token = await adminApiLogin('e2e_reg_admin');
  const resp = await fetch(`${PORTAL_API_URL}/registration/deadlines/ROSTER`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  // 404 acceptable if no deadline configured
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Failed to clear roster deadline: ${resp.status}`);
  }
}

const ALPHA_SEED_MEMBERS = [
  { first_name: 'Anna', last_name: 'Papadimitriou', date_of_birth: '2012-05-15' },
  { first_name: 'Nikos', last_name: 'Georgiou', date_of_birth: '2011-08-20' },
  { first_name: 'Maria', last_name: 'Stavrou', date_of_birth: '2015-02-28' },
];

/** Restore E2E Chaperone Validation Group to seed state (8 minors, 1 chaperone). */
export async function resetChaperoneValidationGroup(): Promise<void> {
  const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const authHeaders = { Authorization: `Bearer ${token}` };
  const gid = await findDirectorGroupId(E2E_GROUP_NAMES.CHAPERONE_VALIDATION);

  const rosterResp = await fetch(`${PORTAL_API_URL}/groups/${gid}/roster`, { headers: authHeaders });
  const { members } = await rosterResp.json() as { members: Array<{ id: number }> };
  for (const m of members) {
    await fetch(`${PORTAL_API_URL}/groups/${gid}/roster/${m.id}`, { method: 'DELETE', headers: authHeaders });
  }
  const minorDobs = [
    '2012-01-15', '2012-02-15', '2012-03-15', '2012-04-15',
    '2012-05-15', '2012-06-15', '2012-07-15', '2012-08-15',
  ];
  for (let i = 0; i < minorDobs.length; i++) {
    await fetch(`${PORTAL_API_URL}/groups/${gid}/roster`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: `Minor${i + 1}`,
        last_name: 'Validation',
        date_of_birth: minorDobs[i],
      }),
    });
  }

  const chapResp = await fetch(`${PORTAL_API_URL}/groups/${gid}/chaperones`, { headers: authHeaders });
  const chaperones = await chapResp.json() as Array<{ id: number }>;
  for (const c of chaperones) {
    await fetch(`${PORTAL_API_URL}/groups/${gid}/chaperones/${c.id}`, { method: 'DELETE', headers: authHeaders });
  }
  await fetch(`${PORTAL_API_URL}/groups/${gid}/chaperones`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'OneChap',
      last_name: 'Only',
      phone: '555-0404',
      is_21_or_older_confirmed: true,
    }),
  });
}

/** Restore E2E Group Alpha roster to seed state (per Playwright project). */
export async function resetGroupAlphaRoster(): Promise<void> {
  const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
  const authHeaders = { Authorization: `Bearer ${token}` };
  const gid = await findDirectorGroupId(E2E_GROUP_NAMES.ALPHA);

  const rosterResp = await fetch(`${PORTAL_API_URL}/groups/${gid}/roster`, { headers: authHeaders });
  const { members } = await rosterResp.json() as { members: Array<{ id: number }> };
  for (const m of members) {
    await fetch(`${PORTAL_API_URL}/groups/${gid}/roster/${m.id}`, { method: 'DELETE', headers: authHeaders });
  }
  for (const seed of ALPHA_SEED_MEMBERS) {
    await fetch(`${PORTAL_API_URL}/groups/${gid}/roster`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(seed),
    });
  }

  const chapResp = await fetch(`${PORTAL_API_URL}/groups/${gid}/chaperones`, { headers: authHeaders });
  const chaperones = await chapResp.json() as Array<{ id: number }>;
  for (const c of chaperones) {
    await fetch(`${PORTAL_API_URL}/groups/${gid}/chaperones/${c.id}`, { method: 'DELETE', headers: authHeaders });
  }
  await fetch(`${PORTAL_API_URL}/groups/${gid}/chaperones`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Stavros',
      last_name: 'Papadopoulos',
      phone: '555-0101',
      is_21_or_older_confirmed: true,
    }),
  });
}
