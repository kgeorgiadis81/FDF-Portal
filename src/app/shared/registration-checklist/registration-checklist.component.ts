import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { RegistrationChecklist } from '../../utils/registration-steps';

@Component({
  selector: 'app-registration-checklist',
  imports: [RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="registration-checklist" data-testid="registration-checklist">
      <p class="checklist-summary" data-testid="registration-checklist-summary">
        {{ checklist().summaryLine }}
      </p>
      @if (actionDetail()) {
        <p class="action-detail" data-testid="registration-action-detail">{{ actionDetail() }}</p>
      }
      <ol class="checklist-steps" aria-label="Registration steps">
        @for (step of checklist().steps; track step.key) {
          <li class="checklist-step" [class.done]="step.done">
            <mat-icon class="step-icon" aria-hidden="true">
              {{ step.done ? 'check_circle' : 'radio_button_unchecked' }}
            </mat-icon>
            <span class="step-label">{{ step.label }}</span>
          </li>
        }
      </ol>
      @if (groupId() && primaryRoute(); as route) {
        <a [routerLink]="route" class="checklist-next-link" data-testid="registration-next-link">
          Continue: {{ checklist().nextStep?.label ?? 'Review registration' }}
        </a>
      }
    </div>
  `,
  styles: `
    .registration-checklist {
      margin-top: 0.75rem;
    }
    .checklist-summary {
      font-weight: 600;
      margin: 0 0 0.5rem;
      color: var(--color-text-primary);
    }
    .action-detail {
      margin: 0 0 0.75rem;
      color: var(--color-warning-text, #7a5210);
      font-size: 0.9rem;
    }
    .checklist-steps {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .checklist-step {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: var(--color-text-muted);
    }
    .checklist-step.done {
      color: var(--color-text-primary);
    }
    .step-icon {
      font-size: 1.1rem;
      width: 1.1rem;
      height: 1.1rem;
      color: var(--color-text-muted);
    }
    .checklist-step.done .step-icon {
      color: var(--color-success);
    }
    .checklist-next-link {
      display: inline-block;
      margin-top: 0.75rem;
      font-weight: 600;
      font-size: 0.9rem;
    }
  `,
})
export class RegistrationChecklistComponent {
  checklist = input.required<RegistrationChecklist>();
  actionDetail = input<string | null>(null);
  groupId = input<number | null>(null);
  primaryRoute = input<(string | number)[] | null>(null);
}
