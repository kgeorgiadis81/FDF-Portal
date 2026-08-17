import {
  Component, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

import {
  CostumeService, CostumeContext, CostumeGender, CostumeResourceType,
  PerformanceCostume, ManualCostumeConflict, RelatedGroupOption, CostumeFormPayload,
} from '../../../services/costume.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { ContextHelpComponent } from '../../../shared/context-help/context-help.component';
import {
  FormAutosaveCoordinator,
  HasUnsavedChanges,
  UnsavedChangesService,
} from '../../../shared/unsaved-changes';

type GenderSection = {
  gender: CostumeGender;
  label: string;
  costume: PerformanceCostume | null;
  editing: boolean;
};

@Component({
  selector: 'fdp-costumes',
  imports: [
    RouterLink, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTabsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatRadioModule,
    MatAutocompleteModule, ContextHelpComponent,
  ],
  templateUrl: './costumes.component.html',
  styleUrl: './costumes.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CostumesComponent implements OnInit, OnDestroy, HasUnsavedChanges {
  groupId = 0;
  selectedRoundIndex = signal(0);

  loading = signal(true);
  error = signal('');
  savingGender = signal<CostumeGender | null>(null);
  savingConflict = signal(false);
  submitting = signal(false);
  loadingRelatedGroups = signal(false);

  context = signal<CostumeContext | null>(null);
  resourceTypes = signal<CostumeResourceType[]>([]);
  costumes = signal(new Map<string, PerformanceCostume>());
  conflicts = signal<ManualCostumeConflict[]>([]);
  relatedGroupOptions = signal<RelatedGroupOption[]>([]);

  editingGender = signal<CostumeGender | null>(null);
  editingConflictId = signal<number | null>(null);
  addingConflict = signal(false);

  readonly canEdit = computed(() => this.context()?.deadline.can_edit ?? false);
  readonly isReadOnly = computed(() => !this.canEdit());
  readonly isActiveEvent = computed(() => this.context()?.group.isActive ?? false);

  readonly selectedPerformance = computed(() => {
    const perfs = this.context()?.performances ?? [];
    return perfs[this.selectedRoundIndex()] ?? null;
  });

  readonly roundConflicts = computed(() => {
    const round = this.selectedPerformance()?.round;
    if (!round) return [];
    return this.conflicts().filter((c) => c.round === round);
  });

  costumeForm;
  conflictForm;
  private costumeAutosave!: FormAutosaveCoordinator<Record<string, unknown>>;
  private conflictAutosave!: FormAutosaveCoordinator<Record<string, unknown>>;
  private editingCostumeGender: CostumeGender | null = null;
  private unbindBeforeUnload?: () => void;
  relatedGroupSearch = signal('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private costumeSvc: CostumeService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
    private fb: FormBuilder,
    private unsavedSvc: UnsavedChangesService,
  ) {
    this.costumeForm = this.fb.group({
      region: ['', Validators.maxLength(500)],
      village: ['', Validators.maxLength(500)],
      resource_type_id: [null as number | null, Validators.required],
      has_won_award: [null as boolean | null, Validators.required],
      purchased_most_or_all: [null as boolean | null, Validators.required],
      purchased_any_parts: [null as boolean | null, Validators.required],
    });

    this.conflictForm = this.fb.group({
      related_group_id: [null as number | null, Validators.required],
      costume_count: [1, [Validators.required, Validators.min(1)]],
    });

    this.costumeAutosave = new FormAutosaveCoordinator(this.costumeForm, {
      enabled: () => this.editingGender() !== null,
      isValid: () => this.costumeForm.valid,
      save: (value) => this.persistCostume(this.editingCostumeGender!, value as unknown as CostumeFormPayload),
      onSaving: () => this.savingGender.set(this.editingCostumeGender),
      onSuccess: () => {
        const gender = this.editingCostumeGender;
        this.savingGender.set(null);
        if (!gender) return;
        const perf = this.selectedPerformance();
        if (!perf) return;
        this.costumeSvc.getCostumes(this.groupId, perf.id).subscribe({
          next: (list) => {
            const map = new Map(this.costumes());
            list.forEach((c) => map.set(`${perf.id}_${c.gender}`, c));
            this.costumes.set(map);
            this.editingGender.set(null);
            this.editingCostumeGender = null;
          },
        });
      },
      onError: (err: unknown) => {
        this.savingGender.set(null);
        this.snack.open((err as { error?: { error?: string } })?.error?.error
          || 'Could not save costume information.', 'Close', { duration: 5000 });
      },
    });
    this.costumeAutosave.connect();

    this.conflictAutosave = new FormAutosaveCoordinator(this.conflictForm, {
      enabled: () => this.addingConflict() || this.editingConflictId() !== null,
      isValid: () => this.conflictForm.valid,
      save: (value) => this.persistConflict(value),
      onSaving: () => this.savingConflict.set(true),
      onSuccess: () => {
        this.costumeSvc.getCostumeConflicts(this.groupId).subscribe({
          next: (list) => {
            this.conflicts.set(list);
            this.savingConflict.set(false);
            this.cancelConflictEdit(false);
          },
        });
      },
      onError: (err: unknown) => {
        this.savingConflict.set(false);
        this.snack.open((err as { error?: { error?: string } })?.error?.error
          || 'Could not save costume conflict.', 'Close', { duration: 5000 });
      },
    });
    this.conflictAutosave.connect();

    toObservable(this.relatedGroupSearch).pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) => {
        if (!this.groupId) return of([]);
        this.loadingRelatedGroups.set(true);
        return this.costumeSvc.searchRelatedGroups(this.groupId, q);
      }),
    ).subscribe({
      next: (opts) => {
        this.relatedGroupOptions.set(opts);
        this.loadingRelatedGroups.set(false);
      },
      error: () => this.loadingRelatedGroups.set(false),
    });
  }

  ngOnInit(): void {
    this.groupId = Number(this.route.snapshot.parent?.paramMap.get('id') ?? 0);
    if (!this.groupId) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadAll();
    this.unbindBeforeUnload = this.unsavedSvc.bindBeforeUnload(() => this.hasUnsavedChanges());
  }

  ngOnDestroy(): void {
    this.costumeAutosave?.disconnect();
    this.conflictAutosave?.disconnect();
    this.unbindBeforeUnload?.();
  }

  hasUnsavedChanges(): boolean {
    return this.costumeAutosave.hasUnsavedChanges() || this.conflictAutosave.hasUnsavedChanges();
  }

  discardUnsavedChanges(): void {
    if (this.costumeAutosave.hasUnsavedChanges()) {
      this.costumeAutosave.discardChanges();
      this.editingGender.set(null);
      this.editingCostumeGender = null;
    }
    if (this.conflictAutosave.hasUnsavedChanges()) {
      this.conflictAutosave.discardChanges();
      this.cancelConflictEdit(false);
    }
  }

  private loadAll(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      context: this.costumeSvc.getCostumeContext(this.groupId),
      resourceTypes: this.costumeSvc.getResourceTypes(this.groupId),
      conflicts: this.costumeSvc.getCostumeConflicts(this.groupId),
    }).subscribe({
      next: ({ context, resourceTypes, conflicts }) => {
        this.context.set(context);
        this.resourceTypes.set(resourceTypes);
        this.conflicts.set(conflicts);
        this.loadCostumesForAllPerformances(context.performances);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 403) {
          this.router.navigate(['/groups', this.groupId]);
          return;
        }
        this.error.set(err.status === 404
          ? 'Group not found or access denied.'
          : 'Could not load costume information. Please try again.');
      },
    });
  }

  private loadCostumesForAllPerformances(
    performances: Array<{ id: number; round: string }>
  ): void {
    if (!performances.length) return;
    forkJoin(
      performances.map((p) => this.costumeSvc.getCostumes(this.groupId, p.id))
    ).subscribe({
      next: (results) => {
        const map = new Map<string, PerformanceCostume>();
        results.forEach((costumeList, idx) => {
          const perfId = performances[idx].id;
          costumeList.forEach((c) => map.set(`${perfId}_${c.gender}`, c));
        });
        this.costumes.set(map);
      },
    });
  }

  getCostume(performanceId: number, gender: CostumeGender): PerformanceCostume | null {
    return this.costumes().get(`${performanceId}_${gender}`) ?? null;
  }

  async onRoundChange(index: number): Promise<void> {
    const previous = this.selectedRoundIndex();
    if (index === previous) return;

    const canLeave = await this.unsavedSvc.confirmLeave(
      () => this.hasUnsavedChanges(),
      () => this.discardUnsavedChanges(),
    );
    if (!canLeave) {
      this.selectedRoundIndex.set(previous);
      return;
    }

    this.selectedRoundIndex.set(index);
    this.cancelCostumeEdit(false);
    this.cancelConflictEdit(false);
  }

  startCostumeEdit(gender: CostumeGender): void {
    const perf = this.selectedPerformance();
    if (!perf) return;
    const existing = this.getCostume(perf.id, gender);
    this.editingGender.set(gender);
    this.editingCostumeGender = gender;
    this.costumeAutosave.setBaseline({
      region: existing?.region ?? '',
      village: existing?.village ?? '',
      resource_type_id: existing?.resource_type_id ?? null,
      has_won_award: existing != null ? Boolean(existing.has_won_award) : null,
      purchased_most_or_all: existing != null ? Boolean(existing.purchased_most_or_all) : null,
      purchased_any_parts: existing != null ? Boolean(existing.purchased_any_parts) : null,
    });
  }

  async cancelCostumeEdit(prompt = true): Promise<void> {
    if (prompt) {
      const canLeave = await this.unsavedSvc.confirmLeave(
        () => this.costumeAutosave.hasUnsavedChanges(),
        () => {
          this.costumeAutosave.discardChanges();
          this.editingGender.set(null);
          this.editingCostumeGender = null;
        },
      );
      if (!canLeave) return;
    }
    this.editingGender.set(null);
    this.editingCostumeGender = null;
    this.costumeForm.reset();
  }

  private persistCostume(gender: CostumeGender, payload: CostumeFormPayload) {
    const perf = this.selectedPerformance();
    if (!perf) throw new Error('No performance selected');
    const existing = this.getCostume(perf.id, gender);
    return existing
      ? this.costumeSvc.updateCostume(this.groupId, perf.id, existing.id, payload)
      : this.costumeSvc.createCostume(this.groupId, perf.id, gender, payload);
  }

  getResourceLabel(id: number | null | undefined): string {
    if (!id) return '—';
    return this.resourceTypes().find((r) => r.id === id)?.label ?? '—';
  }

  formatBool(value: boolean | number | null | undefined): string {
    return value ? 'Yes' : 'No';
  }

  startAddConflict(): void {
    this.addingConflict.set(true);
    this.editingConflictId.set(null);
    this.relatedGroupSearch.set('');
    this.costumeSvc.searchRelatedGroups(this.groupId, '').subscribe({
      next: (opts) => this.relatedGroupOptions.set(opts),
    });
    this.conflictAutosave.setBaseline({
      related_group_id: null,
      costume_count: 1,
    });
  }

  startEditConflict(conflict: ManualCostumeConflict): void {
    this.addingConflict.set(false);
    this.editingConflictId.set(conflict.id);
    this.relatedGroupSearch.set(
      conflict.related_group_name
        ? `${conflict.related_group_name} — ${conflict.related_parish_name ?? ''}`
        : ''
    );
    this.conflictAutosave.setBaseline({
      related_group_id: conflict.related_group_id,
      costume_count: conflict.costume_count,
    });
  }

  async cancelConflictEdit(prompt = true): Promise<void> {
    if (prompt) {
      const canLeave = await this.unsavedSvc.confirmLeave(
        () => this.conflictAutosave.hasUnsavedChanges(),
        () => this.conflictAutosave.discardChanges(),
      );
      if (!canLeave) return;
    }
    this.addingConflict.set(false);
    this.editingConflictId.set(null);
    this.conflictForm.reset();
    this.relatedGroupSearch.set('');
  }

  private persistConflict(value: Record<string, unknown>) {
    const perf = this.selectedPerformance();
    if (!perf) throw new Error('No performance selected');
    const payload = {
      round: perf.round,
      related_group_id: value['related_group_id'] as number,
      costume_count: Number(value['costume_count']),
    };
    const editId = this.editingConflictId();
    return editId
      ? this.costumeSvc.updateCostumeConflict(this.groupId, editId, payload)
      : this.costumeSvc.addCostumeConflict(this.groupId, payload);
  }

  onRelatedGroupSelected(option: RelatedGroupOption): void {
    this.conflictForm.patchValue({ related_group_id: option.id });
    this.relatedGroupSearch.set(option.display_label);
  }

  displayRelatedGroup = (id: number | null): string => {
    if (!id) return '';
    const opt = this.relatedGroupOptions().find((o) => o.id === id);
    return opt?.display_label ?? '';
  };

  confirmDeleteConflict(conflict: ManualCostumeConflict): void {
    const data: ConfirmDialogData = {
      title: 'Remove costume conflict',
      message: 'Remove this costume-sharing conflict?',
      confirmLabel: 'Remove',
    };
    this.dialog.open(ConfirmDialogComponent, { data, width: '400px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.costumeSvc.deleteCostumeConflict(this.groupId, conflict.id).subscribe({
          next: () => {
            this.conflicts.update((list) => list.filter((c) => c.id !== conflict.id));
            this.snack.open('Costume conflict removed.', 'Close', { duration: 3000 });
          },
          error: (err) => {
            this.snack.open(err?.error?.error || 'Could not remove conflict.', 'Close', { duration: 5000 });
          },
        });
      });
  }

  submitCostumes(): void {
    const data: ConfirmDialogData = {
      title: 'Submit costume information',
      message: 'Submit your costume registration for this group? You can still make changes before the deadline.',
      confirmLabel: 'Submit',
    };
    this.dialog.open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.submitting.set(true);
        this.costumeSvc.submitCostumes(this.groupId).subscribe({
          next: () => {
            this.costumeSvc.getCostumeContext(this.groupId).subscribe({
              next: (ctx) => {
                this.context.set(ctx);
                this.submitting.set(false);
                this.snack.open('Costume information submitted.', 'Close', { duration: 4000 });
              },
            });
          },
          error: (err) => {
            this.submitting.set(false);
            this.snack.open(err?.error?.error || 'Could not submit costume information.', 'Close', { duration: 5000 });
          },
        });
      });
  }

  formatDeadlineDate(date: string | null): string {
    if (!date) return '';
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  formatEffectiveCutoff(cutoff: string | null): string {
    if (!cutoff) return '';
    const dt = new Date(cutoff);
    const tz = this.context()?.group.eventTimezone;
    return dt.toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZone: tz || undefined,
      timeZoneName: 'short',
    });
  }

  formatDate(iso: string): string {
    const dt = new Date(iso);
    const tz = this.context()?.group.eventTimezone;
    return dt.toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZone: tz || undefined,
    });
  }

  genderSections(): GenderSection[] {
    const perf = this.selectedPerformance();
    if (!perf) return [];
    return [
      { gender: 'MEN', label: "Men's Costume", costume: this.getCostume(perf.id, 'MEN'), editing: this.editingGender() === 'MEN' },
      { gender: 'WOMEN', label: "Women's Costume", costume: this.getCostume(perf.id, 'WOMEN'), editing: this.editingGender() === 'WOMEN' },
    ];
  }
}
