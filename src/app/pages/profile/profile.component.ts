import {
  Component, OnInit, OnDestroy, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService, DirectorProfile, formatDisplayName } from '../../services/auth.service';
import {
  FormAutosaveCoordinator,
  HasUnsavedChanges,
  UnsavedChangesService,
} from '../../shared/unsaved-changes';

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
export class ProfileComponent implements OnInit, OnDestroy, HasUnsavedChanges {
  profile  = signal<DirectorProfile | null>(null);
  loading  = signal(true);
  saving   = signal(false);
  editMode = signal(false);
  saved    = signal(false);
  error    = signal('');
  saveError= signal('');

  form!: FormGroup;
  private profileAutosave!: FormAutosaveCoordinator<Record<string, unknown>>;
  private unbindBeforeUnload?: () => void;

  constructor(
    private auth: AuthService,
    private fb: FormBuilder,
    private unsavedSvc: UnsavedChangesService,
  ) {}

  ngOnInit(): void {
    this.auth.getProfile().subscribe({
      next: (p) => { this.profile.set(p); this.loading.set(false); this.initForm(p); },
      error: () => { this.loading.set(false); this.error.set('Could not load profile.'); },
    });
    this.unbindBeforeUnload = this.unsavedSvc.bindBeforeUnload(() => this.hasUnsavedChanges());
  }

  ngOnDestroy(): void {
    this.profileAutosave?.disconnect();
    this.unbindBeforeUnload?.();
  }

  hasUnsavedChanges(): boolean {
    return this.editMode() && this.profileAutosave.hasUnsavedChanges();
  }

  discardUnsavedChanges(): void {
    this.profileAutosave.discardChanges();
  }

  private initForm(p: DirectorProfile): void {
    if (!this.form) {
      this.form = this.fb.group({
        firstName:   [p.firstName, [Validators.required, Validators.maxLength(100)]],
        lastName:    [p.lastName,  [Validators.required, Validators.maxLength(100)]],
        phoneNumber: [p.phoneNumber || ''],
      });

      this.profileAutosave = new FormAutosaveCoordinator(this.form, {
        enabled: () => this.editMode(),
        isValid: () => this.form.valid,
        save: (value) => this.auth.updateProfile({
          firstName: String(value['firstName']).trim(),
          lastName: String(value['lastName']).trim(),
          phoneNumber: (value['phoneNumber'] as string) || undefined,
        }),
        onSaving: () => {
          this.saving.set(true);
          this.saveError.set('');
        },
        onSuccess: () => {
          this.saving.set(false);
          this.saved.set(true);
          this.auth.getProfile().subscribe((profile) => {
            this.profile.set(profile);
            this.auth.updateSessionName(formatDisplayName(profile));
            this.profileAutosave.setBaseline({
              firstName: profile.firstName,
              lastName: profile.lastName,
              phoneNumber: profile.phoneNumber || '',
            });
          });
        },
        onError: (err: unknown) => {
          this.saving.set(false);
          this.saveError.set((err as { error?: { error?: string } })?.error?.error
            || 'Could not save changes.');
        },
      });
      this.profileAutosave.connect();
    }

    this.profileAutosave.setBaseline({
      firstName: p.firstName,
      lastName: p.lastName,
      phoneNumber: p.phoneNumber || '',
    });
  }

  startEdit(): void {
    this.editMode.set(true);
    this.saved.set(false);
    this.saveError.set('');
    this.initForm(this.profile()!);
  }

  async cancelEdit(): Promise<void> {
    const canLeave = await this.unsavedSvc.confirmLeave(
      () => this.hasUnsavedChanges(),
      () => this.discardUnsavedChanges(),
    );
    if (!canLeave) return;
    this.editMode.set(false);
    this.initForm(this.profile()!);
  }
}
