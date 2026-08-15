import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../services/auth.service';
import { ContextHelpComponent } from '../../../shared/context-help/context-help.component';

function passwordsMatchValidator(group: AbstractControl) {
  const pw  = group.get('password')?.value;
  const cpw = group.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'fdp-signup',
  imports: [
    ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatCheckboxModule, MatProgressSpinnerModule,
    ContextHelpComponent,
  ],
  templateUrl: './signup.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './signup.component.scss',
})
export class SignupComponent implements OnInit {
  form!: FormGroup;
  loading = signal(false);
  error   = signal('');
  showPassword = signal(false);
  showConfirm  = signal(false);
  readonly today = new Date().toISOString().slice(0, 10);

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName:       ['', [Validators.required, Validators.maxLength(100)]],
      lastName:        ['', [Validators.required, Validators.maxLength(100)]],
      dateOfBirth:     ['', Validators.required],
      email:           ['', [Validators.required, Validators.email]],
      password:        ['', [Validators.required, Validators.minLength(10)]],
      confirmPassword: ['', Validators.required],
      consentAccepted: [false, Validators.requiredTrue],
    }, { validators: passwordsMatchValidator });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');

    const { firstName, lastName, dateOfBirth, email, password, confirmPassword, consentAccepted } = this.form.value;
    this.auth.signup({ firstName, lastName, dateOfBirth, email, password, confirmPassword, consentAccepted }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/auth/verify-email'], { queryParams: { email } });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Account creation failed. Please try again.');
      },
    });
  }

  togglePassword()  { this.showPassword.update(v => !v); }
  toggleConfirm()   { this.showConfirm.update(v => !v); }
}
