import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface PortalEvent {
  id: number;
  name: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly api = `${environment.apiBaseUrl}/portal/events`;

  constructor(private http: HttpClient) {}

  getActiveEvent() {
    return this.http.get<PortalEvent>(`${this.api}/active`);
  }

  getMyHistory() {
    return this.http.get<PortalEvent[]>(`${this.api}/my-history`);
  }
}
