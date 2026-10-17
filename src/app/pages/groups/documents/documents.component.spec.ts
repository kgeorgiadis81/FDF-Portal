import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { DocumentsComponent } from './documents.component';
import { DocumentContext, RegistrationDocument } from '../../../services/document.service';

const routeState = { id: '1' };

const currentDoc: RegistrationDocument = {
  id: 5,
  group_id: 1,
  document_type: 'SIGNED_ROSTER',
  original_filename: 'roster.pdf',
  mime_type: 'application/pdf',
  size_bytes: 2048,
  verification_status: 'PENDING',
  uploaded_at: '2026-06-01T12:00:00.000Z',
  verified_at: null,
  rejection_reason: null,
  is_current: true,
  replaced_document_id: null,
};

const context: DocumentContext = {
  group: { id: 1, groupType: 'Dance', eventId: 2, isActive: true, isArchived: false },
  deadline: { deadline_date: '2026-06-15', effective_cutoff: '2026-06-15T18:30:00.000Z', can_edit: true },
  documents: [
    { document_type: 'SIGNED_ROSTER', status: 'PENDING', current: currentDoc, can_upload: true, can_replace: true, can_view: true },
    { document_type: 'YOUTH_SAFETY', status: 'NOT_UPLOADED', current: null, can_upload: true, can_replace: false, can_view: false },
  ],
};

