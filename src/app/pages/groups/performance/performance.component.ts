import {
  Component, OnInit, signal, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';

import {
  PerformanceService, PerformanceContext, PortalPerformance,
  MusicianOption, InstrumentOption, DanceEntry, ChoralEntry,
} from '../../../services/performance.service';
import { EntryDialogComponent, EntryDialogData } from './entry-dialog/entry-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'fdp-performance',
  imports: [
    RouterLink, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTabsModule,
    MatCheckboxModule, MatFormFieldModule, MatInputModule,
    MatAutocompleteModule, MatChipsModule, DragDropModule,
  ],
  templateUrl: './performance.component.html',
  styleUrl: './performance.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PerformanceComponent implements OnInit {
  groupId = 0;
  selectedRoundIndex = signal(0);

  loading = signal(true);
  error = signal('');
  saving = signal(false);
  submitting = signal(false);

  context = signal<PerformanceContext | null>(null);
  performances = signal<PortalPerformance[]>([]);
  instruments = signal<InstrumentOption[]>([]);
  musicianSearchResults = signal<MusicianOption[]>([]);
  conflicts = signal<string[]>([]);

  readonly canEdit = computed(() => this.context()?.deadline.can_edit ?? false);
  readonly isReadOnly = computed(() => !this.canEdit());
  readonly isActiveEvent = computed(() => this.context()?.group.isActive ?? false);
  readonly isDance = computed(() => {
    const t = (this.context()?.group.groupType ?? '').toUpperCase();
    return t === 'DANCE';
  });

  readonly selectedPerformance = computed(() => {
    const perfs = this.performances();
    const idx = this.selectedRoundIndex();
    return perfs[idx] ?? null;
  });

  logisticsForm;

  musicianSearch = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private perfSvc: PerformanceService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
    private fb: FormBuilder,
  ) {
    this.logisticsForm = this.fb.group({
      uses_fdf_tables_chairs: [false],
      additional_props: [''],
      special_requirements: [''],
      music_audio_needs: [''],
    });
  }

  ngOnInit(): void {
    this.groupId = Number(this.route.snapshot.parent?.paramMap.get('id') ?? 0);
    if (!this.groupId) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadAll();
  }

  private loadAll(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      context: this.perfSvc.getPerformanceContext(this.groupId),
      data: this.perfSvc.getPerformance(this.groupId),
      instruments: this.perfSvc.getInstruments(),
    }).subscribe({
      next: ({ context, data, instruments }) => {
        this.context.set(context);
        this.performances.set(data.performances);
        this.instruments.set(instruments);
        this.syncLogisticsForm();
        this.refreshConflicts();
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.status === 404
          ? 'Group not found or access denied.'
          : 'Could not load performance information. Please try again.');
      },
    });
  }

  private syncLogisticsForm(): void {
    const perf = this.selectedPerformance();
    if (!perf) return;
    this.logisticsForm.patchValue({
      uses_fdf_tables_chairs: !!perf.uses_fdf_tables_chairs,
      additional_props: perf.additional_props ?? '',
      special_requirements: perf.special_requirements ?? '',
      music_audio_needs: perf.music_audio_needs ?? '',
    }, { emitEvent: false });
  }

  onRoundChange(index: number): void {
    this.selectedRoundIndex.set(index);
    this.syncLogisticsForm();
    this.refreshConflicts();
  }

  refreshConflicts(): void {
    const perf = this.selectedPerformance();
    if (!perf) return;
    this.perfSvc.getConflicts(this.groupId, perf.round).subscribe({
      next: (c) => {
        const warnings: string[] = [];
        for (const dc of c.dancer_conflicts) {
          warnings.push(`Participant scheduling conflict: ${dc.first_name} ${dc.last_name} is registered with another group in the ${dc.round} round.`);
        }
        for (const mc of c.musician_conflicts) {
          const others = mc.other_groups.map((g) => g.group_name).join(', ');
          warnings.push(`Musician scheduling conflict: ${mc.musician_name} is also assigned to ${others} in the ${mc.round} round.`);
        }
        for (const dc of c.director_conflicts) {
          if (dc.type === 'director_multi_group' && dc.other_group_names?.length) {
            warnings.push(`Director scheduling conflict: you are directing multiple groups (${dc.other_group_names.join(', ')}) in the ${dc.round} round.`);
          } else if (dc.type === 'director_dancing') {
            warnings.push(`Director scheduling conflict: you appear as a participant in another group during the ${dc.round} round.`);
          }
        }
        this.conflicts.set(warnings);
      },
    });
  }

  openEntryDialog(entry?: DanceEntry | ChoralEntry): void {
    const perf = this.selectedPerformance();
    if (!perf || !this.canEdit()) return;

    const ref = this.dialog.open(EntryDialogComponent, {
      data: {
        isDance: this.isDance(),
        entry,
        roundLabel: perf.round,
      } as EntryDialogData,
      width: '520px',
    });

    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      this.saving.set(true);
      const req = entry
        ? this.perfSvc.updateEntry(this.groupId, perf.id, entry.id, result)
        : this.perfSvc.createEntry(this.groupId, perf.id, result);

      req.subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open(entry ? 'Saved.' : (this.isDance() ? 'Dance added.' : 'Song added.'), 'Close', { duration: 3000 });
          this.reloadPerformance();
        },
        error: (err) => {
          this.saving.set(false);
          this.snack.open(err.error?.error ?? 'Could not save entry.', 'Close', { duration: 5000 });
        },
      });
    });
  }

  deleteEntry(entry: DanceEntry | ChoralEntry): void {
    const perf = this.selectedPerformance();
    if (!perf || !this.canEdit()) return;

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.isDance() ? 'Delete Dance' : 'Delete Song',
        message: `Remove "${entry.name}" from ${perf.round}?`,
        confirmLabel: 'Delete',
        confirmColor: 'warn',
      } as ConfirmDialogData,
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.perfSvc.deleteEntry(this.groupId, perf.id, entry.id).subscribe({
        next: () => {
          this.snack.open('Entry removed.', 'Close', { duration: 3000 });
          this.reloadPerformance();
        },
        error: (err) => {
          this.snack.open(err.error?.error ?? 'Could not delete entry.', 'Close', { duration: 5000 });
        },
      });
    });
  }

  onEntryDrop(event: CdkDragDrop<DanceEntry[] | ChoralEntry[]>): void {
    if (!this.canEdit() || event.previousIndex === event.currentIndex) return;
    const perf = this.selectedPerformance();
    if (!perf) return;

    const entries = [...perf.entries];
    moveItemInArray(entries, event.previousIndex, event.currentIndex);
    const entryIds = entries.map((e) => e.id);

    this.saving.set(true);
    this.perfSvc.reorderEntries(this.groupId, perf.id, entryIds).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.updatePerformanceEntries(perf.id, res.entries);
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Could not reorder entries.', 'Close', { duration: 4000 });
        this.reloadPerformance();
      },
    });
  }

  moveEntry(index: number, direction: -1 | 1): void {
    const perf = this.selectedPerformance();
    if (!perf || !this.canEdit()) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= perf.entries.length) return;

    const entries = [...perf.entries];
    moveItemInArray(entries, index, newIndex);
    this.perfSvc.reorderEntries(this.groupId, perf.id, entries.map((e) => e.id)).subscribe({
      next: (res) => this.updatePerformanceEntries(perf.id, res.entries),
      error: () => this.reloadPerformance(),
    });
  }

  saveLogistics(): void {
    const perf = this.selectedPerformance();
    if (!perf || !this.canEdit()) return;

    this.saving.set(true);
    const v = this.logisticsForm.value;
    const payload = this.isDance()
      ? {
          uses_fdf_tables_chairs: !!v.uses_fdf_tables_chairs,
          additional_props: v.additional_props || null,
          special_requirements: v.special_requirements || null,
          music_audio_needs: v.music_audio_needs || null,
        }
      : {
          music_audio_needs: v.music_audio_needs || null,
          special_requirements: v.special_requirements || null,
        };

    this.perfSvc.updateLogistics(this.groupId, perf.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('AV information saved.', 'Close', { duration: 3000 });
        this.reloadPerformance();
      },
      error: (err) => {
        this.saving.set(false);
        this.snack.open(err.error?.error ?? 'Could not save AV information.', 'Close', { duration: 5000 });
      },
    });
  }

  searchMusicians(query: string): void {
    this.musicianSearch = query;
    if (!query.trim()) {
      this.musicianSearchResults.set([]);
      return;
    }
    this.perfSvc.searchMusicians(query).subscribe({
      next: (rows) => this.musicianSearchResults.set(rows),
    });
  }

  selectMusician(option: MusicianOption): void {
    const perf = this.selectedPerformance();
    if (!perf || !this.canEdit()) return;

    if (perf.musicians.some((m) => m.musician_id === option.id)) {
      this.snack.open('This musician is already selected.', 'Close', { duration: 3000 });
      return;
    }
    if (perf.musicians.length >= 8) {
      this.snack.open('A maximum of 8 musicians may be selected.', 'Close', { duration: 4000 });
      return;
    }

    this.perfSvc.assignMusician(this.groupId, perf.id, option.id, perf.musicians.length).subscribe({
      next: () => {
        this.musicianSearch = '';
        this.musicianSearchResults.set([]);
        this.reloadPerformance();
        this.refreshConflicts();
      },
      error: (err) => {
        this.snack.open(err.error?.error ?? 'Could not assign musician.', 'Close', { duration: 5000 });
      },
    });
  }

  removeMusician(musicianId: number): void {
    const perf = this.selectedPerformance();
    if (!perf || !this.canEdit()) return;
    this.perfSvc.removeMusician(this.groupId, perf.id, musicianId).subscribe({
      next: () => {
        this.reloadPerformance();
        this.refreshConflicts();
      },
    });
  }

  toggleInstrument(instr: InstrumentOption): void {
    const perf = this.selectedPerformance();
    if (!perf || !this.canEdit()) return;

    const existing = perf.instruments.find((i) => i.instrument_id === instr.id);
    if (existing) {
      this.perfSvc.removeInstrument(this.groupId, perf.id, existing.id).subscribe({
        next: () => this.reloadPerformance(),
      });
      return;
    }

    if (instr.code === 'OTHER') {
      const custom = prompt('Describe the other instrument:');
      if (!custom?.trim()) return;
      this.perfSvc.assignInstrument(this.groupId, perf.id, instr.id, custom.trim()).subscribe({
        next: () => this.reloadPerformance(),
        error: (err) => this.snack.open(err.error?.error ?? 'Could not assign instrument.', 'Close', { duration: 5000 }),
      });
    } else {
      this.perfSvc.assignInstrument(this.groupId, perf.id, instr.id).subscribe({
        next: () => this.reloadPerformance(),
        error: (err) => this.snack.open(err.error?.error ?? 'Could not assign instrument.', 'Close', { duration: 5000 }),
      });
    }
  }

  isInstrumentSelected(instr: InstrumentOption): boolean {
    const perf = this.selectedPerformance();
    return !!perf?.instruments.some((i) => i.instrument_id === instr.id);
  }

  submitPerformance(): void {
    const ctx = this.context();
    if (!ctx || !this.canEdit()) return;

    const perfs = this.performances();
    const summary = perfs.map((p) => {
      const label = this.isDance()
        ? `${p.entries.length} dance${p.entries.length !== 1 ? 's' : ''}, ${p.musicians.length} musician${p.musicians.length !== 1 ? 's' : ''}`
        : `${p.entries.length} song${p.entries.length !== 1 ? 's' : ''}`;
      return `${p.round}: ${label}`;
    }).join('\n');

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Submit Performance Information',
        message: `Submit your performance registration?\n\n${summary}`,
        confirmLabel: 'Submit Performance Information',
      } as ConfirmDialogData,
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.submitting.set(true);
      this.perfSvc.submitPerformance(this.groupId, ctx.submissionType).subscribe({
        next: () => {
          this.submitting.set(false);
          this.snack.open('Performance information submitted.', 'Close', { duration: 4000 });
          this.refreshContext();
        },
        error: (err) => {
          this.submitting.set(false);
          this.snack.open(err.error?.error ?? 'Could not submit.', 'Close', { duration: 5000 });
        },
      });
    });
  }

  private reloadPerformance(): void {
    this.perfSvc.getPerformance(this.groupId).subscribe({
      next: (data) => {
        this.performances.set(data.performances);
        this.syncLogisticsForm();
      },
    });
  }

  private refreshContext(): void {
    this.perfSvc.getPerformanceContext(this.groupId).subscribe({
      next: (ctx) => this.context.set(ctx),
    });
  }

  private updatePerformanceEntries(performanceId: number, entries: DanceEntry[] | ChoralEntry[]): void {
    this.performances.update((perfs) =>
      perfs.map((p) => p.id === performanceId ? { ...p, entries } : p),
    );
  }

  formatDeadlineDate(date: string | null): string {
    if (!date) return '';
    return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  formatEffectiveCutoff(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZoneName: 'short',
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  entryFlags(entry: DanceEntry | ChoralEntry): string[] {
    const flags: string[] = [];
    if (entry.uses_live_music) flags.push('Live Music');
    if (entry.uses_recorded_music) flags.push('Recorded Music');
    if (this.isDance()) {
      const d = entry as DanceEntry;
      if (d.is_acapella) flags.push('Acapella');
      if (d.dancers_singing) flags.push('Dancers Singing');
      if (d.musicians_singing) flags.push('Musicians Singing');
      if (d.individual_singing) flags.push('Individual Singing');
    } else {
      const c = entry as ChoralEntry;
      if (c.choral_classification) flags.push(c.choral_classification === 'LITURGICAL' ? 'Liturgical' : 'Secular');
    }
    return flags;
  }
}
