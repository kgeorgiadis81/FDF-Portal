import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  RegistrationSummaryService,
  RegistrationSummary,
  DeadlineInfo,
} from '../../../services/registration-summary.service';

@Component({
  selector: 'fdp-review',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './review.component.html',
  styleUrl: './review.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ReviewComponent implements OnInit {
  groupId = 0;
  loading = signal(true);
  error   = signal('');
  summary = signal<RegistrationSummary | null>(null);

  readonly isActive    = computed(() => this.summary()?.group.isActive ?? true);
  readonly isDance     = computed(() => (this.summary()?.group.groupType ?? '').toUpperCase() === 'DANCE');
  readonly hasActions  = computed(() => (this.summary()?.actionRequired.length ?? 0) > 0);

  readonly totalConflicts = computed(() => {
    const c = this.summary()?.conflicts;
    if (!c) return 0;
    return c.directorConflicts + c.dancerConflicts + c.musicianConflicts + c.costumeConflicts;
  });

  constructor(
    private route: ActivatedRoute,
    private summaryService: RegistrationSummaryService,
  ) {}

  ngOnInit(): void {
    this.groupId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.groupId) {
      this.error.set('Invalid group.');
      this.loading.set(false);
      return;
    }
    this.summaryService.getSummary(this.groupId).subscribe({
      next: (s) => { this.summary.set(s); this.loading.set(false); },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? 'Unable to load registration summary.');
      },
    });
  }

  /** Maps a module submission state to a user-friendly label. */
  submissionLabel(submittedAt: string | null, deadline: DeadlineInfo): string {
    if (submittedAt) return 'Submitted';
    if (deadline.canEdit) return 'Not submitted';
    return 'Closed';
  }

  /** CSS class for submission status. */
  submissionClass(submittedAt: string | null, deadline: DeadlineInfo): string {
    if (submittedAt) return 'status-submitted';
    if (deadline.canEdit) return 'status-not-started';
    return 'status-closed';
  }

  /** Maps document status to a friendly label. */
  docLabel(status: string, canEdit: boolean): string {
    switch (status) {
      case 'VERIFIED': return 'Verified';
      case 'REJECTED': return 'Action Required';
      case 'PENDING':  return 'Pending Review';
      case 'NOT_UPLOADED': return canEdit ? 'Missing' : 'Not uploaded';
      default: return canEdit ? 'Missing' : 'Not uploaded';
    }
  }

  docClass(status: string): string {
    switch (status) {
      case 'VERIFIED': return 'status-submitted';
      case 'REJECTED': return 'status-rejected';
      case 'PENDING':  return 'status-pending';
      default: return 'status-not-started';
    }
  }

  /** Derive the action label for a module link. */
  actionLink(submittedAt: string | null, canEdit: boolean, moduleName: string): string {
    if (!this.isActive()) return `View ${moduleName}`;
    return canEdit ? `Manage ${moduleName}` : `View ${moduleName}`;
  }

  formatDeadline(date: string | null): string {
    if (!date) return '—';
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  formatTimestamp(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }
}
