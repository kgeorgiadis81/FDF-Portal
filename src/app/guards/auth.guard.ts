import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Requires an authenticated Director session.
 * Redirects to /auth/login with current path as returnUrl if not authenticated.
 *
 * NOTE: This guard is for UX only. Backend routes enforce authorization server-side.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Preserve intended destination (validated in interceptor to prevent open redirect)
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};
