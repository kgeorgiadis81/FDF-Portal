import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { EMPTY, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { isPublicAuthUrl, isUnauthenticatedHttpError } from '../utils/session-expiry';

/**
 * Attaches the Bearer token to all outgoing requests and handles sliding-session
 * token renewal (X-New-Token header) and unauthenticated logout.
 *
 * Open-redirect guard: returnUrl is validated on the login component before
 * navigating; here we only preserve the current path.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const token = auth.getToken();
  const cloned = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(cloned).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        const newToken = event.headers.get('X-New-Token');
        if (newToken) auth.updateToken(newToken);
      }
    }),
    catchError((err: HttpErrorResponse) => {
      if (!isPublicAuthUrl(req.url) && isUnauthenticatedHttpError(err)) {
        auth.expireSession();
        return EMPTY;
      }
      return throwError(() => err);
    })
  );
};
