import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type CostumeGender = 'MEN' | 'WOMEN';
export type CostumeRound = 'Semi-Final' | 'Final';

export interface CostumeResourceType {
  id: number;
  code: string;
  label: string;
  display_order: number;
}

export interface PerformanceCostume {
  id: number;
  performance_id: number;
  gender: CostumeGender;
  region: string | null;
  village: string | null;
  resource_type_id: number | null;
  resource_type_code?: string | null;
  resource_type_label?: string | null;
  has_won_award: boolean | number;
  purchased_most_or_all: boolean | number;
  purchased_any_parts: boolean | number;
}

export interface ManualCostumeConflict {
  id: number;
  group_id: number;
  round: CostumeRound;
  related_group_id: number;
  costume_count: number;
  related_group_name?: string;
  related_parish_name?: string | null;
}

export interface RelatedGroupOption {
  id: number;
  name: string;
  parish_name: string | null;
  parish_location: string | null;
  display_label: string;
}

export interface CostumeContext {
  group: {
    id: number;
    groupType: string;
    eventId: number;
    eventName: string;
    isActive: boolean;
    isArchived: boolean;
    eventTimezone: string | null;
  };
  performances: Array<{ id: number; round: CostumeRound; type: string }>;
  deadline: {
    deadline_date: string | null;
    effective_cutoff: string | null;
    can_edit: boolean;
  };
  submission: { submitted_at: string } | null;
}

export interface CostumeFormPayload {
  region: string;
  village: string;
  resource_type_id: number | null;
  has_won_award: boolean;
  purchased_most_or_all: boolean;
  purchased_any_parts: boolean;
}

@Injectable({ providedIn: 'root' })
export class CostumeService {
  private readonly api = environment.apiBaseUrl;

  getCostumeContext(groupId: number) {
    return this.http.get<CostumeContext>(`${this.api}/portal/groups/${groupId}/costume-context`);
  }

  getResourceTypes(groupId: number) {
    return this.http.get<CostumeResourceType[]>(`${this.api}/groups/${groupId}/costume-resource-types`);
  }

  getCostumes(groupId: number, performanceId: number) {
    return this.http.get<PerformanceCostume[]>(
      `${this.api}/groups/${groupId}/performances/${performanceId}/costumes`
    );
  }

  createCostume(groupId: number, performanceId: number, gender: CostumeGender, payload: CostumeFormPayload) {
    return this.http.post<{ id: number }>(
      `${this.api}/groups/${groupId}/performances/${performanceId}/costumes`,
      { gender, ...payload }
    );
  }

  updateCostume(groupId: number, performanceId: number, costumeId: number, payload: CostumeFormPayload) {
    return this.http.put<{ message: string }>(
      `${this.api}/groups/${groupId}/performances/${performanceId}/costumes/${costumeId}`,
      payload
    );
  }

  getCostumeConflicts(groupId: number) {
    return this.http.get<ManualCostumeConflict[]>(`${this.api}/groups/${groupId}/costume-conflicts`);
  }

  addCostumeConflict(
    groupId: number,
    conflict: Pick<ManualCostumeConflict, 'round' | 'related_group_id' | 'costume_count'>
  ) {
    return this.http.post<{ id: number }>(`${this.api}/groups/${groupId}/costume-conflicts`, conflict);
  }

  updateCostumeConflict(
    groupId: number,
    conflictId: number,
    conflict: Pick<ManualCostumeConflict, 'round' | 'related_group_id' | 'costume_count'>
  ) {
    return this.http.put<{ message: string }>(
      `${this.api}/groups/${groupId}/costume-conflicts/${conflictId}`,
      conflict
    );
  }

  deleteCostumeConflict(groupId: number, conflictId: number) {
    return this.http.delete<{ message: string }>(`${this.api}/groups/${groupId}/costume-conflicts/${conflictId}`);
  }

  searchRelatedGroups(groupId: number, search: string) {
    const params: Record<string, string> = search ? { search } : {};
    return this.http.get<RelatedGroupOption[]>(`${this.api}/portal/groups/${groupId}/related-groups`, { params });
  }

  submitCostumes(groupId: number) {
    return this.http.post<{ message: string; submission_type: string }>(
      `${this.api}/groups/${groupId}/submissions`,
      { submission_type: 'COSTUME' }
    );
  }

  constructor(private http: HttpClient) {}
}
