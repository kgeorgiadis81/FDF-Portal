import { Component, OnInit, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { EventService, PortalEvent } from '../../services/event.service';
import { GroupService, PortalGroup } from '../../services/group.service';
import { RegistrationSummaryService } from '../../services/registration-summary.service';
import {
  buildRegistrationCompleteness,
  buildRegistrationCompletenessFromPortalGroup,
  RegistrationCompleteness,
} from '../../utils/registration-completeness';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Component({
  selector: 'fdp-dashboard',
  imports: [
    RouterLink, FormsModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatSelectModule, MatFormFieldModule,
  ],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly summarySvc = inject(RegistrationSummaryService);

  readonly directorName = computed(() => this.auth.currentName() || 'Director');

  activeEvent  = signal<PortalEvent | null>(null);
  allEvents    = signal<PortalEvent[]>([]);
  selectedEventId = signal<number | null>(null);
  groups       = signal<PortalGroup[]>([]);
  completenessByGroupId = signal<Map<number, RegistrationCompleteness>>(new Map());
  loadingEvents= signal(true);
  loadingGroups= signal(true);
  error        = signal('');

  readonly selectedEvent = computed(() =>
    this.allEvents().find(e => e.id === this.selectedEventId()) ?? this.activeEvent()
  );

  readonly isViewingActiveEvent = computed(() =>
    this.selectedEventId() === null || this.selectedEventId() === this.activeEvent()?.id
  );

  constructor(
    private auth: AuthService,
    private events: EventService,
    private groupSvc: GroupService,
    private router: Router,
  ) {}

  navigateToGroup(id: number): void {
    this.router.navigate(['/groups', id]);
  }

  navigateToReview(event: Event, id: number): void {
    event.stopPropagation();
    this.router.navigate(['/groups', id, 'review']);
  }

  ngOnInit(): void {
    this.loadEvents();
  }

  private loadEvents(): void {
    this.loadingEvents.set(true);
    this.events.getActiveEvent().subscribe({
      next: (evt) => {
        this.activeEvent.set(evt);
        this.selectedEventId.set(evt.id);
        this.loadGroups(evt.id);
        this.loadHistory();
      },
      error: () => {
        this.loadingEvents.set(false);
        this.loadingGroups.set(false);
        this.error.set('Could not load event information.');
      },
    });
  }

  private loadHistory(): void {
    this.events.getMyHistory().subscribe({
      next: (evts) => {
        this.allEvents.set(evts);
        this.loadingEvents.set(false);
      },
      error: () => this.loadingEvents.set(false),
    });
  }

  completenessFor(groupId: number): RegistrationCompleteness | undefined {
    return this.completenessByGroupId().get(groupId);
  }

  private loadGroups(eventId: number): void {
    this.loadingGroups.set(true);
    this.groupSvc.getGroups(eventId).subscribe({
      next: (grps) => {
        this.groups.set(grps);
        this.loadCompletenessForGroups(grps);
        this.loadingGroups.set(false);
      },
      error: () => {
        this.groups.set([]);
        this.completenessByGroupId.set(new Map());
        this.loadingGroups.set(false);
      },
    });
  }

  private loadCompletenessForGroups(groups: PortalGroup[]): void {
    if (groups.length === 0) {
      this.completenessByGroupId.set(new Map());
      return;
    }
    forkJoin(
      groups.map((g) =>
        this.summarySvc.getSummary(g.id).pipe(
          map((summary) => ({ id: g.id, completeness: buildRegistrationCompleteness(summary) })),
          catchError(() => of({ id: g.id, completeness: buildRegistrationCompletenessFromPortalGroup(g) })),
        ),
      ),
    ).subscribe((rows) => {
      const mapById = new Map<number, RegistrationCompleteness>();
      for (const row of rows) {
        mapById.set(row.id, row.completeness);
      }
      this.completenessByGroupId.set(mapById);
    });
  }

  onEventChange(eventId: number): void {
    this.selectedEventId.set(eventId);
    this.loadGroups(eventId);
  }
}
