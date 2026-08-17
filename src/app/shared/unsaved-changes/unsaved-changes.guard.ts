import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HasUnsavedChanges, implementsHasUnsavedChanges } from './has-unsaved-changes';
import { UnsavedChangesService } from './unsaved-changes.service';

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async (component) => {
  if (!implementsHasUnsavedChanges(component)) return true;
  if (!component.hasUnsavedChanges()) return true;

  const unsavedSvc = inject(UnsavedChangesService);
  const discard = await firstValueFrom(unsavedSvc.promptDiscard());
  if (discard) {
    component.discardUnsavedChanges();
    return true;
  }
  return false;
};
