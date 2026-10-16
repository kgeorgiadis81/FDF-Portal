import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';

import { AppComponent } from '../app.component';
import { AuthLayoutComponent } from '../layouts/auth-layout/auth-layout.component';
import { AppShellComponent } from '../layouts/app-shell/app-shell.component';
import { GroupsComponent } from './groups/groups.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { CreateGroupComponent } from './groups/create-group/create-group.component';
import { ProfileComponent } from './profile/profile.component';
import { AuthService } from '../services/auth.service';
import { UnsavedChangesService } from '../shared/unsaved-changes';
import { routes } from '../app.routes';

function makeJwt(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    roles: ['Director'],
  })}.sig`;
}

const profile = {
  id: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  name: 'Ada Lovelace',
  email: 'ada@e2e.test',
  emailVerified: true,
  phoneNumber: '555',
  googleLinked: true,
  createdAt: '2026-01-01',
  consent: { version: '1.0', accepted: true, declined: false },
};

const event = {
  id: 2, name: 'Active Event', location: null, startDate: null, endDate: null, timezone: 'UTC', isActive: true,
};
const group = {
  id: 9,
  name: 'Alpha',
  groupType: 'Dance',
  parish: { id: 1, name: 'Parish', location: 'City' },
  event: { id: 2, name: 'Active Event', isActive: true },
  primaryDirector: { name: 'Ada', email: 'ada@e2e.test' },
  isReadOnly: false,
  rosterMemberCount: 0,
  rosterSubmittedAt: null,
};

describe('shell, dashboard, profile, and create group', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).saveAuth(1, makeJwt(), 'Director', 'Ada Lovelace', ['Director']);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  function flushConfig() {
    httpMock.match('/api/portal/auth/public-config').forEach((req) =>
      req.flush({ privacyPolicyUrl: '', requiredConsentVersion: '1.0' })
    );
  }

  it('renders the root and auth layout and signs out of the shell', () => {
    const root = TestBed.createComponent(AppComponent);
    root.detectChanges();
    expect(root.nativeElement.querySelector('router-outlet')).not.toBeNull();

    const authLayout = TestBed.createComponent(AuthLayoutComponent);
    authLayout.detectChanges();
    flushConfig();

    const shell = TestBed.createComponent(AppShellComponent);
    shell.detectChanges();
    expect(shell.componentInstance.name()).toBe('Ada Lovelace');
    shell.componentInstance.logout();
    httpMock.expectOne('/api/portal/auth/logout').flush({});
  });

  it('sends /groups back to the dashboard', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(GroupsComponent);
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard'], { replaceUrl: true });
  });

  it('loads dashboard groups and falls back when summary fails', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock.expectOne('/api/portal/events/active').flush(event);
    httpMock.expectOne('/api/portal/events/my-history').flush([
      event,
      { ...event, id: 1, name: 'History', isActive: false },
    ]);
    httpMock.expectOne((r) => r.url === '/api/portal/groups').flush([group]);
    httpMock.expectOne('/api/portal/groups/9/registration-summary').flush('nope', { status: 500, statusText: 'Error' });
    expect(component.groups().length).toBe(1);
    expect(component.completenessFor(9)).toBeDefined();
    expect(component.isViewingActiveEvent()).toBeTrue();

    const click = new Event('click');
    spyOn(click, 'stopPropagation');
    component.navigateToReview(click, 9);
    component.navigateToGroup(9);
    expect(click.stopPropagation).toHaveBeenCalled();

    component.onEventChange(1);
    httpMock.expectOne((r) => r.url === '/api/portal/groups').flush([]);
    expect(component.groups()).toEqual([]);
    expect(component.isViewingActiveEvent()).toBeFalse();
  });

  it('shows a dashboard error when the active event cannot be loaded', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/portal/events/active').flush('nope', { status: 500, statusText: 'Error' });
    expect(fixture.componentInstance.error()).toContain('Could not load');
  });

  it('shows a dashboard error when groups cannot be loaded and history fails quietly', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/portal/events/active').flush(event);
    httpMock.expectOne('/api/portal/events/my-history').flush('nope', { status: 500, statusText: 'Error' });
    httpMock.expectOne((r) => r.url === '/api/portal/groups').flush('nope', { status: 500, statusText: 'Error' });
    expect(fixture.componentInstance.groups()).toEqual([]);
    expect(fixture.componentInstance.loadingEvents()).toBeFalse();
  });

  it('creates a group from a selected parish and reports validation and server errors', () => {
    const fixture = TestBed.createComponent(CreateGroupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock.expectOne('/api/parishes').flush([
      { id: 1, name: 'Annunciation', location: 'City' },
      { id: 2, name: 'Other', location: null },
    ]);
    flushConfig();

    component.submit();
    expect(component.error()).toBe('');

    component.form.patchValue({ name: 'New Group', groupType: 'Dance', parishId: 0, parishSearch: 'ann' });
    component.submit();
    expect(component.error()).toContain('select a parish');

    const parish = component.parishes()[0];
    expect(component.displayParish(null)).toBe('');
    expect(component.displayParish('typed')).toBe('typed');
    expect(component.displayParish(parish)).toContain('Annunciation');
    expect(component.displayParish(component.parishes()[1])).toBe('Other');
    component.onParishSelected(parish);
    component.submit();
    httpMock.expectOne('/api/portal/groups').flush({ id: 15, message: 'ok' });

    component.form.patchValue({ name: 'Again' });
    component.submit();
    httpMock.expectOne('/api/portal/groups').flush({ error: 'Taken' }, { status: 409, statusText: 'Conflict' });
    expect(component.error()).toBe('Taken');

    component.loading.set(true);
    component.submit();
    httpMock.expectNone('/api/portal/groups');
  });

  it('edits a profile, autosaves, and discards on cancel', fakeAsync(() => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock.expectOne('/api/portal/auth/me').flush(profile);
    fixture.detectChanges();
    expect(component.profile()?.email).toBe('ada@e2e.test');

    component.startEdit();
    component.form.controls['phoneNumber'].setValue('999');
    tick(800);
    const save = httpMock.expectOne({ method: 'PUT', url: '/api/portal/auth/me' });
    expect(save.request.body.phoneNumber).toBe('999');
    save.flush({ message: 'ok' });
    httpMock.expectOne('/api/portal/auth/me').flush({ ...profile, phoneNumber: '999' });
    expect(component.saved()).toBeTrue();
    expect(TestBed.inject(AuthService).currentName()).toBe('Ada Lovelace');

    component.form.controls['firstName'].setValue('');
    tick(800);
    httpMock.expectNone({ method: 'PUT', url: '/api/portal/auth/me' });

    component.form.controls['firstName'].setValue('Grace');
    tick(800);
    httpMock.expectOne({ method: 'PUT', url: '/api/portal/auth/me' }).flush(
      { error: 'nope' },
      { status: 400, statusText: 'Bad Request' }
    );
    expect(component.saveError()).toContain('nope');

    const unsaved = TestBed.inject(UnsavedChangesService);
    const leave = spyOn(unsaved, 'confirmLeave');
    leave.and.resolveTo(false);
    void component.cancelEdit();
    leave.and.resolveTo(true);
    void component.cancelEdit();
    tick();
  }));

  it('shows a profile load error', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/portal/auth/me').flush('nope', { status: 500, statusText: 'Error' });
    expect(fixture.componentInstance.error()).toContain('Could not load profile');
  });
});
