import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CostumeService } from './costume.service';
import { DirectorService } from './director.service';
import { DocumentService } from './document.service';
import { EventService } from './event.service';
import { GroupService } from './group.service';
import { ParishService } from './parish.service';
import { PerformanceService } from './performance.service';
import { PortalConfigService } from './portal-config.service';
import { RegistrationSummaryService } from './registration-summary.service';
import { RosterService } from './roster.service';

describe('portal data services', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function flush(method: string, url: string, body?: unknown) {
    const req = httpMock.expectOne({ method, url });
    if (body !== undefined) {
      expect(req.request.body).toEqual(body);
    }
    req.flush({ ok: true });
    return req;
  }

  it('GroupService, EventService, and ParishService hit their endpoints', () => {
    const groups = TestBed.inject(GroupService);
    const events = TestBed.inject(EventService);
    const parishes = TestBed.inject(ParishService);

    groups.getGroups().subscribe();
    flush('GET', '/api/portal/groups');
    groups.getGroups(7).subscribe();
    const filtered = httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/portal/groups' && r.params.get('eventId') === '7');
    filtered.flush({ ok: true });
    groups.getGroup(3).subscribe();
    flush('GET', '/api/portal/groups/3');
    groups.createGroup({ name: 'A', parishId: 1, groupType: 'Dance' }).subscribe();
    flush('POST', '/api/portal/groups', { name: 'A', parishId: 1, groupType: 'Dance' });
    groups.updateGroup(3, { name: 'B', parishId: 2, groupType: 'Choral' }).subscribe();
    flush('PUT', '/api/portal/groups/3');
    events.getActiveEvent().subscribe();
    flush('GET', '/api/portal/events/active');
    events.getMyHistory().subscribe();
    flush('GET', '/api/portal/events/my-history');
    parishes.getAll().subscribe();
    flush('GET', '/api/parishes');
  });

  it('DirectorService and RegistrationSummaryService hit their endpoints', () => {
    const directors = TestBed.inject(DirectorService);
    const summary = TestBed.inject(RegistrationSummaryService);
    const payload = { first_name: 'Co', last_name: 'Director' };

    directors.getDirectors(1).subscribe();
    flush('GET', '/api/portal/groups/1/directors');
    directors.addCoDirector(1, payload).subscribe();
    flush('POST', '/api/portal/groups/1/co-directors', payload);
    directors.updateCoDirector(1, 9, payload).subscribe();
    flush('PUT', '/api/portal/groups/1/co-directors/9', payload);
    directors.removeCoDirector(1, 9).subscribe();
    flush('DELETE', '/api/portal/groups/1/co-directors/9');
    summary.getSummary(1).subscribe();
    flush('GET', '/api/portal/groups/1/registration-summary');
  });

  it('RosterService hits roster, chaperone, and submission endpoints', () => {
    const roster = TestBed.inject(RosterService);
    const member = { first_name: 'A', last_name: 'B', date_of_birth: '2010-01-01' };
    const chaperone = { first_name: 'C', last_name: 'D', phone: null, is_21_or_older_confirmed: true };

    roster.getRosterContext(1).subscribe();
    flush('GET', '/api/portal/groups/1/roster-context');
    roster.getRoster(1).subscribe();
    flush('GET', '/api/groups/1/roster');
    roster.addMember(1, member).subscribe();
    flush('POST', '/api/groups/1/roster', member);
    roster.updateMember(1, 2, { ...member, member_order: 1 }).subscribe();
    flush('PUT', '/api/groups/1/roster/2');
    roster.deleteMember(1, 2).subscribe();
    flush('DELETE', '/api/groups/1/roster/2');
    roster.getChaperones(1).subscribe();
    flush('GET', '/api/groups/1/chaperones');
    roster.addChaperone(1, chaperone).subscribe();
    flush('POST', '/api/groups/1/chaperones', chaperone);
    roster.updateChaperone(1, 4, chaperone).subscribe();
    flush('PUT', '/api/groups/1/chaperones/4', chaperone);
    roster.deleteChaperone(1, 4).subscribe();
    flush('DELETE', '/api/groups/1/chaperones/4');
    roster.submitRoster(1).subscribe();
    flush('POST', '/api/groups/1/submissions', { submission_type: 'ROSTER' });
    roster.getSubmissions(1).subscribe();
    flush('GET', '/api/groups/1/submissions');
  });

  it('DocumentService builds content URLs and uploads a file', () => {
    const documents = TestBed.inject(DocumentService);
    expect(documents.getContentUrl(1, 8)).toBe('/api/groups/1/documents/8/content');
    expect(documents.getContentUrl(1, 8, true)).toBe('/api/groups/1/documents/8/content?download=1');

    documents.getDocumentContext(1).subscribe();
    flush('GET', '/api/portal/groups/1/document-context');
    documents.getDocuments(1).subscribe();
    flush('GET', '/api/groups/1/documents');
    documents.getHistory(1).subscribe();
    flush('GET', '/api/groups/1/documents/history');
    documents.fetchContent(1, 8).subscribe();
    httpMock.expectOne({ method: 'GET', url: '/api/groups/1/documents/8/content' }).flush(new Blob(['pdf']));
    documents.fetchContent(1, 8, true).subscribe();
    httpMock.expectOne((r) => r.method === 'GET' && r.urlWithParams.includes('download=1')).flush(new Blob(['pdf']));
    const file = new File(['pdf'], 'roster.pdf', { type: 'application/pdf' });
    documents.uploadDocument(1, file, 'SIGNED_ROSTER').subscribe();
    const upload = httpMock.expectOne({ method: 'POST', url: '/api/groups/1/documents' });
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body instanceof FormData).toBeTrue();
    upload.flush({ id: 1 });
  });

  it('CostumeService and PerformanceService hit their endpoints', () => {
    const costumes = TestBed.inject(CostumeService);
    const performance = TestBed.inject(PerformanceService);
    const costume = {
      region: 'Crete', village: 'Anogia', resource_type_id: 1,
      has_won_award: false, purchased_most_or_all: false, purchased_any_parts: true,
    };
    const conflict = { round: 'Final' as const, related_group_id: 2, costume_count: 1 };

    costumes.getCostumeContext(1).subscribe();
    flush('GET', '/api/portal/groups/1/costume-context');
    costumes.getResourceTypes(1).subscribe();
    flush('GET', '/api/groups/1/costume-resource-types');
    costumes.getCostumes(1, 5).subscribe();
    flush('GET', '/api/groups/1/performances/5/costumes');
    costumes.createCostume(1, 5, 'WOMEN', costume).subscribe();
    flush('POST', '/api/groups/1/performances/5/costumes', { gender: 'WOMEN', ...costume });
    costumes.updateCostume(1, 5, 6, costume).subscribe();
    flush('PUT', '/api/groups/1/performances/5/costumes/6', costume);
    costumes.getCostumeConflicts(1).subscribe();
    flush('GET', '/api/groups/1/costume-conflicts');
    costumes.addCostumeConflict(1, conflict).subscribe();
    flush('POST', '/api/groups/1/costume-conflicts', conflict);
    costumes.updateCostumeConflict(1, 7, conflict).subscribe();
    flush('PUT', '/api/groups/1/costume-conflicts/7', conflict);
    costumes.deleteCostumeConflict(1, 7).subscribe();
    flush('DELETE', '/api/groups/1/costume-conflicts/7');
    costumes.searchRelatedGroups(1, '').subscribe();
    flush('GET', '/api/portal/groups/1/related-groups');
    costumes.searchRelatedGroups(1, 'alpha').subscribe();
    const search = httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/portal/groups/1/related-groups' && r.params.get('search') === 'alpha');
    expect(search.request.params.get('search')).toBe('alpha');
    search.flush([]);
    costumes.submitCostumes(1).subscribe();
    flush('POST', '/api/groups/1/submissions', { submission_type: 'COSTUME' });

    performance.getPerformanceContext(1).subscribe();
    flush('GET', '/api/portal/groups/1/performance-context');
    performance.getPerformance(1).subscribe();
    flush('GET', '/api/groups/1/performance');
    performance.getConflicts(1).subscribe();
    flush('GET', '/api/groups/1/performance/conflicts');
    performance.getConflicts(1, 'Final').subscribe();
    const conflicts = httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/groups/1/performance/conflicts' && r.params.get('round') === 'Final');
    conflicts.flush({ ok: true });
    expect(conflicts.request.params.get('round')).toBe('Final');
    performance.searchMusicians('lyra').subscribe();
    const musicians = httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/musicians/search' && r.params.get('q') === 'lyra');
    musicians.flush([]);
    performance.getInstruments().subscribe();
    flush('GET', '/api/instruments');
    performance.createEntry(1, 2, { title: 'Syrtos' }).subscribe();
    flush('POST', '/api/groups/1/performance/2/entries');
    performance.updateEntry(1, 2, 3, { title: 'Syrtos' }).subscribe();
    flush('PUT', '/api/groups/1/performance/2/entries/3');
    performance.deleteEntry(1, 2, 3).subscribe();
    flush('DELETE', '/api/groups/1/performance/2/entries/3');
    performance.reorderEntries(1, 2, [3, 4]).subscribe();
    flush('PATCH', '/api/groups/1/performance/2/entries/reorder', { entry_ids: [3, 4] });
    performance.updateLogistics(1, 2, { tables_chairs: 1 } as never).subscribe();
    flush('PATCH', '/api/groups/1/performance/2/logistics');
    performance.assignMusician(1, 2, 9, 1).subscribe();
    flush('POST', '/api/groups/1/performance/2/musicians', { musician_id: 9, display_order: 1 });
    performance.removeMusician(1, 2, 9).subscribe();
    flush('DELETE', '/api/groups/1/performance/2/musicians/9');
    performance.assignInstrument(1, 2, 4, 'custom').subscribe();
    flush('POST', '/api/groups/1/performance/2/instruments', { instrument_id: 4, custom_name: 'custom' });
    performance.removeInstrument(1, 2, 8).subscribe();
    flush('DELETE', '/api/groups/1/performance/2/instruments/8');
    performance.submitPerformance(1, 'DANCE_PERFORMANCE').subscribe();
    flush('POST', '/api/groups/1/submissions', { submission_type: 'DANCE_PERFORMANCE' });
  });

  it('PortalConfigService stores public config and still finishes when the request fails', () => {
    const config = TestBed.inject(PortalConfigService);
    const req = httpMock.expectOne('/api/portal/auth/public-config');
    req.flush({ privacyPolicyUrl: 'https://example.test/privacy', requiredConsentVersion: '2.0' });
    expect(config.privacyPolicyUrl()).toBe('https://example.test/privacy');
    expect(config.requiredConsentVersion()).toBe('2.0');
    expect(config.loaded()).toBeTrue();

    config.load();
    httpMock.expectOne('/api/portal/auth/public-config').flush('nope', { status: 500, statusText: 'Error' });
    expect(config.loaded()).toBeTrue();

    config.load();
    httpMock.expectOne('/api/portal/auth/public-config').flush({ privacyPolicyUrl: '', requiredConsentVersion: '' });
    expect(config.privacyPolicyUrl()).toBe('');
    expect(config.requiredConsentVersion()).toBe('1.0');
  });
});
