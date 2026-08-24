/**
 * Client-side JWT payload helpers for session UX only.
 * The payload is not signature-verified; the API remains the source of truth.
 * Tokens are never logged.
 */

/**
 * Decode a JWT payload without verifying the signature.
 * Returns null when the token is malformed.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');
    const json = JSON.parse(atob(padded));
    if (json === null || typeof json !== 'object' || Array.isArray(json)) {
      return null;
    }
    return json as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Role claims from a JWT payload for client-side session UX only.
 */
export function getJwtRoles(token: string): string[] {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return [];
  }

  const roles = payload['roles'];
  if (Array.isArray(roles) && roles.length > 0) {
    return roles.map(String);
  }

  const role = payload['role'];
  if (typeof role === 'string' && role) {
    return [role];
  }

  return [];
}

/**
 * True when the token cannot be decoded, has no numeric `exp`, or is at/past expiry.
 */
export function isJwtExpired(token: string, nowMs: number = Date.now()): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload['exp'] !== 'number') {
    return true;
  }
  return payload['exp'] * 1000 <= nowMs;
}
