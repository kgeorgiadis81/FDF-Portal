import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { of } from 'rxjs';

import { PerformanceComponent } from './performance.component';
import { UnsavedChangesService } from '../../../shared/unsaved-changes';
import {
  ChoralEntry, DanceEntry, DirectorConflictSummary, InstrumentOption,
  PerformanceContext, PortalPerformance,
} from '../../../services/performance.service';

const routeState = { parentId: '1' as string | null };

const danceContext: PerformanceContext = {
  group: {
    id: 1, groupType: 'Dance', eventId: 2, eventName: 'FDF',
    isActive: true, isArchived: false, eventTimezone: 'UTC',
  },
  submissionType: 'DANCE_PERFORMANCE',
  deadline: { deadline_date: '2026-06-15', effective_cutoff: '2026-06-15T18:30:00.000Z', can_edit: true },
  submission: { submitted_at: '2026-06-01T12:00:00.000Z' },
};

const danceEntry: DanceEntry = {
  id: 3, entry_order: 1, name: 'Pentozali', region: 'Crete', village: null,
  uses_live_music: true, uses_recorded_music: true, is_acapella: true,
  dancers_singing: true, musicians_singing: true, individual_singing: true,
};

const secondDance: DanceEntry = { ...danceEntry, id: 4, entry_order: 2, name: 'Sousta', uses_live_music: false, uses_recorded_music: false, is_acapella: false, dancers_singing: false, musicians_singing: false, individual_singing: false };

function performance(partial: Partial<PortalPerformance> = {}): PortalPerformance {
  return {
    id: 10,
    round: 'Semi-Final',
    type: 'Dance',
    uses_fdf_tables_chairs: false,
    additional_props: '',
    special_requirements: '',
    music_audio_needs: '',
    entries: [danceEntry, secondDance],
    musicians: [{ musician_id: 1, display_order: 0, display_name: 'Nikos' }],
    instruments: [{ id: 50, instrument_id: 7, code: 'LYRA', name_en: 'Lyra', name_el: null, custom_name: null }],
    ...partial,
  };
}

const instruments: InstrumentOption[] = [
  { id: 7, code: 'LYRA', name_en: 'Lyra', name_el: null, display_order: 1 },
  { id: 8, code: 'OTHER', name_en: 'Other', name_el: null, display_order: 2 },
];

const conflicts: DirectorConflictSummary = {
  dancer_conflicts: [{
    type: 'dancer', round: 'Semi-Final', first_name: 'Nina', last_name: 'Sole',
    other_groups: [{ group_name: 'Other', parish_name: null }],
  }],
  musician_conflicts: [{
    type: 'musician', round: 'Semi-Final', musician_name: 'Nikos',
    other_groups: [{ group_name: 'Beta', parish_name: 'Athens' }, { group_name: 'Gamma', parish_name: null }],
  }],
  director_conflicts: [
    { type: 'director_multi_group', round: 'Semi-Final', other_group_names: ['Beta'] },
    { type: 'director_dancing', round: 'Semi-Final' },
    { type: 'director_multi_group', round: 'Semi-Final', other_group_names: [] },
    { type: 'other', round: 'Semi-Final' },
  ],
};

