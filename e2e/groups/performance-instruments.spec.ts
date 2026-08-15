import { test, expect, Page } from '@playwright/test';
import { DIRECTOR_A, PORTAL_BASE_URL, portalApiLogin } from '../fixtures';
import {
  E2E_PERFORMANCE_GROUPS,
  findGroupId,
  getPerformanceData,
  getSemiFinalPerformanceId,
  getFinalPerformanceId,
  getInstrumentsCatalog,
  assignInstrument,
  removeInstrument,
  clearPerformanceInstruments,
} from '../support/performance-helpers';

test.use({ baseURL: PORTAL_BASE_URL });

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
}

async function openPerformanceForGroup(page: Page, groupName: string): Promise<void> {
  await page.goto('/dashboard');
  await page.locator('.group-card').filter({ hasText: groupName }).click();
  await page.locator('.performance-link').click();
  await expect(page).toHaveURL(/\/groups\/\d+\/performance/);
}

test.describe('Dance instrument selection', () => {
  test.beforeEach(async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const semiId = await getSemiFinalPerformanceId(groupId, token);
    const finalId = await getFinalPerformanceId(groupId, token);
    await clearPerformanceInstruments(groupId, semiId, token);
    await clearPerformanceInstruments(groupId, finalId, token);
  });

  test('Select, persist, reload, and remove catalog instruments via UI', async ({ page }) => {
    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.A2);

    await page.getByRole('button', { name: 'Clarinet' }).click();
    await page.getByRole('button', { name: 'Violin' }).click();
    await expect(page.getByRole('button', { name: 'Clarinet' })).toHaveClass(/selected/);
    await expect(page.getByRole('button', { name: 'Violin' })).toHaveClass(/selected/);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Clarinet' })).toHaveClass(/selected/);
    await expect(page.getByRole('button', { name: 'Violin' })).toHaveClass(/selected/);

    await page.getByRole('button', { name: 'Clarinet' }).click();
    await expect(page.getByRole('button', { name: 'Clarinet' })).not.toHaveClass(/selected/);
    await expect(page.getByRole('button', { name: 'Violin' })).toHaveClass(/selected/);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Clarinet' })).not.toHaveClass(/selected/);
    await expect(page.getByRole('button', { name: 'Violin' })).toHaveClass(/selected/);
  });

  test('Instrument Other with custom text persists after reload', async ({ page }) => {
    const customName = `E2E Fictional Instrument ${Date.now()}`;
    page.on('dialog', async (dialog) => {
      await dialog.accept(customName);
    });

    await loginAs(page, DIRECTOR_A.email, DIRECTOR_A.password);
    await openPerformanceForGroup(page, E2E_PERFORMANCE_GROUPS.A2);
    await page.getByRole('button', { name: 'Other' }).click();
    await expect(page.getByRole('button', { name: 'Other' })).toHaveClass(/selected/);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Other' })).toHaveClass(/selected/);

    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const perfId = await getSemiFinalPerformanceId(groupId, token);
    const catalog = await getInstrumentsCatalog(token);
    const other = catalog.find((i) => i.code === 'OTHER');
    expect(other).toBeTruthy();

    const data = await getPerformanceData(groupId, token);
    const perf = data.performances.find((p) => p.id === perfId)!;
    const assignment = perf.instruments.find((i) => i.code === 'OTHER');
    expect(assignment).toBeTruthy();
    expect(assignment!.instrument_id).toBe(other!.id);
    expect(assignment!.custom_name).toBe(customName);
  });

  test('Other without custom text is rejected by API', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const perfId = await getSemiFinalPerformanceId(groupId, token);
    const catalog = await getInstrumentsCatalog(token);
    const other = catalog.find((i) => i.code === 'OTHER')!;

    const resp = await assignInstrument(groupId, perfId, other.id, '', token);
    expect(resp.status).toBe(400);
    const body = await resp.json() as { error: string };
    expect(body.error).toMatch(/custom_name is required/i);
  });

  test('Non-Other instrument ignores custom_name in stored result', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const perfId = await getSemiFinalPerformanceId(groupId, token);
    const catalog = await getInstrumentsCatalog(token);
    const clarinet = catalog.find((i) => i.code === 'CLARINET')!;

    const resp = await assignInstrument(groupId, perfId, clarinet.id, 'Should Not Persist', token);
    expect(resp.status).toBe(201);

    const data = await getPerformanceData(groupId, token);
    const perf = data.performances.find((p) => p.id === perfId)!;
    const assignment = perf.instruments.find((i) => i.instrument_id === clarinet.id);
    expect(assignment?.custom_name).toBe('Should Not Persist');
  });

  test('Semi-Final instruments do not appear in Final round', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const semiId = await getSemiFinalPerformanceId(groupId, token);
    const finalId = await getFinalPerformanceId(groupId, token);
    const catalog = await getInstrumentsCatalog(token);
    const drum = catalog.find((i) => i.code === 'DRUM')!;

    await assignInstrument(groupId, semiId, drum.id, undefined, token);
    const data = await getPerformanceData(groupId, token);
    const semi = data.performances.find((p) => p.id === semiId)!;
    const finalPerf = data.performances.find((p) => p.id === finalId)!;
    expect(semi.instruments.some((i) => i.code === 'DRUM')).toBe(true);
    expect(finalPerf.instruments.some((i) => i.code === 'DRUM')).toBe(false);
  });

  test('XSS-style custom instrument name is stored as plain text', async () => {
    const token = await portalApiLogin(DIRECTOR_A.email, DIRECTOR_A.password);
    const groupId = await findGroupId(E2E_PERFORMANCE_GROUPS.A2);
    const perfId = await getSemiFinalPerformanceId(groupId, token);
    const catalog = await getInstrumentsCatalog(token);
    const other = catalog.find((i) => i.code === 'OTHER')!;

    const xss = '<script>alert(1)</script>';
    const resp = await assignInstrument(groupId, perfId, other.id, xss, token);
    expect(resp.status).toBe(201);

    const data = await getPerformanceData(groupId, token);
    const perf = data.performances.find((p) => p.id === perfId)!;
    const assignment = perf.instruments.find((i) => i.code === 'OTHER');
    expect(assignment?.custom_name).toBe(xss);
  });
});
