# FDFPortal

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
npm test
```

`npm test` and `npm run test:ci` first run `scripts/generate-coverage-sources.js`. That writes a spec which imports every TypeScript file under `src/app`, so Istanbul coverage includes sources no other spec imports. `includeAllSources` is also set in `karma.conf.js`.

CI runs `npm run test:ci` (ChromeHeadless, `--code-coverage`) on pull requests and on `main`. Thresholds are the 2026-10-16 all-files baseline, floored: lines 13, statements 13, branches 13, functions 6. The job uploads the `coverage/` report and writes the totals to the job summary. It fails when a test fails or coverage drops under those floors.

**Ratchet rule:** when coverage goes up, raise the thresholds to the new floored baseline. Never lower them.

Playwright results are pass/fail only. End-to-end code coverage would need an instrumented Istanbul build (for example `babel-plugin-istanbul` or an Angular instrumentation builder) and a merged browser report. That is not part of these thresholds.

### Playwright secrets

The Playwright job checks out `FDF_Backend` (INT-49 branch until that work is on `main`), runs `npm run e2e:setup` (MariaDB via `docker-compose.e2e.yml`), starts the API and this app, and runs the `portal-chromium` project. It uploads `e2e/reports/html`.

Password and role usernames are repository secrets, not committed values. Create these secrets (values must match the E2E seed usernames and `DEFAULT_PASSWORD`; the placeholders in `e2e/.env.test.example` are the local stand-ins):

| Secret | Purpose |
| --- | --- |
| `FDF_BACKEND_CHECKOUT_TOKEN` | PAT with read access to `kgeorgiadis81/FDF_Backend` |
| `E2E_PASSWORD` | Shared seeded password |
| `E2E_GLOBAL_ADMIN_USERNAME` | Global admin login |
| `E2E_REG_ADMIN_USERNAME` | Registration admin login |
| `E2E_COMP_ADMIN_USERNAME` | Competition admin login |
| `E2E_JUDGE_ADMIN_USERNAME` | Judge admin login |
| `E2E_JUDGE_USERNAME` | Judge login |
| `E2E_VIEWER_USERNAME` | Viewer login |

## Running end-to-end tests

Node.js 24.15 or newer (`nvm use` reads `.nvmrc`).

From a sibling `FDF_Backend` checkout, `npm run test:all` starts MariaDB, seeds `FDF_DB_E2E`, and runs this repo's Karma and Playwright suites with the others.

To run Playwright here only:

```bash
cp e2e/.env.test.example e2e/.env.test
npx playwright install chromium
# Backend must already be seeded: cd ../FDF_Backend && cp .env.e2e.example .env.e2e && npm run e2e:setup
npm run e2e
```

`e2e/.env.test.example` has placeholders only: base URLs, `E2E_PASSWORD`, usernames and emails for the six staff roles, and `DIRECTOR_A_EMAIL` / `DIRECTOR_B_EMAIL`. Do not commit `e2e/.env.test`.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
