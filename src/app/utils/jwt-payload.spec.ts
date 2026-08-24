import { decodeJwtPayload, getJwtRoles, isJwtExpired } from './jwt-payload';

function makeJwt(payload: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`;
}

describe('jwt-payload', () => {
  it('decodes a JWT payload', () => {
    const token = makeJwt({ exp: 1700000000, sub: 'user' });
    expect(decodeJwtPayload(token)).toEqual({ exp: 1700000000, sub: 'user' });
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('')).toBeNull();
  });

  it('treats missing exp as expired', () => {
    expect(isJwtExpired(makeJwt({ sub: 'user' }), 0)).toBeTrue();
  });

  it('treats past exp as expired', () => {
    const now = 1_700_000_000_000;
    expect(isJwtExpired(makeJwt({ exp: now / 1000 - 1 }), now)).toBeTrue();
  });

  it('treats future exp as current', () => {
    const now = 1_700_000_000_000;
    expect(isJwtExpired(makeJwt({ exp: now / 1000 + 60 }), now)).toBeFalse();
  });

  it('reads roles from JWT payload', () => {
    const token = makeJwt({ roles: ['Competitions Admin', 'Director'] });
    expect(getJwtRoles(token)).toEqual(['Competitions Admin', 'Director']);
  });

  it('falls back to single role claim when roles array is absent', () => {
    const token = makeJwt({ role: 'Director' });
    expect(getJwtRoles(token)).toEqual(['Director']);
  });
});
