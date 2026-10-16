/** User-facing deadline line: "Due … · N days left" or "No deadline set yet". */
export function formatDeadlineDueLine(deadlineDate: string | null | undefined, now = new Date()): string {
  if (!deadlineDate) {
    return 'No deadline set yet';
  }
  const due = parseDateOnly(deadlineDate);
  const formatted = due.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const daysLeft = daysUntil(due, now);
  if (daysLeft < 0) {
    return `Due ${formatted} · Past due`;
  }
  if (daysLeft === 0) {
    return `Due ${formatted} · Due today`;
  }
  if (daysLeft === 1) {
    return `Due ${formatted} · 1 day left`;
  }
  return `Due ${formatted} · ${daysLeft} days left`;
}

export function parseDateOnly(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysUntil(due: Date, now: Date): number {
  const dueDay = startOfLocalDay(due).getTime();
  const today = startOfLocalDay(now).getTime();
  return Math.round((dueDay - today) / (24 * 60 * 60 * 1000));
}

/** Locale date for roster tables and dialogs (US-style per product review). */
export function formatLocaleDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const d = parseDateOnly(isoDate);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatWholeAge(age: number | null | undefined): string {
  if (age === null || age === undefined || Number.isNaN(age)) {
    return '—';
  }
  return String(Math.floor(age));
}
