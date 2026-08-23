import { Component, OnInit, signal, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';

declare const google: any;

@Component({
  selector: 'fdp-login',
  imports: [
    ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, AfterViewInit {
  form!: FormGroup;
  loading = signal(false);
  error   = signal('');
  showPassword = signal(false);
  googleAvailable = signal(!!environment.googleClientId);

  private returnUrl = '/dashboard';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });

    // Validate returnUrl — must be a same-origin path (starts with /)
    const raw = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    this.returnUrl = raw.startsWith('/') ? raw : '/dashboard';
  }

  ngAfterViewInit(): void {
    if (this.googleAvailable() && typeof google !== 'undefined') {
      this.initGoogleButton();
    }
  }

  private initGoogleButton(): void {
    try {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response: any) => this.handleGoogleCredential(response.credential),
      });
      google.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        { theme: 'outline', size: 'large', width: 360, text: 'continue_with' }
      );
    } catch {}
  }

  private handleGoogleCredential(credential: string): void {
    this.loading.set(true);
    this.error.set('');
    this.auth.googleAuth(credential).subscribe({
      next: (result) => {
        this.loading.set(false);
        if (result.requiresProfileCompletion) {
          this.router.navigate(['/auth/google-complete'], {
            state: { googleProfile: result.googleProfile, credential }
          });
        } else if (result.token && result.role && result.name) {
          this.auth.saveAuth(0, result.token, result.role, result.name, result.roles ?? []);
          this.router.navigateByUrl(result.requiresConsent ? '/consent' : this.returnUrl);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Google sign-in failed. Please try again.');
      },
    });
  }

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.value;
    this.auth.login(email, password).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.auth.saveAuth(res.id, res.token, res.role, res.name, res.roles ?? []);
        this.router.navigateByUrl(res.requiresConsent ? '/consent' : this.returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        const code = err.error?.code;
        if (code === 'EMAIL_UNVERIFIED') {
          this.router.navigate(['/auth/verify-email'], { queryParams: { email: this.form.value.email } });
        } else {
          this.error.set(err.error?.error || 'Sign in failed. Please try again.');
        }
      },
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }
}
