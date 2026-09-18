# Repository Guidelines

## Project Structure & Module Organization

Homeboard is a Next.js App Router application. Pages and API routes are under `src/app/`; reusable domain logic is in `src/lib/`, and client components are in `src/components/`.

Keep ordered SQL migrations in `db/migrations/`. The scheduler is `src/worker.ts`; deployment configuration is in `Dockerfile`, `docker-compose.yml`, and `helm/homeboard/`.

## Build, Test, and Development Commands

Use Node `24.21.x` and npm `12.x` (see `.nvmrc` and `package.json`).

- `npm ci` installs the locked dependency set.
- `npm run dev` starts the web app; run `npm run worker` separately for recurrence processing.
- `npm test` runs the Vitest suite.
- `npx tsc --noEmit` checks TypeScript without generating output.
- `npm run build` creates the production Next.js build.
- `npm run db:migrate` and `npm run db:seed` manage local database state.
- `docker compose config --quiet` and `helm lint helm/homeboard` validate deployment configuration.

## Coding Style & Naming Conventions

Write strict TypeScript with two-space indentation, semicolons, double quotes, and `@/` imports. Prefer focused functions and descriptive names. Keep UI, hooks, and API handling in their owning feature directory; parent-console hooks use `use-<feature>-management.ts`.

Validate API input with Zod at route boundaries. Reuse canonical helpers such as `src/lib/schedule-validation.ts` instead of duplicating schemas. Avoid `any`, nested ternaries, and unrelated cleanup in feature changes.

## Testing Guidelines

Place `*.test.ts` unit tests beside their modules. Add behavior coverage for scheduling, assignment, or validation changes. Run `npm test`, `npx tsc --noEmit`, and `npm run build` before opening a PR.

## Commit & Pull Request Guidelines

Use conventional, imperative commits: `refactor: isolate parent management state`, `fix: ...`, or `chore: release vX.Y.Z`. Keep commits focused and do not commit `.env`, build output, or credentials.

PRs should explain the change, list verification commands, and include screenshots for visual changes.

## Release & Deployment Process

1. Choose an immutable patch version and update `package.json`, `package-lock.json`, `helm/homeboard/Chart.yaml`, and `helm/homeboard/values.yaml` together.
2. Open a release PR. It must pass `npm test`, `npx tsc --noEmit`, `npm run build`, Docker Compose validation, and Helm lint/template checks.
3. Publish `butlerrc30/homeboard:vX.Y.Z` and `:vX.Y.Z-tools`, then create the matching GitHub release/tag from its commit.
4. Upgrade production without replacing its namespace-specific configuration:

   `helm upgrade homeboard ./helm/homeboard --namespace homeboard --reuse-values --set image.tag=vX.Y.Z --set image.toolsTag=vX.Y.Z-tools --wait --timeout 10m`

5. Confirm Helm reports `deployed`, both web replicas and the worker roll out, and `http://homeboard.internal.techdrabble.com/` returns HTTP 200. Roll back with `helm rollback homeboard <previous-revision> --namespace homeboard --wait` if the rollout fails.
