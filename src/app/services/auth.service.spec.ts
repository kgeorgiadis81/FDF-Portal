import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService, formatDisplayName, SESSION_EXPIRED_MESSAGE } from './auth.service';

function makeJwt(expOffsetSeconds: number): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ exp })}.sig`;
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    Object.defineProperty(router, 'url', { get: () => '/dashboard' });
    router.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('isAuthenticated is false when no token is stored', () => {
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('isAuthenticated is true for an unexpired Director token', () => {
    service.saveAuth(1, makeJwt(3600), 'Director', 'Director', ['Director']);
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('isAuthenticated is false for an expired token', () => {
    service.saveAuth(1, makeJwt(-60), 'Director', 'Director', ['Director']);
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.getToken()).toBeTruthy();
  });

  it('isAuthenticated is true when JWT roles include Director even if primary role differs', () => {
    const encode = (value: object) =>
      btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      exp,
      role: 'Competitions Admin',
      roles: ['Competitions Admin', 'Director'],
    })}.sig`;

    service.saveAuth(1, token, 'Competitions Admin', 'Dual User');
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('isAuthenticated is true for Global Admin + Judge + Director JWT', () => {
    const encode = (value: object) =>
      btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      exp,
      role: 'Global Admin',
      roles: ['Global Admin', 'Judge', 'Director'],
    })}.sig`;

    service.saveAuth(9, token, 'Global Admin', 'Triple User');
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('formats a display name from first and last name, then falls back', () => {
    expect(formatDisplayName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
    expect(formatDisplayName({ name: 'Director' })).toBe('Director');
    expect(formatDisplayName({})).toBe('');
  });

  it('resolves roles from the JWT when the caller omits them', () => {
    const encode = (value: object) =>
      btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const token = `${encode({ alg: 'none' })}.${encode({
      exp: Math.floor(Date.now() / 1000) + 60,
      roles: ['Director'],
    })}.sig`;
    service.saveAuth(4, token, '', 'Named');
    expect(service.isAuthenticated()).toBeTrue();
    expect(sessionStorage.getItem('fdp_roles')).toBe(JSON.stringify(['Director']));
  });

  it('reads a stored primary role when roles JSON is invalid', () => {
    sessionStorage.clear();
    sessionStorage.setItem('fdp_roles', '{');
    sessionStorage.setItem('fdp_role', 'Director');
    sessionStorage.setItem('fdp_token', makeJwt(60));
    sessionStorage.setItem('fdp_id', '3');
    TestBed.resetTestingModule();
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    Object.defineProperty(router, 'url', { get: () => '/auth/login' });
    router.navigate.and.returnValue(Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        { provide: Router, useValue: router },
      ],
    });
    const fresh = TestBed.inject(AuthService);
    expect(fresh.isAuthenticated()).toBeTrue();
    fresh.expireSession();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { message: SESSION_EXPIRED_MESSAGE, returnUrl: '/dashboard' },
      replaceUrl: true,
    });
  });

  it('updates the session name and token', () => {
    service.updateSessionName('New Name');
    service.updateToken('fresh-token');
    expect(service.currentName()).toBe('New Name');
    expect(service.getToken()).toBe('fresh-token');
  });

  it('logout posts an audit call and redirects to login', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    service.saveAuth(1, makeJwt(60), 'Director', 'Director', ['Director']);
    service.logout('/groups/1');
    const req = httpMock.expectOne('/api/portal/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush({});
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/groups/1' },
      replaceUrl: false,
    });
    expect(service.getToken()).toBeNull();
    service.logout();
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('expireSession clears the token and sends the user to login once', () => {
    const router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    service.saveAuth(1, makeJwt(60), 'Director', 'Director', ['Director']);
    service.expireSession();
    service.expireSession();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { message: SESSION_EXPIRED_MESSAGE, returnUrl: '/dashboard' },
      replaceUrl: true,
    });
    expect(service.isLoginRedirectInFlight()).toBeTrue();
  });

  it('calls each auth API with the expected body', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    const profile = {
      id: 1, firstName: 'A', lastName: 'B', name: 'A B', email: 'a@e2e.test',
      emailVerified: true, phoneNumber: null, googleLinked: false, createdAt: '',
      consent: { version: '1.0', accepted: true },
    };

    service.signup({
      firstName: 'A', lastName: 'B', dateOfBirth: '1990-01-01',
      email: 'a@e2e.test', password: 'secret', confirmPassword: 'secret', consentAccepted: true,
    }).subscribe();
    service.login('a@e2e.test', 'secret').subscribe();
    service.verifyEmail('tok').subscribe();
    service.resendVerification('a@e2e.test').subscribe();
    service.forgotPassword('a@e2e.test').subscribe();
    service.resetPassword('tok', 'new-secret', 'new-secret').subscribe();
    service.googleAuth('cred').subscribe();
    service.googleCompleteProfile({
      credential: 'cred', firstName: 'A', lastName: 'B', dateOfBirth: '1990-01-01', consentAccepted: true,
    }).subscribe();
    service.acceptConsent().subscribe();
    service.declineConsent().subscribe();
    service.getConsentStatus().subscribe();
    service.getProfile().subscribe();
    service.updateProfile({ firstName: 'A', lastName: 'B', phoneNumber: '555' }).subscribe();

    const expected: Array<[string, string, unknown]> = [
      ['POST', '/api/portal/auth/signup', { message: 'ok' }],
      ['POST', '/api/portal/auth/login', { message: 'ok' }],
      ['POST', '/api/portal/auth/verify-email', { message: 'ok' }],
      ['POST', '/api/portal/auth/resend-verification', { message: 'ok' }],
      ['POST', '/api/portal/auth/forgot-password', { message: 'ok' }],
      ['POST', '/api/portal/auth/reset-password', { message: 'ok' }],
      ['POST', '/api/portal/auth/google', { message: 'ok' }],
      ['POST', '/api/portal/auth/google/complete-profile', { message: 'ok' }],
      ['POST', '/api/portal/auth/consent', { message: 'ok' }],
      ['POST', '/api/portal/auth/consent/decline', { message: 'ok' }],
      ['GET', '/api/portal/auth/consent-status', { message: 'ok' }],
      ['GET', '/api/portal/auth/me', profile],
      ['PUT', '/api/portal/auth/me', { message: 'ok' }],
    ];
    for (const [method, url, body] of expected) {
      httpMock.expectOne({ method, url }).flush(body as object);
    }
    httpMock.verify();
  });
});
