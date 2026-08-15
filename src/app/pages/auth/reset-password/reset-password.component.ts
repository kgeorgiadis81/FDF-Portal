import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

function matchPasswords(g: AbstractControl) {
  const pw = g.get('newPassword')?.value;
  const cp = g.get('confirmPassword')?.value;
  return pw && cp && pw !== cp ? { passwordMismatch: true } : null;
}

/** Shows error state for confirmPassword when the parent group has passwordMismatch AND the control is touched. */
class PasswordMismatchMatcher implements ErrorStateMatcher {
  constructor(private group: () => FormGroup | null) {}
  isErrorState(control: FormControl | null, _form: FormGroupDirective | NgForm | null): boolean {
    return !!(control?.touched && this.group()?.hasError('passwordMismatch'));
  }
}

@Component({
  selector: 'fdp-reset-password',
  imports: [
    ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './reset-password.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  form!: FormGroup;
  token = '';
  loading  = signal(false);
  success  = signal(false);
  error    = signal('');
  showPw   = signal(false);
  showCpw  = signal(false);
  mismatchMatcher = new PasswordMismatchMatcher(() => this.form ?? null);

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';

    if (!this.token) {
      this.error.set('Invalid or missing reset link. Please request a new one.');
    }

    this.form = this.fb.group({
      newPassword:     ['', [Validators.required, Validators.minLength(10)]],
      confirmPassword: ['', Validators.required],
    }, { validators: matchPasswords });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading() || !this.token) return;
    this.loading.set(true);
    this.error.set('');

    const { newPassword, confirmPassword } = this.form.value;
    this.auth.resetPassword(this.token, newPassword, confirmPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        // Remove token from URL to prevent accidental reuse
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Password reset failed. The link may have expired.');
      },
    });
  }

  togglePw()  { this.showPw.update(v => !v); }
  toggleCpw() { this.showCpw.update(v => !v); }
}
