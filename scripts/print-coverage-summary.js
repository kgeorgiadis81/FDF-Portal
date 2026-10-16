#!/usr/bin/env node
/** Append Istanbul json-summary totals to the GitHub Actions job summary. */
const fs = require('fs');

const summaryPath = process.argv[2];
const out = process.env.GITHUB_STEP_SUMMARY;

function line(text) {
  if (out) fs.appendFileSync(out, text + '\n');
  console.log(text);
}

if (!summaryPath || !fs.existsSync(summaryPath)) {
  line('Coverage summary file was not produced.');
  process.exit(0);
}

const total = JSON.parse(fs.readFileSync(summaryPath, 'utf8')).total;
line('## Unit test coverage');
line('');
line('| Metric | Covered | Total | Percent |');
line('| --- | ---: | ---: | ---: |');
for (const metric of ['lines', 'statements', 'branches', 'functions']) {
  const row = total[metric];
  line(`| ${metric} | ${row.covered} | ${row.total} | ${row.pct}% |`);
}
line('');
line(`Source: \`${summaryPath}\`.`);
