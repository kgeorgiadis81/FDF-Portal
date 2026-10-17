# FDFPortal

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.4.

## Deploys and `main`

Production deploys are automated from `main`. **Do not push to `main`** — use pull requests only. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full process (PR-only flow, who merges, and how CI/Deploy are gated).

## Content Security Policy

The portal ships a matching CSP in `src/index.html` (`<meta http-equiv="Content-Security-Policy">`) so local, e2e, and production HTML all enforce the same allowlist.

**Production nginx must also set `Content-Security-Policy` as an HTTP response header.** `frame-ancestors` is ignored in `<meta>` and belongs only on the header. The header is configured in the FDF_Backend deploy nginx snippets (`deploy/nginx/tls/fdf-portal.conf` and related snippets), not in this repo.

Required policy (portal origin is `'self'`; Google Sign-In is the only third-party source). Inter and Material Icons are self-hosted from `src/fonts/` and do not need `fonts.googleapis.com` or `fonts.gstatic.com`.

```
default-src 'self';
script-src 'self' https://accounts.google.com/gsi/client;
style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style;
font-src 'self';
frame-src https://accounts.google.com;
connect-src 'self' https://accounts.google.com/gsi/;
img-src 'self' data: blob: https://*.googleusercontent.com;
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
```

The HTML meta policy also allows `http://localhost:3500` and `http://localhost:3501` on `connect-src` so `ng serve` and Playwright can reach the local API. Production nginx should omit those localhost origins. Production API calls go to same-origin `/api`.

Verify: open the portal, DevTools → Network → document request shows `content-security-policy`; Console has no CSP violations for Google Sign-In, group pages, or PDF viewing (`blob:` object URLs).

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4201/`. The application will automatically reload whenever you modify any of the source files.

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

CI runs `npm audit --omit=dev --audit-level=high` (production dependencies). Remaining `npm audit` findings are in Karma / webpack-dev-server used only for unit tests; Karma stays because `ng test` still uses it.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
npm test
```

`npm run test:ci` runs the same suite headlessly and checks coverage over every TypeScript file under `src/app`. Thresholds live in `karma.conf.js` (`coverageReporter.check.global`). CI runs this command on every pull request and fails the unit job when a test fails or coverage drops below a threshold.

**Ratchet:** when measured coverage goes up, raise the matching threshold to the floor of the new value. Never lower a threshold to make CI pass. Playwright pass/fail is separate — line coverage of the e2e run would need an instrumented build.

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

GitHub Actions runs `npx playwright test --project=portal-chromium` against that seeded backend. The job checks out the private `kgeorgiadis81/FDF_Backend` repo with the repository secret `FDF_BACKEND_CHECKOUT_TOKEN` (read-only access to `FDF_Backend`). Logins are the committed seed accounts in `e2e/.env.test.example`. Do not add login secrets.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
