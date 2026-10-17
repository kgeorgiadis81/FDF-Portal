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
import { RegistrationSummary } from '../services/registration-summary.service';
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
const registrationSummary: RegistrationSummary = {
  group: {
    id: 9, name: 'Alpha', groupType: 'Dance', eventName: 'Active Event', eventTimezone: 'UTC',
    isActive: true, isArchived: false, parish: { name: 'Parish', location: 'City' },
  },
  directors: { primaryDirector: { name: 'Ada', email: 'ada@e2e.test' }, coDirectorCount: 0 },
  roster: {
    memberCount: 0, minorCount: 0, requiredChaperones: 0, providedChaperones: 0,
    chaperoneRequirementSatisfied: true, submittedAt: null,
    deadline: { deadlineDate: '2026-06-15', effectiveCutoff: null, canEdit: true },
  },
  performance: {
    submissionType: 'DANCE_PERFORMANCE', semiFinalCount: 0, finalCount: 0, submittedAt: null,
    deadline: { deadlineDate: '2026-06-15', effectiveCutoff: null, canEdit: true },
  },
  costume: {
    semiFinalComplete: false, finalComplete: false, submittedAt: null,
    deadline: { deadlineDate: '2026-06-15', effectiveCutoff: null, canEdit: true },
  },
  documents: {
    signedRoster: { status: 'NOT_UPLOADED', submittedAt: null },
    youthSafety: { status: 'NOT_UPLOADED', submittedAt: null },
  },
  conflicts: { directorConflicts: 0, dancerConflicts: 0, musicianConflicts: 0, costumeConflicts: 0 },
  actionRequired: [],
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
    expect(component.selectedEvent()?.id).toBe(2);
    httpMock.expectOne('/api/portal/events/my-history').flush([
      event,
      { ...event, id: 1, name: 'History', isActive: false },
    ]);
    expect(component.selectedEvent()?.name).toBe('Active Event');
    component.selectedEventId.set(99);
    expect(component.selectedEvent()?.id).toBe(2);
    component.selectedEventId.set(2);
    httpMock.expectOne((r) => r.url === '/api/portal/groups').flush([
      group,
      { ...group, id: 10, name: 'Beta' },
    ]);
    const summaries = httpMock.match((r) => r.url.includes('/registration-summary'));
    summaries.find((req) => req.request.url.endsWith('/9/registration-summary'))
      ?.flush(registrationSummary);
    summaries.find((req) => req.request.url.endsWith('/10/registration-summary'))
      ?.flush('nope', { status: 500, statusText: 'Error' });
    expect(component.groups().length).toBe(2);
    expect(component.completenessFor(9)).toBeDefined();
    expect(component.completenessFor(10)).toBeDefined();
    expect(component.primaryCtaRoute(9).length).toBeGreaterThan(0);
    expect(component.primaryCtaRoute(404)).toEqual(['/groups', 404]);
    expect(component.isViewingActiveEvent()).toBeTrue();

    fixture.detectChanges();
    const reviewLink: HTMLAnchorElement | null = fixture.nativeElement.querySelector('a.review-btn');
    expect(reviewLink?.getAttribute('href')).toBe('/groups/9/review');
    expect(reviewLink?.getAttribute('aria-label')).toBe('Review registration for Alpha');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    spyOn(click, 'stopPropagation').and.callThrough();
    reviewLink?.addEventListener('click', (event) => event.preventDefault(), true);
    reviewLink?.dispatchEvent(click);
    expect(click.stopPropagation).toHaveBeenCalled();

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    component.navigateToGroup(9);
    expect(router.navigate).toHaveBeenCalledWith(['/groups', 9]);

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
    component.form.controls['phoneNumber'].setValue('5551234567');
    tick(800);
    const save = httpMock.expectOne({ method: 'PUT', url: '/api/portal/auth/me' });
    expect(save.request.body.phoneNumber).toBe('5551234567');
    save.flush({ message: 'ok' });
    httpMock.expectOne('/api/portal/auth/me').flush({ ...profile, phoneNumber: '5551234567' });
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
    expect(component.hasUnsavedChanges()).toBeTrue();

    component.saveProfile();
    const manual = httpMock.expectOne({ method: 'PUT', url: '/api/portal/auth/me' });
    expect(manual.request.body.firstName).toBe('Grace');
    manual.flush({ message: 'ok' });
    httpMock.expectOne('/api/portal/auth/me').flush({ ...profile, firstName: 'Grace', phoneNumber: '5551234567' });
    expect(component.editMode()).toBeFalse();
    expect(component.saved()).toBeTrue();

    component.startEdit();
    component.form.controls['phoneNumber'].setValue('not-a-phone');
    component.saveProfile();
    expect(component.form.invalid).toBeTrue();
    httpMock.expectNone({ method: 'PUT', url: '/api/portal/auth/me' });

    component.form.controls['phoneNumber'].setValue('5551234567');
    component.saveProfile();
    httpMock.expectOne({ method: 'PUT', url: '/api/portal/auth/me' }).flush(
      'nope',
      { status: 500, statusText: 'Error' }
    );
    expect(component.saveError()).toContain('Could not save changes.');
    component.discardUnsavedChanges();

    const unsaved = TestBed.inject(UnsavedChangesService);
    const leave = spyOn(unsaved, 'confirmLeave');
    leave.and.callFake((hasUnsaved: () => boolean, discard: () => void) => {
      if (hasUnsaved()) {
        discard();
        return Promise.resolve(false);
      }
      return Promise.resolve(true);
    });
    component.form.controls['firstName'].setValue('Changed');
    void component.cancelEdit();
    tick();
    expect(component.editMode()).toBeTrue();
    void component.cancelEdit();
    tick();
    expect(component.editMode()).toBeFalse();
  }));

  it('shows a profile load error', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/portal/auth/me').flush('nope', { status: 500, statusText: 'Error' });
    expect(fixture.componentInstance.error()).toContain('Could not load profile');
  });
});
