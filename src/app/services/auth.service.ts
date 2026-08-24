import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { isJwtExpired } from '../utils/jwt-payload';
import { SESSION_EXPIRED_MESSAGE } from '../utils/session-expiry';

export { SESSION_EXPIRED_MESSAGE };

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
  consent: {
    version: string;
    accepted: boolean;
    acceptedAt?: string | null;
    declined?: boolean;
    declinedAt?: string | null;
    required?: boolean;
  };
}

export function formatDisplayName(person: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}): string {
  const combined = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  return combined || (person.name ?? '');
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

  private readonly _roles = signal<string[]>(this.readStoredRoles());

  readonly isAuthenticated = computed(() => {
    const token = this._token();
    if (!token || isJwtExpired(token)) {
      return false;
    }
    return this._roles().includes('Director');
  });
  readonly currentName     = computed(() => this._name());
  readonly currentId       = computed(() => this._id());

  private loginRedirectInFlight = false;

  constructor(private http: HttpClient, private router: Router) {}

  getToken(): string | null { return this._token(); }

  saveAuth(id: number, token: string, role: string, name: string, roles: string[] = []): void {
    this.loginRedirectInFlight = false;
    const resolvedRoles = roles.length > 0 ? roles : [role];
    sessionStorage.setItem('fdp_token', token);
    sessionStorage.setItem('fdp_role', role);
    sessionStorage.setItem('fdp_roles', JSON.stringify(resolvedRoles));
    sessionStorage.setItem('fdp_name', name);
    sessionStorage.setItem('fdp_id',   String(id));
    this._token.set(token);
    this._role.set(role);
    this._roles.set(resolvedRoles);
    this._name.set(name);
    this._id.set(id);
  }

  updateSessionName(name: string): void {
    sessionStorage.setItem('fdp_name', name);
    this._name.set(name);
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
    this.redirectToLogin(returnUrl ? { returnUrl } : {}, false);
  }

  /**
   * Clear an expired/invalid session and send the user to login.
   * Does not call the logout API (the token is already unusable).
   */
  expireSession(): void {
    const currentUrl = this.router.url;
    const safeReturn =
      currentUrl.startsWith('/') && !currentUrl.startsWith('/auth/')
        ? currentUrl
        : '/dashboard';
    this.clearSession();
    this.redirectToLogin(
      { message: SESSION_EXPIRED_MESSAGE, returnUrl: safeReturn },
      true
    );
  }

  isLoginRedirectInFlight(): boolean {
    return this.loginRedirectInFlight;
  }

  clearSession(): void {
    sessionStorage.removeItem('fdp_token');
    sessionStorage.removeItem('fdp_role');
    sessionStorage.removeItem('fdp_roles');
    sessionStorage.removeItem('fdp_name');
    sessionStorage.removeItem('fdp_id');
    this._token.set(null);
    this._role.set(null);
    this._roles.set([]);
    this._name.set(null);
    this._id.set(null);
  }

  private redirectToLogin(
    queryParams: Record<string, string>,
    replaceUrl: boolean
  ): void {
    if (this.loginRedirectInFlight) {
      return;
    }
    this.loginRedirectInFlight = true;
    const hasParams = Object.keys(queryParams).length > 0;
    this.router.navigate(['/auth/login'], {
      queryParams: hasParams ? queryParams : undefined,
      replaceUrl,
    });
  }

  private readStoredRoles(): string[] {
    const raw = sessionStorage.getItem('fdp_roles');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(String);
        }
      } catch {
        // Fall through to primary role.
      }
    }
    const role = sessionStorage.getItem('fdp_role');
    return role ? [role] : [];
  }

  // ─── API methods ───────────────────────────────────────────────────────────

  signup(data: {
    firstName: string; lastName: string; dateOfBirth: string;
    email: string; password: string; confirmPassword: string; consentAccepted: boolean;
  }) {
    return this.http.post<{ message: string; emailSent: boolean }>(`${this.api}/signup`, data);
  }

  login(email: string, password: string) {
    return this.http.post<{
      id: number;
      token: string;
      role: string;
      roles?: string[];
      firstName?: string;
      lastName?: string;
      name?: string;
      requiresConsent: boolean;
    }>(
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
      token?: string; role?: string; roles?: string[]; firstName?: string; lastName?: string; name?: string; requiresConsent?: boolean;
      requiresProfileCompletion?: boolean;
      googleProfile?: { providerSubject: string; providerEmail: string; suggestedFirstName: string; suggestedLastName: string };
    }>(`${this.api}/google`, { credential });
  }

  googleCompleteProfile(data: {
    credential: string; firstName: string; lastName: string;
    dateOfBirth: string; consentAccepted: boolean;
  }) {
    return this.http.post<{ token: string; role: string; roles?: string[]; firstName?: string; lastName?: string; name?: string; requiresConsent: boolean }>(
      `${this.api}/google/complete-profile`, data
    );
  }

  acceptConsent() {
    return this.http.post<{ message: string }>(`${this.api}/consent`, {});
  }

  declineConsent() {
    return this.http.post<{ message: string }>(`${this.api}/consent/decline`, {});
  }

  getConsentStatus() {
    return this.http.get<{
      required: string;
      accepted: boolean;
      acceptedAt: string | null;
      requiresConsent: boolean;
      declined: boolean;
      declinedAt: string | null;
    }>(`${this.api}/consent-status`);
  }

  getProfile() {
    return this.http.get<DirectorProfile>(`${this.api}/me`);
  }

  updateProfile(data: { firstName: string; lastName: string; phoneNumber?: string }) {
    return this.http.put<{ message: string }>(`${this.api}/me`, data);
  }
}