describe('DocumentsComponent', () => {
  let httpMock: HttpTestingController;
  let fixture: ComponentFixture<DocumentsComponent>;
  let snack: MatSnackBar;

  beforeEach(() => {
    routeState.id = '1';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useFactory: () => ({
          snapshot: {
            paramMap: convertToParamMap(routeState.id ? { id: routeState.id } : {}),
            queryParamMap: convertToParamMap({}),
          },
        }) },
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

  function create(): DocumentsComponent {
    fixture = TestBed.createComponent(DocumentsComponent);
    snack = fixture.debugElement.injector.get(MatSnackBar);
    if (!jasmine.isSpy(snack.open)) spyOn(snack, 'open');
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  function load(ctx: DocumentContext = context): DocumentsComponent {
    const component = create();
    httpMock.expectOne('/api/portal/groups/1/document-context').flush(ctx);
    fixture.detectChanges();
    return component;
  }

  function selectFile(name = 'roster.pdf'): Event {
    const file = new File(['%PDF'], name, { type: 'application/pdf' });
    return { target: { files: [file], value: '' } } as unknown as Event;
  }

  it('rejects a missing group id', () => {
    routeState.id = '';
    const component = create();
    expect(component.error()).toBe('Invalid group.');
    expect(component.loading()).toBeFalse();
    expect(component.sections()).toEqual([]);
  });

  it('loads document sections and formats status, size, and dates', () => {
    const inactive: DocumentContext = {
      ...context,
      group: { ...context.group, isActive: false },
      deadline: { deadline_date: null, effective_cutoff: null, can_edit: false },
    };
    const component = load(inactive);
    expect(component.loading()).toBeFalse();
    expect(component.sections().map((section) => section.label)).toEqual(['Signed Roster', 'Youth Safety Compliance']);
    expect(component.canEdit()).toBeFalse();
    expect(component.isReadOnly()).toBeTrue();
    expect(component.isActiveEvent()).toBeFalse();
    expect(component.statusLabel('VERIFIED')).toBe('Verified');
    expect(component.statusLabel('REJECTED')).toBe('Rejected');
    expect(component.statusLabel('PENDING')).toBe('Pending Review');
    expect(component.statusLabel('OTHER')).toBe('Not Uploaded');
    expect(component.statusClass('VERIFIED')).toBe('status-verified');
    expect(component.statusClass('REJECTED')).toBe('status-rejected');
    expect(component.statusClass('PENDING')).toBe('status-pending');
    expect(component.statusClass('OTHER')).toBe('status-missing');
    expect(component.formatBytes(12)).toBe('12 B');
    expect(component.formatBytes(2048)).toBe('2.0 KB');
    expect(component.formatBytes(2 * 1048576)).toBe('2.0 MB');
    expect(component.formatDeadlineDate('2026-06-15')).toContain('2026');
    expect(component.formatDeadlineDate(null)).toBe('');
    expect(component.formatEffectiveCutoff('2026-06-15T18:30:00.000Z')).toContain('2026');
    expect(component.formatEffectiveCutoff(null)).toBe('');
    component.ngOnDestroy();
  });

  it('shows the server error or a fallback when context fails', () => {
    const component = create();
    httpMock.expectOne('/api/portal/groups/1/document-context')
      .flush({ error: 'Hidden' }, { status: 403, statusText: 'Forbidden' });
    expect(component.error()).toBe('Hidden');

    const fallback = create();
    httpMock.expectOne('/api/portal/groups/1/document-context').flush('nope', { status: 500, statusText: 'Error' });
    expect(fallback.error()).toBe('Unable to load documents.');
  });

  it('toggles history open and closed and reports a history error', () => {
    const component = load();
    const older: RegistrationDocument = { ...currentDoc, id: 4, document_type: 'YOUTH_SAFETY', is_current: false };
    component.toggleHistory();
    httpMock.expectOne('/api/groups/1/documents/history').flush([currentDoc, older]);
    expect(component.showHistory()).toBeTrue();
    expect(component.historyForType('SIGNED_ROSTER').length).toBe(1);
    component.toggleHistory();
    expect(component.showHistory()).toBeFalse();

    component.toggleHistory();
    httpMock.expectOne('/api/groups/1/documents/history').flush({ error: 'nope' }, { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Unable to load document history.', 'Close', jasmine.any(Object));
    expect(component.showHistory()).toBeFalse();
  });

  it('uploads a file, reloads context, and closes an open history', () => {
    const component = load();
    component.onFileSelected({ target: document.createElement('input') } as unknown as Event, 'SIGNED_ROSTER');
    expect(component.uploading()).toBeNull();

    component.toggleHistory();
    httpMock.expectOne('/api/groups/1/documents/history').flush([currentDoc]);
    component.onFileSelected(selectFile(), 'YOUTH_SAFETY');
    const upload = httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/groups/1/documents');
    expect(upload.request.body instanceof FormData).toBeTrue();
    upload.flush({ id: 6, verification_status: 'PENDING' });
    httpMock.expectOne('/api/portal/groups/1/document-context').flush(context);
    expect(component.uploading()).toBeNull();
    expect(component.showHistory()).toBeFalse();
    expect(snack.open).toHaveBeenCalledWith(
      'Document uploaded. Awaiting FDF review.', 'Close', jasmine.objectContaining({ duration: 4000 }),
    );
  });

  it('reports an upload failure with the server message or a fallback', () => {
    const component = load();
    component.onFileSelected(selectFile(), 'SIGNED_ROSTER');
    httpMock.expectOne((req) => req.method === 'POST').flush({ error: 'PDF only' }, { status: 400, statusText: 'Bad Request' });
    expect(snack.open).toHaveBeenCalledWith('PDF only', 'Close', jasmine.objectContaining({ panelClass: 'error-snackbar' }));

    component.onFileSelected(selectFile(), 'SIGNED_ROSTER');
    httpMock.expectOne((req) => req.method === 'POST').flush({}, { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Upload failed.', 'Close', jasmine.any(Object));
    expect(component.uploading()).toBeNull();
  });

  it('opens and downloads document content and reports failures', () => {
    const component = load();
    spyOn(URL, 'createObjectURL').and.returnValue('blob:doc');
    spyOn(URL, 'revokeObjectURL');
    spyOn(window, 'open');
    spyOn(HTMLAnchorElement.prototype, 'click');

    component.viewDocument(5);
    httpMock.expectOne('/api/groups/1/documents/5/content').flush(new Blob(['pdf']));
    expect(window.open).toHaveBeenCalledWith('blob:doc', '_blank', 'noopener,noreferrer');

    component.viewDocument(5);
    httpMock.expectOne('/api/groups/1/documents/5/content').flush(new Blob(['nope']), { status: 404, statusText: 'Not Found' });
    expect(snack.open).toHaveBeenCalledWith('Unable to view document.', 'Close', jasmine.any(Object));

    component.downloadDocument(5, 'roster.pdf');
    httpMock.expectOne('/api/groups/1/documents/5/content?download=1').flush(new Blob(['pdf']));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();

    component.downloadDocument(5, 'roster.pdf');
    httpMock.expectOne('/api/groups/1/documents/5/content?download=1').flush(new Blob(['nope']), { status: 500, statusText: 'Error' });
    expect(snack.open).toHaveBeenCalledWith('Unable to download document.', 'Close', jasmine.any(Object));

    fixture.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:doc');
  });
});
