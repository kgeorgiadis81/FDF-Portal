import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
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
  readonly directorName = computed(() => this.auth.currentName() || 'Director');

  activeEvent  = signal<PortalEvent | null>(null);
  allEvents    = signal<PortalEvent[]>([]);
  selectedEventId = signal<number | null>(null);
  groups       = signal<PortalGroup[]>([]);
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

  private loadGroups(eventId: number): void {
    this.loadingGroups.set(true);
    this.groupSvc.getGroups(eventId).subscribe({
      next: (grps) => { this.groups.set(grps); this.loadingGroups.set(false); },
      error: () => { this.groups.set([]); this.loadingGroups.set(false); },
    });
  }

  onEventChange(eventId: number): void {
    this.selectedEventId.set(eventId);
    this.loadGroups(eventId);
  }
}
