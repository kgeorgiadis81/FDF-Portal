import {
  DeadlineInfo,
  RegistrationSummary,
} from '../services/registration-summary.service';
import { PortalGroup } from '../services/group.service';

/** Shared module/overall status vocabulary (display labels). */
export type ModuleStatusLabel =
  | 'Not started'
  | 'In progress'
  | 'Submitted'
  | 'Action required'
  | 'Locked';

export type OverallStatusLabel =
  | 'Action required'
  | 'In progress'
  | 'Ready'
  | 'Locked';

export type ModuleStatusClass =
  | 'not-started'
  | 'in-progress'
  | 'submitted'
  | 'action-required'
  | 'locked';

export type OverallStatusClass =
  | 'action-required'
  | 'in-progress'
  | 'ready'
  | 'locked';

export type RegistrationModuleKey = 'roster' | 'performance' | 'costumes' | 'documents';

export interface ModuleCompletenessRow {
  key: RegistrationModuleKey;
  title: string;
  statusLabel: ModuleStatusLabel;
  statusClass: ModuleStatusClass;
  /** Route segments after `/groups/:id`. */
  routeSuffix: string[];
}

export interface PrimaryRegistrationCta {
  label: string;
  routeSuffix: string[];
  /** When false, use stroked / view-only styling (locked groups). */
  emphasize: boolean;
}

export interface RegistrationCompleteness {
  overallLabel: OverallStatusLabel;
  overallClass: OverallStatusClass;
  lockedExplanation: string | null;
  modules: ModuleCompletenessRow[];
  primaryCta: PrimaryRegistrationCta | null;
}

function isDanceGroupType(groupType: string): boolean {
  return groupType.toUpperCase() === 'DANCE';
}

function submissionModuleStatus(
  submittedAt: string | null,
  deadline: DeadlineInfo,
  hasDraftProgress: boolean,
  eventActive: boolean,
): { label: ModuleStatusLabel; class: ModuleStatusClass } {
  if (submittedAt) {
    return { label: 'Submitted', class: 'submitted' };
  }
  if (!eventActive || !deadline.canEdit) {
    return { label: 'Locked', class: 'locked' };
  }
  if (hasDraftProgress) {
    return { label: 'In progress', class: 'in-progress' };
  }
  return { label: 'Not started', class: 'not-started' };
}

function documentsModuleStatus(
  summary: RegistrationSummary,
): { label: ModuleStatusLabel; class: ModuleStatusClass } {
  const { signedRoster, youthSafety } = summary.documents;
  const statuses = [signedRoster.status, youthSafety.status];

  if (statuses.some((s) => s === 'REJECTED')) {
    return { label: 'Action required', class: 'action-required' };
  }

  const eventActive = summary.group.isActive && !summary.group.isArchived;
  if (!eventActive) {
    return { label: 'Locked', class: 'locked' };
  }

  const uploaded = (s: string) => s !== 'NOT_UPLOADED' && s !== '';
  const bothUploaded = uploaded(signedRoster.status) && uploaded(youthSafety.status);
  const anyUploaded = uploaded(signedRoster.status) || uploaded(youthSafety.status);

  if (bothUploaded) {
    return { label: 'Submitted', class: 'submitted' };
  }
  if (anyUploaded) {
    return { label: 'In progress', class: 'in-progress' };
  }
  return { label: 'Not started', class: 'not-started' };
}

function costumeHasDraftProgress(summary: RegistrationSummary): boolean {
  const c = summary.costume;
  if (!c) return false;
  return c.semiFinalComplete || c.finalComplete;
}

function performanceHasDraftProgress(summary: RegistrationSummary): boolean {
  const p = summary.performance;
  return p.semiFinalCount > 0 || p.finalCount > 0;
}

function rosterHasDraftProgress(summary: RegistrationSummary): boolean {
  return summary.roster.memberCount > 0;
}

export function isRegistrationLocked(summary: RegistrationSummary): boolean {
  return !summary.group.isActive || summary.group.isArchived;
}

function moduleRowsFromSummary(summary: RegistrationSummary): ModuleCompletenessRow[] {
  const eventActive = summary.group.isActive && !summary.group.isArchived;
  const dance = isDanceGroupType(summary.group.groupType);

  const roster = submissionModuleStatus(
    summary.roster.submittedAt,
    summary.roster.deadline,
    rosterHasDraftProgress(summary),
    eventActive,
  );

  const performance = submissionModuleStatus(
    summary.performance.submittedAt,
    summary.performance.deadline,
    performanceHasDraftProgress(summary),
    eventActive,
  );

  const documents = documentsModuleStatus(summary);

  const rows: ModuleCompletenessRow[] = [
    {
      key: 'roster',
      title: 'Roster',
      statusLabel: roster.label,
      statusClass: roster.class,
      routeSuffix: ['roster'],
    },
    {
      key: 'performance',
      title: 'Performance',
      statusLabel: performance.label,
      statusClass: performance.class,
      routeSuffix: ['performance'],
    },
  ];

  if (dance && summary.costume) {
    const costumes = submissionModuleStatus(
      summary.costume.submittedAt,
      summary.costume.deadline,
      costumeHasDraftProgress(summary),
      eventActive,
    );
    rows.push({
      key: 'costumes',
      title: 'Costumes',
      statusLabel: costumes.label,
      statusClass: costumes.class,
      routeSuffix: ['costumes'],
    });
  }

  rows.push({
    key: 'documents',
    title: 'Documents',
    statusLabel: documents.label,
    statusClass: documents.class,
    routeSuffix: ['documents'],
  });

  return rows;
}

