import { Injectable, OnDestroy, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, firstValueFrom, map } from 'rxjs';
import { UnsavedChangesDialogComponent, UnsavedChangesDialogData } from './unsaved-changes-dialog.component';

@Injectable({ providedIn: 'root' })
export class UnsavedChangesService implements OnDestroy {
  private readonly dialog = inject(MatDialog);
  private beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | null = null;
  private beforeUnloadCheck: (() => boolean) | null = null;

  /** Browser tab close / refresh warning when there are unsaved edits. */
  bindBeforeUnload(check: () => boolean): () => void {
    this.unbindBeforeUnload();
    this.beforeUnloadCheck = check;
    this.beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      if (check()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    return () => this.unbindBeforeUnload();
  }

  unbindBeforeUnload(): void {
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
      this.beforeUnloadCheck = null;
    }
  }

  ngOnDestroy(): void {
    this.unbindBeforeUnload();
  }

  promptDiscard(data?: UnsavedChangesDialogData): Observable<boolean> {
    return this.dialog.open(UnsavedChangesDialogComponent, {
      data,
      width: '440px',
      disableClose: true,
    }).afterClosed().pipe(map((result) => result === true));
  }

  /** Returns true when navigation may proceed; false when the user chose to keep editing. */
  async confirmLeave(
    hasUnsaved: () => boolean,
    discard: () => void,
    data?: UnsavedChangesDialogData,
  ): Promise<boolean> {
    if (!hasUnsaved()) return true;
    const discardConfirmed = await firstValueFrom(this.promptDiscard(data));
    if (discardConfirmed) {
      discard();
      return true;
    }
    return false;
  }
}
