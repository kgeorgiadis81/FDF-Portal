import {
  ChangeDetectionStrategy, Component, OnInit, signal, inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { RosterService, RosterMember } from '../../../../services/roster.service';
import { GroupService, PortalGroup } from '../../../../services/group.service';
import { formatLocaleDate } from '../../../../utils/deadline-display';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'fdp-roster-print',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (loading()) {
      <p>Loading roster…</p>
    } @else if (error()) {
      <p>{{ error() }}</p>
    } @else {
      <header class="print-header">
        <h1>{{ group()?.name }} — Roster</h1>
        <p>{{ group()?.event.name }} · {{ group()?.parish?.name }}</p>
        <button type="button" mat-stroked-button (click)="print()">Print / Save as PDF</button>
      </header>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>First name</th>
            <th>Last name</th>
            <th>Date of birth</th>
          </tr>
        </thead>
        <tbody>
          @for (m of members(); track m.id) {
            <tr>
              <td>{{ m.member_order }}</td>
              <td>{{ m.first_name }}</td>
              <td>{{ m.last_name }}</td>
              <td>{{ formatDob(m.date_of_birth) }}</td>
            </tr>
          }
        </tbody>
      </table>
      <p class="sign-line">Director signature: _________________________ Date: __________</p>
      <p class="sign-line">Parish priest signature: __________________ Date: __________</p>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 1.5rem;
      max-width: 800px;
      margin: 0 auto;
      font-family: Inter, sans-serif;
    }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
    .sign-line { margin-top: 2rem; }
    @media print {
      button { display: none; }
    }
  `,
})
export class RosterPrintComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly rosterSvc = inject(RosterService);
  private readonly groupSvc = inject(GroupService);

  loading = signal(true);
  error = signal('');
  group = signal<PortalGroup | null>(null);
  members = signal<RosterMember[]>([]);

  ngOnInit(): void {
    const groupId = Number(this.route.snapshot.paramMap.get('id'));
    if (!groupId) {
      this.error.set('Invalid group.');
      this.loading.set(false);
      return;
    }
    forkJoin({
      group: this.groupSvc.getGroup(groupId),
      roster: this.rosterSvc.getRoster(groupId),
    }).subscribe({
      next: ({ group, roster }) => {
        this.group.set(group);
        this.members.set(roster.members);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load roster for printing.');
        this.loading.set(false);
      },
    });
  }

  formatDob(iso: string): string {
    return formatLocaleDate(iso);
  }

  print(): void {
    window.print();
  }
}
