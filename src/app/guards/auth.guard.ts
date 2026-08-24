import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, SESSION_EXPIRED_MESSAGE } from '../services/auth.service';

/**
 * Requires an authenticated Director session.
 * Redirects to /auth/login with current path as returnUrl if not authenticated.
 *
 * NOTE: This guard is for UX only. Backend routes enforce authorization server-side.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  if (auth.isLoginRedirectInFlight()) {
    return false;
  }

  const hadToken = !!auth.getToken();
  if (hadToken) {
    auth.clearSession();
  }

  const queryParams: Record<string, string> = {};
  const returnUrl = state.url.startsWith('/') ? state.url : '/dashboard';
  queryParams['returnUrl'] = returnUrl;
  if (hadToken) {
    queryParams['message'] = SESSION_EXPIRED_MESSAGE;
  }

  return router.createUrlTree(['/auth/login'], { queryParams });
};
