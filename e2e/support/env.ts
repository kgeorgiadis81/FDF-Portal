import * as path from 'path';
import * as fs from 'fs';
import { config as loadDotenv } from 'dotenv';

/**
 * Load E2E environment variables from e2e/.env.test if present.
 */
const envPath = path.resolve(__dirname, '../.env.test');
if (fs.existsSync(envPath)) {
  loadDotenv({ path: envPath });
}

export const E2E_API_URL = process.env['API_URL'] ?? 'http://localhost:3501';
export const E2E_BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:4200';
