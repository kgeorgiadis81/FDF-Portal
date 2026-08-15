import { test, expect } from '@playwright/test';

import { DIRECTOR_A, DIRECTOR_B, PORTAL_API_URL } from '../fixtures';
import {
  E2E_DOCUMENT_GROUPS,
  findGroupId,
  portalApiLogin,
  adminApiLogin,
  uploadDocumentApi,
  getDocumentsApi,
  getDocumentContentApi,
  createTestPdfBuffer,
  resetGroupDocuments,
} from '../support/document-helpers';

test.describe('Document IDOR protection', () => {
  let groupBId: number;
  let docId: number;
  let directorAToken: string;
  let directorBToken: string;

  test.beforeAll(async () => {
    groupBId = await findGroupId(E2E_DOCUMENT_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);
    directorAToken = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    directorBToken = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
    const upload = await uploadDocumentApi(
      groupBId, 'SIGNED_ROSTER', directorBToken,
      createTestPdfBuffer('IDOR TEST'), 'idor-test.pdf',
    );
    docId = upload.id;
  });

  test('Director A cannot list Director B documents', async () => {
    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupBId}/documents`, {
      headers: { Authorization: `Bearer ${directorAToken}` },
    });
    expect(resp.status).toBe(403);
  });

  test('Director A cannot download Director B document content', async () => {
    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupBId}/documents/${docId}/content`, {
      headers: { Authorization: `Bearer ${directorAToken}` },
    });
    expect(resp.status).toBe(403);
  });

  test('Director A cannot upload to Director B group', async () => {
    const form = new FormData();
    const blob = new Blob([createTestPdfBuffer()], { type: 'application/pdf' });
    form.append('file', blob, 'evil.pdf');
    form.append('document_type', 'SIGNED_ROSTER');
    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupBId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${directorAToken}` },
      body: form,
    });
    expect(resp.status).toBe(403);
  });
});

test.describe('Document role security', () => {
  test('Registration Admin can access document content', async () => {
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);
    const directorToken = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
    const adminToken = await adminApiLogin('e2e_reg_admin');
    const upload = await uploadDocumentApi(
      groupId, 'YOUTH_SAFETY', directorToken,
      createTestPdfBuffer('ADMIN ACCESS'), 'admin-access.pdf',
    );
    const content = await getDocumentContentApi(groupId, upload.id, adminToken);
    expect(content.length).toBeGreaterThan(0);
  });

  test('Viewer cannot access document metadata', async () => {
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);
    const viewerToken = await adminApiLogin('e2e_viewer');
    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/documents`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    expect(resp.status).toBe(403);
  });

  test('Director cannot verify own document', async () => {
    await resetGroupDocuments(E2E_DOCUMENT_GROUPS.DEADLINE_CLOSED);
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.DEADLINE_CLOSED);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const upload = await uploadDocumentApi(groupId, 'SIGNED_ROSTER', token);
    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/documents/${upload.id}/verify`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(resp.status).toBe(403);
  });

  test('Competitions Admin cannot verify documents', async () => {
    await resetGroupDocuments(E2E_DOCUMENT_GROUPS.DEADLINE_CLOSED);
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.DEADLINE_CLOSED);
    const directorToken = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const compToken = await adminApiLogin('e2e_comp_admin');
    const upload = await uploadDocumentApi(groupId, 'YOUTH_SAFETY', directorToken);
    const resp = await fetch(`${PORTAL_API_URL}/groups/${groupId}/documents/${upload.id}/verify`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${compToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(resp.status).toBe(403);
  });
});

test.describe('Storage key leakage', () => {
  test('API responses do not include storage_key', async () => {
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.ALPHA);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const docs = await getDocumentsApi(groupId, token);
    for (const doc of docs) {
      expect(doc.storage_key).toBeUndefined();
    }
  });
});
