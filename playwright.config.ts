import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// Load E2E env vars before config evaluation
require('dotenv').config({ path: path.resolve(__dirname, 'e2e/.env.test') });

/**
 * FDF Portal — Playwright E2E Configuration
 *
 * Prerequisites:
 *   1. cd ../FDF_Backend && npm run e2e:setup
 *   2. Copy e2e/.env.test.example to e2e/.env.test
 *
 * Portal runs on port 4201; backend E2E on port 3501.
 *
 * NEVER run against production.
 */

const backendDir = path.resolve(__dirname, '../FDF_Backend');
const e2eDir = path.resolve(__dirname, 'e2e');

export default defineConfig({
  testDir: e2eDir,
  tsconfig: path.join(e2eDir, 'tsconfig.json'),
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: path.join(e2eDir, 'reports/html'), open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env['PORTAL_BASE_URL'] ?? 'http://localhost:4201',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'portal-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'portal-mobile',
      use: { ...devices['Pixel 5'] },
      testMatch: [
        '**/auth/director-login.spec.ts',
        '**/auth/director-signup.spec.ts',
        '**/groups/my-groups.spec.ts',
        '**/groups/roster.spec.ts',
      ],
    },
    {
      name: 'portal-webkit',
      use: { ...devices['iPhone 12'] },
      testMatch: [
        '**/auth/director-login.spec.ts',
        '**/groups/my-groups.spec.ts',
        '**/groups/roster.spec.ts',
      ],
    },
  ],

  webServer: process.env['CI']
    ? undefined
    : [
        {
          command: 'npm run start:e2e',
          url: 'http://localhost:3501/health',
          reuseExistingServer: true,
          timeout: 60_000,
          cwd: backendDir,
        },
        {
          command: 'npm run start:e2e',
          url: 'http://localhost:4201',
          reuseExistingServer: true,
          timeout: 120_000,
          cwd: __dirname,
        },
      ],
});
