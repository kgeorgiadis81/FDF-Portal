import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ParticipantDialogComponent, ParticipantDialogData } from './participant-dialog.component';
import { RosterMember } from '../../../../services/roster.service';

describe('ParticipantDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogData: ParticipantDialogData;
  let dialogRef: jasmine.SpyObj<MatDialogRef<ParticipantDialogComponent>>;

  const member: RosterMember = {
    id: 7, group_id: 1, first_name: 'Nina', last_name: 'Sole',
    date_of_birth: '2010-04-01', age_at_fdf: 16, member_order: 2,
  };

  beforeEach(() => {
    dialogData = {};
    dialogRef = jasmine.createSpyObj<MatDialogRef<ParticipantDialogComponent>>('MatDialogRef', ['close']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useFactory: () => dialogData },
        { provide: MatDialogRef, useFactory: () => dialogRef },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.match('/api/portal/auth/public-config').forEach((req) =>
      req.flush({ privacyPolicyUrl: '', requiredConsentVersion: '1.0' }),
    );
    httpMock.verify();
  });

  function create(): ComponentFixture<ParticipantDialogComponent> {
    const fixture = TestBed.createComponent(ParticipantDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('does not close until a past date of birth is entered', () => {
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('Add Participant');
    expect(fixture.componentInstance.isEdit).toBeFalse();
    expect(fixture.componentInstance.saving).toBeFalse();
    fixture.componentInstance.submit();
    expect(dialogRef.close).not.toHaveBeenCalled();

    fixture.componentInstance.form.patchValue({
      first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '2999-01-01',
    });
    expect(fixture.componentInstance.form.get('date_of_birth')?.errors?.['futureDate']).toBeTrue();
    fixture.componentInstance.submit();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('closes with a trimmed new participant', () => {
    const fixture = create();
    fixture.componentInstance.form.setValue({
      first_name: ' Ada ', last_name: ' Lovelace ', date_of_birth: '2000-01-15',
    });
    fixture.componentInstance.submit();
    expect(dialogRef.close).toHaveBeenCalledWith({
      first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '2000-01-15',
    });
  });

  it('prefills a participant being edited', () => {
    dialogData = { member, ageReferenceDate: '2026-06-15' };
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('Edit Participant');
    expect(fixture.componentInstance.form.value).toEqual({
      first_name: 'Nina', last_name: 'Sole', date_of_birth: '2010-04-01',
    });
    fixture.componentInstance.submit();
    expect(dialogRef.close).toHaveBeenCalledWith({
      first_name: 'Nina', last_name: 'Sole', date_of_birth: '2010-04-01',
    });
  });
});
