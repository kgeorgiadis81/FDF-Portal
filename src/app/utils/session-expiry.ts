import { HttpErrorResponse } from '@angular/common/http';

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

const PUBLIC_AUTH_PATH_SUFFIXES = [
  '/auth/login',
  '/auth/signup',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/google',
  '/auth/google/complete-profile',
];

/**
 * Public credential endpoints must not trigger session-expiry logout (e.g. a 401 from bad login).
 */
export function isPublicAuthUrl(url: string): boolean {
  const path = url.split('?')[0];
  return PUBLIC_AUTH_PATH_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

/**
 * True for unauthenticated API responses. Permission 403s are not session expiry.
 */
export function isUnauthenticatedHttpError(error: HttpErrorResponse): boolean {
  if (error.status === 401) {
    return true;
  }
  if (error.status !== 403) {
    return false;
  }
  const body = error.error;
  return !!body && typeof body === 'object' && body.error === 'No token provided';
}
