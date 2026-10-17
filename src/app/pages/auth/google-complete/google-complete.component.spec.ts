import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';

import { AuthService } from '../../../services/auth.service';
import { GoogleCompleteComponent } from './google-complete.component';

describe('GoogleCompleteComponent', () => {
  let router: jasmine.SpyObj<Router>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate', 'getCurrentNavigation']);
    router.navigate.and.returnValue(Promise.resolve(true));
    router.getCurrentNavigation.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [GoogleCompleteComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.match('/api/portal/auth/public-config').forEach((req) =>
      req.flush({ privacyPolicyUrl: '', requiredConsentVersion: '1.0' }),
    );
    httpMock.verify();
  });

  function create(): ComponentFixture<GoogleCompleteComponent> {
    const fixture = TestBed.createComponent(GoogleCompleteComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('redirects to login without binding a form when opened with no credential', () => {
    const fixture = create();

    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], { replaceUrl: true });
    expect(fixture.componentInstance.form).toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Complete your FDF profile');
    expect(() => fixture.componentInstance.submit()).not.toThrow();
  });

  it('renders the profile form when a Google credential is pending', () => {
    TestBed.inject(AuthService).beginGoogleProfileCompletion('google-cred', {
      providerSubject: 'google-subject',
      providerEmail: 'ada@e2e.test',
      suggestedFirstName: 'Ada',
      suggestedLastName: 'Lovelace',
    });

    const fixture = create();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Complete your FDF profile');
    expect(fixture.componentInstance.form?.value).toEqual(jasmine.objectContaining({
      firstName: 'Ada',
      lastName: 'Lovelace',
    }));
  });
});
