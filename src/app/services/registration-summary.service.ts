import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DeadlineInfo {
  deadlineDate: string | null;
  effectiveCutoff: string | null;
  canEdit: boolean;
}

export interface RegistrationSummary {
  group: {
    id: number;
    name: string;
    groupType: string;
    eventName: string;
    eventTimezone: string;
    isActive: boolean;
    isArchived: boolean;
    parish: { name: string; location: string | null } | null;
  };
  directors: {
    primaryDirector: { name: string | null; email: string | null } | null;
    coDirectorCount: number;
  };
  roster: {
    memberCount: number;
    minorCount: number;
    requiredChaperones: number;
    providedChaperones: number;
    chaperoneRequirementSatisfied: boolean;
    submittedAt: string | null;
    deadline: DeadlineInfo;
  };
  performance: {
    submissionType: string;
    semiFinalCount: number;
    finalCount: number;
    submittedAt: string | null;
    deadline: DeadlineInfo;
  };
  costume: {
    semiFinalComplete: boolean;
    finalComplete: boolean;
    submittedAt: string | null;
    deadline: DeadlineInfo;
  } | null;
  documents: {
    signedRoster: { status: string; submittedAt: string | null };
    youthSafety: { status: string; submittedAt: string | null };
  };
  conflicts: {
    directorConflicts: number;
    dancerConflicts: number;
    musicianConflicts: number;
    costumeConflicts: number;
  };
  actionRequired: string[];
}

@Injectable({ providedIn: 'root' })
export class RegistrationSummaryService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  /** Get the full registration summary for a group. */
  getSummary(groupId: number): Observable<RegistrationSummary> {
    return this.http.get<RegistrationSummary>(`${this.base}/portal/groups/${groupId}/registration-summary`);
  }
}
