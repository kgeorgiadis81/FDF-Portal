import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { CoDirectorDialogComponent, CoDirectorDialogData } from './co-director-dialog.component';
import { GroupDirector } from '../../../services/director.service';

describe('CoDirectorDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogData: CoDirectorDialogData;
  let dialogRef: jasmine.SpyObj<MatDialogRef<CoDirectorDialogComponent>>;

  const director: GroupDirector = {
    id: 3,
    first_name: 'Bea',
    last_name: 'Code',
    email: 'bea@e2e.test',
    cell_phone: '555',
    is_primary: 0,
    display_order: 2,
    is_legacy: 0,
  };

  beforeEach(() => {
    dialogData = {};
    dialogRef = jasmine.createSpyObj<MatDialogRef<CoDirectorDialogComponent>>('MatDialogRef', ['close']);
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

  function create(): ComponentFixture<CoDirectorDialogComponent> {
    const fixture = TestBed.createComponent(CoDirectorDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('keeps an incomplete add form open', () => {
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('Add Co-Director');
    fixture.componentInstance.save();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.touched).toBeTrue();
  });

  it('rejects an invalid email and closes with a trimmed payload', () => {
    const fixture = create();
    fixture.componentInstance.form.setValue({
      first_name: '  Ada ',
      last_name: ' Lovelace ',
      email: 'not-an-email',
      cell_phone: ' 555 ',
    });
    fixture.componentInstance.save();
    expect(dialogRef.close).not.toHaveBeenCalled();

    fixture.componentInstance.form.patchValue({ email: '', cell_phone: '   ' });
    fixture.componentInstance.save();
    expect(dialogRef.close).toHaveBeenCalledWith({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: undefined,
      cell_phone: undefined,
    });
  });

  it('prefills an existing co-director and saves the edited values', () => {
    dialogData = { director };
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('Edit Co-Director');
    expect(fixture.componentInstance.form.value.first_name).toBe('Bea');
    fixture.componentInstance.form.patchValue({ email: 'new@e2e.test', cell_phone: ' 555 ' });
    fixture.componentInstance.save();
    expect(dialogRef.close).toHaveBeenCalledWith(jasmine.objectContaining({
      first_name: 'Bea',
      last_name: 'Code',
      email: 'new@e2e.test',
      cell_phone: '555',
    }));
  });
});
