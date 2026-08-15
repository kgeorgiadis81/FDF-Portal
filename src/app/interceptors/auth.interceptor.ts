import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Attaches the Bearer token to all outgoing requests and handles sliding-session
 * token renewal (X-New-Token header) and 401 logout.
 *
 * Open-redirect guard: returnUrl is validated on the component side before
 * navigating; here we simply preserve the current path as-is.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  const token = auth.getToken();
  const cloned = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(cloned).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          const newToken = event.headers.get('X-New-Token');
          if (newToken) auth.updateToken(newToken);
        }
      },
      error: (err) => {
        if (err.status === 401) {
          // Session expired — clear and redirect to login
          auth.clearSession();
          const currentUrl = router.url;
          // Validate returnUrl: only allow same-origin paths (no external redirects)
          const safeReturn = currentUrl.startsWith('/') ? currentUrl : '/dashboard';
          router.navigate(['/auth/login'], { queryParams: { returnUrl: safeReturn } });
        }
      },
    })
  );
};
