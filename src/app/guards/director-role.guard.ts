import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Ensures only Director-role tokens reach portal routes.
 * Admin/Judge tokens must not access the Portal.
 */
export const directorRoleGuard: CanActivateFn = (_route, _state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }

  // isAuthenticated already checks role === 'Director' via the signal
  return true;
};
