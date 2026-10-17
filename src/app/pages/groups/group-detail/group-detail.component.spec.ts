import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { GroupDetailComponent } from './group-detail.component';
import { UnsavedChangesService } from '../../../shared/unsaved-changes';
import { PortalGroup } from '../../../services/group.service';
import { Parish } from '../../../services/parish.service';
import { GroupDirector } from '../../../services/director.service';
import { RegistrationSummary } from '../../../services/registration-summary.service';

const routeState = { id: '1', edit: '' };

const group: PortalGroup = {
  id: 1,
  name: 'Alpha',
  groupType: 'Dance',
  parish: { id: 2, name: 'Athens', location: 'GR' },
  event: { id: 3, name: 'FDF', isActive: true },
  primaryDirector: { name: 'Ada', email: 'ada@e2e.test' },
  isReadOnly: false,
  rosterMemberCount: 2,
  rosterSubmittedAt: null,
};

const parishes: Parish[] = [
  { id: 2, name: 'Athens', location: 'GR' },
  { id: 4, name: 'Boston', location: null },
];

const directors: GroupDirector[] = [
  { id: 1, first_name: 'Ada', last_name: 'Lovelace', email: 'ada@e2e.test', cell_phone: null, is_primary: 1, display_order: 1, is_legacy: 0 },
  { id: 2, first_name: 'Bea', last_name: 'Code', email: null, cell_phone: null, is_primary: 0, display_order: 2, is_legacy: 0 },
];

