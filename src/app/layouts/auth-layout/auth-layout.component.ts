import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PortalConfigService } from '../../services/portal-config.service';

@Component({
  selector: 'fdp-auth-layout',
  imports: [RouterOutlet],
  templateUrl: './auth-layout.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent {
  readonly portalConfig = inject(PortalConfigService);
}
