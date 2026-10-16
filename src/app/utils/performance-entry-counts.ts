import { PortalPerformance } from '../services/performance.service';

export interface PerformanceEntryCounts {
  semiFinal: number;
  final: number;
}

/** Entry counts from live performance API (same source as Performance page). */
export function countPerformanceEntries(performances: PortalPerformance[]): PerformanceEntryCounts {
  let semiFinal = 0;
  let final = 0;
  for (const p of performances) {
    const round = (p.round ?? '').toUpperCase();
    const n = p.entries?.length ?? 0;
    if (round.includes('SEMI')) {
      semiFinal += n;
    } else if (round.includes('FINAL')) {
      final += n;
    }
  }
  return { semiFinal, final };
}

export function performanceHasUnsubmittedWork(
  performances: PortalPerformance[],
  submittedAt: string | null,
): boolean {
  if (!submittedAt) {
    const counts = countPerformanceEntries(performances);
    return counts.semiFinal > 0 || counts.final > 0;
  }
  return false;
}
