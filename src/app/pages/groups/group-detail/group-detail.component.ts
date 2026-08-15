import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AsyncPipe } from '@angular/common';
import { Observable } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { GroupService, PortalGroup } from '../../../services/group.service';
import { ParishService, Parish } from '../../../services/parish.service';
import { DirectorService, GroupDirector, CoDirectorPayload } from '../../../services/director.service';
import { CoDirectorDialogComponent } from './co-director-dialog.component';

@Component({
  selector: 'fdp-group-detail',
  imports: [
    ReactiveFormsModule, RouterLink, AsyncPipe,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatAutocompleteModule,
    MatProgressSpinnerModule, MatDialogModule, MatSnackBarModule,
  ],
  templateUrl: './group-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './group-detail.component.scss',
})
export class GroupDetailComponent implements OnInit {
  group      = signal<PortalGroup | null>(null);
  loading    = signal(true);
  saving     = signal(false);
  error      = signal('');
  saveError  = signal('');
  saved      = signal(false);
  editMode   = signal(false);

  directors        = signal<GroupDirector[]>([]);
  directorsLoading = signal(false);

  readonly coDirectors = computed(() => this.directors().filter(d => !d.is_primary));
  readonly primaryDirectorRecord = computed(() => this.directors().find(d => !!d.is_primary) ?? null);

  form!: FormGroup;
  parishes   = signal<Parish[]>([]);
  filteredParishes$!: Observable<Parish[]>;
  readonly groupTypes = ['Dance', 'Choral'];

  isDanceGroup(): boolean {
    const t = (this.group()?.groupType ?? '').toUpperCase();
    return t === 'DANCE';
  }

  docStatusLabel(status?: string | null): string {
    switch (status) {
      case 'VERIFIED': return 'Verified';
      case 'REJECTED': return 'Rejected';
      case 'PENDING': return 'Pending';
      default: return 'Missing';
    }
  }

  docStatusClass(status?: string | null): string {
    switch (status) {
      case 'VERIFIED': return 'submitted';
      case 'REJECTED': return 'rejected';
      case 'PENDING': return 'in-progress';
      default: return 'not-started';
    }
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private groupSvc: GroupService,
    private parishSvc: ParishService,
    private directorSvc: DirectorService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { this.router.navigate(['/dashboard']); return; }

    this.groupSvc.getGroup(id).subscribe({
      next: (g) => {
        this.group.set(g);
        this.loading.set(false);
        this.initForm(g);
        this.loadDirectors(id);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Group not found or access denied.');
      },
    });

    this.parishSvc.getAll().subscribe({
      next: (ps) => this.parishes.set(ps),
      error: () => {},
    });
  }

  private loadDirectors(groupId: number): void {
    this.directorsLoading.set(true);
    this.directorSvc.getDirectors(groupId).subscribe({
      next: (dirs) => { this.directors.set(dirs); this.directorsLoading.set(false); },
      error: () => { this.directorsLoading.set(false); },
    });
  }

  private initForm(g: PortalGroup): void {
    this.form = this.fb.group({
      name:         [g.name, [Validators.required, Validators.maxLength(200)]],
      parishId:     [g.parish?.id || null, Validators.required],
      parishSearch: [g.parish ? this.displayParish(g.parish) : ''],
      groupType:    [g.groupType, Validators.required],
    });

    this.filteredParishes$ = this.form.get('parishSearch')!.valueChanges.pipe(
      startWith(g.parish ? this.displayParish(g.parish) : ''),
      map(v => typeof v === 'string' ? v : this.displayParish(v)),
      map(v => this.filterParishes(v)),
    );
  }

  displayParish(p: Parish | any | null): string {
    if (!p) return '';
    if (typeof p === 'string') return p;
    return p.location ? `${p.name} — ${p.location}` : p.name;
  }

  private filterParishes(query: string): Parish[] {
    const q = (query || '').toLowerCase();
    return this.parishes().filter(p =>
      p.name.toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q)
    );
  }

  onParishSelected(parish: Parish): void {
    this.form.patchValue({ parishId: parish.id, parishSearch: this.displayParish(parish) });
  }

  startEdit(): void { this.editMode.set(true); this.saved.set(false); this.saveError.set(''); }
  cancelEdit(): void { this.editMode.set(false); this.initForm(this.group()!); }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.saveError.set('');
    const g = this.group()!;

    this.groupSvc.updateGroup(g.id, {
      name:      this.form.value.name.trim(),
      parishId:  this.form.value.parishId,
      groupType: this.form.value.groupType,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        this.editMode.set(false);
        this.groupSvc.getGroup(g.id).subscribe(updated => {
          this.group.set(updated);
          this.initForm(updated);
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err.error?.error || 'Could not save changes.');
      },
    });
  }

  openAddDialog(): void {
    const ref = this.dialog.open(CoDirectorDialogComponent, {
      data: {},
      width: '400px',
    });
    ref.afterClosed().subscribe((result: CoDirectorPayload | undefined) => {
      if (!result) return;
      const groupId = this.group()!.id;
      this.directorSvc.addCoDirector(groupId, result).subscribe({
        next: () => this.loadDirectors(groupId),
        error: (err) => this.snackBar.open(err?.error?.error || 'Could not add co-director.', 'Close', { duration: 5000 }),
      });
    });
  }

  openEditDialog(director: GroupDirector): void {
    const ref = this.dialog.open(CoDirectorDialogComponent, {
      data: { director },
      width: '400px',
    });
    ref.afterClosed().subscribe((result: CoDirectorPayload | undefined) => {
      if (!result) return;
      const groupId = this.group()!.id;
      this.directorSvc.updateCoDirector(groupId, director.id, result).subscribe({
        next: () => this.loadDirectors(groupId),
        error: (err) => this.snackBar.open(err?.error?.error || 'Could not update co-director.', 'Close', { duration: 5000 }),
      });
    });
  }

  confirmRemove(director: GroupDirector): void {
    const name = [director.first_name, director.last_name].filter(Boolean).join(' ') || 'this co-director';
    if (!confirm(`Remove ${name} as a co-director?`)) return;
    const groupId = this.group()!.id;
    this.directorSvc.removeCoDirector(groupId, director.id).subscribe({
      next: () => this.loadDirectors(groupId),
      error: (err) => this.snackBar.open(err?.error?.error || 'Could not remove co-director.', 'Close', { duration: 5000 }),
    });
  }
}
