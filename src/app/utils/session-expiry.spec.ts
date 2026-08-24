import { HttpErrorResponse } from '@angular/common/http';
import { isPublicAuthUrl, isUnauthenticatedHttpError } from './session-expiry';

describe('session-expiry helpers', () => {
  it('recognizes public auth URLs including absolute API origins', () => {
    expect(isPublicAuthUrl('http://localhost:3500/auth/login')).toBeTrue();
    expect(isPublicAuthUrl('http://localhost:3501/portal/auth/forgot-password')).toBeTrue();
    expect(isPublicAuthUrl('http://localhost:3500/users')).toBeFalse();
    expect(isPublicAuthUrl('http://localhost:3501/portal/auth/me')).toBeFalse();
  });

  it('treats 401 as unauthenticated', () => {
    const error = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });
    expect(isUnauthenticatedHttpError(error)).toBeTrue();
  });

  it('treats 403 No token provided as unauthenticated', () => {
    const error = new HttpErrorResponse({
      status: 403,
      error: { error: 'No token provided' },
    });
    expect(isUnauthenticatedHttpError(error)).toBeTrue();
  });

  it('does not treat permission 403 as session expiry', () => {
    const error = new HttpErrorResponse({
      status: 403,
      error: { error: 'Forbidden: insufficient role' },
    });
    expect(isUnauthenticatedHttpError(error)).toBeFalse();
  });
});