const summary: RegistrationSummary = {
  group: {
    id: 1, name: 'Alpha', groupType: 'Dance', eventName: 'FDF', eventTimezone: 'UTC',
    isActive: true, isArchived: false, parish: { name: 'Athens', location: 'GR' },
  },
  directors: { primaryDirector: { name: 'Ada', email: 'ada@e2e.test' }, coDirectorCount: 1 },
  roster: {
    memberCount: 2, minorCount: 0, requiredChaperones: 0, providedChaperones: 0,
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

describe('GroupDetailComponent', () => {
  let httpMock: HttpTestingController;
  let dialog: MatDialog;
  let snack: MatSnackBar;
  let allowLeave: boolean;

  beforeEach(() => {
    routeState.id = '1';
    routeState.edit = '';
    allowLeave = true;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useFactory: () => ({
          snapshot: {
            paramMap: convertToParamMap(routeState.id ? { id: routeState.id } : {}),
            queryParamMap: convertToParamMap(routeState.edit ? { edit: routeState.edit } : {}),
          },
        }) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    spyOn(TestBed.inject(UnsavedChangesService), 'confirmLeave').and.callFake(
      async (hasUnsaved: () => boolean, discard: () => void) => {
        if (!allowLeave) return false;
        if (hasUnsaved()) discard();
        return true;
      },
    );
  });

  afterEach(() => {
    httpMock.match('/api/portal/auth/public-config').forEach((req) =>
      req.flush({ privacyPolicyUrl: '', requiredConsentVersion: '1.0' }),
    );
    httpMock.verify();
  });

  function create(): GroupDetailComponent {
    const fixture = TestBed.createComponent(GroupDetailComponent);
    dialog = fixture.debugElement.injector.get(MatDialog);
    if (jasmine.isSpy(dialog.open)) {
      (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(undefined) });
    } else {
      spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of(undefined) } as never);
    }
    snack = fixture.debugElement.injector.get(MatSnackBar);
    if (!jasmine.isSpy(snack.open)) spyOn(snack, 'open');
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  function load(portalGroup: PortalGroup = group): GroupDetailComponent {
    const component = create();
    httpMock.expectOne('/api/portal/groups/1').flush(portalGroup);
    httpMock.expectOne('/api/parishes').flush(parishes);
    httpMock.expectOne('/api/portal/groups/1/directors').flush(directors);
    httpMock.expectOne('/api/portal/groups/1/registration-summary').flush(summary);
    return component;
  }

  it('returns to the dashboard when the route has no group id', () => {
    routeState.id = '';
    const component = create();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.primaryCtaRoute()).toEqual([]);
    expect(component.moduleByKey().size).toBe(0);
  });

  it('shows an error when the group cannot be loaded', () => {
    const component = create();
    httpMock.expectOne('/api/portal/groups/1').flush('nope', { status: 404, statusText: 'Not Found' });
    httpMock.expectOne('/api/parishes').flush(parishes);
    expect(component.loading()).toBeFalse();
    expect(component.error()).toBe('Group not found or access denied.');
    httpMock.expectNone('/api/portal/groups/1/directors');
  });

  it('loads the group, directors, and registration status', () => {
    const fixture = TestBed.createComponent(GroupDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.primaryCtaRoute()).toEqual([]);
    httpMock.expectOne('/api/portal/groups/1').flush(group);
    httpMock.expectOne('/api/parishes').flush(parishes);
    httpMock.expectOne('/api/portal/groups/1/directors').flush(directors);
    httpMock.expectOne('/api/portal/groups/1/registration-summary').flush(summary);
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.coDirectors().map((director) => director.id)).toEqual([2]);
    expect(component.primaryDirectorRecord()?.id).toBe(1);
    expect(component.moduleByKey().has('roster')).toBeTrue();
    expect(component.primaryCtaRoute()[0]).toBe('/groups');
    expect(component.displayParish(null)).toBe('');
    expect(component.displayParish('typed')).toBe('typed');
    expect(component.displayParish(parishes[0])).toBe('Athens — GR');
    expect(component.displayParish(parishes[1])).toBe('Boston');
    expect(component.hasUnsavedChanges()).toBeFalse();
  });

  it('falls back when parishes, directors, or the summary fail and supports a group with no parish', () => {
    const component = create();
    httpMock.expectOne('/api/portal/groups/1').flush({ ...group, parish: null });
    httpMock.expectOne('/api/parishes').flush('nope', { status: 500, statusText: 'Error' });
    httpMock.expectOne('/api/portal/groups/1/directors').flush('nope', { status: 500, statusText: 'Error' });
    httpMock.expectOne('/api/portal/groups/1/registration-summary').flush('nope', { status: 500, statusText: 'Error' });
    expect(component.parishes()).toEqual([]);
    expect(component.directors()).toEqual([]);
    expect(component.directorsLoading()).toBeFalse();
    expect(component.primaryDirectorRecord()).toBeNull();
    expect(component.completeness()).not.toBeNull();
    expect(component.form.value.parishId).toBeNull();
  });

  it('filters parishes, selects one, and autosaves a valid edit', fakeAsync(() => {
    const component = load();
    const seen: string[][] = [];
    component.filteredParishes$.subscribe((rows) => seen.push(rows.map((row) => row.name)));
    component.form.get('parishSearch')!.setValue('bos');
    expect(seen.at(-1)).toEqual(['Boston']);
    component.form.get('parishSearch')!.setValue({ id: 2, name: 'Athens', location: null });
    expect(seen.at(-1)).toEqual(['Athens']);

    component.startEdit();
    component.onParishSelected(parishes[1]);
    expect(component.form.value.parishId).toBe(4);
    component.form.patchValue({ name: ' Beta ' });
    expect(component.hasUnsavedChanges()).toBeTrue();
    tick(800);
    const update = httpMock.expectOne((req) => req.method === 'PUT' && req.url === '/api/portal/groups/1');
    expect(update.request.body).toEqual({ name: 'Beta', parishId: 4, groupType: 'Dance' });
    update.flush({ message: 'ok' });
    httpMock.expectOne((req) => req.method === 'GET' && req.url === '/api/portal/groups/1')
      .flush({ ...group, name: 'Beta', parish: { id: 4, name: 'Boston', location: null } });
    expect(component.saving()).toBeFalse();
    expect(component.saved()).toBeTrue();
    expect(component.group()?.name).toBe('Beta');
  }));

  it('keeps the form dirty when saving fails and when leaving is declined', fakeAsync(() => {
    const component = load();
    component.startEdit();
    component.form.patchValue({ name: 'Gamma' });
    tick(800);
    httpMock.expectOne((req) => req.method === 'PUT').flush({ error: 'Taken' }, { status: 400, statusText: 'Bad Request' });
    expect(component.saveError()).toBe('Taken');
    expect(component.saving()).toBeFalse();

    component.form.patchValue({ name: 'Delta' });
    tick(800);
    httpMock.expectOne((req) => req.method === 'PUT').flush('nope', { status: 500, statusText: 'Error' });
    expect(component.saveError()).toBe('Could not save changes.');

    allowLeave = false;
    component.cancelEdit();
    flushMicrotasks();
    expect(component.editMode()).toBeTrue();
    component.discardUnsavedChanges();
    expect(component.form.value.name).toBe('Alpha');

    allowLeave = true;
    component.form.patchValue({ name: 'Epsilon' });
    component.cancelEdit();
    flushMicrotasks();
    expect(component.editMode()).toBeFalse();
    component.ngOnDestroy();
  }));

  it('saves from the explicit save action, including a requested edit', () => {
    routeState.edit = '1';
    const component = load();
    expect(component.editMode()).toBeTrue();

    component.form.patchValue({ name: '' });
    component.saveEdit();
    expect(component.form.controls['name'].touched).toBeTrue();
    httpMock.expectNone((req) => req.method === 'PUT');

    component.form.patchValue({ name: ' Saved ' });
    component.saveEdit();
    const update = httpMock.expectOne((req) => req.method === 'PUT' && req.url === '/api/portal/groups/1');
    expect(update.request.body.name).toBe('Saved');
    update.flush({ message: 'ok' });
    httpMock.expectOne((req) => req.method === 'GET' && req.url === '/api/portal/groups/1')
      .flush({ ...group, name: 'Saved' });
    httpMock.expectOne('/api/portal/groups/1/registration-summary').flush(summary);
    expect(component.editMode()).toBeFalse();
    expect(component.saved()).toBeTrue();
    expect(snack.open).toHaveBeenCalled();

    component.startEdit();
    component.form.patchValue({ name: 'Nope' });
    component.saveEdit();
    httpMock.expectOne((req) => req.method === 'PUT').flush('nope', { status: 500, statusText: 'Error' });
    expect(component.saveError()).toBe('Could not save changes.');

    component.form.patchValue({ name: 'Taken' });
    component.saveEdit();
    httpMock.expectOne((req) => req.method === 'PUT').flush(
      { error: 'Taken' },
      { status: 400, statusText: 'Bad Request' }
    );
    expect(component.saveError()).toBe('Taken');
  });

  it('adds, updates, and removes co-directors', () => {
    const component = load();
    component.openAddDialog();
    expect(httpMock.match((req) => req.url.includes('co-directors')).length).toBe(0);

    const payload = { first_name: 'Cara', last_name: 'Diaz', email: 'cara@e2e.test', cell_phone: '555' };
    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(payload) });
    component.openAddDialog();
    httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/portal/groups/1/co-directors').flush({ id: 9 });
    httpMock.expectOne('/api/portal/groups/1/directors').flush(directors);

    component.openAddDialog();
    httpMock.expectOne((req) => req.method === 'POST').flush({ error: 'Exists' }, { status: 400, statusText: 'Bad Request' });
    expect(snack.open).toHaveBeenCalledWith('Exists', 'Close', jasmine.any(Object));
    component.openAddDialog();
    httpMock.expectOne((req) => req.method === 'POST').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not add co-director.', 'Close', jasmine.any(Object));

    component.openEditDialog(directors[1]);
    httpMock.expectOne((req) => req.method === 'PUT' && req.url.includes('/co-directors/2')).flush({ message: 'ok' });
    httpMock.expectOne('/api/portal/groups/1/directors').flush(directors);
    component.openEditDialog(directors[1]);
    httpMock.expectOne((req) => req.method === 'PUT').flush({ error: 'Invalid' }, { status: 400, statusText: 'Bad Request' });
    component.openEditDialog(directors[1]);
    httpMock.expectOne((req) => req.method === 'PUT').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not update co-director.', 'Close', jasmine.any(Object));

    spyOn(window, 'confirm').and.returnValue(false);
    component.confirmRemove(directors[1]);
    (window.confirm as jasmine.Spy).and.returnValue(true);
    component.confirmRemove({ ...directors[1], first_name: null, last_name: null });
    httpMock.expectOne((req) => req.method === 'DELETE' && req.url.includes('/co-directors/2')).flush({ message: 'ok' });
    httpMock.expectOne('/api/portal/groups/1/directors').flush([directors[0]]);
    component.confirmRemove(directors[1]);
    httpMock.expectOne((req) => req.method === 'DELETE').flush({ error: 'Primary' }, { status: 400, statusText: 'Bad Request' });
    component.confirmRemove(directors[1]);
    httpMock.expectOne((req) => req.method === 'DELETE').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not remove co-director.', 'Close', jasmine.any(Object));
  });
});
