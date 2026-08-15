/**
 * Phase 7 — Registration document E2E helpers.
 */
import {
  PORTAL_API_URL,
  DIRECTOR_A,
  DIRECTOR_B,
  portalApiLogin,
} from '../fixtures';
import { adminApiLogin } from './roster-helpers';
import { findGroupId } from './performance-helpers';

export const E2E_DOCUMENT_GROUPS = {
  ALPHA: 'E2E Group Alpha',
  A2: 'E2E Group A2',
  CHORAL: 'E2E Choral Group Alpha',
  A_HISTORICAL: 'E2E Group A Historical',
  BETA_DIRECTOR: 'E2E Group Beta Director',
  DEADLINE_OPEN: 'E2E Document Deadline Open',
  DEADLINE_CLOSED: 'E2E Document Deadline Closed',
} as const;

export const DOCUMENT_DEADLINE_FUTURE = '2030-02-05';
export const DOCUMENT_DEADLINE_PAST = '2020-02-05';

export type DocumentType = 'SIGNED_ROSTER' | 'YOUTH_SAFETY';

/** Minimal valid test PDF — no real PII. */
export function createTestPdfBuffer(label = 'FDF E2E TEST DOCUMENT'): Buffer {
  const content =
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n` +
    `4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 50 700 Td (${label}) Tj ET\nendstream\nendobj\n` +
    `trailer<</Root 1 0 R>>\n%%EOF\n`;
  return Buffer.from(content);
}

export async function setDocumentDeadline(deadlineDate: string): Promise<void> {
  const token = await adminApiLogin('e2e_reg_admin');
  const resp = await fetch(`${PORTAL_API_URL}/registration/deadlines/DOCUMENT`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deadline_date: deadlineDate }),
  });
  if (!resp.ok) throw new Error(`Failed to set document deadline: ${resp.status}`);
}

export async function clearDocumentDeadline(): Promise<void> {
  const token = await adminApiLogin('e2e_reg_admin');
  await fetch(`${PORTAL_API_URL}/registration/deadlines/DOCUMENT`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function uploadDocumentApi(
  groupId: number,
  documentType: DocumentType,
  token: string,
  pdfBuffer?: Buffer,
  filename = 'e2e-test-document.pdf',
): Promise<{ id: number; verification_status: string }> {
  const buffer = pdfBuffer ?? createTestPdfBuffer();
  const form = new FormData();
  const blob = new Blob([buffer], { type: 'application/pdf' });
  form.append('file', blob, filename);
  form.append('document_type', documentType);

  const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as { error?: string };
    throw new Error(`Upload failed: ${resp.status} ${err.error ?? ''}`);
  }
  return resp.json() as Promise<{ id: number; verification_status: string }>;
}

export async function getDocumentsApi(groupId: number, token: string) {
  const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`getDocuments failed: ${resp.status}`);
  return resp.json() as Promise<Array<{
    id: number;
    document_type: string;
    original_filename: string;
    verification_status: string;
    storage_key?: string;
  }>>;
}

export async function getDocumentContentApi(
  groupId: number,
  documentId: number,
  token: string,
): Promise<Buffer> {
  const resp = await fetch(
    `${PORTAL_API_URL}/groups/${groupId}/documents/${documentId}/content`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp.ok) throw new Error(`getContent failed: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

export async function verifyDocumentApi(
  groupId: number,
  documentId: number,
  token: string,
): Promise<void> {
  const resp = await fetch(
    `${PORTAL_API_URL}/groups/${groupId}/documents/${documentId}/verify`,
    { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' },
  );
  if (!resp.ok) throw new Error(`verify failed: ${resp.status}`);
}

export async function rejectDocumentApi(
  groupId: number,
  documentId: number,
  reason: string,
  token: string,
): Promise<void> {
  const resp = await fetch(
    `${PORTAL_API_URL}/groups/${groupId}/documents/${documentId}/reject`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejection_reason: reason }),
    },
  );
  if (!resp.ok) throw new Error(`reject failed: ${resp.status}`);
}

export { findGroupId, portalApiLogin, adminApiLogin, DIRECTOR_A, DIRECTOR_B, PORTAL_API_URL };
