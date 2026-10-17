import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';

import { RosterPrintComponent } from './roster-print.component';

describe('RosterPrintComponent', () => {
  let httpMock: HttpTestingController;
  let groupId = '9';

  beforeEach(() => {
    groupId = '9';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useFactory: () => ({ snapshot: { paramMap: { get: () => groupId } } }),
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('prints a loaded roster and formats dates of birth', () => {
    const fixture = TestBed.createComponent(RosterPrintComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/portal/groups/9').flush({
      id: 9,
      name: 'Alpha',
      groupType: 'Dance',
      parish: { id: 1, name: 'Parish', location: 'City' },
      event: { id: 2, name: 'Active Event', isActive: true },
      primaryDirector: { name: 'Ada', email: 'ada@e2e.test' },
      isReadOnly: false,
      rosterMemberCount: 1,
      rosterSubmittedAt: null,
    });
    httpMock.expectOne('/api/groups/9/roster').flush({
      members: [{
        id: 1,
        group_id: 9,
        first_name: 'Ada',
        last_name: 'Lovelace',
        date_of_birth: '2010-06-15',
        age_at_fdf: 15,
        member_order: 1,
      }],
      summary: {},
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Alpha');
    expect(fixture.nativeElement.textContent).toContain('Ada');
    expect(fixture.componentInstance.formatDob('2010-06-15')).toMatch(/\d{2}\/\d{2}\/\d{4}/);

    spyOn(window, 'print');
    fixture.componentInstance.print();
    expect(window.print).toHaveBeenCalled();
  });

  it('reports an invalid group and a failed load', () => {
    groupId = '';
    const missing = TestBed.createComponent(RosterPrintComponent);
    missing.detectChanges();
    expect(missing.componentInstance.error()).toBe('Invalid group.');
    expect(missing.componentInstance.loading()).toBeFalse();

    groupId = '9';
    const failed = TestBed.createComponent(RosterPrintComponent);
    failed.detectChanges();
    httpMock.expectOne('/api/groups/9/roster').flush({ members: [], summary: {} });
    httpMock.expectOne('/api/portal/groups/9').flush('nope', { status: 500, statusText: 'Error' });
    expect(failed.componentInstance.error()).toBe('Could not load roster for printing.');
    expect(failed.componentInstance.loading()).toBeFalse();
  });
});
