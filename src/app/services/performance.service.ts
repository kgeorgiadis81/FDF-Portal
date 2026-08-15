import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type ChoralClassification = 'SECULAR' | 'LITURGICAL';
export type PerformanceSubmissionType = 'DANCE_PERFORMANCE' | 'CHORAL_PERFORMANCE';

export interface PerformanceContext {
  group: {
    id: number;
    groupType: string;
    eventId: number;
    eventName: string;
    isActive: boolean;
    isArchived: boolean;
    eventTimezone: string | null;
  };
  submissionType: PerformanceSubmissionType;
  deadline: {
    deadline_date: string | null;
    effective_cutoff: string | null;
    can_edit: boolean;
  };
  submission: { submitted_at: string } | null;
}

export interface DanceEntry {
  id: number;
  entry_order: number;
  name: string;
  region: string | null;
  village: string | null;
  uses_live_music: boolean;
  uses_recorded_music: boolean;
  is_acapella: boolean;
  dancers_singing: boolean;
  musicians_singing: boolean;
  individual_singing: boolean;
}

export interface ChoralEntry {
  id: number;
  entry_order: number;
  name: string;
  uses_live_music: boolean;
  uses_recorded_music: boolean;
  choral_classification: ChoralClassification | null;
}

export interface PerformanceMusician {
  musician_id: number;
  display_order: number;
  display_name: string;
}

export interface PerformanceInstrument {
  id: number;
  instrument_id: number;
  code: string;
  name_en: string;
  name_el: string | null;
  custom_name: string | null;
}

export interface PortalPerformance {
  id: number;
  round: string;
  type: string;
  uses_fdf_tables_chairs: boolean | null;
  additional_props: string | null;
  special_requirements: string | null;
  music_audio_needs: string | null;
  date_time?: string | null;
  entries: DanceEntry[] | ChoralEntry[];
  musicians: PerformanceMusician[];
  instruments: PerformanceInstrument[];
}

export interface MusicianOption {
  id: number;
  display_name: string;
  disambiguation_hint: string | null;
}

export interface InstrumentOption {
  id: number;
  code: string;
  name_en: string;
  name_el: string | null;
  display_order: number;
}

export interface PerformanceLogistics {
  uses_fdf_tables_chairs?: boolean | null;
  additional_props?: string | null;
  special_requirements?: string | null;
  music_audio_needs?: string | null;
}

export interface DirectorConflictSummary {
  dancer_conflicts: Array<{
    type: string;
    round: string;
    first_name: string;
    last_name: string;
    other_groups: Array<{ group_name: string; parish_name: string | null }>;
  }>;
  director_conflicts: Array<{
    type: string;
    round: string;
    other_group_names?: string[];
    member_group_name?: string;
  }>;
  musician_conflicts: Array<{
    type: string;
    round: string;
    musician_name: string;
    other_groups: Array<{ group_name: string; parish_name: string | null }>;
  }>;
}

@Injectable({ providedIn: 'root' })
export class PerformanceService {
  private readonly api = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getPerformanceContext(groupId: number) {
    return this.http.get<PerformanceContext>(`${this.api}/portal/groups/${groupId}/performance-context`);
  }

  getPerformance(groupId: number) {
    return this.http.get<{ performances: PortalPerformance[] }>(`${this.api}/groups/${groupId}/performance`);
  }

  getConflicts(groupId: number, round?: string) {
    const params: Record<string, string> = round ? { round } : {};
    return this.http.get<DirectorConflictSummary>(`${this.api}/groups/${groupId}/performance/conflicts`, { params });
  }

  searchMusicians(query: string) {
    return this.http.get<MusicianOption[]>(`${this.api}/musicians/search`, { params: { q: query } });
  }

  getInstruments() {
    return this.http.get<InstrumentOption[]>(`${this.api}/instruments`);
  }

  createEntry(groupId: number, performanceId: number, data: Record<string, unknown>) {
    return this.http.post(`${this.api}/groups/${groupId}/performance/${performanceId}/entries`, data);
  }

  updateEntry(groupId: number, performanceId: number, entryId: number, data: Record<string, unknown>) {
    return this.http.put(`${this.api}/groups/${groupId}/performance/${performanceId}/entries/${entryId}`, data);
  }

  deleteEntry(groupId: number, performanceId: number, entryId: number) {
    return this.http.delete(`${this.api}/groups/${groupId}/performance/${performanceId}/entries/${entryId}`);
  }

  reorderEntries(groupId: number, performanceId: number, entryIds: number[]) {
    return this.http.patch<{ entries: DanceEntry[] | ChoralEntry[] }>(
      `${this.api}/groups/${groupId}/performance/${performanceId}/entries/reorder`,
      { entry_ids: entryIds },
    );
  }

  updateLogistics(groupId: number, performanceId: number, data: PerformanceLogistics) {
    return this.http.patch<PerformanceLogistics>(
      `${this.api}/groups/${groupId}/performance/${performanceId}/logistics`,
      data,
    );
  }

  assignMusician(groupId: number, performanceId: number, musicianId: number, displayOrder?: number) {
    return this.http.post(`${this.api}/groups/${groupId}/performance/${performanceId}/musicians`, {
      musician_id: musicianId,
      display_order: displayOrder,
    });
  }

  removeMusician(groupId: number, performanceId: number, musicianId: number) {
    return this.http.delete(`${this.api}/groups/${groupId}/performance/${performanceId}/musicians/${musicianId}`);
  }

  assignInstrument(groupId: number, performanceId: number, instrumentId: number, customName?: string) {
    return this.http.post(`${this.api}/groups/${groupId}/performance/${performanceId}/instruments`, {
      instrument_id: instrumentId,
      custom_name: customName,
    });
  }

  removeInstrument(groupId: number, performanceId: number, assignmentId: number) {
    return this.http.delete(`${this.api}/groups/${groupId}/performance/${performanceId}/instruments/${assignmentId}`);
  }

  submitPerformance(groupId: number, submissionType: PerformanceSubmissionType) {
    return this.http.post(`${this.api}/groups/${groupId}/submissions`, { submission_type: submissionType });
  }
}
