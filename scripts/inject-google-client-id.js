'use strict';

/**
 * Inject GOOGLE_CLIENT_ID into the production environment file before `ng build`.
 * Does not log the client ID. Leaves the file unchanged when the var is unset
 * unless REQUIRE_GOOGLE_CLIENT_ID=true (CI production builds).
 */

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '../src/environments/environment.ts');
const clientId = process.env.GOOGLE_CLIENT_ID != null ? String(process.env.GOOGLE_CLIENT_ID).trim() : '';
const required = String(process.env.REQUIRE_GOOGLE_CLIENT_ID || '').toLowerCase() === 'true';

if (!clientId) {
  if (required) {
    console.error('GOOGLE_CLIENT_ID is required for this production build.');
    process.exit(1);
  }
  console.log('GOOGLE_CLIENT_ID is not set; Google Sign-In will be hidden.');
  process.exit(0);
}

const source = fs.readFileSync(envFile, 'utf8');
const next = source.replace(
  /googleClientId:\s*(?:'[^']*'|"[^"]*")/,
  `googleClientId: ${JSON.stringify(clientId)}`
);

if (next === source) {
  console.error('Failed to inject GOOGLE_CLIENT_ID: googleClientId assignment not found.');
  process.exit(1);
}

fs.writeFileSync(envFile, next);
console.log('Injected GOOGLE_CLIENT_ID into src/environments/environment.ts');
