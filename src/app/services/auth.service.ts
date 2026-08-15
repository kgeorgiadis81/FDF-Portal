import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface DirectorProfile {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string | null;
  googleLinked: boolean;
  createdAt: string;
  consent: { version: string; accepted: boolean; required?: boolean };
}

export interface AuthState {
  token: string | null;
  role: string | null;
  name: string | null;
  id: number | null;
}

/**
 * Portal Auth Service
 *
 * Security note on token storage:
 * JWT is stored in sessionStorage rather than localStorage. sessionStorage is cleared
 * when the browser tab/session ends, reducing the token lifetime window for XSS-based
 * theft. It remains XSS-vulnerable (as any JS-accessible storage). The trade-off
 * is documented here; a future phase may migrate to httpOnly cookie auth if the
 * backend is refactored to support that pattern without breaking Admin Portal.
 *
 * Tokens are never logged, printed to console, or sent to third parties.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = `${environment.apiBaseUrl}/portal/auth`;

  // Reactive auth state via signals
  private readonly _token = signal<string | null>(sessionStorage.getItem('fdp_token'));
  private readonly _role  = signal<string | null>(sessionStorage.getItem('fdp_role'));
  private readonly _name  = signal<string | null>(sessionStorage.getItem('fdp_name'));
  private readonly _id    = signal<number | null>(
    sessionStorage.getItem('fdp_id') ? Number(sessionStorage.getItem('fdp_id')) : null
  );

  readonly isAuthenticated = computed(() => !!this._token() && this._role() === 'Director');
  readonly currentName     = computed(() => this._name());
  readonly currentId       = computed(() => this._id());

  constructor(private http: HttpClient, private router: Router) {}

  getToken(): string | null { return this._token(); }

  saveAuth(id: number, token: string, role: string, name: string): void {
    sessionStorage.setItem('fdp_token', token);
    sessionStorage.setItem('fdp_role', role);
    sessionStorage.setItem('fdp_name', name);
    sessionStorage.setItem('fdp_id',   String(id));
    this._token.set(token);
    this._role.set(role);
    this._name.set(name);
    this._id.set(id);
  }

  updateToken(newToken: string): void {
    sessionStorage.setItem('fdp_token', newToken);
    this._token.set(newToken);
  }

  logout(returnUrl?: string): void {
    // Best-effort server-side audit (fire and forget)
    if (this._token()) {
      this.http.post(`${this.api}/logout`, {}).subscribe({ error: () => {} });
    }
    this.clearSession();
    this.router.navigate(['/auth/login'], returnUrl ? { queryParams: { returnUrl } } : {});
  }

  clearSession(): void {
    sessionStorage.removeItem('fdp_token');
    sessionStorage.removeItem('fdp_role');
    sessionStorage.removeItem('fdp_name');
    sessionStorage.removeItem('fdp_id');
    this._token.set(null);
    this._role.set(null);
    this._name.set(null);
    this._id.set(null);
  }

  // ─── API methods ───────────────────────────────────────────────────────────

  signup(data: {
    firstName: string; lastName: string; dateOfBirth: string;
    email: string; password: string; confirmPassword: string; consentAccepted: boolean;
  }) {
    return this.http.post<{ message: string; emailSent: boolean }>(`${this.api}/signup`, data);
  }

  login(email: string, password: string) {
    return this.http.post<{ id: number; token: string; role: string; name: string; requiresConsent: boolean }>(
      `${this.api}/login`, { email, password }
    );
  }

  verifyEmail(token: string) {
    return this.http.post<{ message: string }>(`${this.api}/verify-email`, { token });
  }

  resendVerification(email: string) {
    return this.http.post<{ message: string }>(`${this.api}/resend-verification`, { email });
  }

  forgotPassword(email: string) {
    return this.http.post<{ message: string }>(`${this.api}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string, confirmPassword: string) {
    return this.http.post<{ message: string }>(`${this.api}/reset-password`, { token, newPassword, confirmPassword });
  }

  googleAuth(credential: string) {
    return this.http.post<{
      token?: string; role?: string; name?: string; requiresConsent?: boolean;
      requiresProfileCompletion?: boolean;
      googleProfile?: { providerSubject: string; providerEmail: string; suggestedFirstName: string; suggestedLastName: string };
    }>(`${this.api}/google`, { credential });
  }

  googleCompleteProfile(data: {
    credential: string; firstName: string; lastName: string;
    dateOfBirth: string; consentAccepted: boolean;
  }) {
    return this.http.post<{ token: string; role: string; name: string; requiresConsent: boolean }>(
      `${this.api}/google/complete-profile`, data
    );
  }

  acceptConsent() {
    return this.http.post<{ message: string }>(`${this.api}/consent`, {});
  }

  getConsentStatus() {
    return this.http.get<{ required: string; accepted: boolean; requiresConsent: boolean }>(`${this.api}/consent-status`);
  }

  getProfile() {
    return this.http.get<DirectorProfile>(`${this.api}/me`);
  }

  updateProfile(data: { firstName: string; lastName: string; phoneNumber?: string }) {
    return this.http.put<{ message: string }>(`${this.api}/me`, data);
  }
}
