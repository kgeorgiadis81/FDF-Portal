import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface UnsavedChangesDialogData {
  title?: string;
  message?: string;
}

@Component({
  selector: 'fdp-unsaved-changes-dialog',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title ?? 'Unsaved changes' }}</h2>
    <mat-dialog-content>
      <p>{{ data.message ?? 'You have unsaved changes. Leave this page and discard them?' }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close(false)" cdkFocusInitial>
        Keep editing
      </button>
      <button mat-raised-button color="warn" type="button" (click)="dialogRef.close(true)">
        Discard changes
      </button>
    </mat-dialog-actions>
  `,
})
export class UnsavedChangesDialogComponent {
  readonly data = inject<UnsavedChangesDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  readonly dialogRef = inject(MatDialogRef<UnsavedChangesDialogComponent, boolean>);
}
