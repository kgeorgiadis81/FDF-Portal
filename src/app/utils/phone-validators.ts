import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Optional US-style phone: digits with optional +1, spaces, dashes, parentheses. */
export function optionalPhoneValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (!raw) return null;
  if (/[a-zA-Z]/.test(raw)) {
    return { phoneFormat: true };
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    return { phoneFormat: true };
  }
  return null;
}

export const PHONE_FORMAT_HINT = 'Use 10 digits, e.g. (555) 123-4567 or 555-123-4567.';
