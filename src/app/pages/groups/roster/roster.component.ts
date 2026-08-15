import {
  Component, OnInit, signal, computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';

import {
  RosterService, RosterMember, Chaperone, RosterContext,
} from '../../../services/roster.service';
import {
  ParticipantDialogComponent,
  ParticipantDialogData,
  ParticipantDialogResult,
} from './participant-dialog/participant-dialog.component';
import {
  ChaperoneDialogComponent,
  ChaperoneDialogData,
  ChaperoneDialogResult,
} from './chaperone-dialog/chaperone-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { ContextHelpComponent } from '../../../shared/context-help/context-help.component';

@Component({
  selector: 'fdp-roster',
  imports: [
    RouterLink,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    ContextHelpComponent,
  ],
  templateUrl: './roster.component.html',
  styleUrl: './roster.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class RosterComponent implements OnInit {
  groupId = 0;

  loading    = signal(true);
  error      = signal('');
  saving     = signal(false);
  submitting = signal(false);

  context   = signal<RosterContext | null>(null);
  members   = signal<RosterMember[]>([]);
  chaperones = signal<Chaperone[]>([]);

  readonly canEdit = computed(() => this.context()?.deadline.can_edit ?? false);
  readonly isReadOnly = computed(() => !this.canEdit());
  readonly isActiveEvent = computed(() => this.context()?.group.isActive ?? false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private rosterSvc: RosterService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.groupId = Number(this.route.snapshot.parent?.paramMap.get('id') ?? 0);
    if (!this.groupId) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadAll();
  }

  private loadAll(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      context:    this.rosterSvc.getRosterContext(this.groupId),
      roster:     this.rosterSvc.getRoster(this.groupId),
      chaperones: this.rosterSvc.getChaperones(this.groupId),
    }).subscribe({
      next: ({ context, roster, chaperones }) => {
        this.context.set(context);
        this.members.set(roster.members);
        this.chaperones.set(chaperones);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.error.set('Group not found or access denied.');
        } else {
          this.error.set('Could not load roster. Please try again.');
        }
      },
    });
  }

  private refreshContext(): void {
    forkJoin({
      context:    this.rosterSvc.getRosterContext(this.groupId),
      chaperones: this.rosterSvc.getChaperones(this.groupId),
    }).subscribe({
      next: ({ context, chaperones }) => {
        this.context.set(context);
        this.chaperones.set(chaperones);
      },
    });
  }

  private refreshRoster(): void {
    forkJoin({
      context: this.rosterSvc.getRosterContext(this.groupId),
      roster:  this.rosterSvc.getRoster(this.groupId),
    }).subscribe({
      next: ({ context, roster }) => {
        this.context.set(context);
        this.members.set(roster.members);
      },
    });
  }

  // ─── Participants ─────────────────────────────────────────────────────────

  openAddParticipant(): void {
    const ref = this.dialog.open<ParticipantDialogComponent, ParticipantDialogData, ParticipantDialogResult | null>(
      ParticipantDialogComponent,
      { data: {}, disableClose: true, width: '520px' }
    );

    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.saving.set(true);
      this.rosterSvc.addMember(this.groupId, result).subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open('Participant added.', 'OK', { duration: 3000 });
          this.refreshRoster();
        },
        error: (err) => {
          this.saving.set(false);
          const msg = err.error?.error || 'Could not add participant.';
          this.snack.open(msg, 'Dismiss', { duration: 6000 });
        },
      });
    });
  }

  openEditParticipant(member: RosterMember): void {
    const ref = this.dialog.open<ParticipantDialogComponent, ParticipantDialogData, ParticipantDialogResult | null>(
      ParticipantDialogComponent,
      { data: { member }, disableClose: true, width: '520px' }
    );

    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.saving.set(true);
      this.rosterSvc.updateMember(this.groupId, member.id, {
        ...result,
        member_order: member.member_order,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open('Participant updated.', 'OK', { duration: 3000 });
          this.refreshRoster();
        },
        error: (err) => {
          this.saving.set(false);
          const msg = err.error?.error || 'Could not update participant.';
          this.snack.open(msg, 'Dismiss', { duration: 6000 });
        },
      });
    });
  }

  confirmDeleteParticipant(member: RosterMember): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent, {
        data: {
          title: 'Remove Participant',
          message: `Remove ${member.first_name} ${member.last_name} from this roster?`,
          confirmLabel: 'Remove',
        },
        width: '400px',
      }
    );
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.saving.set(true);
      this.rosterSvc.deleteMember(this.groupId, member.id).subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open('Participant removed.', 'OK', { duration: 3000 });
          this.refreshRoster();
        },
        error: () => {
          this.saving.set(false);
          this.snack.open('Could not remove participant.', 'Dismiss', { duration: 6000 });
        },
      });
    });
  }

  // ─── Chaperones ───────────────────────────────────────────────────────────

  openAddChaperone(): void {
    const ref = this.dialog.open<ChaperoneDialogComponent, ChaperoneDialogData, ChaperoneDialogResult | null>(
      ChaperoneDialogComponent,
      { data: {}, disableClose: true, width: '520px' }
    );

    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.saving.set(true);
      this.rosterSvc.addChaperone(this.groupId, result).subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open('Chaperone added.', 'OK', { duration: 3000 });
          this.refreshContext();
        },
        error: (err) => {
          this.saving.set(false);
          const msg = err.error?.error || 'Could not add chaperone.';
          this.snack.open(msg, 'Dismiss', { duration: 6000 });
        },
      });
    });
  }

  openEditChaperone(chap: Chaperone): void {
    const ref = this.dialog.open<ChaperoneDialogComponent, ChaperoneDialogData, ChaperoneDialogResult | null>(
      ChaperoneDialogComponent,
      { data: { chaperone: chap }, disableClose: true, width: '520px' }
    );

    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.saving.set(true);
      this.rosterSvc.updateChaperone(this.groupId, chap.id, result).subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open('Chaperone updated.', 'OK', { duration: 3000 });
          this.refreshContext();
        },
        error: (err) => {
          this.saving.set(false);
          const msg = err.error?.error || 'Could not update chaperone.';
          this.snack.open(msg, 'Dismiss', { duration: 6000 });
        },
      });
    });
  }

  confirmDeleteChaperone(chap: Chaperone): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent, {
        data: {
          title: 'Remove Chaperone',
          message: `Remove ${chap.first_name} ${chap.last_name} as a chaperone?`,
          confirmLabel: 'Remove',
        },
        width: '400px',
      }
    );
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.saving.set(true);
      this.rosterSvc.deleteChaperone(this.groupId, chap.id).subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open('Chaperone removed.', 'OK', { duration: 3000 });
          this.refreshContext();
        },
        error: () => {
          this.saving.set(false);
          this.snack.open('Could not remove chaperone.', 'Dismiss', { duration: 6000 });
        },
      });
    });
  }

  // ─── Submission ───────────────────────────────────────────────────────────

  get submissionValidation() {
    const ctx = this.context();
    if (!ctx) return null;
    const s = ctx.summary;
    const chaps = this.chaperones();
    const unconfirmedChaperones = chaps.filter(c => !c.is_21_or_older_confirmed);
    return {
      participantCount:        s.member_count,
      minorCount:              s.minor_count,
      requiredChaperones:      s.required_chaperones,
      providedChaperones:      s.provided_chaperones,
      chaperonesSatisfied:     s.chaperone_requirement_satisfied,
      unconfirmedCount:        unconfirmedChaperones.length,
      canSubmit:               s.member_count > 0
                                 && s.chaperone_requirement_satisfied
                                 && unconfirmedChaperones.length === 0,
    };
  }

  confirmSubmitRoster(): void {
    const validation = this.submissionValidation;
    if (!validation?.canSubmit) return;

    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent, {
        data: {
          title: 'Submit Roster?',
          message:
            'You can continue making changes until the roster deadline. ' +
            'Any changes after submission will update the roster information stored by FDF.',
          confirmLabel: 'Submit',
        },
        width: '480px',
      }
    );
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.submitting.set(true);
      this.rosterSvc.submitRoster(this.groupId).subscribe({
        next: () => {
          this.submitting.set(false);
          this.snack.open('Roster submitted.', 'OK', { duration: 4000 });
          this.refreshContext();
        },
      error: (err) => {
        this.submitting.set(false);
        const msg = err.error?.error || 'Could not submit roster.';
        this.snack.open(msg, 'Dismiss', { duration: 6000 });
      },
    });
    });
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  formatDeadlineDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatEffectiveCutoff(isoStr: string | null | undefined): string {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  chaperoneIsConfirmed(chap: Chaperone): boolean {
    return Boolean(chap.is_21_or_older_confirmed);
  }
}
