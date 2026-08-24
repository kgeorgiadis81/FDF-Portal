import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService, SESSION_EXPIRED_MESSAGE } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

function makeJwt(expOffsetSeconds: number): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ exp })}.sig`;
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    sessionStorage.clear();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    Object.defineProperty(router, 'url', { get: () => '/dashboard' });
    router.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthService,
        { provide: Router, useValue: router },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);
    auth.saveAuth(1, makeJwt(3600), 'Director', 'Test Director', ['Director']);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it('expires the session and completes without emitting on 401', async () => {
    const resultPromise = firstValueFrom(http.get('/portal/groups'), { defaultValue: 'empty' });
    const req = httpMock.expectOne('/portal/groups');
    req.flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    await expectAsync(resultPromise).toBeResolvedTo('empty');
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { message: SESSION_EXPIRED_MESSAGE, returnUrl: '/dashboard' },
      replaceUrl: true,
    });
    expect(sessionStorage.getItem('fdp_token')).toBeNull();
  });

  it('does not expire the session on a failed login 401', async () => {
    const resultPromise = firstValueFrom(
      http.post('http://localhost:3501/portal/auth/login', { email: 'a', password: 'b' })
    ).catch((err: HttpErrorResponse) => err.status);

    const req = httpMock.expectOne('http://localhost:3501/portal/auth/login');
    req.flush({ error: 'Invalid email or password' }, { status: 401, statusText: 'Unauthorized' });

    await expectAsync(resultPromise).toBeResolvedTo(401);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('fdp_token')).toBeTruthy();
  });

  it('does not expire the session on a permission 403', async () => {
    const resultPromise = firstValueFrom(http.get('/portal/groups/1')).catch(
      (err: HttpErrorResponse) => err.status
    );
    const req = httpMock.expectOne('/portal/groups/1');
    req.flush({ error: 'Forbidden: Director access only.' }, { status: 403, statusText: 'Forbidden' });

    await expectAsync(resultPromise).toBeResolvedTo(403);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
