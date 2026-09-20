# Homeboard

Homeboard is a portrait-first household dashboard and chore manager for shared displays, tablets, desktops, and phones. Children can follow routines and complete chores; parents can manage the household from a PIN-protected console.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development conventions and the pull-request checklist.

<img src="public/screenshots/dashboard.png" alt="Seeded Homeboard dashboard showing chore progress and each child's to-do list" width="720">

## Features

- Schedule chores once, daily, on weekdays, or on selected days of the week.
- Assign chores to one child, every selected child, or any child; organize related chores into groups and rotate two groups weekly between two children.
- Set due times, mark missed chores automatically, and require parent approval when needed.
- Create repeatable, step-by-step routines.
- View completion reports and export them as CSV.
- Export and import household setup, including children, groups, rotations, chores, and routines. Completion history is not imported or overwritten.
- Keep an audit trail for key household-management actions.

## License

Homeboard is available under the [MIT License](LICENSE), copyright © 2026 Ryan Butler.

## Architecture

```mermaid
graph TD
  User[Shared display, tablet, phone, or desktop] --> Web[Next.js 16 application]
  Web --> DB[(PostgreSQL 16)]
  Worker[Background worker] --> DB
```

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS power the web application.
- PostgreSQL stores household data; ordered raw-SQL migrations live in `db/migrations/`.
- `src/worker.ts` runs once at startup, then every five minutes to materialize schedules and mark overdue chores as missed.
- Parent PINs and seeded demo passwords use Argon2id hashes. Browser session tokens are stored as SHA-256 digests.

## Local development

### Prerequisites

- Node.js 24.21.x and npm 12.x (see `.nvmrc` and `package.json`)
- PostgreSQL 16 or SQLite (Docker Compose can provide either option)

Install the locked dependency set and configure the database:

```bash
nvm install
nvm use
npm ci
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local` to a PostgreSQL connection string or a SQLite file URL. For example, use `file:./homeboard.db` for a local SQLite database or `postgres://USER:PASSWORD@HOST:5432/DATABASE_NAME` for PostgreSQL.

Apply migrations, then start the app and scheduler in separate terminals:

```bash
npm run db:migrate
npm run dev
```

```bash
npm run worker
```

Open `http://localhost:3000`. With an empty database, Homeboard presents the first-run setup flow, where you create the household and its 4–20 digit parent PIN.

### Optional demo data

The seed script creates the Johnson demo household, three children, sample chores, and a routine. It requires `PARENT_PIN` or `INITIAL_PIN` in addition to `DATABASE_URL`:

```bash
# PowerShell
$env:PARENT_PIN = "1234"
npm run db:seed
```

The seeded parent account is `parent@example.com` with password `homeboard-demo`; the current UI unlocks Parent mode with the household PIN. Do not use these credentials outside local development.

## Docker Compose stacks

Two local Compose configurations are provided. Run only one at a time because both expose port 3000.

### SQLite demo

[`docker-compose.yml`](docker-compose.yml) is the ready-to-run demo stack. It persists SQLite data in the `sqlite-data` volume, applies migrations, seeds the Johnson household, exposes the app on port 3000, and starts the worker.

```bash
docker compose up -d --build
docker compose ps
```

It intentionally uses fixed development credentials, PIN `1234`, and `ALLOW_DEMO=true`; it is not a production configuration and should not be exposed to an untrusted network. To start over locally, stop the stack and remove the named `sqlite-data` volume only after confirming that you no longer need its data:

```bash
docker compose down
docker volume rm home-org_sqlite-data
```

### PostgreSQL, empty database

[`docker-compose.postgres.yml`](docker-compose.postgres.yml) starts a PostgreSQL 16 container, applies migrations, starts the web app and worker, and leaves the database empty. It does not enable demo mode and does not run the seed script. Visit `http://localhost:3000` to complete first-run household setup.

```bash
docker compose -f docker-compose.postgres.yml up -d --build
docker compose -f docker-compose.postgres.yml ps
```

To discard its local PostgreSQL data after stopping it:

```bash
docker compose -f docker-compose.postgres.yml down
docker volume rm home-org_postgres-data
```

## Kubernetes with Helm

The chart at [`helm/homeboard`](helm/homeboard) deploys the web application, one worker, and a migration job. By default it provisions a 1 GiB ReadWriteOnce PVC and uses SQLite at `file:/data/homeboard.db`. It still requires a pre-existing Secret for `SESSION_SECRET`.

