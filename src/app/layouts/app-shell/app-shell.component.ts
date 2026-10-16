import { Component, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../services/auth.service';
import { FDF_MANAGEMENT_MAILTO } from '../../constants/fdf-contact';

@Component({
  selector: 'fdp-app-shell',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatButtonModule, MatIconModule,
    MatMenuModule, MatDividerModule,
  ],
  templateUrl: './app-shell.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  readonly helpMailto = FDF_MANAGEMENT_MAILTO;
  readonly name = computed(() => this.auth.currentName() || 'Director');

  constructor(private auth: AuthService) {}

  logout(): void {
    this.auth.logout();
  }
}
