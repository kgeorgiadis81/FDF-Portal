import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type DocumentType = 'SIGNED_ROSTER' | 'YOUTH_SAFETY';
export type DocumentStatus = 'NOT_UPLOADED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface RegistrationDocument {
  id: number;
  group_id: number;
  document_type: DocumentType;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  verification_status: Exclude<DocumentStatus, 'NOT_UPLOADED'>;
  uploaded_at: string;
  verified_at: string | null;
  rejection_reason: string | null;
  is_current: boolean;
  replaced_document_id: number | null;
}

export interface DocumentTypeContext {
  document_type: DocumentType;
  status: DocumentStatus;
  current: RegistrationDocument | null;
  can_upload: boolean;
  can_replace: boolean;
  can_view: boolean;
}

export interface DocumentContext {
  group: {
    id: number;
    groupType: string;
    eventId: number;
    isActive: boolean;
    isArchived: boolean;
  };
  deadline: {
    deadline_date: string | null;
    effective_cutoff: string | null;
    can_edit: boolean;
  };
  documents: DocumentTypeContext[];
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  getDocumentContext(groupId: number) {
    return this.http.get<DocumentContext>(`${this.api}/portal/groups/${groupId}/document-context`);
  }

  getDocuments(groupId: number) {
    return this.http.get<RegistrationDocument[]>(`${this.api}/groups/${groupId}/documents`);
  }

  getHistory(groupId: number) {
    return this.http.get<RegistrationDocument[]>(`${this.api}/groups/${groupId}/documents/history`);
  }

  uploadDocument(groupId: number, file: File, documentType: DocumentType) {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('document_type', documentType);
    return this.http.post<{ id: number; verification_status: string }>(
      `${this.api}/groups/${groupId}/documents`,
      form
    );
  }

  getContentUrl(groupId: number, documentId: number, download = false): string {
    const base = `${this.api}/groups/${groupId}/documents/${documentId}/content`;
    return download ? `${base}?download=1` : base;
  }

  fetchContent(groupId: number, documentId: number, download = false): Observable<Blob> {
    return this.http.get(this.getContentUrl(groupId, documentId, download), {
      responseType: 'blob',
    });
  }
}
