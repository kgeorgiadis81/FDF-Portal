import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { RosterComponent } from './roster.component';
import { Chaperone, RosterContext, RosterMember, RosterSummary } from '../../../services/roster.service';

const routeState = { parentId: '1' as string | null };

const summary: RosterSummary = {
  member_count: 2,
  minor_count: 1,
  required_chaperones: 1,
  provided_chaperones: 1,
  chaperone_requirement_satisfied: true,
};

const context: RosterContext = {
  group: {
    id: 1, groupType: 'Dance', eventId: 2, eventName: 'FDF',
    isActive: true, isArchived: false, eventTimezone: 'UTC',
  },
  deadline: { deadline_date: '2026-06-15', effective_cutoff: '2026-06-15T18:30:00.000Z', can_edit: true },
  summary,
  submission: { submitted_at: '2026-06-01T15:00:00.000Z' },
};

const member: RosterMember = {
  id: 7, group_id: 1, first_name: 'Nina', last_name: 'Sole',
  date_of_birth: '2010-04-01', age_at_fdf: 16, member_order: 2,
};

const chaperone: Chaperone = {
  id: 6, group_id: 1, first_name: 'Mina', last_name: 'Park',
  phone: '555', is_21_or_older_confirmed: 1,
};

describe('RosterComponent', () => {
  let httpMock: HttpTestingController;
  let dialog: MatDialog;
  let snack: MatSnackBar;

  beforeEach(() => {
    routeState.parentId = '1';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useFactory: () => ({
          snapshot: {
            paramMap: convertToParamMap({ id: '1' }),
            queryParamMap: convertToParamMap({}),
            parent: routeState.parentId == null
              ? null
              : { paramMap: convertToParamMap({ id: routeState.parentId }) },
          },
        }) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    httpMock.match('/api/portal/auth/public-config').forEach((req) =>
      req.flush({ privacyPolicyUrl: '', requiredConsentVersion: '1.0' }),
    );
    httpMock.verify();
  });

  function create(): RosterComponent {
    const fixture = TestBed.createComponent(RosterComponent);
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

  function flushStatus(urlPart: string, status: number): void {
    const pending = httpMock.match((req) => req.url.startsWith('/api/'));
    const failed = pending.find((req) => req.request.url.includes(urlPart));
    if (!failed) throw new Error(`No request matching ${urlPart}`);
    failed.flush({}, { status, statusText: 'Error' });
    pending.forEach((req) => {
      if (req !== failed && !req.cancelled) {
        req.flush(req.request.url.endsWith('/roster') ? { members: [], summary: null } : []);
      }
    });
  }

  function load(ctx: RosterContext = context, chaps: Chaperone[] = [chaperone]): RosterComponent {
    const component = create();
    httpMock.expectOne('/api/portal/groups/1/roster-context').flush(ctx);
    httpMock.expectOne('/api/groups/1/roster').flush({ members: [member], summary });
    httpMock.expectOne('/api/groups/1/chaperones').flush(chaps);
    return component;
  }

  it('returns to the dashboard without a group id', () => {
    routeState.parentId = null;
    const component = create();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.submissionValidation).toBeNull();
    component.confirmSubmitRoster();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('loads the roster and formats dates', () => {
    const fixture = TestBed.createComponent(RosterComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    httpMock.expectOne('/api/portal/groups/1/roster-context').flush(context);
    httpMock.expectOne('/api/groups/1/roster').flush({ members: [member], summary });
    httpMock.expectOne('/api/groups/1/chaperones').flush([chaperone]);
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.members().length).toBe(1);
    expect(component.canEdit()).toBeTrue();
    expect(component.isReadOnly()).toBeFalse();
    expect(component.isActiveEvent()).toBeTrue();
    expect(component.submissionValidation?.canSubmit).toBeTrue();
    expect(component.chaperoneIsConfirmed(chaperone)).toBeTrue();
    expect(component.chaperoneIsConfirmed({ ...chaperone, is_21_or_older_confirmed: 0 })).toBeFalse();
    expect(component.formatDate(null)).toBe('—');
    expect(component.formatDate('2026-06-01T15:00:00.000Z')).toContain('2026');
    expect(component.formatDeadlineDate(null)).toBe('No deadline set yet');
    expect(component.formatDeadlineDate('2026-06-15')).toContain('Jun');
    expect(component.formatDeadlineDate('2026-06-15')).toContain('2026');
    expect(component.formatEffectiveCutoff(null)).toBe('—');
    expect(component.formatEffectiveCutoff('2026-06-15T18:30:00.000Z')).toContain('2026');
  });

  it('distinguishes a missing group from a generic load error', () => {
    const missing = create();
    flushStatus('roster-context', 404);
    expect(missing.error()).toBe('Group not found or access denied.');

    const failed = create();
    flushStatus('roster-context', 500);
    expect(failed.error()).toBe('Could not load roster. Please try again.');
    expect(failed.loading()).toBeFalse();
  });

  it('blocks submit until participants and confirmed chaperones are present', () => {
    const inactive: RosterContext = {
      ...context,
      group: { ...context.group, isActive: false },
      deadline: { deadline_date: null, effective_cutoff: null, can_edit: false },
      summary: { ...summary, member_count: 0, chaperone_requirement_satisfied: false },
      submission: null,
    };
    const component = load(inactive, [{ ...chaperone, is_21_or_older_confirmed: false }]);
    expect(component.isReadOnly()).toBeTrue();
    expect(component.isActiveEvent()).toBeFalse();
    expect(component.submissionValidation?.canSubmit).toBeFalse();
    component.confirmSubmitRoster();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('adds, edits, and removes participants', () => {
    const component = load();
    const result = { first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '2001-02-03' };
    component.openAddParticipant();
    expect(httpMock.match((req) => req.method === 'POST').length).toBe(0);

    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(result) });
    component.openAddParticipant();
    httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/groups/1/roster').flush({ id: 8 });
    httpMock.expectOne('/api/portal/groups/1/roster-context').flush(context);
    httpMock.expectOne('/api/groups/1/roster').flush({ members: [member], summary });
    expect(snack.open).toHaveBeenCalledWith('Participant added.', 'OK', jasmine.any(Object));

    component.openAddParticipant();
    httpMock.expectOne((req) => req.method === 'POST').flush({ error: 'Duplicate' }, { status: 400, statusText: 'Bad Request' });
    expect(component.saving()).toBeFalse();
    component.openAddParticipant();
    httpMock.expectOne((req) => req.method === 'POST').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not add participant.', 'Dismiss', jasmine.any(Object));

    component.openEditParticipant(member);
    const update = httpMock.expectOne((req) => req.method === 'PUT' && req.url === '/api/groups/1/roster/7');
    expect(update.request.body.member_order).toBe(2);
    update.flush({ message: 'ok' });
    httpMock.expectOne('/api/portal/groups/1/roster-context').flush(context);
    httpMock.expectOne('/api/groups/1/roster').flush({ members: [member], summary });
    component.openEditParticipant(member);
    httpMock.expectOne((req) => req.method === 'PUT').flush({ error: 'Invalid' }, { status: 400, statusText: 'Bad Request' });
    component.openEditParticipant(member);
    httpMock.expectOne((req) => req.method === 'PUT').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not update participant.', 'Dismiss', jasmine.any(Object));

    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(false) });
    component.confirmDeleteParticipant(member);
    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(true) });
    component.confirmDeleteParticipant(member);
    httpMock.expectOne((req) => req.method === 'DELETE' && req.url === '/api/groups/1/roster/7').flush({ message: 'ok' });
    httpMock.expectOne('/api/portal/groups/1/roster-context').flush(context);
    httpMock.expectOne('/api/groups/1/roster').flush({ members: [], summary });
    component.confirmDeleteParticipant(member);
    httpMock.expectOne((req) => req.method === 'DELETE').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not remove participant.', 'Dismiss', jasmine.any(Object));
    expect(component.saving()).toBeFalse();
  });

  it('adds, edits, and removes chaperones', () => {
    const component = load();
    const result = { first_name: 'Cara', last_name: 'Diaz', phone: null, is_21_or_older_confirmed: true };
    component.openAddChaperone();
    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(result) });
    component.openAddChaperone();
    httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/groups/1/chaperones').flush({ id: 9 });
    httpMock.expectOne('/api/portal/groups/1/roster-context').flush(context);
    httpMock.expectOne('/api/groups/1/chaperones').flush([chaperone]);

    component.openAddChaperone();
    httpMock.expectOne((req) => req.method === 'POST').flush({ error: 'Limit' }, { status: 400, statusText: 'Bad Request' });
    component.openAddChaperone();
    httpMock.expectOne((req) => req.method === 'POST').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not add chaperone.', 'Dismiss', jasmine.any(Object));

    component.openEditChaperone(chaperone);
    httpMock.expectOne((req) => req.method === 'PUT' && req.url === '/api/groups/1/chaperones/6').flush({ message: 'ok' });
    httpMock.expectOne('/api/portal/groups/1/roster-context').flush(context);
    httpMock.expectOne('/api/groups/1/chaperones').flush([chaperone]);
    component.openEditChaperone(chaperone);
    httpMock.expectOne((req) => req.method === 'PUT').flush({ error: 'Invalid' }, { status: 400, statusText: 'Bad Request' });
    component.openEditChaperone(chaperone);
    httpMock.expectOne((req) => req.method === 'PUT').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not update chaperone.', 'Dismiss', jasmine.any(Object));

    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(false) });
    component.confirmDeleteChaperone(chaperone);
    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(true) });
    component.confirmDeleteChaperone(chaperone);
    httpMock.expectOne((req) => req.method === 'DELETE' && req.url === '/api/groups/1/chaperones/6').flush({ message: 'ok' });
    httpMock.expectOne('/api/portal/groups/1/roster-context').flush(context);
    httpMock.expectOne('/api/groups/1/chaperones').flush([]);
    component.confirmDeleteChaperone(chaperone);
    httpMock.expectOne((req) => req.method === 'DELETE').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not remove chaperone.', 'Dismiss', jasmine.any(Object));
  });

  it('submits the roster and reports a failed submission', () => {
    const component = load();
    const validation = component.submissionValidation!;
    expect(validation.participantCount).toBe(2);
    expect(validation.unconfirmedCount).toBe(0);

    component.confirmSubmitRoster();
    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(true) });
    component.confirmSubmitRoster();
    const submitted = httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/groups/1/submissions');
    expect(submitted.request.body).toEqual({ submission_type: 'ROSTER' });
    submitted.flush({ message: 'ok', submission_type: 'ROSTER' });
    httpMock.expectOne('/api/portal/groups/1/roster-context').flush(context);
    httpMock.expectOne('/api/groups/1/chaperones').flush([chaperone]);
    expect(component.submitting()).toBeFalse();
    expect(snack.open).toHaveBeenCalledWith('Roster submitted.', 'OK', jasmine.any(Object));

    component.confirmSubmitRoster();
    httpMock.expectOne((req) => req.method === 'POST' && req.url.endsWith('/submissions'))
      .flush({ error: 'Closed' }, { status: 400, statusText: 'Bad Request' });
    component.confirmSubmitRoster();
    httpMock.expectOne((req) => req.method === 'POST' && req.url.endsWith('/submissions'))
      .flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not submit roster.', 'Dismiss', jasmine.any(Object));
    expect(component.submitting()).toBeFalse();
  });
});