describe('PerformanceComponent', () => {
  let httpMock: HttpTestingController;
  let dialog: MatDialog;
  let snack: MatSnackBar;
  let allowLeave: boolean;

  beforeEach(() => {
    routeState.parentId = '1';
    allowLeave = true;
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

  function create(): PerformanceComponent {
    const fixture = TestBed.createComponent(PerformanceComponent);
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
      if (req !== failed && !req.cancelled) req.flush(req.request.url.includes('performance') ? { performances: [] } : []);
    });
  }

  function load(
    ctx: PerformanceContext = danceContext,
    perfs: PortalPerformance[] = [performance(), performance({ id: 11, round: 'Final', entries: [danceEntry], musicians: [] })],
    conflictBody: DirectorConflictSummary = conflicts,
  ): PerformanceComponent {
    const component = create();
    httpMock.expectOne('/api/portal/groups/1/performance-context').flush(ctx);
    httpMock.expectOne('/api/groups/1/performance').flush({ performances: perfs });
    httpMock.expectOne('/api/instruments').flush(instruments);
    if (perfs.length) {
      httpMock.expectOne((req) => req.url === '/api/groups/1/performance/conflicts').flush(conflictBody);
    }
    return component;
  }

  it('returns to the dashboard without a group id', () => {
    routeState.parentId = null;
    create();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('loads dance performances and describes conflicts and entry flags', () => {
    const fixture = TestBed.createComponent(PerformanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    httpMock.expectOne('/api/portal/groups/1/performance-context').flush(danceContext);
    httpMock.expectOne('/api/groups/1/performance').flush({
      performances: [performance(), performance({ id: 11, round: 'Final', entries: [], musicians: [] })],
    });
    httpMock.expectOne('/api/instruments').flush(instruments);
    httpMock.expectOne((req) => req.url.includes('/performance/conflicts')).flush(conflicts);
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.isDance()).toBeTrue();
    expect(component.canEdit()).toBeTrue();
    expect(component.isReadOnly()).toBeFalse();
    expect(component.conflicts().length).toBe(4);
    expect(component.conflicts()[0]).toContain('Nina Sole');
    expect(component.conflicts()[1]).toContain('Beta, Gamma');
    expect(component.entryFlags(danceEntry)).toEqual([
      'Live Music', 'Recorded Music', 'Acapella', 'Dancers Singing', 'Musicians Singing', 'Individual Singing',
    ]);
    expect(component.entryFlags(secondDance)).toEqual([]);
    expect(component.isInstrumentSelected(component.selectedPerformance()!, instruments[0])).toBeTrue();
    expect(component.isInstrumentSelected(component.selectedPerformance()!, instruments[1])).toBeFalse();
    expect(component.formatDeadlineDate('2026-06-15')).toContain('June');
    expect(component.formatDeadlineDate(null)).toBe('');
    expect(component.formatEffectiveCutoff('2026-06-15T18:30:00.000Z')).toContain('2026');
    expect(component.formatEffectiveCutoff(null)).toBe('');
    expect(component.formatDate('2026-06-01T12:00:00.000Z')).toContain('2026');
    expect(component.hasUnsavedChanges()).toBeFalse();
  });

  it('reports a missing group and a generic load failure', () => {
    const missing = create();
    flushStatus('performance-context', 404);
    expect(missing.error()).toBe('Group not found or access denied.');

    const failed = create();
    flushStatus('performance-context', 500);
    expect(failed.error()).toContain('Could not load performance');
  });

  it('does nothing for an empty performance list', () => {
    const component = load(danceContext, []);
    expect(component.selectedPerformance()).toBeNull();
    component.openEntryDialog();
    component.deleteEntry(danceEntry);
    component.moveEntry(0, 1);
    component.selectMusician({ id: 2, display_name: 'Mia', disambiguation_hint: null });
    component.removeMusician(1);
    component.onEntryDrop({ previousIndex: 0, currentIndex: 1 } as never);
    expect(dialog.open).not.toHaveBeenCalled();
    component.submitPerformance();
    expect(dialog.open).toHaveBeenCalled();
    expect(component.searchMusicians('   ')).toBeUndefined();
    expect(component.musicianSearchResults()).toEqual([]);
  });

  it('switches rounds and saves dance logistics', fakeAsync(() => {
    const component = load();
    component.onRoundChange(0);
    flushMicrotasks();
    expect(TestBed.inject(UnsavedChangesService).confirmLeave).not.toHaveBeenCalled();

    allowLeave = false;
    component.logisticsForm.patchValue({ music_audio_needs: 'Mic' });
    component.onRoundChange(1);
    flushMicrotasks();
    expect(component.selectedRoundIndex()).toBe(0);
    component.discardUnsavedChanges();

    allowLeave = true;
    component.onRoundChange(1);
    flushMicrotasks();
    expect(component.selectedRoundIndex()).toBe(1);
    httpMock.expectOne((req) => req.params.get('round') === 'Final').flush(conflicts);

    component.logisticsForm.patchValue({
      uses_fdf_tables_chairs: true,
      additional_props: 'Bench',
      special_requirements: 'Aisle',
      music_audio_needs: 'Mic',
    });
    tick(800);
    const saved = httpMock.expectOne((req) => req.method === 'PATCH' && req.url.includes('/logistics'));
    expect(saved.request.body.uses_fdf_tables_chairs).toBeTrue();
    saved.flush({});
    httpMock.expectOne('/api/groups/1/performance').flush({
      performances: [performance(), performance({ id: 11, round: 'Final' })],
    });
    expect(component.saving()).toBeFalse();
  }));

  it('saves choral logistics without dance fields and reports save errors', fakeAsync(() => {
    const choral: PerformanceContext = {
      ...danceContext,
      group: { ...danceContext.group, groupType: 'Choral' },
      submissionType: 'CHORAL_PERFORMANCE',
    };
    const song: ChoralEntry = {
      id: 9, entry_order: 1, name: 'Hymn', uses_live_music: true, uses_recorded_music: false,
      choral_classification: 'LITURGICAL',
    };
    const secular: ChoralEntry = { ...song, id: 10, name: 'Folk', choral_classification: 'SECULAR', uses_live_music: false };
    const unset: ChoralEntry = {
      ...song, id: 11, name: 'Open', choral_classification: null, uses_live_music: false,
    };
    const component = load(choral, [performance({ type: 'Choral', entries: [song, secular, unset], musicians: [] })]);
    expect(component.isDance()).toBeFalse();
    expect(component.entryFlags(song)).toEqual(['Live Music', 'Liturgical']);
    expect(component.entryFlags(secular)).toEqual(['Secular']);
    expect(component.entryFlags(unset)).toEqual([]);

    component.logisticsForm.patchValue({ music_audio_needs: 'Piano', special_requirements: '' });
    tick(800);
    const saved = httpMock.expectOne((req) => req.method === 'PATCH' && req.url.includes('/logistics'));
    expect(saved.request.body.uses_fdf_tables_chairs).toBeUndefined();
    expect(saved.request.body.music_audio_needs).toBe('Piano');
    saved.flush({ error: 'Closed' }, { status: 400, statusText: 'Bad Request' });
    expect(snack.open).toHaveBeenCalledWith('Closed', 'Close', jasmine.any(Object));

    component.logisticsForm.patchValue({ music_audio_needs: 'Organ' });
    tick(800);
    httpMock.expectOne((req) => req.method === 'PATCH').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not save AV information.', 'Close', jasmine.any(Object));

    component.logisticsForm.patchValue({ music_audio_needs: 'Harp' });
    component.performances.set([]);
    expect(() => tick(800)).toThrowError('No performance selected');
  }));

  it('creates, updates, reorders, and deletes entries', () => {
    const component = load();
    const perf = component.selectedPerformance()!;
    component.openEntryDialog();
    component.deleteEntry(danceEntry);
    expect(httpMock.match((req) => req.url.includes('/entries')).length).toBe(0);

    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of({ name: 'New' }) });
    component.openEntryDialog();
    httpMock.expectOne((req) => req.method === 'POST' && req.url.includes('/entries')).flush({});
    httpMock.expectOne('/api/groups/1/performance').flush({ performances: [perf] });
    expect(snack.open).toHaveBeenCalledWith('Dance added.', 'Close', jasmine.any(Object));

    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of({ name: 'Edited' }) });
    component.openEntryDialog(danceEntry);
    httpMock.expectOne((req) => req.method === 'PUT' && req.url.includes('/entries/3')).flush({});
    httpMock.expectOne('/api/groups/1/performance').flush({ performances: [perf] });
    expect(snack.open).toHaveBeenCalledWith('Saved.', 'Close', jasmine.any(Object));

    component.openEntryDialog();
    httpMock.expectOne((req) => req.method === 'POST').flush({ error: 'Full' }, { status: 400, statusText: 'Bad Request' });
    component.openEntryDialog();
    httpMock.expectOne((req) => req.method === 'POST').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not save entry.', 'Close', jasmine.any(Object));

    component.onEntryDrop({ previousIndex: 0, currentIndex: 0 } as never);
    component.onEntryDrop({ previousIndex: 0, currentIndex: 1 } as never);
    const reorder = httpMock.expectOne((req) => req.method === 'PATCH' && req.url.includes('/reorder'));
    expect(reorder.request.body.entry_ids).toEqual([4, 3]);
    reorder.flush({ entries: [secondDance, danceEntry] });
    expect(component.selectedPerformance()?.entries[0].id).toBe(4);

    component.onEntryDrop({ previousIndex: 1, currentIndex: 0 } as never);
    httpMock.expectOne((req) => req.url.includes('/reorder')).flush('nope', { status: 500, statusText: 'Error' });
    httpMock.expectOne('/api/groups/1/performance').flush({ performances: [perf] });
    expect(snack.open).toHaveBeenCalledWith('Could not reorder entries.', 'Close', jasmine.any(Object));

    component.moveEntry(0, -1);
    component.moveEntry(1, 1);
    component.moveEntry(0, 1);
    httpMock.expectOne((req) => req.url.includes('/reorder')).flush({ entries: [secondDance, danceEntry] });
    component.moveEntry(0, 1);
    httpMock.expectOne((req) => req.url.includes('/reorder')).flush('nope', { status: 500, statusText: 'Error' });
    httpMock.expectOne('/api/groups/1/performance').flush({ performances: [perf] });

    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(false) });
    component.deleteEntry(danceEntry);
    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(true) });
    component.deleteEntry(danceEntry);
    httpMock.expectOne((req) => req.method === 'DELETE' && req.url.includes('/entries/3')).flush({});
    httpMock.expectOne('/api/groups/1/performance').flush({ performances: [perf] });
    component.deleteEntry(danceEntry);
    httpMock.expectOne((req) => req.method === 'DELETE').flush({ error: 'Locked' }, { status: 400, statusText: 'Bad Request' });
    component.deleteEntry(danceEntry);
    httpMock.expectOne((req) => req.method === 'DELETE').flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not delete entry.', 'Close', jasmine.any(Object));
  });

  it('uses song labels for choral entry dialogs', () => {
    const choral: PerformanceContext = {
      ...danceContext,
      group: { ...danceContext.group, groupType: 'Choral' },
      submissionType: 'CHORAL_PERFORMANCE',
    };
    const song: ChoralEntry = {
      id: 9, entry_order: 1, name: 'Hymn', uses_live_music: false, uses_recorded_music: false, choral_classification: 'SECULAR',
    };
    const component = load(choral, [performance({ entries: [song] })]);
    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of({ name: 'Carol' }) });
    component.openEntryDialog();
    httpMock.expectOne((req) => req.method === 'POST').flush({});
    httpMock.expectOne('/api/groups/1/performance').flush({ performances: [component.selectedPerformance()] });
    expect(snack.open).toHaveBeenCalledWith('Song added.', 'Close', jasmine.any(Object));
    const opened = (dialog.open as jasmine.Spy).calls.mostRecent().args[1].data;
    expect(opened.isDance).toBeFalse();
  });

  it('searches, assigns, and removes musicians', () => {
    const component = load();
    component.searchMusicians('   ');
    expect(component.musicianSearchResults()).toEqual([]);
    component.searchMusicians('nik');
    httpMock.expectOne((req) => req.url === '/api/musicians/search' && req.params.get('q') === 'nik')
      .flush([{ id: 1, display_name: 'Nikos', disambiguation_hint: null }, { id: 2, display_name: 'Mia', disambiguation_hint: 'Violin' }]);

    component.selectMusician({ id: 1, display_name: 'Nikos', disambiguation_hint: null });
    expect(snack.open).toHaveBeenCalledWith('This musician is already selected.', 'Close', jasmine.any(Object));

    const full = performance({
      musicians: Array.from({ length: 8 }, (_, index) => ({ musician_id: index + 1, display_order: index, display_name: `M${index}` })),
    });
    component.performances.set([full]);
    component.selectMusician({ id: 99, display_name: 'Extra', disambiguation_hint: null });
    expect(snack.open).toHaveBeenCalledWith('A maximum of 8 musicians may be selected.', 'Close', jasmine.any(Object));

    component.performances.set([performance({ musicians: [] })]);
    component.selectMusician({ id: 2, display_name: 'Mia', disambiguation_hint: null });
    const assigned = httpMock.expectOne((req) => req.method === 'POST' && req.url.includes('/musicians'));
    expect(assigned.request.body).toEqual({ musician_id: 2, display_order: 0 });
    assigned.flush({});
    httpMock.expectOne('/api/groups/1/performance').flush({ performances: [performance()] });
    httpMock.expectOne((req) => req.url.includes('/performance/conflicts')).flush(conflicts);
    expect(component.musicianSearch).toBe('');

    component.selectMusician({ id: 3, display_name: 'Ora', disambiguation_hint: null });
    httpMock.expectOne((req) => req.method === 'POST' && req.url.includes('/musicians'))
      .flush({ error: 'Duplicate' }, { status: 400, statusText: 'Bad Request' });
    component.selectMusician({ id: 4, display_name: 'Pia', disambiguation_hint: null });
    httpMock.expectOne((req) => req.method === 'POST' && req.url.includes('/musicians'))
      .flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not assign musician.', 'Close', jasmine.any(Object));

    component.removeMusician(1);
    httpMock.expectOne((req) => req.method === 'DELETE' && req.url.includes('/musicians/1')).flush({});
    httpMock.expectOne('/api/groups/1/performance').flush({ performances: [performance({ musicians: [] })] });
    httpMock.expectOne((req) => req.url.includes('/performance/conflicts')).flush({
      dancer_conflicts: [], musician_conflicts: [], director_conflicts: [],
    });
  });

  it('toggles instruments, including a custom other instrument', () => {
    const component = load();
    const perf = component.selectedPerformance()!;
    const prompt = spyOn(window, 'prompt');

    component.toggleInstrument(perf, instruments[0]);
    httpMock.expectOne((req) => req.method === 'DELETE' && req.url.includes('/instruments/50')).flush({});
    httpMock.expectOne('/api/groups/1/performance').flush({ performances: [performance({ instruments: [] })] });

    const cleared = component.selectedPerformance()!;
    prompt.and.returnValue(null);
    component.toggleInstrument(cleared, instruments[1]);
    prompt.and.returnValue('   ');
    component.toggleInstrument(cleared, instruments[1]);
    prompt.and.returnValue(' Daouli ');
    component.toggleInstrument(cleared, instruments[1]);
    const custom = httpMock.expectOne((req) => req.method === 'POST' && req.url.includes('/instruments'));
    expect(custom.request.body).toEqual({ instrument_id: 8, custom_name: 'Daouli' });
    custom.flush({});
    httpMock.expectOne('/api/groups/1/performance').flush({ performances: [performance({ instruments: [] })] });

    component.toggleInstrument(component.selectedPerformance()!, instruments[0]);
    httpMock.expectOne((req) => req.method === 'POST').flush({});
    httpMock.expectOne('/api/groups/1/performance').flush({ performances: [perf] });

    component.toggleInstrument(perf, instruments[0]);
    httpMock.expectOne((req) => req.method === 'DELETE').flush('nope', { status: 400, statusText: 'Bad Request' });
    component.toggleInstrument(component.selectedPerformance()!, instruments[1]);
    prompt.and.returnValue('Drum');
    httpMock.expectOne((req) => req.method === 'POST').flush('nope', { status: 500, statusText: 'Error' });
    component.toggleInstrument(performance({ instruments: [] }), instruments[0]);
    httpMock.expectOne((req) => req.method === 'POST').flush({ error: 'Closed' }, { status: 400, statusText: 'Bad Request' });
    expect(snack.open).toHaveBeenCalledWith('Could not assign instrument.', 'Close', jasmine.any(Object));
    expect(snack.open).toHaveBeenCalledWith('Could not remove instrument.', 'Close', jasmine.any(Object));
  });

  it('submits dance and choral performance summaries', () => {
    const component = load();
    component.submitPerformance();
    const message = (dialog.open as jasmine.Spy).calls.mostRecent().args[1].data.message as string;
    expect(message).toContain('2 dances, 1 musician');
    expect(message).toContain('1 dance, 0 musicians');

    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(true) });
    component.submitPerformance();
    const submitted = httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/groups/1/submissions');
    expect(submitted.request.body).toEqual({ submission_type: 'DANCE_PERFORMANCE' });
    submitted.flush({});
    httpMock.expectOne('/api/portal/groups/1/performance-context').flush(danceContext);
    expect(component.submitting()).toBeFalse();

    component.submitPerformance();
    httpMock.expectOne((req) => req.method === 'POST' && req.url.endsWith('/submissions'))
      .flush({ error: 'Incomplete' }, { status: 400, statusText: 'Bad Request' });
    component.submitPerformance();
    httpMock.expectOne((req) => req.method === 'POST' && req.url.endsWith('/submissions'))
      .flush('nope', { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Could not submit.', 'Close', jasmine.any(Object));

    const closed = load({
      ...danceContext,
      group: { ...danceContext.group, groupType: 'Choral', isActive: false },
      submissionType: 'CHORAL_PERFORMANCE',
      deadline: { ...danceContext.deadline, can_edit: false },
    }, [performance({ entries: [{ ...danceEntry } as unknown as ChoralEntry, { ...secondDance } as unknown as ChoralEntry] })]);
    expect(closed.isReadOnly()).toBeTrue();
    expect(closed.isActiveEvent()).toBeFalse();
    closed.openEntryDialog();
    closed.deleteEntry(danceEntry);
    closed.moveEntry(0, 1);
    closed.selectMusician({ id: 2, display_name: 'Mia', disambiguation_hint: null });
    closed.removeMusician(1);
    closed.toggleInstrument(closed.selectedPerformance()!, instruments[0]);
    closed.onEntryDrop({ previousIndex: 0, currentIndex: 1 } as never);
    closed.submitPerformance();
    expect(closed.canEdit()).toBeFalse();

    const plural = load({
      ...danceContext,
      group: { ...danceContext.group, groupType: 'Choral' },
      submissionType: 'CHORAL_PERFORMANCE',
    }, [
      performance({ entries: [danceEntry as unknown as ChoralEntry] }),
      performance({ id: 11, round: 'Final', entries: [] }),
    ]);
    (dialog.open as jasmine.Spy).and.returnValue({ afterClosed: () => of(false) });
    plural.submitPerformance();
    const choralMessage = (dialog.open as jasmine.Spy).calls.mostRecent().args[1].data.message as string;
    expect(choralMessage).toContain('1 song');
    expect(choralMessage).toContain('0 songs');
  });

  it('disconnects autosave on destroy', fakeAsync(() => {
    const component = load();
    component.logisticsForm.patchValue({ music_audio_needs: 'Mic' });
    expect(component.hasUnsavedChanges()).toBeTrue();
    component.ngOnDestroy();
    tick(800);
    httpMock.expectNone((req) => req.url.includes('/logistics'));
  }));
});
