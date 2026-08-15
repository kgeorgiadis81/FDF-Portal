import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface PortalGroup {
  id: number;
  name: string;
  groupType: 'Dance' | 'Choral';
  parish: { id: number; name: string; location: string | null } | null;
  event: { id: number; name: string; isActive: boolean };
  primaryDirector: { name: string | null; email: string | null };
  isReadOnly: boolean;
  rosterMemberCount: number;
  rosterSubmittedAt: string | null;
  performanceSubmittedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly api = `${environment.apiBaseUrl}/portal/groups`;

  constructor(private http: HttpClient) {}

  getGroups(eventId?: number) {
    const params: Record<string, string> = eventId ? { eventId: String(eventId) } : {};
    return this.http.get<PortalGroup[]>(this.api, { params });
  }

  getGroup(id: number) {
    return this.http.get<PortalGroup>(`${this.api}/${id}`);
  }

  createGroup(data: { name: string; parishId: number; groupType: string }) {
    return this.http.post<{ id: number; message: string }>(this.api, data);
  }

  updateGroup(id: number, data: { name: string; parishId: number; groupType: string }) {
    return this.http.put<{ message: string }>(`${this.api}/${id}`, data);
  }
}
