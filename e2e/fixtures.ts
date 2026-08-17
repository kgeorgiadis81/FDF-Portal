/**
 * FDF Portal E2E test fixtures.
 *
 * Director accounts for E2E testing.
 * All accounts are seeded in FDF_DB_E2E via e2e-seed.js.
 * NEVER use real production accounts.
 */

export const PORTAL_API_URL  = process.env['API_URL']         ?? 'http://localhost:3501';
export const PORTAL_BASE_URL = process.env['PORTAL_BASE_URL'] ?? 'http://localhost:4201';

const E2E_PASSWORD = process.env['E2E_PASSWORD'] ?? 'E2eTest!2026';

/**
 * Director A — verified, consented, owns active and historical groups.
 * Use for: happy-path tests, IDOR tests.
 */
export const DIRECTOR_A = {
  email:    'director.a@e2e.test',
  password: E2E_PASSWORD,
  name:     'Director Alpha',
  firstName:'Director',
  lastName: 'Alpha',
};

/**
 * Director B — verified, consented, owns one active group.
 * Use for: IDOR negative tests (Director A must NOT access Director B's group).
 */
export const DIRECTOR_B = {
  email:    'director.b@e2e.test',
  password: E2E_PASSWORD,
  name:     'Director Beta',
};

/**
 * Director (unverified) — created but email not verified.
 * Use for: email-verification flow tests.
 */
export const DIRECTOR_UNVERIFIED = {
  email:    'director.unverified@e2e.test',
  password: E2E_PASSWORD,
  name:     'Director Unverified',
};

/**
 * Director — verified email but has not accepted current consent version.
 * Use for: consent gate and decline flow tests.
 */
export const DIRECTOR_PENDING_CONSENT = {
  email:    'director.pending-consent@e2e.test',
  password: E2E_PASSWORD,
  name:     'E2E Director Pending Consent',
};

/**
 * Portal API helper: login via API and return token.
 * Uses Node 24 native fetch. Never call from browser context.
 */
export async function portalApiLogin(email: string, password: string): Promise<string> {
  const resp = await fetch(`${PORTAL_API_URL}/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) throw new Error(`Login failed: ${resp.status}`);
  const data = await resp.json() as { token: string };
  return data.token;
}

/**
 * Get test emails from the test email provider.
 * Returns the inbox for a given email address.
 */
export async function getTestEmails(email: string) {
  const resp = await fetch(`${PORTAL_API_URL}/test-only/emails?to=${encodeURIComponent(email)}`);
  return resp.json() as Promise<Array<{ to: string; subject: string; htmlContent: string; sentAt: string }>>;
}

/** Extract a URL from email HTML content. */
export function extractLinkFromEmail(htmlContent: string, pathPrefix: string): string | null {
  const match = htmlContent.match(new RegExp(`href="([^"]*${pathPrefix}[^"]*)"`, 'i'));
  return match ? match[1] : null;
}

/** Extract query param token from a URL string. */
export function extractTokenFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.searchParams.get('token');
  } catch {
    return null;
  }
}
