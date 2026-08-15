import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { DIRECTOR_A, DIRECTOR_B, PORTAL_BASE_URL } from '../fixtures';
import { getDirectorHistoricalEventId, findDirectorGroupIdForEvent } from '../support/roster-helpers';
import {
  E2E_DOCUMENT_GROUPS,
  findGroupId,
  portalApiLogin,
  adminApiLogin,
  uploadDocumentApi,
  getDocumentsApi,
  getDocumentContentApi,
  verifyDocumentApi,
  rejectDocumentApi,
  setDocumentDeadline,
  clearDocumentDeadline,
  resetGroupDocuments,
  DOCUMENT_DEADLINE_FUTURE,
  DOCUMENT_DEADLINE_PAST,
  createTestPdfBuffer,
} from '../support/document-helpers';

test.use({ baseURL: PORTAL_BASE_URL });

const FIXTURES = path.join(__dirname, '..', 'fixtures');

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
}

test.describe('Documents page', () => {
  test.beforeAll(async () => {
    await clearDocumentDeadline();
  });

  test('Director navigates to Documents page', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.ALPHA);
    await page.goto(`/groups/${groupId}/documents`);
    await expect(page.getByRole('heading', { name: 'Registration Documents' })).toBeVisible();
    await expect(page.getByText('Signed Roster')).toBeVisible();
    await expect(page.getByText('Youth Safety Compliance')).toBeVisible();
  });

  test('upload valid Signed Roster shows Pending Review', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.A2);
    await page.goto(`/groups/${groupId}/documents`);
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(FIXTURES, 'signed-roster-valid.pdf'));
    await expect(page.getByText('Pending Review').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('signed-roster-valid.pdf')).toBeVisible();
  });
});

test.describe('Signed Roster full lifecycle', () => {
  test.beforeAll(async () => {
    await setDocumentDeadline(DOCUMENT_DEADLINE_FUTURE);
    await resetGroupDocuments(E2E_DOCUMENT_GROUPS.LIFECYCLE);
  });

  test('cross-portal: upload → admin pending → reject → replace → verify → lock', async ({ page }) => {
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.LIFECYCLE);
    const directorToken = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const adminToken = await adminApiLogin('e2e_reg_admin');

    await uploadDocumentApi(
      groupId, 'SIGNED_ROSTER', directorToken,
      createTestPdfBuffer('E2E lifecycle v1'), 'lifecycle-v1.pdf',
    );

    const adminDocs = await getDocumentsApi(groupId, adminToken);
    const current = adminDocs.find(d => d.document_type === 'SIGNED_ROSTER');
    expect(current?.verification_status).toBe('PENDING');

    await rejectDocumentApi(groupId, current!.id, 'E2E signature missing', adminToken);

    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await page.goto(`/groups/${groupId}/documents`);
    await expect(page.getByText('E2E signature missing')).toBeVisible();
    await expect(page.getByRole('button', { name: /Upload Replacement/i }).first()).toBeVisible();

    await uploadDocumentApi(
      groupId, 'SIGNED_ROSTER', directorToken,
      createTestPdfBuffer('E2E lifecycle v2'), 'lifecycle-v2.pdf',
    );

    const docsAfterReplace = await getDocumentsApi(groupId, directorToken);
    const newCurrent = docsAfterReplace.find(d => d.document_type === 'SIGNED_ROSTER');
    await verifyDocumentApi(groupId, newCurrent!.id, adminToken);

    await page.goto(`/groups/${groupId}/documents`);
    await expect(page.getByText('Verified by FDF')).toBeVisible();
    await expect(page.getByRole('button', { name: /Upload Replacement/i })).toHaveCount(0);

    await expect(uploadDocumentApi(groupId, 'SIGNED_ROSTER', directorToken)).rejects.toThrow(/403/);
  });
});

test.describe('Youth Safety lifecycle', () => {
  test.beforeAll(async () => {
    await resetGroupDocuments(E2E_DOCUMENT_GROUPS.A2);
  });

  test('independent upload and verify', async () => {
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.A2);
    const directorToken = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const adminToken = await adminApiLogin('e2e_reg_admin');

    await uploadDocumentApi(
      groupId, 'YOUTH_SAFETY', directorToken,
      createTestPdfBuffer('YOUTH SAFETY TEST'), 'youth-safety-e2e.pdf',
    );

    const docs = await getDocumentsApi(groupId, directorToken);
    const youth = docs.find(d => d.document_type === 'YOUTH_SAFETY');
    await verifyDocumentApi(groupId, youth!.id, adminToken);

    const after = await getDocumentsApi(groupId, directorToken);
    const verified = after.find(d => d.document_type === 'YOUTH_SAFETY');
    expect(verified?.verification_status).toBe('VERIFIED');
  });
});

test.describe('Document deadline', () => {
  test.afterEach(async () => {
    await clearDocumentDeadline();
  });

  test('closed deadline blocks Director upload', async () => {
    await setDocumentDeadline(DOCUMENT_DEADLINE_PAST);
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.DEADLINE_CLOSED);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    await expect(uploadDocumentApi(groupId, 'SIGNED_ROSTER', token)).rejects.toThrow(/403/);
  });

  test('open deadline allows upload', async () => {
    await setDocumentDeadline(DOCUMENT_DEADLINE_FUTURE);
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.A2);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const result = await uploadDocumentApi(groupId, 'SIGNED_ROSTER', token);
    expect(result.verification_status).toBe('PENDING');
  });
});

test.describe('Historical group documents', () => {
  test('read-only — no upload controls', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const histEventId = await getDirectorHistoricalEventId();
    const groupId = await findDirectorGroupIdForEvent(E2E_DOCUMENT_GROUPS.A_HISTORICAL, histEventId);
    await page.goto(`/groups/${groupId}/documents`);
    await expect(page.getByText('Past Event — Read Only')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });
});

test.describe('Choral documents', () => {
  test('Choral group has Documents page', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.CHORAL);
    await page.goto(`/groups/${groupId}/documents`);
    await expect(page.getByRole('heading', { name: 'Registration Documents' })).toBeVisible();
  });
});

test.describe('Invalid MIME', () => {
  test('rejects non-PDF file', async () => {
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.DEADLINE_OPEN);
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const form = new FormData();
    const blob = new Blob(['not a pdf'], { type: 'application/pdf' });
    form.append('file', blob, 'fake.pdf');
    form.append('document_type', 'SIGNED_ROSTER');
    const resp = await fetch(`http://localhost:3501/groups/${groupId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    expect(resp.status).toBe(400);
    const body = await resp.json() as { error: string };
    expect(body.error).toMatch(/valid PDF/i);
  });
});

test.describe('Secure content download', () => {
  test('owner Director can download own file', async () => {
    const groupId = await findGroupId(E2E_DOCUMENT_GROUPS.BETA_DIRECTOR, DIRECTOR_B.email, DIRECTOR_B.password);
    const token = await portalApiLogin(DIRECTOR_B.email, DIRECTOR_B.password);
    const upload = await uploadDocumentApi(groupId, 'SIGNED_ROSTER', token, createTestPdfBuffer('DOWNLOAD TEST'));
    const content = await getDocumentContentApi(groupId, upload.id, token);
    expect(content.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
