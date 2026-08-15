import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface RosterMember {
  id: number;
  group_id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string; // YYYY-MM-DD
  age_at_fdf: number | null;
  member_order: number;
}

export interface Chaperone {
  id: number;
  group_id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_21_or_older_confirmed: boolean | 0 | 1;
}

export interface RosterSummary {
  member_count: number;
  minor_count: number;
  required_chaperones: number;
  provided_chaperones: number;
  chaperone_requirement_satisfied: boolean;
}

export interface RosterContext {
  group: {
    id: number;
    groupType: string;
    eventId: number;
    eventName: string;
    isActive: boolean;
    isArchived: boolean;
    eventTimezone: string | null;
  };
  deadline: {
    deadline_date: string | null;
    effective_cutoff: string | null;
    can_edit: boolean;
  };
  summary: RosterSummary;
  submission: { submitted_at: string } | null;
}

export interface RosterResponse {
  members: RosterMember[];
  summary: RosterSummary | null;
}

@Injectable({ providedIn: 'root' })
export class RosterService {
  private readonly api = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  /** Roster context: deadline, summary, submission status (no PII list). */
  getRosterContext(groupId: number) {
    return this.http.get<RosterContext>(`${this.api}/portal/groups/${groupId}/roster-context`);
  }

  /** Full roster member list with age_at_fdf. */
  getRoster(groupId: number) {
    return this.http.get<RosterResponse>(`${this.api}/groups/${groupId}/roster`);
  }

  addMember(groupId: number, data: { first_name: string; last_name: string; date_of_birth: string }) {
    return this.http.post<{ id: number }>(`${this.api}/groups/${groupId}/roster`, data);
  }

  updateMember(groupId: number, memberId: number, data: { first_name: string; last_name: string; date_of_birth: string; member_order?: number }) {
    return this.http.put<{ message: string }>(`${this.api}/groups/${groupId}/roster/${memberId}`, data);
  }

  deleteMember(groupId: number, memberId: number) {
    return this.http.delete<{ message: string }>(`${this.api}/groups/${groupId}/roster/${memberId}`);
  }

  /** Chaperone CRUD. */
  getChaperones(groupId: number) {
    return this.http.get<Chaperone[]>(`${this.api}/groups/${groupId}/chaperones`);
  }

  addChaperone(groupId: number, data: { first_name: string; last_name: string; phone?: string | null; is_21_or_older_confirmed: boolean }) {
    return this.http.post<{ id: number }>(`${this.api}/groups/${groupId}/chaperones`, data);
  }

  updateChaperone(groupId: number, chaperoneId: number, data: { first_name: string; last_name: string; phone?: string | null; is_21_or_older_confirmed: boolean }) {
    return this.http.put<{ message: string }>(`${this.api}/groups/${groupId}/chaperones/${chaperoneId}`, data);
  }

  deleteChaperone(groupId: number, chaperoneId: number) {
    return this.http.delete<{ message: string }>(`${this.api}/groups/${groupId}/chaperones/${chaperoneId}`);
  }

  /** Submit the roster (sets submitted_at if not already set). */
  submitRoster(groupId: number) {
    return this.http.post<{ message: string; submission_type: string }>(
      `${this.api}/groups/${groupId}/submissions`,
      { submission_type: 'ROSTER' }
    );
  }

  /** Get all submissions for a group (to find ROSTER submitted_at). */
  getSubmissions(groupId: number) {
    return this.http.get<Array<{ submission_type: string; submitted_at: string }>>(
      `${this.api}/groups/${groupId}/submissions`
    );
  }
}
