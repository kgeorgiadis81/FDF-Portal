#!/usr/bin/env node
/**
 * Write Karma's coverage-summary.json to GITHUB_STEP_SUMMARY as a table.
 * Thresholds come from karma.conf.js so the summary matches the enforced ratchet.
 *
 * Usage: GITHUB_STEP_SUMMARY=path node scripts/coverage-step-summary.js [summary.json]
 */
const fs = require('fs');
const path = require('path');

const summaryPath = process.argv[2] || path.join('coverage', 'fdf-portal', 'coverage-summary.json');
const outputPath = process.env.GITHUB_STEP_SUMMARY;

const METRICS = [
  ['lines', 'Lines'],
  ['statements', 'Statements'],
  ['branches', 'Branches'],
  ['functions', 'Functions'],
];

function loadThresholds() {
  let captured;
  require(path.resolve('karma.conf.js'))({
    set(config) {
      captured = config;
    },
  });
  const globalThresholds = captured?.coverageReporter?.check?.global;
  if (!globalThresholds) {
    throw new Error('karma.conf.js has no coverageReporter.check.global thresholds');
  }
  return globalThresholds;
}

function formatPct(pct) {
  if (typeof pct !== 'number' || Number.isNaN(pct)) {
    return 'n/a';
  }
  return `${pct.toFixed(2)}%`;
}

function main() {
  if (!outputPath) {
    console.error('GITHUB_STEP_SUMMARY is not set');
    process.exit(1);
  }

  if (!fs.existsSync(summaryPath)) {
    const missing = `Coverage summary not found at \`${summaryPath}\`.\n`;
    fs.appendFileSync(outputPath, missing);
    console.error(missing.trim());
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const total = report.total || {};
  const thresholds = loadThresholds();
  const rows = [
    '### Unit test coverage',
    '',
    '| Metric | Coverage | Threshold | Result |',
    '| --- | ---: | ---: | --- |',
  ];

  for (const [key, label] of METRICS) {
    const pct = total[key]?.pct;
    const threshold = thresholds[key];
    const pass = typeof pct === 'number' && typeof threshold === 'number' && pct + 1e-9 >= threshold;
    rows.push(`| ${label} | ${formatPct(pct)} | ${threshold}% | ${pass ? 'pass' : 'fail'} |`);
  }

  rows.push('');
  const markdown = `${rows.join('\n')}\n`;
  fs.appendFileSync(outputPath, markdown);
  process.stdout.write(markdown);
}

main();