function allRequiredModulesSubmitted(summary: RegistrationSummary, modules: ModuleCompletenessRow[]): boolean {
  return modules.every((m) => m.statusLabel === 'Submitted' || m.statusLabel === 'Locked');
}

function deriveOverall(
  summary: RegistrationSummary,
  modules: ModuleCompletenessRow[],
): Pick<RegistrationCompleteness, 'overallLabel' | 'overallClass' | 'lockedExplanation'> {
  if (isRegistrationLocked(summary)) {
    return {
      overallLabel: 'Locked',
      overallClass: 'locked',
      lockedExplanation: summary.group.isArchived
        ? 'This group is archived and registration can no longer be changed.'
        : 'This group belongs to a past FDF event. Registration is read-only — contact FDF Management if you need changes.',
    };
  }

  const hasActionRequired =
    summary.actionRequired.length > 0
    || modules.some((m) => m.statusLabel === 'Action required');

  if (hasActionRequired) {
    return {
      overallLabel: 'Action required',
      overallClass: 'action-required',
      lockedExplanation: null,
    };
  }

  if (allRequiredModulesSubmitted(summary, modules)) {
    return {
      overallLabel: 'Ready',
      overallClass: 'ready',
      lockedExplanation: null,
    };
  }

  const anyStarted = modules.some(
    (m) => m.statusLabel === 'In progress' || m.statusLabel === 'Submitted',
  );

  return {
    overallLabel: anyStarted ? 'In progress' : 'In progress',
    overallClass: 'in-progress',
    lockedExplanation: null,
  };
}

function pickPrimaryCta(
  summary: RegistrationSummary,
  modules: ModuleCompletenessRow[],
  overall: OverallStatusLabel,
): PrimaryRegistrationCta | null {
  const locked = isRegistrationLocked(summary);

  if (locked) {
    return {
      label: 'View Registration Review',
      routeSuffix: ['review'],
      emphasize: false,
    };
  }

  const documents = modules.find((m) => m.key === 'documents');
  if (documents?.statusLabel === 'Action required') {
    return {
      label: 'Fix Documents',
      routeSuffix: ['documents'],
      emphasize: true,
    };
  }

  const priority: RegistrationModuleKey[] = ['roster', 'performance', 'costumes', 'documents'];
  for (const key of priority) {
    const row = modules.find((m) => m.key === key);
    if (!row || row.statusLabel === 'Submitted' || row.statusLabel === 'Locked') {
      continue;
    }
    const label =
      row.statusLabel === 'Action required'
        ? `Fix ${row.title}`
        : `Continue ${row.title}`;
    return {
      label,
      routeSuffix: row.routeSuffix,
      emphasize: true,
    };
  }

  if (summary.actionRequired.length > 0) {
    return {
      label: 'Review Registration',
      routeSuffix: ['review'],
      emphasize: true,
    };
  }

  if (overall === 'Ready') {
    return {
      label: 'Review Registration',
      routeSuffix: ['review'],
      emphasize: true,
    };
  }

  return {
    label: 'Review Registration',
    routeSuffix: ['review'],
    emphasize: true,
  };
}

/** Build hub/dashboard completeness from the registration summary API. */
export function buildRegistrationCompleteness(summary: RegistrationSummary): RegistrationCompleteness {
  const modules = moduleRowsFromSummary(summary);
  const overall = deriveOverall(summary, modules);
  const primaryCta = pickPrimaryCta(summary, modules, overall.overallLabel);

  return {
    ...overall,
    modules,
    primaryCta,
  };
}

