import { RegistrationSummary } from '../services/registration-summary.service';
import { RegistrationModuleKey } from './registration-completeness';

export interface RegistrationChecklistStep {
  order: number;
  key: string;
  label: string;
  done: boolean;
  routeSuffix: string[];
}

export interface RegistrationChecklist {
  steps: RegistrationChecklistStep[];
  completedCount: number;
  totalCount: number;
  nextStep: RegistrationChecklistStep | null;
  summaryLine: string;
}

const TOTAL_STEPS = 5;

function documentsComplete(summary: RegistrationSummary): boolean {
  const sr = summary.documents.signedRoster.status;
  const ys = summary.documents.youthSafety.status;
  const uploaded = (s: string) => s !== 'NOT_UPLOADED' && s !== '';
  return uploaded(sr) && uploaded(ys);
}

function isDance(groupType: string): boolean {
  return groupType.toUpperCase() === 'DANCE';
}

/** Ordered registration checklist (5 steps) for hub and dashboard cards. */
export function buildRegistrationChecklist(summary: RegistrationSummary): RegistrationChecklist {
  const dance = isDance(summary.group.groupType);
  const parishOk = Boolean(summary.group.parish?.name);

  const steps: RegistrationChecklistStep[] = [
    {
      order: 1,
      key: 'group',
      label: 'Confirm group details',
      done: parishOk,
      routeSuffix: [],
    },
    {
      order: 2,
      key: 'roster',
      label: 'Submit roster',
      done: Boolean(summary.roster.submittedAt),
      routeSuffix: ['roster'],
    },
    {
      order: 3,
      key: 'performance',
      label: 'Submit performance',
      done: Boolean(summary.performance.submittedAt),
      routeSuffix: ['performance'],
    },
    {
      order: 4,
      key: 'costumes',
      label: dance ? 'Submit costumes' : 'Costumes (not required)',
      done: dance ? Boolean(summary.costume?.submittedAt) : true,
      routeSuffix: dance ? ['costumes'] : [],
    },
    {
      order: 5,
      key: 'documents',
      label: 'Upload documents',
      done: documentsComplete(summary),
      routeSuffix: ['documents'],
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done) ?? null;
  const nextLabel = nextStep ? nextStep.label : 'Review registration';
  const summaryLine = `${completedCount} of ${TOTAL_STEPS} steps done, Next: ${nextLabel}`;

  return {
    steps,
    completedCount,
    totalCount: TOTAL_STEPS,
    nextStep,
    summaryLine,
  };
}

export function deadlineForModule(
  summary: RegistrationSummary,
  key: RegistrationModuleKey,
): string | null {
  switch (key) {
    case 'roster':
      return summary.roster.deadline.deadlineDate;
    case 'performance':
      return summary.performance.deadline.deadlineDate;
    case 'costumes':
      return summary.costume?.deadline.deadlineDate ?? null;
    case 'documents':
      return null;
    default:
      return null;
  }
}

export function actionRequiredExplanation(summary: RegistrationSummary): string | null {
  if (summary.actionRequired.length > 0) {
    return summary.actionRequired[0];
  }
  const sr = summary.documents.signedRoster.status;
  const ys = summary.documents.youthSafety.status;
  if (sr === 'REJECTED' || ys === 'REJECTED') {
    return 'A document was rejected — upload a corrected PDF.';
  }
  return null;
}
