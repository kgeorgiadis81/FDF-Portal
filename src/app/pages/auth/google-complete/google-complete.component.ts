import { Component, OnInit, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService, formatDisplayName } from '../../../services/auth.service';
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
  form!: FormGroup;
  loading = signal(false);
  error   = signal('');

  private credential = '';
  googleProfile: any = {};

  readonly portalConfig = inject(PortalConfigService);
  readonly today = new Date().toISOString().slice(0, 10);

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as any;
    this.credential   = state?.credential   || '';
    this.googleProfile= state?.googleProfile || {};
  }

  ngOnInit(): void {
    if (!this.credential) {
      this.router.navigate(['/auth/login']);
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
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');

    const { firstName, lastName, dateOfBirth, consentAccepted } = this.form.value;
    this.auth.googleCompleteProfile({
      credential: this.credential,
      firstName, lastName, dateOfBirth, consentAccepted,
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.auth.saveAuth(0, res.token, res.role, formatDisplayName(res), res.roles ?? []);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Profile setup failed. Please try again.');
      },
    });
  }
}
