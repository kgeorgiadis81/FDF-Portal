import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { EntryDialogComponent } from './entry-dialog.component';
import { EntryDialogData } from './entry-dialog.component';
import { ChoralEntry, DanceEntry } from '../../../../services/performance.service';

describe('EntryDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogData: EntryDialogData;
  let dialogRef: jasmine.SpyObj<MatDialogRef<EntryDialogComponent>>;

  const dance: DanceEntry = {
    id: 3, entry_order: 1, name: 'Pentozali', region: 'Crete', village: 'Anogia',
    uses_live_music: true, uses_recorded_music: false, is_acapella: false,
    dancers_singing: true, musicians_singing: false, individual_singing: false,
  };

  const song: ChoralEntry = {
    id: 4, entry_order: 1, name: 'Hymn', uses_live_music: false, uses_recorded_music: true,
    choral_classification: 'LITURGICAL',
  };

  beforeEach(() => {
    dialogData = { isDance: true, roundLabel: 'Final' };
    dialogRef = jasmine.createSpyObj<MatDialogRef<EntryDialogComponent>>('MatDialogRef', ['close']);
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

  function create(): ComponentFixture<EntryDialogComponent> {
    const fixture = TestBed.createComponent(EntryDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('does not close an empty dance form', () => {
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('Add Dance');
    expect(fixture.componentInstance.isEdit).toBeFalse();
    fixture.componentInstance.submit();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('closes a new dance with trimmed text and boolean flags', () => {
    const fixture = create();
    fixture.componentInstance.form.setValue({
      name: '  Kalamatiano ',
      region: '   ',
      village: ' Village ',
      uses_live_music: true,
      uses_recorded_music: false,
      is_acapella: true,
      dancers_singing: false,
      musicians_singing: true,
      individual_singing: false,
    });
    fixture.componentInstance.submit();
    expect(dialogRef.close).toHaveBeenCalledWith({
      name: 'Kalamatiano',
      region: null,
      village: 'Village',
      uses_live_music: true,
      uses_recorded_music: false,
      is_acapella: true,
      dancers_singing: false,
      musicians_singing: true,
      individual_singing: false,
      choral_classification: null,
    });
  });

  it('prefills a dance being edited', () => {
    dialogData = { isDance: true, roundLabel: 'Semi-Final', entry: dance };
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('Edit Dance');
    expect(fixture.componentInstance.form.value.name).toBe('Pentozali');
    expect(fixture.componentInstance.roundLabel).toBe('Semi-Final');
  });

  it('adds a secular song and edits a liturgical one', () => {
    dialogData = { isDance: false, roundLabel: 'Final' };
    const created = create();
    expect(created.nativeElement.textContent).toContain('Add Song');
    created.componentInstance.form.patchValue({ name: '  Song  ' });
    created.componentInstance.submit();
    expect(dialogRef.close).toHaveBeenCalledWith(jasmine.objectContaining({
      name: 'Song',
      region: null,
      village: null,
      choral_classification: 'SECULAR',
      uses_live_music: false,
      uses_recorded_music: false,
    }));

  });

  it('edits a liturgical song', () => {
    dialogData = { isDance: false, roundLabel: 'Final', entry: song };
    const edited = create();
    expect(edited.nativeElement.textContent).toContain('Edit Song');
    expect(edited.componentInstance.form.value.choral_classification).toBe('LITURGICAL');
    edited.componentInstance.submit();
    expect(dialogRef.close).toHaveBeenCalledWith(jasmine.objectContaining({
      name: 'Hymn',
      choral_classification: 'LITURGICAL',
      uses_recorded_music: true,
    }));
  });
});