/** Fallback when summary is unavailable (less accurate — no conflicts / deadlines). */
export function buildRegistrationCompletenessFromPortalGroup(group: PortalGroup): RegistrationCompleteness {
  const dance = isDanceGroupType(group.groupType);
  const eventActive = group.event.isActive && !group.isReadOnly;

  const rosterLabel: ModuleStatusLabel = group.rosterSubmittedAt
    ? 'Submitted'
    : group.rosterMemberCount > 0
      ? 'In progress'
      : eventActive
        ? 'Not started'
        : 'Locked';

  const performanceLabel: ModuleStatusLabel = group.performanceSubmittedAt
    ? 'Submitted'
    : eventActive
      ? 'Not started'
      : 'Locked';

  const modules: ModuleCompletenessRow[] = [
    {
      key: 'roster',
      title: 'Roster',
      statusLabel: rosterLabel,
      statusClass: statusClassFromLabel(rosterLabel),
      routeSuffix: ['roster'],
    },
    {
      key: 'performance',
      title: 'Performance',
      statusLabel: performanceLabel,
      statusClass: statusClassFromLabel(performanceLabel),
      routeSuffix: ['performance'],
    },
  ];

  if (dance) {
    const costumeLabel: ModuleStatusLabel = group.costumeSubmittedAt
      ? 'Submitted'
      : eventActive
        ? 'Not started'
        : 'Locked';
    modules.push({
      key: 'costumes',
      title: 'Costumes',
      statusLabel: costumeLabel,
      statusClass: statusClassFromLabel(costumeLabel),
      routeSuffix: ['costumes'],
    });
  }

  const sr = group.documents?.signedRoster ?? '';
  const ys = group.documents?.youthSafety ?? '';
  let documentsLabel: ModuleStatusLabel = 'Not started';
  if (sr === 'REJECTED' || ys === 'REJECTED') {
    documentsLabel = 'Action required';
  } else if (sr && ys && sr !== 'NOT_UPLOADED' && ys !== 'NOT_UPLOADED') {
    documentsLabel = 'Submitted';
  } else if ((sr && sr !== 'NOT_UPLOADED') || (ys && ys !== 'NOT_UPLOADED')) {
    documentsLabel = 'In progress';
  } else if (!eventActive) {
    documentsLabel = 'Locked';
  }

  modules.push({
    key: 'documents',
    title: 'Documents',
    statusLabel: documentsLabel,
    statusClass: statusClassFromLabel(documentsLabel),
    routeSuffix: ['documents'],
  });

  let overallLabel: OverallStatusLabel;
  let lockedExplanation: string | null = null;

  if (!eventActive) {
    overallLabel = 'Locked';
    lockedExplanation =
      'This group belongs to a past FDF event. Registration is read-only — contact FDF Management if you need changes.';
  } else if (modules.some((m) => m.statusLabel === 'Action required')) {
    overallLabel = 'Action required';
  } else if (modules.every((m) => m.statusLabel === 'Submitted')) {
    overallLabel = 'Ready';
  } else {
    overallLabel = 'In progress';
  }

  const primaryCta = pickPrimaryCta(
    {
      group: {
        id: group.id,
        name: group.name,
        groupType: group.groupType,
        eventName: group.event.name,
        eventTimezone: '',
        isActive: group.event.isActive,
        isArchived: false,
        parish: group.parish,
      },
      directors: { primaryDirector: null, coDirectorCount: 0 },
      roster: {
        memberCount: group.rosterMemberCount,
        minorCount: 0,
        requiredChaperones: 0,
        providedChaperones: 0,
        chaperoneRequirementSatisfied: true,
        submittedAt: group.rosterSubmittedAt,
        deadline: { deadlineDate: null, effectiveCutoff: null, canEdit: eventActive },
      },
      performance: {
        submissionType: dance ? 'DANCE_PERFORMANCE' : 'CHORAL_PERFORMANCE',
        semiFinalCount: 0,
        finalCount: 0,
        submittedAt: group.performanceSubmittedAt ?? null,
        deadline: { deadlineDate: null, effectiveCutoff: null, canEdit: eventActive },
      },
      costume: dance
        ? {
            semiFinalComplete: !!group.costumeSubmittedAt,
            finalComplete: !!group.costumeSubmittedAt,
            submittedAt: group.costumeSubmittedAt ?? null,
            deadline: { deadlineDate: null, effectiveCutoff: null, canEdit: eventActive },
          }
        : null,
      documents: {
        signedRoster: { status: sr || 'NOT_UPLOADED', submittedAt: null },
        youthSafety: { status: ys || 'NOT_UPLOADED', submittedAt: null },
      },
      conflicts: {
        directorConflicts: 0,
        dancerConflicts: 0,
        musicianConflicts: 0,
        costumeConflicts: 0,
      },
      actionRequired: [],
    },
    modules,
    overallLabel,
  );

  return {
    overallLabel,
    overallClass: overallClassFromLabel(overallLabel),
    lockedExplanation,
    modules,
    primaryCta,
  };
}

function statusClassFromLabel(label: ModuleStatusLabel): ModuleStatusClass {
  switch (label) {
    case 'Submitted': return 'submitted';
    case 'In progress': return 'in-progress';
    case 'Action required': return 'action-required';
    case 'Locked': return 'locked';
    default: return 'not-started';
  }
}

function overallClassFromLabel(label: OverallStatusLabel): OverallStatusClass {
  switch (label) {
    case 'Ready': return 'ready';
    case 'Action required': return 'action-required';
    case 'Locked': return 'locked';
    default: return 'in-progress';
  }
}
