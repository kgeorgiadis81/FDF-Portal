import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError, of } from 'rxjs';

/**
 * Checks that the authenticated Director has accepted the current consent version.
 * Redirects to /consent if not.
 *
 * NOTE: UX guard only. Backend enforces consent on all protected portal APIs.
 */
export const consentGuard: CanActivateFn = (_route, _state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  return auth.getConsentStatus().pipe(
    map(status => {
      if (!status.requiresConsent) return true;
      return router.createUrlTree(['/consent']);
    }),
    catchError(() => of(router.createUrlTree(['/consent'])))
  );
};
