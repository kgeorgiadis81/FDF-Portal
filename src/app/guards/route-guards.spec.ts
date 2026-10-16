import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { SESSION_EXPIRED_MESSAGE } from '../utils/session-expiry';
import { authGuard } from './auth.guard';
import { consentGuard } from './consent.guard';
import { directorRoleGuard } from './director-role.guard';
import { emailVerifiedGuard } from './email-verified.guard';

function makeJwt(expOffsetSeconds: number, extra: Record<string, unknown> = {}): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode({
    exp: Math.floor(Date.now() / 1000) + expOffsetSeconds,
    ...extra,
  })}.sig`;
}

describe('route guards', () => {
  let auth: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
      ],
    });
    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  async function run(guard: typeof authGuard, url = '/dashboard') {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as never, { url } as never)
    );
    return isObservable(result) ? firstValueFrom(result) : result;
  }

  it('authGuard allows an authenticated director', async () => {
    auth.saveAuth(1, makeJwt(60), 'Director', 'Director', ['Director']);
    expect(await run(authGuard)).toBeTrue();
  });

  it('authGuard redirects anonymous visitors without a session message', async () => {
    const result = await run(authGuard, '/groups/4');
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toContain('returnUrl=');
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).not.toContain('message');
  });

  it('authGuard clears an expired token and explains the session ended', async () => {
    auth.saveAuth(1, makeJwt(-30), 'Director', 'Director', ['Director']);
    const result = await run(authGuard, 'dashboard');
    const url = TestBed.inject(Router).serializeUrl(result as UrlTree);
    expect(url).toContain(encodeURIComponent(SESSION_EXPIRED_MESSAGE));
    expect(auth.getToken()).toBeNull();
  });

  it('authGuard does nothing while a login redirect is already in flight', async () => {
    auth.expireSession();
    expect(await run(authGuard)).toBeFalse();
  });

  it('directorRoleGuard sends anonymous users to login and admits directors', async () => {
    expect(await run(directorRoleGuard)).toBeInstanceOf(UrlTree);
    auth.saveAuth(1, makeJwt(60), 'Director', 'Director', ['Director']);
    expect(await run(directorRoleGuard)).toBeTrue();
  });

  it('consentGuard allows directors who already accepted and redirects the rest', async () => {
    const allowed = run(consentGuard);
    httpMock.expectOne('/api/portal/auth/consent-status').flush({ requiresConsent: false });
    expect(await allowed).toBeTrue();

    const blocked = run(consentGuard);
    httpMock.expectOne('/api/portal/auth/consent-status').flush({ requiresConsent: true });
    expect(await blocked).toBeInstanceOf(UrlTree);

    const failed = run(consentGuard);
    httpMock.expectOne('/api/portal/auth/consent-status').flush('nope', { status: 500, statusText: 'Error' });
    expect(await failed).toBeInstanceOf(UrlTree);
  });

  it('emailVerifiedGuard redirects unverified profiles and allows the app through on errors', async () => {
    const verified = run(emailVerifiedGuard);
    httpMock.expectOne('/api/portal/auth/me').flush({ emailVerified: true });
    expect(await verified).toBeTrue();

    const unverified = run(emailVerifiedGuard);
    httpMock.expectOne('/api/portal/auth/me').flush({ emailVerified: false });
    expect(TestBed.inject(Router).serializeUrl(await unverified as UrlTree)).toContain('/auth/verify-email');

    const failed = run(emailVerifiedGuard);
    httpMock.expectOne('/api/portal/auth/me').flush('nope', { status: 500, statusText: 'Error' });
    expect(await failed).toBeTrue();
  });
});
