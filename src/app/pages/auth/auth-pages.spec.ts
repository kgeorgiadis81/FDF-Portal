import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { VerifyEmailComponent } from './verify-email/verify-email.component';
import { GoogleCompleteComponent } from './google-complete/google-complete.component';
import { ConsentComponent } from '../consent/consent.component';

function routeWith(params: Record<string, string>): ActivatedRoute {
  return { snapshot: { queryParamMap: convertToParamMap(params), paramMap: convertToParamMap({}) } } as ActivatedRoute;
}

describe('auth pages', () => {
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    sessionStorage.clear();
    router = jasmine.createSpyObj<Router>('Router', ['navigate', 'navigateByUrl', 'getCurrentNavigation']);
    router.navigate.and.returnValue(Promise.resolve(true));
    router.navigateByUrl.and.returnValue(Promise.resolve(true));
    router.getCurrentNavigation.and.returnValue(null);
    Object.defineProperty(router, 'url', { get: () => '/auth/login' });
  });

  afterEach(() => {
    httpMock?.match('/api/portal/auth/public-config').forEach((req) =>
      req.flush({ privacyPolicyUrl: '', requiredConsentVersion: '1.0' })
    );
    httpMock?.verify();
    sessionStorage.clear();
  });

  async function setup<T>(component: Type<T>, route: ActivatedRoute) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [component],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        AuthService,
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    const pending = httpMock.match('/api/portal/auth/public-config');
    pending.forEach((req) => req.flush({ privacyPolicyUrl: 'https://example.test/privacy', requiredConsentVersion: '1.0' }));
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    httpMock.match('/api/portal/auth/public-config').forEach((req) =>
      req.flush({ privacyPolicyUrl: '', requiredConsentVersion: '1.0' })
    );
    return fixture;
  }

  it('logs in, honors a safe return URL, and sends unverified directors to verify-email', async () => {
    const fixture = await setup(LoginComponent, routeWith({ returnUrl: '/profile', message: 'Welcome back' }));
    const component = fixture.componentInstance;
    expect(component.infoMessage()).toBe('Welcome back');
    component.togglePassword();
    expect(component.showPassword()).toBeTrue();

    component.form.setValue({ email: 'a@e2e.test', password: 'secret' });
    component.submit();
    let req = httpMock.expectOne('/api/portal/auth/login');
    req.flush({
      id: 1, token: 'tok', role: 'Director', roles: ['Director'],
      firstName: 'Ada', lastName: 'Lovelace', requiresConsent: false,
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/profile');

    component.form.setValue({ email: 'a@e2e.test', password: 'secret' });
    component.submit();
    req = httpMock.expectOne('/api/portal/auth/login');
    req.flush({
      id: 1, token: 'tok', role: 'Director', firstName: 'Ada', lastName: '', requiresConsent: true,
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/consent');

    component.submit();
    req = httpMock.expectOne('/api/portal/auth/login');
    req.flush({ code: 'EMAIL_UNVERIFIED', error: 'Verify' }, { status: 403, statusText: 'Forbidden' });
    expect(router.navigate).toHaveBeenCalledWith(['/auth/verify-email'], { queryParams: { email: 'a@e2e.test' } });

    component.submit();
    req = httpMock.expectOne('/api/portal/auth/login');
    req.flush({ error: 'Invalid email or password' }, { status: 401, statusText: 'Unauthorized' });
    expect(component.error()).toContain('Invalid email');

    component.form.setValue({ email: '', password: '' });
    component.submit();
    httpMock.expectNone('/api/portal/auth/login');

    component.loading.set(true);
    component.form.setValue({ email: 'a@e2e.test', password: 'secret' });
    component.submit();
    httpMock.expectNone('/api/portal/auth/login');
    component.loading.set(false);

    component['handleGoogleCredential']('google-cred');
    httpMock.expectOne('/api/portal/auth/google').flush({
      requiresProfileCompletion: true,
      googleProfile: { suggestedFirstName: 'Ada', suggestedLastName: 'Lovelace' },
    });
    expect(router.navigate).toHaveBeenCalledWith(['/auth/google-complete'], {
      state: {
        googleProfile: { suggestedFirstName: 'Ada', suggestedLastName: 'Lovelace' },
        credential: 'google-cred',
      },
    });

    component['handleGoogleCredential']('google-cred');
    httpMock.expectOne('/api/portal/auth/google').flush({
      token: 'tok', role: 'Director', roles: ['Director'], firstName: 'Ada', lastName: 'Lovelace', requiresConsent: false,
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/profile');

    component['handleGoogleCredential']('google-cred');
    httpMock.expectOne('/api/portal/auth/google').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(component.error()).toContain('Google sign-in failed');

    const unsafe = await setup(LoginComponent, routeWith({ returnUrl: 'https://evil.test' }));
    unsafe.componentInstance.form.setValue({ email: 'a@e2e.test', password: 'secret' });
    unsafe.componentInstance.submit();
    httpMock.expectOne('/api/portal/auth/login').flush({
      id: 1, token: 'tok', role: 'Director', roles: ['Director'], name: 'Fallback', requiresConsent: false,
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('signs up and toggles password visibility', async () => {
    const fixture = await setup(SignupComponent, routeWith({}));
    const component = fixture.componentInstance;
    component.togglePassword();
    component.toggleConfirm();
    expect(component.showPassword()).toBeTrue();
    component.submit();
    httpMock.expectNone('/api/portal/auth/signup');

    component.form.setValue({
      firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '1990-01-01',
      email: 'ada@e2e.test', password: 'longpassword', confirmPassword: 'other',
      consentAccepted: true,
    });
    component.submit();
    httpMock.expectNone('/api/portal/auth/signup');

    component.form.patchValue({ confirmPassword: 'longpassword' });
    component.submit();
    let req = httpMock.expectOne('/api/portal/auth/signup');
    req.flush({ message: 'ok', emailSent: true });
    expect(router.navigate).toHaveBeenCalledWith(['/auth/verify-email'], { queryParams: { email: 'ada@e2e.test' } });

    component.submit();
    req = httpMock.expectOne('/api/portal/auth/signup');
    req.flush({}, { status: 400, statusText: 'Bad Request' });
    expect(component.error()).toContain('Account creation failed');
  });

  it('always shows the generic forgot-password confirmation', async () => {
    const fixture = await setup(ForgotPasswordComponent, routeWith({}));
    const component = fixture.componentInstance;
    component.submit();
    expect(component.sent()).toBeFalse();
    component.form.setValue({ email: 'ada@e2e.test' });
    component.submit();
    httpMock.expectOne('/api/portal/auth/forgot-password').flush({ message: 'ok' });
    expect(component.sent()).toBeTrue();

    component.sent.set(false);
    component.submit();
    httpMock.expectOne('/api/portal/auth/forgot-password').flush('nope', { status: 500, statusText: 'Error' });
    expect(component.sent()).toBeTrue();
  });

  it('resets a password only when the token and confirmation match', async () => {
    const missing = await setup(ResetPasswordComponent, routeWith({}));
    expect(missing.componentInstance.error()).toContain('Invalid or missing');
    missing.componentInstance.form.setValue({ newPassword: 'longpassword', confirmPassword: 'longpassword' });
    missing.componentInstance.submit();
    httpMock.expectNone('/api/portal/auth/reset-password');

    const fixture = await setup(ResetPasswordComponent, routeWith({ token: 'reset-token' }));
    const component = fixture.componentInstance;
    component.togglePw();
    component.toggleCpw();
    component.form.setValue({ newPassword: 'longpassword', confirmPassword: 'different1' });
    component.submit();
    httpMock.expectNone('/api/portal/auth/reset-password');

    component.form.setValue({ newPassword: 'longpassword', confirmPassword: 'longpassword' });
    component.submit();
    httpMock.expectOne('/api/portal/auth/reset-password').flush({ message: 'ok' });
    expect(component.success()).toBeTrue();
    expect(router.navigate).toHaveBeenCalled();

    component.success.set(false);
    component.submit();
    httpMock.expectOne('/api/portal/auth/reset-password').flush(
      { error: 'expired' },
      { status: 400, statusText: 'Bad Request' }
    );
    expect(component.error()).toBe('expired');
  });

  it('verifies an email token, masks the address, and resends', async () => {
    const fixture = await setup(VerifyEmailComponent, routeWith({ email: 'ada@e2e.test', token: 'verify-token' }));
    const component = fixture.componentInstance;
    expect(component.maskedEmail()).toBe('ad***@e2e.test');
    httpMock.expectOne('/api/portal/auth/verify-email').flush({ message: 'ok' });
    expect(component.verified()).toBeTrue();
    component.goToLogin();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);

    const failed = await setup(VerifyEmailComponent, routeWith({ email: 'not-an-email', token: 'bad' }));
    httpMock.expectOne('/api/portal/auth/verify-email').flush({}, { status: 400, statusText: 'Bad Request' });
    expect(failed.componentInstance.error()).toContain('invalid or has expired');
    expect(failed.componentInstance.maskedEmail()).toBe('not-an-email');
    failed.componentInstance.resend();
    httpMock.expectOne('/api/portal/auth/resend-verification').flush({ message: 'ok' });

    const resend = await setup(VerifyEmailComponent, routeWith({ email: 'ada@e2e.test' }));
    resend.componentInstance.resend();
    httpMock.expectOne('/api/portal/auth/resend-verification').flush({ message: 'ok' });
    expect(resend.componentInstance.resent()).toBeTrue();
    resend.componentInstance.resent.set(false);
    resend.componentInstance.resend();
    httpMock.expectOne('/api/portal/auth/resend-verification').flush('nope', { status: 500, statusText: 'Error' });
    expect(resend.componentInstance.resent()).toBeTrue();
    resend.componentInstance.resending.set(true);
    resend.componentInstance.resend();
    httpMock.expectNone('/api/portal/auth/resend-verification');
  });

  it('completes a Google profile and returns to login without a credential', async () => {
    router.getCurrentNavigation.and.returnValue({
      extras: {
        state: {
          credential: 'google-cred',
          googleProfile: { suggestedFirstName: 'Ada', suggestedLastName: 'Lovelace' },
        },
      },
    } as never);
    const fixture = await setup(GoogleCompleteComponent, routeWith({}));
    const component = fixture.componentInstance;
    expect(component.form.value.firstName).toBe('Ada');
    component.submit();
    httpMock.expectNone('/api/portal/auth/google/complete-profile');

    component.form.setValue({
      firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '1990-01-01', consentAccepted: true,
    });
    component.submit();
    httpMock.expectOne('/api/portal/auth/google/complete-profile').flush({
      token: 'tok', role: 'Director', roles: ['Director'], firstName: 'Ada', lastName: 'Lovelace', requiresConsent: false,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);

    component.submit();
    httpMock.expectOne('/api/portal/auth/google/complete-profile').flush({}, { status: 400, statusText: 'Bad Request' });
    expect(component.error()).toContain('Profile setup failed');

    router.getCurrentNavigation.and.returnValue(null);
    await expectAsync(setup(GoogleCompleteComponent, routeWith({}))).toBeRejected();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('records consent acceptance, decline, and logout', async () => {
    const fixture = await setup(ConsentComponent, routeWith({}));
    const component = fixture.componentInstance as ConsentComponent;
    component.submit();
    httpMock.expectNone('/api/portal/auth/consent');
    component.accepted = true;
    component.submit();
    httpMock.expectOne('/api/portal/auth/consent').flush({ message: 'ok' });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);

    component.submit();
    httpMock.expectOne('/api/portal/auth/consent').flush({}, { status: 500, statusText: 'Error' });
    expect(component.error()).toContain('Could not record consent');

    component.decline();
    const decline = httpMock.expectOne('/api/portal/auth/consent/decline');
    decline.flush({ message: 'ok' });
    const logout = httpMock.match('/api/portal/auth/logout');
    logout.forEach((req) => req.flush({}));
    expect(router.navigate).toHaveBeenCalled();

    component.loading.set(false);
    component.decline();
    httpMock.expectOne('/api/portal/auth/consent/decline').flush({}, { status: 500, statusText: 'Error' });
    expect(component.error()).toContain('Could not record');

    component.logout();
  });
});

void ComponentFixture;
