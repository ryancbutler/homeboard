# Contributing to Homeboard

Thank you for improving Homeboard. Please keep changes focused, tested, and
safe to deploy for self-hosted households.

## Development setup

Use Node.js 24.21.x and npm 12.x. Install dependencies with `npm ci`, copy
`.env.example` to `.env.local`, set `DATABASE_URL`, and apply migrations:

```bash
npm run db:migrate
npm run dev
```

Run `npm run worker` in a separate terminal when working on scheduling or
recurrence behavior.

## Before opening a pull request

Run the checks relevant to your change. For normal application changes, run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Changes to deployment configuration should also run:

```bash
docker compose config --quiet
helm lint helm/homeboard
helm template homeboard helm/homeboard --namespace homeboard > /dev/null
```

Add or update nearby unit tests for scheduling, assignment, or input-validation
behavior. Include screenshots for visual changes.

## Conventions

- Write strict TypeScript with two-space indentation, semicolons, double quotes,
  and `@/` imports.
- Keep reusable domain logic in `src/lib/`; keep UI and related hooks within
  their owning feature directory.
- Validate API inputs with Zod at route boundaries and reuse existing validation
  helpers where possible.
- Add database changes as the next ordered SQL migration in `db/migrations/`;
  never edit an applied migration.
- Use focused, conventional commits such as `fix: validate chore schedule`.
- Never commit credentials, local environment files, build output, or generated
  agent tooling.

See [README.md](README.md) for architecture, local operations, deployment,
release, and parent-PIN recovery instructions.
