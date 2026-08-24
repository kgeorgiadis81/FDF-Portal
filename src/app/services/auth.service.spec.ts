import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

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
});
