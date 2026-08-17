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
import { MatSuffix } from '@angular/material/form-field';
import { getPortalHelp, PortalHelpKey } from '../portal-help-content';
import { ContextHelpService } from './context-help.service';

@Component({
  selector: 'app-context-help',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatMenuModule],
  host: {
    class: 'context-help-host',
    '[class.context-help-host--suffix]': 'isFormFieldSuffix',
  },
  template: `
    <button
      mat-icon-button
      type="button"
      tabindex="-1"
      class="context-help-btn"
      [class.context-help-btn--compact]="compact()"
      [matMenuTriggerFor]="helpMenu"
      #menuTrigger="matMenuTrigger"
      (pointerdown)="onTriggerPointerDown($event)"
      (mousedown)="onTriggerPointerDown($event)"
      (click)="onTriggerClick($event)"
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
      </div>
    </mat-menu>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        vertical-align: middle;
      }

      :host(.context-help-host--suffix) {
        align-self: center;
        margin-inline-end: 0.5rem;
      }

      :host(.context-help-host--suffix) .context-help-btn {
        width: 2rem;
        height: 2rem;
        min-width: 2rem;
        padding: 2px;
      }

      .context-help-btn {
        width: 32px;
        height: 32px;
        min-width: 32px;
        padding: 4px;
        color: #607d8b;
        vertical-align: middle;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }

      .context-help-btn:hover {
        background-color: rgba(96, 125, 139, 0.08);
      }

      .context-help-btn--compact {
        width: 1.5rem;
        height: 1.5rem;
        min-width: 1.5rem;
        padding: 2px;
      }

      .context-help-btn--compact .mat-icon {
        font-size: 1.125rem;
        width: 1.125rem;
        height: 1.125rem;
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
        margin: 0;
        font-size: 0.85rem;
        color: #607d8b;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ContextHelpComponent {
  private readonly helpService = inject(ContextHelpService);
  protected readonly isFormFieldSuffix = !!inject(MatSuffix, { optional: true, self: true });

  readonly helpKey = input.required<PortalHelpKey>();
  readonly label = input.required<string>();
  /** Smaller icon for inline use beside labels. */
  readonly compact = input(false);

  readonly menuTrigger = viewChild.required<MatMenuTrigger>('menuTrigger');

  readonly content = computed(() => getPortalHelp(this.helpKey()));
  readonly ariaLabel = computed(() => `Help for ${this.label()}`);

  /** Block mat-select/autocomplete from opening when help is activated inside a form field. */
  onTriggerPointerDown(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onTriggerClick(event: Event): void {
    event.stopPropagation();
  }

  onMenuOpened(trigger: MatMenuTrigger): void {
    this.helpService.registerOpen(trigger);
  }

  onMenuClosed(trigger: MatMenuTrigger): void {
    this.helpService.registerClosed(trigger);
  }
}
