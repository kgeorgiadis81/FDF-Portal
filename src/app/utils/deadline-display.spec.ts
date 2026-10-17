import { formatDeadlineDueLine, formatLocaleDate, formatWholeAge } from './deadline-display';

describe('deadline-display', () => {
  it('formats due line with days left', () => {
    const now = new Date(2026, 0, 1);
    expect(formatDeadlineDueLine('2026-01-11', now)).toContain('10 days left');
  });

  it('shows no deadline message when date missing', () => {
    expect(formatDeadlineDueLine(null)).toBe('No deadline set yet');
    expect(formatDeadlineDueLine(undefined)).toBe('No deadline set yet');
  });

  it('formats due today, one day left, and past due', () => {
    const now = new Date(2026, 5, 15);
    expect(formatDeadlineDueLine('2026-06-15', now)).toContain('Due today');
    expect(formatDeadlineDueLine('2026-06-16', now)).toContain('1 day left');
    expect(formatDeadlineDueLine('2026-06-14', now)).toContain('Past due');
  });

  it('formats locale date and whole age', () => {
    expect(formatLocaleDate('2010-06-15')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(formatLocaleDate(null)).toBe('—');
    expect(formatWholeAge(43.54)).toBe('43');
    expect(formatWholeAge(null)).toBe('—');
    expect(formatWholeAge(undefined)).toBe('—');
    expect(formatWholeAge(Number.NaN)).toBe('—');
  });
});