To retain an existing PostgreSQL deployment, keep `secrets.databaseUrlKey` set to the key that contains `DATABASE_URL` (as in the existing `helm-values.yaml`). That takes precedence over the SQLite default; no current values changes are needed.

For PostgreSQL, create a Secret containing the required keys:

```bash
kubectl create namespace homeboard
kubectl create secret generic homeboard-secrets \
  --namespace homeboard \
  --from-literal=DATABASE_URL="postgres://USER:PASSWORD@DATABASE_HOST:5432/DATABASE_NAME" \
  --from-literal=SESSION_SECRET="$(openssl rand -base64 32)"
```

Create a values override such as `my-values.yaml`:

```yaml
image:
  repository: butlerrc30/homeboard
  tag: "v0.2.20"

ingress:
  enabled: true
  className: traefik
  host: homeboard.example.internal

config:
  allowDemo: false

secrets:
  existingSecret: homeboard-secrets
```

Install or upgrade the release:

```bash
helm upgrade --install homeboard ./helm/homeboard \
  --namespace homeboard \
  --values my-values.yaml \
  --wait --timeout 10m
```

By default, the chart does not seed demo data. A fresh deployment instead uses the first-run setup flow. Keep `config.allowDemo` set to `false` in production.

### Local quality checks

`npm ci` enables the repository's Git hooks automatically. They format staged supported files and validate release versions and database migrations before each commit; they also require conventional commit subjects and run tests plus TypeScript checking before a push. Bypass a hook only for an emergency with Git's `--no-verify` flag, then run the skipped command promptly.

SQLite is maintained as a fresh-install schema snapshot. When adding a PostgreSQL migration, update `db/migrations/sqlite/001_initial.sql` and its `PostgreSQL migration baseline` comment in the same commit. Run the validators directly when needed:

```bash
npm run validate:release
npm run validate:migrations
```

### Releases

Use an immutable patch version and update `package.json`, `package-lock.json`, `helm/homeboard/Chart.yaml`, and `helm/homeboard/values.yaml` together. Validate the application and deployment configuration before opening a release PR:

```bash
npm test
npx tsc --noEmit
npm run build
docker compose config --quiet
helm lint helm/homeboard
helm template homeboard helm/homeboard --namespace homeboard > /dev/null
```

Merge the release PR into `main`. The release workflow validates the merged revision, creates the matching GitHub release and tag, and publishes `butlerrc30/homeboard:vX.Y.Z` plus `butlerrc30/homeboard:vX.Y.Z-tools`. After it succeeds, upgrade production without replacing namespace-specific values:

```bash
helm upgrade homeboard ./helm/homeboard \
  --namespace homeboard \
  --reuse-values \
  --set image.tag=vX.Y.Z \
  --set image.toolsTag=vX.Y.Z-tools \
  --wait --timeout 10m
```

Confirm Helm reports `deployed`, both the web and worker deployments roll out, and the configured application URL returns HTTP 200. If rollout fails, roll back with `helm rollback homeboard <previous-revision> --namespace homeboard --wait`.

## Parent PIN recovery

The household PIN is stored as an Argon2id hash in `households.fridge_pin_hash`. If that value is `NULL`, the application accepts the `PARENT_PIN` or `INITIAL_PIN` environment variable and persists its hash after a successful unlock. There is no built-in fallback PIN when neither variable is configured.

If the PIN is forgotten, connect to the correct PostgreSQL database and clear the stored hash:

```sql
UPDATE households SET fridge_pin_hash = NULL;
```

Before unlocking Parent mode again, ensure the application has a known `PARENT_PIN` or `INITIAL_PIN`; then use that value and set a new PIN in Parent mode. In the local Compose demo, the reset command is:

```bash
docker compose exec postgres psql -U homeorg -d homeorg -c "UPDATE households SET fridge_pin_hash = NULL;"
```

`ALLOW_DEMO=true` grants parent context for the first active household parent and is intended only for local demo use.

## Verification

Run the unit tests, type check, and production build:

```bash
npm test
npx tsc --noEmit
npm run build
```

For an integration check against a locally running application and database, run:

```bash
node scripts/verify-stack.mjs
```

## Project layout

```text
db/migrations/       Ordered PostgreSQL migrations
helm/homeboard/      Kubernetes Helm chart
scripts/             Migration, seed, and integration-verification scripts
src/app/             Next.js pages and API routes
src/components/      Client components
src/lib/             Database, authentication, scheduling, and domain logic
src/worker.ts        Recurrence and overdue-status worker
```
