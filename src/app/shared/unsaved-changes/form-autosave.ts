import { FormGroup } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { cloneFormValue, formValuesEqual } from './form-values.util';

export interface FormAutosaveOptions<T extends Record<string, unknown>> {
  debounceMs?: number;
  enabled: () => boolean;
  isValid?: () => boolean;
  save: (value: T) => Observable<unknown>;
  onSaving?: () => void;
  onSuccess?: (value: T) => void;
  onError?: (err: unknown) => void;
}

/**
 * Tracks a reactive form against a saved baseline, debounces valid changes, and auto-persists.
 * "Unsaved" means the current value differs from the last saved baseline, or a save is pending.
 */
export class FormAutosaveCoordinator<T extends Record<string, unknown>> {
  private baseline!: T;
  private subscription?: Subscription;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private saveInFlight = false;
  private saveScheduled = false;

  constructor(
    private readonly form: FormGroup,
    private readonly options: FormAutosaveOptions<T>,
  ) {}

  connect(): void {
    this.disconnect();
    this.subscription = this.form.valueChanges.subscribe(() => this.onValueChange());
  }

  disconnect(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.clearScheduledSave();
  }

  setBaseline(value: T): void {
    this.baseline = cloneFormValue(value);
    this.form.patchValue(value, { emitEvent: false });
    this.clearScheduledSave();
    this.saveInFlight = false;
  }

  getBaseline(): T {
    return cloneFormValue(this.baseline);
  }

  hasUnsavedChanges(): boolean {
    if (!this.options.enabled()) return false;
    if (this.saveInFlight || this.saveScheduled) return true;
    return !formValuesEqual(this.form.getRawValue(), this.baseline);
  }

  discardChanges(): void {
    this.clearScheduledSave();
    this.saveInFlight = false;
    this.form.patchValue(this.baseline, { emitEvent: false });
  }

  private onValueChange(): void {
    if (!this.options.enabled()) return;
    const current = this.form.getRawValue() as T;
    if (formValuesEqual(current, this.baseline)) {
      this.clearScheduledSave();
      return;
    }
    if (this.options.isValid && !this.options.isValid()) return;
    this.scheduleSave();
  }

  private scheduleSave(): void {
    this.saveScheduled = true;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.saveScheduled = false;
      this.executeSave();
    }, this.options.debounceMs ?? 800);
  }

  private executeSave(): void {
    if (!this.options.enabled()) return;
    if (this.options.isValid && !this.options.isValid()) return;

    const current = this.form.getRawValue() as T;
    if (formValuesEqual(current, this.baseline)) return;

    this.options.onSaving?.();
    this.saveInFlight = true;
    this.options.save(current).subscribe({
      next: () => {
        this.saveInFlight = false;
        this.baseline = cloneFormValue(current);
        this.options.onSuccess?.(current);
      },
      error: (err) => {
        this.saveInFlight = false;
        this.options.onError?.(err);
      },
    });
  }

  private clearScheduledSave(): void {
    this.saveScheduled = false;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = undefined;
  }
}
