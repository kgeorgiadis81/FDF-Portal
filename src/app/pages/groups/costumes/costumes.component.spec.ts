import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { CostumesComponent } from './costumes.component';
import { UnsavedChangesService } from '../../../shared/unsaved-changes';
import {
  CostumeContext, CostumeResourceType, ManualCostumeConflict, PerformanceCostume, RelatedGroupOption,
} from '../../../services/costume.service';

const routeState = { id: '1', parentId: '1' as string | null };

function routeSnapshot() {
  return {
    snapshot: {
      paramMap: convertToParamMap(routeState.id ? { id: routeState.id } : {}),
      queryParamMap: convertToParamMap({}),
      parent: routeState.parentId == null
        ? null
        : { paramMap: convertToParamMap({ id: routeState.parentId }) },
    },
  };
}

const context: CostumeContext = {
  group: {
    id: 1, groupType: 'Dance', eventId: 2, eventName: 'FDF',
    isActive: true, isArchived: false, eventTimezone: 'UTC',
  },
  performances: [
    { id: 10, round: 'Semi-Final', type: 'Dance' },
    { id: 11, round: 'Final', type: 'Dance' },
  ],
  deadline: { deadline_date: '2026-06-15', effective_cutoff: '2026-06-15T18:30:00.000Z', can_edit: true },
  submission: { submitted_at: '2026-06-01T12:00:00.000Z' },
};

const resourceTypes: CostumeResourceType[] = [
  { id: 3, code: 'HAND', label: 'Handmade', display_order: 1 },
];

const costume: PerformanceCostume = {
  id: 8,
  performance_id: 10,
  gender: 'MEN',
  region: 'Crete',
  village: 'Anogia',
  resource_type_id: 3,
  has_won_award: 1,
  purchased_most_or_all: 0,
  purchased_any_parts: 1,
};

const conflict: ManualCostumeConflict = {
  id: 4,
  group_id: 1,
  round: 'Semi-Final',
  related_group_id: 9,
  costume_count: 2,
  related_group_name: 'Beta',
  related_parish_name: 'Athens',
};

const related: RelatedGroupOption = {
  id: 9, name: 'Beta', parish_name: 'Athens', parish_location: 'GR', display_label: 'Beta — Athens',
};

