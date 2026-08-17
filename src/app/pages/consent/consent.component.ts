import { Component, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { PortalConfigService } from '../../services/portal-config.service';

@Component({
  selector: 'fdp-consent',
  imports: [MatButtonModule, MatCheckboxModule, MatProgressSpinnerModule, FormsModule],
  templateUrl: './consent.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './consent.component.scss',
})
export class ConsentComponent {
  readonly portalConfig = inject(PortalConfigService);

  accepted = false;
  loading  = signal(false);
  error    = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  submit(): void {
    if (!this.accepted || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.acceptConsent().subscribe({
      next: () => { this.loading.set(false); this.router.navigate(['/dashboard']); },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Could not record consent. Please try again.');
      },
    });
  }

  decline(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.declineConsent().subscribe({
      next: () => {
        this.loading.set(false);
        this.auth.logout();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Could not record your choice. Please try again.');
      },
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
