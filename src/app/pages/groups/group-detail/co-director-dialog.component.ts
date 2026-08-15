import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { GroupDirector } from '../../../services/director.service';

export interface CoDirectorDialogData {
  director?: GroupDirector;
}

@Component({
  selector: 'fdp-co-director-dialog',
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatFormFieldModule, MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <h2 mat-dialog-title>{{ data.director ? 'Edit Co-Director' : 'Add Co-Director' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="co-dir-form">
        <mat-form-field>
          <mat-label>First name</mat-label>
          <input matInput formControlName="first_name" autocomplete="given-name" />
          @if (form.get('first_name')?.invalid && form.get('first_name')?.touched) {
            <mat-error>First name is required.</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Last name</mat-label>
          <input matInput formControlName="last_name" autocomplete="family-name" />
          @if (form.get('last_name')?.invalid && form.get('last_name')?.touched) {
            <mat-error>Last name is required.</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Email (optional)</mat-label>
          <input matInput formControlName="email" type="email" autocomplete="email" />
          @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
            <mat-error>Enter a valid email address.</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Cell phone (optional)</mat-label>
          <input matInput formControlName="cell_phone" type="tel" autocomplete="tel" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="save()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .co-dir-form {
      display: flex; flex-direction: column; gap: .25rem; min-width: 300px;
    }
    mat-form-field { width: 100%; }
  `],
})
export class CoDirectorDialogComponent {
  readonly data: CoDirectorDialogData = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<CoDirectorDialogComponent>);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    first_name: [this.data.director?.first_name ?? '', [Validators.required, Validators.maxLength(100)]],
    last_name:  [this.data.director?.last_name ?? '',  [Validators.required, Validators.maxLength(100)]],
    email:      [this.data.director?.email ?? '',      [Validators.email, Validators.maxLength(255)]],
    cell_phone: [this.data.director?.cell_phone ?? '', [Validators.maxLength(30)]],
  });

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.value;
    this.dialogRef.close({
      first_name: v.first_name!.trim(),
      last_name:  v.last_name!.trim(),
      email:      v.email?.trim() || undefined,
      cell_phone: v.cell_phone?.trim() || undefined,
    });
  }
}
