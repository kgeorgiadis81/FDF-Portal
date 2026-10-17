import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { ReviewComponent } from './review.component';
import { DeadlineInfo, RegistrationSummary } from '../../../services/registration-summary.service';

const routeState = { id: '1' };

const openDeadline: DeadlineInfo = { deadlineDate: '2026-06-15', effectiveCutoff: null, canEdit: true };
const closedDeadline: DeadlineInfo = { deadlineDate: null, effectiveCutoff: null, canEdit: false };

const summary: RegistrationSummary = {
  group: {
    id: 1, name: 'Alpha', groupType: 'Dance', eventName: 'FDF', eventTimezone: 'UTC',
    isActive: true, isArchived: false, parish: { name: 'Athens', location: 'GR' },
  },
  directors: { primaryDirector: { name: 'Ada', email: 'ada@e2e.test' }, coDirectorCount: 1 },
  roster: {
    memberCount: 4, minorCount: 1, requiredChaperones: 1, providedChaperones: 1,
    chaperoneRequirementSatisfied: true, submittedAt: null, deadline: openDeadline,
  },
  performance: {
    submissionType: 'DANCE_PERFORMANCE', semiFinalCount: 1, finalCount: 1,
    submittedAt: '2026-06-01T12:00:00.000Z', deadline: openDeadline,
  },
  costume: {
    semiFinalComplete: false, finalComplete: false, submittedAt: null, deadline: closedDeadline,
  },
  documents: {
    signedRoster: { status: 'REJECTED', submittedAt: null },
    youthSafety: { status: 'VERIFIED', submittedAt: '2026-06-01T12:00:00.000Z' },
  },
  conflicts: { directorConflicts: 1, dancerConflicts: 2, musicianConflicts: 0, costumeConflicts: 3 },
  actionRequired: ['Replace the signed roster'],
};

describe('ReviewComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    routeState.id = '1';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useFactory: () => ({
          snapshot: {
            paramMap: convertToParamMap(routeState.id ? { id: routeState.id } : {}),
            queryParamMap: convertToParamMap({}),
          },
        }) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.match('/api/portal/auth/public-config').forEach((req) =>
      req.flush({ privacyPolicyUrl: '', requiredConsentVersion: '1.0' }),
    );
    httpMock.verify();
  });

  function create(): ReviewComponent {
    const fixture = TestBed.createComponent(ReviewComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  function flushReview(
    summaryBody: object | string,
    summaryStatus?: { status: number; statusText: string },
    performances: unknown[] = [],
  ): void {
    const summaryReq = httpMock.expectOne('/api/portal/groups/1/registration-summary');
    const performanceReq = httpMock.expectOne('/api/groups/1/performance');
    performanceReq.flush({ performances });
    if (summaryStatus) {
      summaryReq.flush(summaryBody, summaryStatus);
    } else {
      summaryReq.flush(summaryBody);
    }
  }

  it('rejects a missing group id', () => {
    routeState.id = '';
    const component = create();
    expect(component.error()).toBe('Invalid group.');
    expect(component.loading()).toBeFalse();
    expect(component.totalConflicts()).toBe(0);
    expect(component.hasActions()).toBeFalse();
    expect(component.performanceCountsDiffer()).toBeFalse();
  });

  it('loads a dance summary and maps status labels', () => {
    const fixture = TestBed.createComponent(ReviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushReview(summary, undefined, [
      { id: 1, round: 'SEMI_FINAL', entries: [{}, {}] },
      { id: 2, round: 'FINAL', entries: [{}] },
      { id: 3, round: 'SHOWCASE' },
    ]);
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.isActive()).toBeTrue();
    expect(component.isDance()).toBeTrue();
    expect(component.hasActions()).toBeTrue();
    expect(component.totalConflicts()).toBe(6);
    expect(component.submissionLabel('2026-06-01T00:00:00Z', openDeadline)).toBe('Submitted');
    expect(component.submissionLabel(null, openDeadline)).toBe('Not submitted');
    expect(component.submissionLabel(null, closedDeadline)).toBe('Closed');
    expect(component.submissionClass('2026-06-01T00:00:00Z', openDeadline)).toBe('status-submitted');
    expect(component.submissionClass(null, openDeadline)).toBe('status-not-started');
    expect(component.submissionClass(null, closedDeadline)).toBe('status-closed');
    expect(component.docLabel('VERIFIED', true)).toBe('Verified');
    expect(component.docLabel('REJECTED', false)).toBe('Action Required');
    expect(component.docLabel('PENDING', true)).toBe('Pending Review');
    expect(component.docLabel('NOT_UPLOADED', true)).toBe('Missing');
    expect(component.docLabel('NOT_UPLOADED', false)).toBe('Not uploaded');
    expect(component.docLabel('OTHER', true)).toBe('Missing');
    expect(component.docLabel('OTHER', false)).toBe('Not uploaded');
    expect(component.docClass('VERIFIED')).toBe('status-submitted');
    expect(component.docClass('REJECTED')).toBe('status-rejected');
    expect(component.docClass('PENDING')).toBe('status-pending');
    expect(component.docClass('OTHER')).toBe('status-not-started');
    expect(component.actionLink(null, true, 'Roster')).toBe('Manage Roster');
    expect(component.actionLink(null, false, 'Roster')).toBe('View Roster');
    expect(component.formatDeadline('2026-06-15')).toContain('2026');
    expect(component.formatDeadline(null)).toBe('No deadline set yet');
    expect(component.performanceCountsDiffer()).toBeTrue();
    expect(component.formatTimestamp('2026-06-01T12:00:00.000Z')).toContain('2026');
    expect(component.formatTimestamp(null)).toBe('—');
  });

  it('uses view labels for an inactive choral summary and falls back on load errors', () => {
    const choral: RegistrationSummary = {
      ...summary,
      group: { ...summary.group, groupType: 'Choral', isActive: false },
      costume: null,
      conflicts: { directorConflicts: 0, dancerConflicts: 0, musicianConflicts: 0, costumeConflicts: 0 },
      actionRequired: [],
    };
    const component = create();
    flushReview(choral);
    expect(component.isDance()).toBeFalse();
    expect(component.isActive()).toBeFalse();
    expect(component.actionLink(null, true, 'Performance')).toBe('View Performance');
    expect(component.totalConflicts()).toBe(0);

    const failed = create();
    flushReview({ error: 'Denied' }, { status: 403, statusText: 'Forbidden' });
    expect(failed.error()).toBe('Denied');

    const fallback = create();
    flushReview('nope', { status: 500, statusText: 'Error' });
    expect(fallback.error()).toBe('Unable to load registration summary.');
    expect(fallback.loading()).toBeFalse();
  });
});
