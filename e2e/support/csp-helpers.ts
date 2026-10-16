import { Page, expect } from '@playwright/test';

export interface CspViolation {
  blockedURI: string;
  violatedDirective: string;
  originalPolicy: string;
}

/**
 * Record Content-Security-Policy violations on the page.
 * Does not log policy text to the terminal beyond assertion messages.
 */
export async function attachCspViolationCollector(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __cspViolations?: CspViolation[] }).__cspViolations = [];
    window.addEventListener('securitypolicyviolation', (event) => {
      const store = (window as unknown as { __cspViolations: CspViolation[] }).__cspViolations;
      store.push({
        blockedURI: event.blockedURI,
        violatedDirective: event.violatedDirective,
        originalPolicy: event.originalPolicy,
      });
    });
  });
}

export async function expectNoCspViolations(page: Page): Promise<void> {
  const violations = await page.evaluate(() => {
    return (window as unknown as { __cspViolations?: CspViolation[] }).__cspViolations ?? [];
  });
  expect(violations, `CSP violations: ${JSON.stringify(violations)}`).toEqual([]);
}
