import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'fdp-verify-email',
  imports: [RouterLink, MatButtonModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './verify-email.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './verify-email.component.scss',
})
export class VerifyEmailComponent implements OnInit {
  email     = signal('');
  maskedEmail = signal('');
  verifying = signal(false);
  verified  = signal(false);
  error     = signal('');
  resent    = signal(false);
  resending = signal(false);

  constructor(
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email') || '';
    this.email.set(email);
    this.maskedEmail.set(this.maskEmail(email));

    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.verifyToken(token);
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return `${local.slice(0, 2)}***@${domain}`;
  }

  private verifyToken(token: string): void {
    this.verifying.set(true);
    this.auth.verifyEmail(token).subscribe({
      next: () => {
        this.verifying.set(false);
        this.verified.set(true);
      },
      error: (err) => {
        this.verifying.set(false);
        this.error.set(err.error?.error || 'This link is invalid or has expired.');
      },
    });
  }

  resend(): void {
    if (!this.email() || this.resending()) return;
    this.resending.set(true);
    this.auth.resendVerification(this.email()).subscribe({
      next: () => {
        this.resending.set(false);
        this.resent.set(true);
      },
      error: () => {
        this.resending.set(false);
        this.resent.set(true); // Generic response regardless
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
