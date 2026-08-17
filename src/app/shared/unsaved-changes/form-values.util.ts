/** Deep-ish equality for plain form value objects (JSON-serializable). */
export function formValuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeFormValue(a)) === JSON.stringify(normalizeFormValue(b));
}

export function cloneFormValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeFormValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(normalizeFormValue);
  const obj = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined || v === '') {
      normalized[key] = null;
    } else {
      normalized[key] = normalizeFormValue(v);
    }
  }
  return normalized;
}
