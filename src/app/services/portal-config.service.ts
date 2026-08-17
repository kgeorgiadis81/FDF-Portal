import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface PortalPublicConfig {
  privacyPolicyUrl: string;
  requiredConsentVersion: string;
}

@Injectable({ providedIn: 'root' })
export class PortalConfigService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiBaseUrl}/portal/auth/public-config`;

  readonly privacyPolicyUrl = signal('');
  readonly requiredConsentVersion = signal('1.0');
  readonly loaded = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.http.get<PortalPublicConfig>(this.api).subscribe({
      next: (config) => {
        this.privacyPolicyUrl.set(config.privacyPolicyUrl || '');
        this.requiredConsentVersion.set(config.requiredConsentVersion || '1.0');
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }
}
