import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Chaperone } from '../../../../services/roster.service';
import { ContextHelpComponent } from '../../../../shared/context-help/context-help.component';

export interface ChaperoneDialogData {
  chaperone?: Chaperone;
}

export interface ChaperoneDialogResult {
  first_name: string;
  last_name: string;
  phone: string | null;
  is_21_or_older_confirmed: boolean;
}

@Component({
  selector: 'fdp-chaperone-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    ContextHelpComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit Chaperone' : 'Add Chaperone' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" novalidate>
        <mat-form-field>
          <mat-label>
            <span class="fdp-label-with-help">
              <span>First Name</span>
              <app-context-help helpKey="roster.chaperoneName" label="Chaperone Name" />
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
              <app-context-help helpKey="roster.chaperoneName" label="Chaperone Name" />
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
              <span>Phone Number</span>
              <app-context-help helpKey="roster.chaperonePhone" label="Chaperone Phone" />
            </span>
          </mat-label>
          <input matInput formControlName="phone"
                 type="tel"
                 autocomplete="off"
                 maxlength="30"
                 placeholder="Optional" />
          @if (form.get('phone')?.errors?.['maxlength']) {
            <mat-error>Phone number is too long.</mat-error>
          }
        </mat-form-field>

        <div class="age-confirmation">
          <mat-checkbox formControlName="is_21_or_older_confirmed" color="primary">
            <span class="fdp-label-with-help">
              <span>I confirm this chaperone will be at least 21 years old at FDF.</span>
              <app-context-help helpKey="roster.chaperone21Plus" label="21+ Confirmation" />
            </span>
          </mat-checkbox>
        </div>

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
          {{ isEdit ? 'Save Changes' : 'Add Chaperone' }}
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
    .age-confirmation {
      padding: 8px 0 4px;
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
export class ChaperoneDialogComponent {
  form: FormGroup;
  isEdit: boolean;
  saving = false;
  serverError = '';

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ChaperoneDialogComponent, ChaperoneDialogResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: ChaperoneDialogData,
  ) {
    this.isEdit = !!data.chaperone;
    const chap = data.chaperone;
    this.form = this.fb.group({
      first_name:              [chap?.first_name ?? '',  [Validators.required, Validators.maxLength(100)]],
      last_name:               [chap?.last_name ?? '',   [Validators.required, Validators.maxLength(100)]],
      phone:                   [chap?.phone ?? '',       [Validators.maxLength(30)]],
      is_21_or_older_confirmed: [
        chap ? Boolean(chap.is_21_or_older_confirmed) : false
      ],
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.dialogRef.close({
      first_name:               this.form.value.first_name.trim(),
      last_name:                this.form.value.last_name.trim(),
      phone:                    this.form.value.phone?.trim() || null,
      is_21_or_older_confirmed: this.form.value.is_21_or_older_confirmed,
    });
  }
}
