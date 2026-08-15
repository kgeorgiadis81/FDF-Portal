import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RosterMember } from '../../../../services/roster.service';
import { ContextHelpComponent } from '../../../../shared/context-help/context-help.component';

export interface ParticipantDialogData {
  member?: RosterMember;
  ageReferenceDate?: string; // ISO date string for client-side preview
}

export interface ParticipantDialogResult {
  first_name: string;
  last_name: string;
  date_of_birth: string;
}

/** Validator: date must not be in the future */
function notFutureDateValidator(control: AbstractControl) {
  if (!control.value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dob = new Date(control.value + 'T00:00:00');
  if (dob > today) {
    return { futureDate: true };
  }
  return null;
}

@Component({
  selector: 'fdp-participant-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ContextHelpComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit Participant' : 'Add Participant' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" novalidate>
        <mat-form-field>
          <mat-label>
            <span class="fdp-label-with-help">
              <span>First Name</span>
              <app-context-help helpKey="roster.firstName" label="Participant First Name" />
            </span>
          </mat-label>
          <input matInput formControlName="first_name"
                 autocomplete="off"
                 maxlength="100" />
          @if (form.get('first_name')?.invalid && form.get('first_name')?.touched) {
            <mat-error>First name is required.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>
            <span class="fdp-label-with-help">
              <span>Last Name</span>
              <app-context-help helpKey="roster.lastName" label="Participant Last Name" />
            </span>
          </mat-label>
          <input matInput formControlName="last_name"
                 autocomplete="off"
                 maxlength="100" />
          @if (form.get('last_name')?.invalid && form.get('last_name')?.touched) {
            <mat-error>Last name is required.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>
            <span class="fdp-label-with-help">
              <span>Date of Birth</span>
              <app-context-help helpKey="roster.dateOfBirth" label="Date of Birth" />
            </span>
          </mat-label>
          <input matInput formControlName="date_of_birth"
                 type="date"
                 autocomplete="off"
                 [max]="today" />
          @if (form.get('date_of_birth')?.errors?.['required'] && form.get('date_of_birth')?.touched) {
            <mat-error>Date of birth is required.</mat-error>
          } @else if (form.get('date_of_birth')?.errors?.['futureDate'] && form.get('date_of_birth')?.touched) {
            <mat-error>Date of birth cannot be in the future.</mat-error>
          }
          <mat-hint>Enter as YYYY-MM-DD or use the date picker</mat-hint>
        </mat-form-field>

        @if (serverError) {
          <p class="server-error" role="alert">{{ serverError }}</p>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary"
              [disabled]="saving"
              (click)="submit()">
        @if (saving) {
          <mat-spinner diameter="18" />
        } @else {
          {{ isEdit ? 'Save Changes' : 'Add Participant' }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 0;
      min-width: min(480px, 90vw);
      padding-bottom: 8px;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    mat-form-field {
      width: 100%;
    }
    .server-error {
      color: var(--mat-sys-error);
      font-size: 0.875rem;
      margin: 8px 0 0;
    }
    mat-dialog-actions {
      padding: 8px 24px 16px;
    }
  `],
})
export class ParticipantDialogComponent {
  form: FormGroup;
  isEdit: boolean;
  saving = false;
  serverError = '';
  readonly today = new Date().toISOString().split('T')[0];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ParticipantDialogComponent, ParticipantDialogResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: ParticipantDialogData,
  ) {
    this.isEdit = !!data.member;
    this.form = this.fb.group({
      first_name:    [data.member?.first_name ?? '',   [Validators.required, Validators.maxLength(100)]],
      last_name:     [data.member?.last_name ?? '',    [Validators.required, Validators.maxLength(100)]],
      date_of_birth: [data.member?.date_of_birth ?? '', [Validators.required, notFutureDateValidator]],
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.dialogRef.close({
      first_name:    this.form.value.first_name.trim(),
      last_name:     this.form.value.last_name.trim(),
      date_of_birth: this.form.value.date_of_birth,
    });
  }
}