describe('CostumesComponent', () => {
  let httpMock: HttpTestingController;
  let snack: MatSnackBar;
  let dialog: MatDialog;
  let allowLeave: boolean;

  beforeEach(() => {
    routeState.id = '1';
    routeState.parentId = '1';
    allowLeave = true;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useFactory: () => routeSnapshot() },
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

  function create(): CostumesComponent {
    const fixture = TestBed.createComponent(CostumesComponent);
    dialog = fixture.debugElement.injector.get(MatDialog);
    if (jasmine.isSpy(dialog.open)) {
      (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(undefined) });
    } else {
      spyOn(dialog, 'open').and.returnValue({ afterClosed: () => of(undefined) } as never);
    }
    snack = fixture.debugElement.injector.get(MatSnackBar);
    if (!jasmine.isSpy(snack.open)) spyOn(snack, 'open');
    fixture.detectChanges();
    TestBed.flushEffects();
    return fixture.componentInstance;
  }

  function flushStatus(urlPart: string, status: number, body: object = {}): void {
    const pending = httpMock.match((req) => req.url.includes('/groups/'));
    const failed = pending.find((req) => req.request.url.includes(urlPart));
    if (!failed) {
      throw new Error(`No request matching ${urlPart}`);
    }
    failed.flush(body, { status, statusText: 'Error' });
    pending.forEach((req) => {
      if (req !== failed && !req.cancelled) req.flush([]);
    });
  }

  function load(componentContext: CostumeContext = context, costumes: PerformanceCostume[] = [costume]): CostumesComponent {
    const component = create();
    httpMock.expectOne('/api/portal/groups/1/costume-context').flush(componentContext);
    httpMock.expectOne('/api/groups/1/costume-resource-types').flush(resourceTypes);
    httpMock.expectOne('/api/groups/1/costume-conflicts').flush([conflict]);
    for (const performance of componentContext.performances) {
      httpMock.expectOne(`/api/groups/1/performances/${performance.id}/costumes`)
        .flush(performance.id === 10 ? costumes : []);
    }
    tick(250);
    httpMock.expectOne('/api/portal/groups/1/related-groups').flush([related]);
    return component;
  }

  function validCostumeValue() {
    return {
      region: 'Epirus',
      village: 'Ioannina',
      resource_type_id: 3,
      has_won_award: false,
      purchased_most_or_all: true,
      purchased_any_parts: false,
    };
  }

  it('sends an unknown group back to the dashboard', fakeAsync(() => {
    routeState.parentId = null;
    const component = create();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.loading()).toBeTrue();
    tick(250);
  }));

  it('loads costumes, conflicts, and related groups', fakeAsync(() => {
    const component = load();
    expect(component.loading()).toBeFalse();
    expect(component.canEdit()).toBeTrue();
    expect(component.isReadOnly()).toBeFalse();
    expect(component.isActiveEvent()).toBeTrue();
    expect(component.getCostume(10, 'MEN')?.id).toBe(8);
    expect(component.getCostume(10, 'WOMEN')).toBeNull();
    expect(component.roundConflicts().length).toBe(1);
    expect(component.genderSections().map((section) => section.gender)).toEqual(['MEN', 'WOMEN']);
    expect(component.getResourceLabel(3)).toBe('Handmade');
    expect(component.getResourceLabel(null)).toBe('—');
    expect(component.getResourceLabel(0)).toBe('—');
    expect(component.getResourceLabel(99)).toBe('—');
    expect(component.formatBool(1)).toBe('Yes');
    expect(component.formatBool(0)).toBe('No');
    expect(component.formatBool(null)).toBe('No');
    expect(component.formatDeadlineDate('2026-06-15')).toContain('2026');
    expect(component.formatDeadlineDate(null)).toBe('');
    expect(component.formatEffectiveCutoff(context.deadline.effective_cutoff)).toContain('2026');
    expect(component.formatEffectiveCutoff(null)).toBe('');
    expect(component.formatDate('2026-06-01T12:00:00.000Z')).toContain('2026');
    expect(component.displayRelatedGroup(null)).toBe('');
    expect(component.displayRelatedGroup(9)).toBe('Beta — Athens');
    expect(component.displayRelatedGroup(4)).toBe('');
    expect(component.hasUnsavedChanges()).toBeFalse();
    component.ngOnDestroy();
  }));

  it('loads an empty performance list and inactive read-only context', fakeAsync(() => {
    const inactive: CostumeContext = {
      ...context,
      performances: [],
      group: { ...context.group, isActive: false, eventTimezone: null },
      deadline: { deadline_date: null, effective_cutoff: null, can_edit: false },
      submission: null,
    };
    const component = load(inactive, []);
    expect(component.selectedPerformance()).toBeNull();
    expect(component.genderSections()).toEqual([]);
    expect(component.roundConflicts()).toEqual([]);
    expect(component.isReadOnly()).toBeTrue();
    expect(component.isActiveEvent()).toBeFalse();
    expect(component.formatEffectiveCutoff('2026-06-15T18:30:00.000Z')).toContain('2026');
    component.startCostumeEdit('MEN');
    expect(component.editingGender()).toBeNull();
  }));

  it('reports context errors and redirects when editing is forbidden', fakeAsync(() => {
    const forbidden = create();
    flushStatus('costume-context', 403);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/groups', 1]);
    tick(250);
    httpMock.expectOne('/api/portal/groups/1/related-groups').flush([]);

    const missing = create();
    flushStatus('costume-context', 404);
    expect(missing.error()).toBe('Group not found or access denied.');
    tick(250);
    httpMock.expectOne('/api/portal/groups/1/related-groups').flush([]);

    const failed = create();
    flushStatus('costume-context', 500);
    expect(failed.error()).toContain('Could not load costume');
    failed.relatedGroupSearch.set('missing');
    tick(250);
    httpMock.expectOne((req) => req.url.includes('related-groups')).flush({}, { status: 500, statusText: 'Error' });
    expect(failed.loadingRelatedGroups()).toBeFalse();
  }));

  it('keeps the round when leaving is declined and switches when it is allowed', fakeAsync(() => {
    const component = load();
    component.onRoundChange(0);
    flushMicrotasks();
    expect(TestBed.inject(UnsavedChangesService).confirmLeave).not.toHaveBeenCalled();

    allowLeave = false;
    component.onRoundChange(1);
    flushMicrotasks();
    expect(component.selectedRoundIndex()).toBe(0);

    allowLeave = true;
    component.startCostumeEdit('WOMEN');
    component.startAddConflict();
    httpMock.expectOne('/api/portal/groups/1/related-groups').flush([]);
    component.onRoundChange(1);
    flushMicrotasks();
    expect(component.selectedRoundIndex()).toBe(1);
    expect(component.editingGender()).toBeNull();
    expect(component.addingConflict()).toBeFalse();
    tick(250);
    httpMock.match((req) => req.url.includes('related-groups')).forEach((req) => req.flush([]));
  }));

  it('creates and updates a costume and surfaces save errors', fakeAsync(() => {
    const component = load(context, []);
    component.startCostumeEdit('WOMEN');
    component.costumeForm.setValue(validCostumeValue());
    tick(800);
    const created = httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/groups/1/performances/10/costumes');
    expect(created.request.body.gender).toBe('WOMEN');
    created.flush({ id: 15 });
    httpMock.expectOne((req) => req.method === 'GET' && req.url === '/api/groups/1/performances/10/costumes')
      .flush([{ ...costume, id: 15, gender: 'WOMEN' }, costume]);
    expect(component.editingGender()).toBeNull();
    expect(component.savingGender()).toBeNull();

    component.startCostumeEdit('MEN');
    component.costumeForm.setValue(validCostumeValue());
    tick(800);
    const updated = httpMock.expectOne((req) => req.method === 'PUT' && req.url.includes('/costumes/8'));
    updated.flush({ error: 'Duplicate' }, { status: 400, statusText: 'Bad Request' });
    expect(snack.open).toHaveBeenCalledWith('Duplicate', 'Close', jasmine.objectContaining({ duration: 5000 }));
    expect(component.savingGender()).toBeNull();

    component.costumeForm.setValue({ ...validCostumeValue(), region: 'Thrace' });
    tick(800);
    httpMock.expectOne((req) => req.method === 'PUT').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith(
      'Could not save costume information.', 'Close', jasmine.objectContaining({ duration: 5000 }),
    );
  }));

  it('discards costume edits and honors a declined cancel', fakeAsync(() => {
    const component = load();
    component.startCostumeEdit('MEN');
    component.costumeForm.setValue(validCostumeValue());
    allowLeave = false;
    component.cancelCostumeEdit();
    flushMicrotasks();
    expect(component.editingGender()).toBe('MEN');
    component.discardUnsavedChanges();
    expect(component.editingGender()).toBeNull();
    expect(component.hasUnsavedChanges()).toBeFalse();

    component.startCostumeEdit('MEN');
    component.cancelCostumeEdit(false);
    expect(component.editingGender()).toBeNull();
  }));

  it('adds, updates, and deletes costume conflicts', fakeAsync(() => {
    const component = load();
    component.startEditConflict({ ...conflict, related_group_name: undefined, related_parish_name: null });
    expect(component.relatedGroupSearch()).toBe('');
    component.startEditConflict(conflict);
    expect(component.relatedGroupSearch()).toContain('Beta');
    component.conflictForm.setValue({ related_group_id: 9, costume_count: 3 });
    tick(800);
    const updated = httpMock.expectOne((req) => req.method === 'PUT' && req.url.includes('/costume-conflicts/4'));
    expect(updated.request.body).toEqual({ round: 'Semi-Final', related_group_id: 9, costume_count: 3 });
    updated.flush({ message: 'ok' });
    httpMock.expectOne('/api/groups/1/costume-conflicts').flush([]);
    expect(component.editingConflictId()).toBeNull();
    expect(component.savingConflict()).toBeFalse();

    component.startAddConflict();
    httpMock.expectOne('/api/portal/groups/1/related-groups').flush([related]);
    component.onRelatedGroupSelected(related);
    component.conflictForm.patchValue({ costume_count: 2 });
    tick(250);
    httpMock.match((req) => req.url.includes('related-groups')).forEach((req) => req.flush([related]));
    tick(800);
    const created = httpMock.expectOne((req) => req.method === 'POST' && req.url.endsWith('/costume-conflicts'));
    created.flush({ error: 'Conflict' }, { status: 400, statusText: 'Bad Request' });
    expect(component.savingConflict()).toBeFalse();
    expect(snack.open).toHaveBeenCalledWith('Conflict', 'Close', jasmine.any(Object));

    component.conflictForm.patchValue({ costume_count: 4 });
    tick(800);
    httpMock.expectOne((req) => req.method === 'POST' && req.url.endsWith('/costume-conflicts'))
      .flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith(
      'Could not save costume conflict.', 'Close', jasmine.objectContaining({ duration: 5000 }),
    );

    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(false) });
    component.confirmDeleteConflict(conflict);
    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(true) });
    component.confirmDeleteConflict(conflict);
    httpMock.expectOne((req) => req.method === 'DELETE' && req.url.includes('/costume-conflicts/4'))
      .flush({ message: 'removed' });
    expect(component.conflicts().some((row) => row.id === 4)).toBeFalse();

    component.conflicts.set([conflict]);
    component.confirmDeleteConflict(conflict);
    httpMock.expectOne((req) => req.method === 'DELETE').flush({ error: 'Locked' }, { status: 400, statusText: 'Bad Request' });
    component.confirmDeleteConflict(conflict);
    httpMock.expectOne((req) => req.method === 'DELETE').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not remove conflict.', 'Close', jasmine.any(Object));
  }));

  it('cancels conflict editing and throws when a save has no performance', fakeAsync(() => {
    const component = load();
    component.startAddConflict();
    httpMock.expectOne('/api/portal/groups/1/related-groups').flush([]);
    component.conflictForm.setValue({ related_group_id: 9, costume_count: 1 });
    allowLeave = false;
    component.cancelConflictEdit();
    flushMicrotasks();
    expect(component.addingConflict()).toBeTrue();
    allowLeave = true;
    component.cancelConflictEdit();
    flushMicrotasks();
    expect(component.addingConflict()).toBeFalse();

    component.startAddConflict();
    httpMock.expectOne('/api/portal/groups/1/related-groups').flush([]);
    component.conflictForm.setValue({ related_group_id: 9, costume_count: 2 });
    component.selectedRoundIndex.set(9);
    expect(() => tick(800)).toThrowError('No performance selected');

    component.selectedRoundIndex.set(0);
    component.startCostumeEdit('MEN');
    component.costumeForm.setValue(validCostumeValue());
    component.selectedRoundIndex.set(9);
    expect(() => tick(800)).toThrowError('No performance selected');
    component.ngOnDestroy();
  }));

  it('submits costumes after confirmation and reports a failed submit', fakeAsync(() => {
    const component = load();
    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(false) });
    component.submitCostumes();
    expect(component.submitting()).toBeFalse();

    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(true) });
    component.submitCostumes();
    httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/groups/1/submissions').flush({ message: 'ok' });
    httpMock.expectOne('/api/portal/groups/1/costume-context').flush(context);
    expect(component.submitting()).toBeFalse();
    expect(snack.open).toHaveBeenCalledWith('Costume information submitted.', 'Close', jasmine.any(Object));

    component.submitCostumes();
    httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/groups/1/submissions')
      .flush({ error: 'Closed' }, { status: 400, statusText: 'Bad Request' });
    expect(component.submitting()).toBeFalse();
    component.submitCostumes();
    httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/groups/1/submissions')
      .flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith(
      'Could not submit costume information.', 'Close', jasmine.any(Object),
    );
  }));
});
