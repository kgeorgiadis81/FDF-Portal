import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GroupDirector {
  id: number;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  cell_phone: string | null;
  is_primary: boolean | number;
  display_order: number;
  is_legacy: boolean | number;
  created_at?: string;
}

export interface CoDirectorPayload {
  first_name: string;
  last_name: string;
  email?: string;
  cell_phone?: string;
}

@Injectable({ providedIn: 'root' })
export class DirectorService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  /** Get all director records for a group (primary + co-directors). */
  getDirectors(groupId: number): Observable<GroupDirector[]> {
    return this.http.get<GroupDirector[]>(`${this.base}/portal/groups/${groupId}/directors`);
  }

  /** Add a Co-Director to the group. Returns {id}. */
  addCoDirector(groupId: number, payload: CoDirectorPayload): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.base}/portal/groups/${groupId}/co-directors`, payload);
  }

  /** Update a Co-Director. */
  updateCoDirector(groupId: number, directorId: number, payload: CoDirectorPayload): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.base}/portal/groups/${groupId}/co-directors/${directorId}`, payload);
  }

  /** Remove a Co-Director. */
  removeCoDirector(groupId: number, directorId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/portal/groups/${groupId}/co-directors/${directorId}`);
  }
}
