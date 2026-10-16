# Portal Playwright tests

Never point these tests at production. They use the seeded `FDF_DB_E2E` database on port 3307 and the portal on port 4201.

## Prerequisites

1. Sibling checkout of `kgeorgiadis81/FDF_Backend` at `../FDF_Backend`.
2. In that repo: `cp .env.e2e.example .env.e2e` and `npm run e2e:setup` (MariaDB via `docker-compose.e2e.yml`, then schema and seed).
3. In this repo: `cp e2e/.env.test.example e2e/.env.test` and `npx playwright install chromium`.

`e2e/.env.test.example` has dummy values only. Do not commit `e2e/.env.test`.

On a Cursor Cloud agent, `.cursor/install.sh` and `.cursor/start.sh` do those steps. The `api-e2e` terminal serves http://localhost:3501 and `portal-e2e` serves http://localhost:4201.

## Run

```bash
npm run e2e          # portal-chromium
npm run e2e:mobile   # portal-mobile
npm run e2e:all      # every portal project, including webkit
```

`npm run e2e` does not start webkit. Install that browser separately if you run `npm run e2e:all`.
