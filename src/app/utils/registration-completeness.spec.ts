import {
  buildRegistrationCompleteness,
  buildRegistrationCompletenessFromPortalGroup,
} from './registration-completeness';
import { RegistrationSummary } from '../services/registration-summary.service';
import { PortalGroup } from '../services/group.service';

function baseSummary(overrides: Partial<RegistrationSummary> = {}): RegistrationSummary {
  return {
    group: {
      id: 1,
      name: 'Test Group',
      groupType: 'Dance',
      eventName: 'FDF',
      eventTimezone: 'UTC',
      isActive: true,
      isArchived: false,
      parish: null,
    },
    directors: { primaryDirector: null, coDirectorCount: 0 },
    roster: {
      memberCount: 5,
      minorCount: 0,
      requiredChaperones: 1,
      providedChaperones: 1,
      chaperoneRequirementSatisfied: true,
      submittedAt: null,
      deadline: { deadlineDate: '2026-01-01', effectiveCutoff: null, canEdit: true },
    },
    performance: {
      submissionType: 'DANCE_PERFORMANCE',
      semiFinalCount: 0,
      finalCount: 0,
      submittedAt: null,
      deadline: { deadlineDate: '2026-01-01', effectiveCutoff: null, canEdit: true },
    },
    costume: {
      semiFinalComplete: false,
      finalComplete: false,
      submittedAt: null,
      deadline: { deadlineDate: '2026-01-01', effectiveCutoff: null, canEdit: true },
    },
    documents: {
      signedRoster: { status: 'NOT_UPLOADED', submittedAt: null },
      youthSafety: { status: 'NOT_UPLOADED', submittedAt: null },
    },
    conflicts: {
      directorConflicts: 0,
      dancerConflicts: 0,
      musicianConflicts: 0,
      costumeConflicts: 0,
    },
    actionRequired: [],
    ...overrides,
  };
}

describe('buildRegistrationCompleteness', () => {
  it('omits costumes module for choral groups', () => {
    const summary = baseSummary({
      group: { ...baseSummary().group, groupType: 'Choral' },
      costume: null,
      performance: { ...baseSummary().performance, submissionType: 'CHORAL_PERFORMANCE' },
    });
    const result = buildRegistrationCompleteness(summary);
    expect(result.modules.map((m) => m.key)).toEqual(['roster', 'performance', 'documents']);
  });

  it('marks overall Ready when all dance modules submitted and no actions', () => {
    const summary = baseSummary({
      roster: { ...baseSummary().roster, submittedAt: '2026-01-01T00:00:00Z' },
      performance: { ...baseSummary().performance, submittedAt: '2026-01-01T00:00:00Z' },
      costume: { ...baseSummary().costume!, submittedAt: '2026-01-01T00:00:00Z' },
      documents: {
        signedRoster: { status: 'PENDING', submittedAt: '2026-01-01T00:00:00Z' },
        youthSafety: { status: 'VERIFIED', submittedAt: '2026-01-01T00:00:00Z' },
      },
    });
    const result = buildRegistrationCompleteness(summary);
    expect(result.overallLabel).toBe('Ready');
    expect(result.primaryCta?.routeSuffix).toEqual(['review']);
  });

  it('marks Action required for rejected documents and CTA to documents', () => {
    const summary = baseSummary({
      documents: {
        signedRoster: { status: 'REJECTED', submittedAt: '2026-01-01T00:00:00Z' },
        youthSafety: { status: 'VERIFIED', submittedAt: '2026-01-01T00:00:00Z' },
      },
    });
    const result = buildRegistrationCompleteness(summary);
    expect(result.overallLabel).toBe('Action required');
    expect(result.primaryCta?.label).toMatch(/Documents/i);
    expect(result.primaryCta?.routeSuffix).toEqual(['documents']);
  });

  it('marks Locked for past events', () => {
    const summary = baseSummary({
      group: { ...baseSummary().group, isActive: false },
    });
    const result = buildRegistrationCompleteness(summary);
    expect(result.overallLabel).toBe('Locked');
    expect(result.primaryCta?.emphasize).toBe(false);
  });
});

describe('buildRegistrationCompletenessFromPortalGroup', () => {
  const portalGroup: PortalGroup = {
    id: 2,
    name: 'Choral Group',
    groupType: 'Choral',
    parish: null,
    event: { id: 1, name: 'FDF', isActive: true },
    primaryDirector: { name: 'Dir', email: null },
    isReadOnly: false,
    rosterMemberCount: 3,
    rosterSubmittedAt: '2026-01-01T00:00:00Z',
    performanceSubmittedAt: '2026-01-01T00:00:00Z',
    documents: { signedRoster: 'PENDING', youthSafety: 'PENDING' },
  };

  it('choral ready without costumes module', () => {
    const result = buildRegistrationCompletenessFromPortalGroup(portalGroup);
    expect(result.modules.some((m) => m.key === 'costumes')).toBe(false);
    expect(result.overallLabel).toBe('Ready');
  });
});
