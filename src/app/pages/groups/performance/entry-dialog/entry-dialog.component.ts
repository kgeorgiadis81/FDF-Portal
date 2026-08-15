import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import {
  ChoralEntry, ChoralClassification, DanceEntry,
} from '../../../../services/performance.service';

export interface EntryDialogData {
  isDance: boolean;
  entry?: DanceEntry | ChoralEntry;
  roundLabel: string;
}

export type EntryDialogResult = Record<string, unknown>;

@Component({
  selector: 'fdp-entry-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <h2 mat-dialog-title>{{ isEdit ? (isDance ? 'Edit Dance' : 'Edit Song') : (isDance ? 'Add Dance' : 'Add Song') }}</h2>
    <p class="round-hint">{{ roundLabel }}</p>

    <mat-dialog-content>
      <form [formGroup]="form" novalidate>
        <mat-form-field>
          <mat-label>{{ isDance ? 'Dance Name' : 'Song Name' }}</mat-label>
          <input matInput formControlName="name" maxlength="255" />
          @if (form.get('name')?.invalid && form.get('name')?.touched) {
            <mat-error>Name is required.</mat-error>
          }
        </mat-form-field>

        @if (isDance) {
          <mat-form-field>
            <mat-label>Region</mat-label>
            <input matInput formControlName="region" maxlength="255" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Village</mat-label>
            <input matInput formControlName="village" maxlength="255" />
          </mat-form-field>
          <div class="checkbox-group" role="group" aria-label="Music and singing options">
            <mat-checkbox formControlName="uses_live_music">Live Music</mat-checkbox>
            <mat-checkbox formControlName="uses_recorded_music">Recorded Music</mat-checkbox>
            <mat-checkbox formControlName="is_acapella">Acapella</mat-checkbox>
            <mat-checkbox formControlName="dancers_singing">Dancer(s) Singing</mat-checkbox>
            <mat-checkbox formControlName="musicians_singing">Musician(s) Singing</mat-checkbox>
            <mat-checkbox formControlName="individual_singing">Individual Singing</mat-checkbox>
          </div>
        } @else {
          <mat-form-field>
            <mat-label>Secular / Liturgical</mat-label>
            <mat-select formControlName="choral_classification">
              <mat-option value="SECULAR">Secular</mat-option>
              <mat-option value="LITURGICAL">Liturgical</mat-option>
            </mat-select>
          </mat-form-field>
          <div class="checkbox-group" role="group" aria-label="Music options">
            <mat-checkbox formControlName="uses_live_music">Live Music</mat-checkbox>
            <mat-checkbox formControlName="uses_recorded_music">Recorded Music</mat-checkbox>
          </div>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="submit()">
        {{ isEdit ? 'Save' : 'Add' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: min(480px, 90vw); }
    form { display: flex; flex-direction: column; gap: 4px; }
    mat-form-field { width: 100%; }
    .checkbox-group { display: flex; flex-direction: column; gap: 8px; margin: 8px 0 16px; }
    .round-hint { margin: 0 24px; color: var(--mat-sys-on-surface-variant); font-size: 0.875rem; }
  `],
})
export class EntryDialogComponent {
  form: FormGroup;
  isEdit: boolean;
  isDance: boolean;
  roundLabel: string;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<EntryDialogComponent, EntryDialogResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: EntryDialogData,
  ) {
    this.isDance = data.isDance;
    this.isEdit = !!data.entry;
    this.roundLabel = data.roundLabel;

    const e = data.entry;
    if (data.isDance) {
      const d = e as DanceEntry | undefined;
      this.form = this.fb.group({
        name: [d?.name ?? '', Validators.required],
        region: [d?.region ?? ''],
        village: [d?.village ?? ''],
        uses_live_music: [d?.uses_live_music ?? false],
        uses_recorded_music: [d?.uses_recorded_music ?? false],
        is_acapella: [d?.is_acapella ?? false],
        dancers_singing: [d?.dancers_singing ?? false],
        musicians_singing: [d?.musicians_singing ?? false],
        individual_singing: [d?.individual_singing ?? false],
      });
    } else {
      const c = e as ChoralEntry | undefined;
      this.form = this.fb.group({
        name: [c?.name ?? '', Validators.required],
        choral_classification: [c?.choral_classification ?? 'SECULAR' as ChoralClassification],
        uses_live_music: [c?.uses_live_music ?? false],
        uses_recorded_music: [c?.uses_recorded_music ?? false],
      });
    }
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.value;
    this.dialogRef.close({
      name: v.name.trim(),
      region: v.region?.trim() || null,
      village: v.village?.trim() || null,
      uses_live_music: !!v.uses_live_music,
      uses_recorded_music: !!v.uses_recorded_music,
      is_acapella: !!v.is_acapella,
      dancers_singing: !!v.dancers_singing,
      musicians_singing: !!v.musicians_singing,
      individual_singing: !!v.individual_singing,
      choral_classification: v.choral_classification ?? null,
    });
  }
}
