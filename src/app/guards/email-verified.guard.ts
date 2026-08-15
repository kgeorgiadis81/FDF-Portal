import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError, of } from 'rxjs';

/**
 * Ensures Director's email is verified before accessing protected routes.
 * Redirects to /auth/verify-email if not verified.
 */
export const emailVerifiedGuard: CanActivateFn = (_route, _state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  return auth.getProfile().pipe(
    map(profile => {
      if (profile.emailVerified) return true;
      return router.createUrlTree(['/auth/verify-email']);
    }),
    catchError(() => of(true))
  );
};
