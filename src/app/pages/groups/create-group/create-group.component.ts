import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AsyncPipe } from '@angular/common';
import { startWith, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { GroupService } from '../../../services/group.service';
import { ParishService, Parish } from '../../../services/parish.service';
import { ContextHelpComponent } from '../../../shared/context-help/context-help.component';

@Component({
  selector: 'fdp-create-group',
  imports: [
    ReactiveFormsModule, RouterLink, AsyncPipe,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatSelectModule, MatAutocompleteModule, MatIconModule,
    MatProgressSpinnerModule, ContextHelpComponent,
  ],
  templateUrl: './create-group.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './create-group.component.scss',
})
export class CreateGroupComponent implements OnInit {
  form!: FormGroup;
  loading  = signal(false);
  error    = signal('');
  parishes = signal<Parish[]>([]);

  filteredParishes$!: Observable<Parish[]>;

  readonly groupTypes = ['Dance', 'Choral'];

  constructor(
    private fb: FormBuilder,
    private groupSvc: GroupService,
    private parishSvc: ParishService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name:      ['', [Validators.required, Validators.maxLength(200)]],
      parishId:  [null, Validators.required],
      parishSearch: [''],
      groupType: ['', Validators.required],
    });

    this.parishSvc.getAll().subscribe({
      next: (ps) => this.parishes.set(ps),
      error: () => {},
    });

    this.filteredParishes$ = this.form.get('parishSearch')!.valueChanges.pipe(
      startWith(''),
      map(v => typeof v === 'string' ? v : this.displayParish(v)),
      map(v => this.filterParishes(v)),
    );
  }

  displayParish(p: Parish | string | null): string {
    if (!p) return '';
    if (typeof p === 'string') return p;
    return p.location ? `${p.name} — ${p.location}` : p.name;
  }

  private filterParishes(query: string): Parish[] {
    const q = query.toLowerCase();
    return this.parishes().filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.location || '').toLowerCase().includes(q)
    );
  }

  onParishSelected(parish: Parish): void {
    this.form.patchValue({
      parishId: parish.id,
      parishSearch: this.displayParish(parish),
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;
    if (!this.form.value.parishId) {
      this.error.set('Please select a parish from the list.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.groupSvc.createGroup({
      name:      this.form.value.name.trim(),
      parishId:  this.form.value.parishId,
      groupType: this.form.value.groupType,
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.router.navigate(['/groups', res.id]);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Could not create group. Please try again.');
      },
    });
  }
}
