import { Component, OnInit, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService, formatDisplayName, GoogleProfileHints } from '../../../services/auth.service';
import { PortalConfigService } from '../../../services/portal-config.service';

@Component({
  selector: 'fdp-google-complete',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatCheckboxModule, MatProgressSpinnerModule,
  ],
  templateUrl: './google-complete.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './google-complete.component.scss',
})
export class GoogleCompleteComponent implements OnInit {
  /** Absent until a Google credential is present. The template must not bind it before then. */
  form: FormGroup | null = null;
  loading = signal(false);
  error   = signal('');

  private credential = '';
  googleProfile: Partial<GoogleProfileHints> = {};

  readonly portalConfig = inject(PortalConfigService);
  readonly today = new Date().toISOString().slice(0, 10);

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    const pending = this.auth.takeGoogleProfileCompletion();
    this.credential = pending?.credential || '';
    this.googleProfile = pending?.googleProfile || {};

    if (!this.credential) {
      this.router.navigate(['/auth/login'], { replaceUrl: true });
      return;
    }

    this.form = this.fb.group({
      firstName:       [this.googleProfile.suggestedFirstName || '', [Validators.required, Validators.maxLength(100)]],
      lastName:        [this.googleProfile.suggestedLastName  || '', [Validators.required, Validators.maxLength(100)]],
      dateOfBirth:     ['', Validators.required],
      consentAccepted: [false, Validators.requiredTrue],
    });
  }

  submit(): void {
    const form = this.form;
    if (!form || this.loading()) return;
    form.markAllAsTouched();
    if (form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    const { firstName, lastName, dateOfBirth, consentAccepted } = form.value;
    this.auth.googleCompleteProfile({
      credential: this.credential,
      firstName, lastName, dateOfBirth, consentAccepted,
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.credential = '';
        this.auth.saveAuth(0, res.token, res.role, formatDisplayName(res), res.roles ?? []);
        this.router.navigate(['/dashboard'], { replaceUrl: true });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Profile setup failed. Please try again.');
      },
    });
  }
}
