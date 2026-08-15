import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { getPortalHelp, PortalHelpKey } from '../portal-help-content';
import { ContextHelpService } from './context-help.service';

@Component({
  selector: 'app-context-help',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatMenuModule],
  template: `
    <button
      mat-icon-button
      type="button"
      class="context-help-btn"
      [matMenuTriggerFor]="helpMenu"
      #menuTrigger="matMenuTrigger"
      (menuOpened)="onMenuOpened(menuTrigger)"
      (menuClosed)="onMenuClosed(menuTrigger)"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-haspopup]="'dialog'"
      [attr.aria-expanded]="menuTrigger.menuOpen"
    >
      <mat-icon fontIcon="help_outline" aria-hidden="true"></mat-icon>
    </button>

    <mat-menu #helpMenu="matMenu" class="context-help-menu" [overlapTrigger]="false">
      <div
        class="context-help-panel"
        role="dialog"
        [attr.aria-label]="content().title"
        (click)="$event.stopPropagation()"
        (keydown.escape)="menuTrigger.closeMenu()"
      >
        <h3 class="context-help-title">{{ content().title }}</h3>
        <p class="context-help-body">{{ content().body }}</p>
        @if (content().example) {
          <p class="context-help-example"><em>Example: {{ content().example }}</em></p>
        }
        <button
          mat-button
          type="button"
          class="context-help-close"
          (click)="menuTrigger.closeMenu()"
        >
          Close
        </button>
      </div>
    </mat-menu>
  `,
  styles: [
    `
      .context-help-btn {
        width: 32px;
        height: 32px;
        line-height: 32px;
        color: #607d8b;
        vertical-align: middle;
      }

      .context-help-panel {
        padding: 12px 16px;
        max-width: min(320px, calc(100vw - 32px));
        box-sizing: border-box;
      }

      .context-help-title {
        margin: 0 0 8px;
        font-size: 0.95rem;
        font-weight: 600;
        color: #263238;
      }

      .context-help-body {
        margin: 0 0 8px;
        font-size: 0.9rem;
        line-height: 1.45;
        color: #455a64;
      }

      .context-help-example {
        margin: 0 0 8px;
        font-size: 0.85rem;
        color: #607d8b;
      }

      .context-help-close {
        margin-top: 4px;
        min-height: 36px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ContextHelpComponent {
  private readonly helpService = inject(ContextHelpService);

  readonly helpKey = input.required<PortalHelpKey>();
  readonly label = input.required<string>();

  readonly menuTrigger = viewChild.required<MatMenuTrigger>('menuTrigger');

  readonly content = computed(() => getPortalHelp(this.helpKey()));
  readonly ariaLabel = computed(() => `Help for ${this.label()}`);

  onMenuOpened(trigger: MatMenuTrigger): void {
    this.helpService.registerOpen(trigger);
  }

  onMenuClosed(trigger: MatMenuTrigger): void {
    this.helpService.registerClosed(trigger);
  }
}
