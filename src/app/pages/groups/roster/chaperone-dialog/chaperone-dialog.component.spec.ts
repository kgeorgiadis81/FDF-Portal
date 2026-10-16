import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ChaperoneDialogComponent, ChaperoneDialogData } from './chaperone-dialog.component';
import { Chaperone } from '../../../../services/roster.service';

describe('ChaperoneDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogData: ChaperoneDialogData;
  let dialogRef: jasmine.SpyObj<MatDialogRef<ChaperoneDialogComponent>>;

  const chaperone: Chaperone = {
    id: 6, group_id: 1, first_name: 'Mina', last_name: 'Park',
    phone: '555-0100', is_21_or_older_confirmed: 1,
  };

  beforeEach(() => {
    dialogData = {};
    dialogRef = jasmine.createSpyObj<MatDialogRef<ChaperoneDialogComponent>>('MatDialogRef', ['close']);
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

  function create(): ComponentFixture<ChaperoneDialogComponent> {
    const fixture = TestBed.createComponent(ChaperoneDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('does not close an incomplete form or an over-long phone number', () => {
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('Add Chaperone');
    expect(fixture.componentInstance.isEdit).toBeFalse();
    fixture.componentInstance.submit();
    expect(dialogRef.close).not.toHaveBeenCalled();

    fixture.componentInstance.form.patchValue({
      first_name: 'Ada', last_name: 'Lovelace', phone: '1'.repeat(31),
    });
    fixture.componentInstance.submit();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.get('phone')?.errors?.['maxlength']).toBeTruthy();
  });

  it('closes with a blank phone stored as null', () => {
    const fixture = create();
    fixture.componentInstance.form.setValue({
      first_name: ' Ada ', last_name: ' Lovelace ', phone: '   ', is_21_or_older_confirmed: true,
    });
    fixture.componentInstance.submit();
    expect(dialogRef.close).toHaveBeenCalledWith({
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: null,
      is_21_or_older_confirmed: true,
    });
  });

  it('prefills a chaperone being edited', () => {
    dialogData = { chaperone };
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('Edit Chaperone');
    expect(fixture.componentInstance.form.value.is_21_or_older_confirmed).toBeTrue();
    fixture.componentInstance.form.patchValue({ phone: ' 555 ' });
    fixture.componentInstance.submit();
    expect(dialogRef.close).toHaveBeenCalledWith({
      first_name: 'Mina',
      last_name: 'Park',
      phone: '555',
      is_21_or_older_confirmed: true,
    });
  });
});
