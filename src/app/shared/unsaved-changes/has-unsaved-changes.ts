/** Implemented by routed components that track editable form state. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
  discardUnsavedChanges(): void;
}

export function implementsHasUnsavedChanges(component: unknown): component is HasUnsavedChanges {
  const candidate = component as HasUnsavedChanges;
  return typeof candidate?.hasUnsavedChanges === 'function'
    && typeof candidate?.discardUnsavedChanges === 'function';
}
