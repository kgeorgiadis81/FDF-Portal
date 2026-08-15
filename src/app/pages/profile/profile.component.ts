import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService, DirectorProfile } from '../../services/auth.service';

@Component({
  selector: 'fdp-profile',
  imports: [
    ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatProgressSpinnerModule,
  ],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  profile  = signal<DirectorProfile | null>(null);
  loading  = signal(true);
  saving   = signal(false);
  editMode = signal(false);
  saved    = signal(false);
  error    = signal('');
  saveError= signal('');

  form!: FormGroup;

  constructor(private auth: AuthService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.auth.getProfile().subscribe({
      next: (p) => { this.profile.set(p); this.loading.set(false); this.initForm(p); },
      error: () => { this.loading.set(false); this.error.set('Could not load profile.'); },
    });
  }

  private initForm(p: DirectorProfile): void {
    this.form = this.fb.group({
      firstName:   [p.firstName, [Validators.required, Validators.maxLength(100)]],
      lastName:    [p.lastName,  [Validators.required, Validators.maxLength(100)]],
      phoneNumber: [p.phoneNumber || ''],
    });
  }

  startEdit():  void { this.editMode.set(true); this.saved.set(false); this.saveError.set(''); }
  cancelEdit(): void { this.editMode.set(false); this.initForm(this.profile()!); }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');

    const { firstName, lastName, phoneNumber } = this.form.value;
    this.auth.updateProfile({ firstName, lastName, phoneNumber: phoneNumber || undefined }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        this.editMode.set(false);
        // Refresh profile
        this.auth.getProfile().subscribe(p => this.profile.set(p));
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err.error?.error || 'Could not save changes.');
      },
    });
  }
}
