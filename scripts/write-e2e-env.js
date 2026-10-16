#!/usr/bin/env node
/**
 * Write e2e/.env.test and FDF_Backend/.env.e2e for CI.
 * Password and role usernames come from the environment (GitHub secrets in Actions).
 * URLs and placeholder emails match the E2E seed; they are not production values.
 */
const fs = require('fs');
const path = require('path');

const required = [
  'E2E_PASSWORD',
  'E2E_GLOBAL_ADMIN_USERNAME',
  'E2E_REG_ADMIN_USERNAME',
  'E2E_COMP_ADMIN_USERNAME',
  'E2E_JUDGE_ADMIN_USERNAME',
  'E2E_JUDGE_USERNAME',
  'E2E_VIEWER_USERNAME',
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error('Missing E2E environment variables: ' + missing.join(', '));
  console.error('In GitHub Actions these must be repository secrets. See the README.');
  process.exit(1);
}

const backendDir = path.join(__dirname, '..', 'FDF_Backend');
const example = path.join(backendDir, '.env.e2e.example');
if (!fs.existsSync(example)) {
  console.error('FDF_Backend checkout is missing .env.e2e.example at ' + example);
  process.exit(1);
}

let backendEnv = fs.readFileSync(example, 'utf8');
const password = process.env.E2E_PASSWORD;
if (!/^DEFAULT_PASSWORD=.*$/m.test(backendEnv)) {
  console.error('.env.e2e.example has no DEFAULT_PASSWORD line.');
  process.exit(1);
}
backendEnv = backendEnv.replace(/^DEFAULT_PASSWORD=.*$/m, 'DEFAULT_PASSWORD=' + password);
// .env.e2e.example has an unquoted value with a space. Bash `source` splits it.
backendEnv = backendEnv.replace(/^BREVO_SENDER_NAME=FDF E2E$/m, 'BREVO_SENDER_NAME="FDF E2E"');
fs.writeFileSync(path.join(backendDir, '.env.e2e'), backendEnv);

const lines = [
  'BASE_URL=http://localhost:4200',
  'API_URL=http://localhost:3501',
  'PORTAL_BASE_URL=http://localhost:4201',
  'E2E_PASSWORD=' + password,
  'E2E_GLOBAL_ADMIN_USERNAME=' + process.env.E2E_GLOBAL_ADMIN_USERNAME,
  'E2E_GLOBAL_ADMIN_EMAIL=e2e.global.admin@e2e.test',
  'E2E_REG_ADMIN_USERNAME=' + process.env.E2E_REG_ADMIN_USERNAME,
  'E2E_REG_ADMIN_EMAIL=e2e.reg.admin@e2e.test',
  'E2E_COMP_ADMIN_USERNAME=' + process.env.E2E_COMP_ADMIN_USERNAME,
  'E2E_COMP_ADMIN_EMAIL=e2e.comp.admin@e2e.test',
  'E2E_JUDGE_ADMIN_USERNAME=' + process.env.E2E_JUDGE_ADMIN_USERNAME,
  'E2E_JUDGE_ADMIN_EMAIL=e2e.judge.admin@e2e.test',
  'E2E_JUDGE_USERNAME=' + process.env.E2E_JUDGE_USERNAME,
  'E2E_JUDGE_EMAIL=e2e.judge@e2e.test',
  'E2E_VIEWER_USERNAME=' + process.env.E2E_VIEWER_USERNAME,
  'E2E_VIEWER_EMAIL=e2e.viewer@e2e.test',
  'DIRECTOR_A_EMAIL=director.a@e2e.test',
  'DIRECTOR_B_EMAIL=director.b@e2e.test',
  '',
];
fs.mkdirSync(path.join(__dirname, '..', 'e2e'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'e2e', '.env.test'), lines.join('\n'));
console.log('Wrote e2e/.env.test and FDF_Backend/.env.e2e from the environment.');
