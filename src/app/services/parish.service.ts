import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface Parish {
  id: number;
  name: string;
  location: string | null;
}

@Injectable({ providedIn: 'root' })
export class ParishService {
  private readonly api = `${environment.apiBaseUrl}/parishes`;

  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<Parish[]>(this.api);
  }
}
