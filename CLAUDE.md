# Homeboard contributor notes

Homeboard is a Next.js App Router household dashboard. Keep changes focused,
strictly typed, and safe for self-hosted deployments.

## Local development

- Use Node.js 24.21.x and npm 12.x.
- Run `npm ci`, copy `.env.example` to `.env.local`, and provide local values
  for `DATABASE_URL` and `SESSION_SECRET`.
- Apply migrations with `npm run db:migrate`; run `npm run dev` and
  `npm run worker` separately when working on scheduling.
- SQLite (`file:` URLs) and PostgreSQL are supported. Do not assume a specific
  host, database name, deployment platform, or secret value.

## Before submitting changes

Run `npm test`, `npx tsc --noEmit`, and `npm run build`. For deployment work,
also validate Docker Compose and the Helm chart. Never commit `.env` files,
credentials, production URLs, or generated build output.

See `AGENTS.md`, `CONTRIBUTING.md`, and `README.md` for the full conventions
and project documentation.
