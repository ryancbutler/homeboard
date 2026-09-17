# 🏠 Homeboard

> **A portrait-first family organization dashboard and chore management hub.**  
> Built for smart refrigerator displays (e.g. Samsung Family Hub), wall-mounted tablets, desktop browsers, and mobile phones.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Helm-326CE5?style=flat&logo=kubernetes)](https://helm.sh/)

---

## 📑 Table of Contents

- [🌟 Overview](#-overview)
- [✨ Core Features](#-core-features)
  - [📋 Chores & Flexible Scheduling](#-chores--flexible-scheduling)
  - [🔁 Morning & Evening Routines](#-morning--evening-routines)
  - [👨‍👩‍👧‍👦 Parent Console & Approvals](#-parent-console--approvals)
  - [📊 Reports & Streak Tracking](#-reports--streak-tracking)
- [🏗️ Architecture & Technology Stack](#️-architecture--technology-stack)
- [🚀 Quick Start (Local Development)](#-quick-start-local-development)
- [🐳 Deployment Guide](#-deployment-guide)
  - [Option A: Docker Compose (Recommended for Self-Hosting)](#option-a-docker-compose-recommended-for-self-hosting)
  - [Option B: Kubernetes via Helm](#option-b-kubernetes-via-helm)
- [🔐 Parent PIN Recovery & Reset](#-parent-pin-recovery--reset)
  - [How the PIN Works](#how-the-pin-works)
  - [Reset Method 1: Database Reset (Quickest)](#reset-method-1-database-reset-quickest)
  - [Reset Method 2: Change PIN from Parent Console](#reset-method-2-change-pin-from-parent-console)
  - [Reset Method 3: Demo Mode Access](#reset-method-3-demo-mode-access)
- [🧪 Testing & Health Verification](#-testing--health-verification)
- [📁 Project Layout](#-project-layout)

---

## 🌟 Overview

**Homeboard** transforms shared household screens into an intuitive command center for kids and parents. It replaces scattered paper chore charts, whiteboard lists, and fridge magnets with an interactive, portrait-optimized touch experience.

Kids can easily check off daily obligations, follow step-by-step routines, and track their progress. Parents get a secure, PIN-protected management console to schedule chores, organize chore groups, review pending approvals, and analyze completion reports.

---

## ✨ Core Features

### 📋 Chores & Flexible Scheduling
- **Custom Cadences:** Schedule chores daily, on weekdays, weekends, or specific days of the week (e.g., Monday/Wednesday/Friday trash and laundry).
- **Flexible Assignment Policies:**
  - *Individual:* Assigned to one specific child.
  - *Shared / Any:* Available for any child to claim and complete.
  - *Rotating:* Cycle responsibility among children automatically.
- **Chore Groups:** Bundle related chores (e.g. "Morning Kitchen Duty" or "Pet Care"). Reassigning a chore group to a different child immediately updates all open chores from today forward while preserving past completion history for the previous child.
- **Due Times & Overdue Tracking:** Set specific completion targets (e.g., `18:00`) with automated status tracking.

### 🔁 Morning & Evening Routines
- **Step-by-Step Checklists:** Guide children through daily workflows (e.g., *"Put backpack away"*, *"Place lunchbox by sink"*, *"Finish homework check-in"*).
- **Interactive Checkoffs:** Visual, multi-step progress bar on the kiosk display.
- **Repeatable Templates:** Automatically recreated daily or on weekdays by the background worker.

### 👨‍👩‍👧‍👦 Parent Console & Approvals
- **PIN-Protected Parent Mode:** Accessible right from the fridge kiosk using a 4+ digit PIN.
- **Approval Workflow:** Chores can optionally require parent verification before being marked as fully approved.
- **Household Management:** Add and manage family members, custom display colors, avatars, and timezones.
- **Complete Audit Trail:** Audit logs track every creation, assignment, checkoff, and approval.

### 📊 Reports & Streak Tracking
- **Completion Rates:** Real-time analytics breaking down completed, pending, and missed obligations.
- **Historical Analysis:** Filter reports across custom date ranges and individual children.
- **Data Portability:** Export household configuration and chore logs to JSON, or import backups.

---

## 🏗️ Architecture & Technology Stack

```mermaid
graph TD
  User[Kiosk Display / Tablet / Phone / Desktop] -->|HTTP / API| Web[Next.js 15 Web App]
  Web -->|PostgreSQL Wire| DB[(PostgreSQL 16)]
  Worker[Background Worker] -->|Materialize Schedules & Overdue| DB
```

- **Frontend & App Framework:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Database:** PostgreSQL 16 utilizing raw SQL migrations and fast connection pooling (`postgres.js`).
- **Background Worker:** `src/worker.ts` runs on a 5-minute schedule to materialize recurring daily/weekly chores and routines, and mark overdue obligations.
- **Security & Cryptography:** Argon2id hash verification (`@node-rs/argon2`) for parent PINs and passwords; AES/SHA-256 for sessions and credentials.

---

## 🚀 Quick Start (Local Development)

### 1. Clone and Install Dependencies
Use Node.js 24.21.0 LTS and npm 12.0.2. With nvm:
```bash
nvm install
nvm use
```

Then install dependencies:
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Provide a running PostgreSQL database connection string in `DATABASE_URL`.

### 3. Run Database Migrations and Seed
```bash
npm run db:migrate
npm run db:seed
```

### 4. Start Development Server & Background Worker
In separate terminals:
```bash
# Web application
npm run dev

# Background recurrence scheduler worker
npm run worker
```
Access the dashboard at `http://localhost:3000`.

---

## 🐳 Deployment Guide

### Option A: Docker Compose (Recommended for Self-Hosting)

Docker Compose provides a complete, turnkey deployment including PostgreSQL, automated migrations, database seeding (optional), the web application, and the background worker.

#### 1. Configure Production Secrets
Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL=postgres://homeorg:CHANGE_ME_DB_PASSWORD@postgres:5432/homeorg
POSTGRES_PASSWORD=CHANGE_ME_DB_PASSWORD

# Security Secrets (generate random strings with `openssl rand -base64 32`)
SESSION_SECRET=replace-with-at-least-32-random-characters

# Production Security
ALLOW_DEMO=false
PARENT_PIN=5678
```

> [!WARNING]
> Always set `ALLOW_DEMO=false` and use strong, unique values for `SESSION_SECRET` in production.

#### 2. Start the Stack
```bash
docker compose up -d --build
```

#### 3. Verify Container Health
```bash
docker compose ps
```

The stack coordinates startup order automatically:
1. `postgres` starts and completes its health check.
2. `migrate` runs schema migrations to completion.
3. `seed` creates the initial household (if empty).
4. `web` and `worker` start serving traffic and materializing schedules.

---

### Option B: Kubernetes via Helm

A production-ready Helm chart is included under [`helm/homeboard`](file:///d:/gitprojects/home-org/helm/homeboard).

#### 1. Prerequisites
- A Kubernetes cluster (1.24+)
- Ingress controller (e.g., `ingress-nginx`)
- External PostgreSQL instance

#### 2. Create the Kubernetes Secret
Store database credentials and application keys in a Kubernetes Secret:

```bash
kubectl create secret generic homeboard-secrets \
  --from-literal=DATABASE_URL="postgresql://homeorg:SECRET_PASSWORD@postgres.database.svc.cluster.local:5432/homeorg" \
  --from-literal=SESSION_SECRET="$(openssl rand -base64 32)"
```

#### 3. Configure `values.yaml`
Customize [`helm/homeboard/values.yaml`](file:///d:/gitprojects/home-org/helm/homeboard/values.yaml) or provide an override file:

```yaml
image:
  repository: butlerrc30/homeboard
  tag: "v0.2.1"
  pullPolicy: IfNotPresent

replicaCount: 2

ingress:
  enabled: true
  className: nginx
  host: homeboard.your-domain.local
  tlsSecret: homeboard-tls-cert

config:
  appName: "Homeboard"

secrets:
  existingSecret: homeboard-secrets
  databaseUrlKey: DATABASE_URL
  sessionSecretKey: SESSION_SECRET

resources:
  web:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      memory: 512Mi
  worker:
    requests:
      cpu: 50m
      memory: 128Mi
    limits:
      memory: 256Mi
```

#### 4. Install or Upgrade with Helm
```bash
helm upgrade --install homeboard ./helm/homeboard \
  --namespace homeboard \
  --create-namespace \
  -f my-values.yaml
```

> [!NOTE]
> The Helm chart includes a pre-install and pre-upgrade `Job` ([`migrate-job.yaml`](file:///d:/gitprojects/home-org/helm/homeboard/templates/migrate-job.yaml)) that executes database schema migrations before new pods are rolled out.

---

## 🔐 Parent PIN Recovery & Reset

### How the PIN Works
- The fridge PIN protects the **Parent Console** on shared touchscreen displays.
- The PIN is stored as an **Argon2id** cryptographic hash in the `households.fridge_pin_hash` database column.
- When `fridge_pin_hash` is `NULL`, the application accepts the PIN defined by the `PARENT_PIN` or `INITIAL_PIN` environment variables (or defaults to `1234` if neither is set).
- Once entered, the PIN is hashed and persisted into the database.

---

### Reset Method 1: Database Reset (Quickest)

If parents forget their PIN, the fastest and most reliable fix is to clear the stored hash in PostgreSQL. This immediately resets the PIN back to the environment variable default.

#### In Docker Compose:
```bash
docker compose exec postgres psql -U homeorg -d homeorg -c "UPDATE households SET fridge_pin_hash = NULL;"
```

#### In Kubernetes:
```bash
kubectl exec -it deployment/postgres -n homeboard -- psql -U homeorg -d homeorg -c "UPDATE households SET fridge_pin_hash = NULL;"
```
*(Or run the SQL command directly in your managed database console e.g. AWS RDS, Supabase, etc.):*
```sql
UPDATE households SET fridge_pin_hash = NULL;
```

#### What happens next:
1. Tap the **Parent Mode** lock icon on the fridge screen.
2. Enter your default PIN:
   - If `PARENT_PIN` or `INITIAL_PIN` is set in your environment / `.env`, enter that value.
   - Otherwise, enter the default `1234`.
3. Homeboard validates the default PIN, automatically hashes it with Argon2id, and saves it.
4. Go to **Settings** (gear icon) in the Parent Console and set your new custom PIN.

---

### Reset Method 2: Change PIN from Parent Console

If you are already logged in as a parent on another device (desktop or phone) or have a valid browser session:

1. Open Homeboard in your browser.
2. Navigate to **Parent Mode** -> **Settings**.
3. Locate the **Parent PIN** section.
4. Enter a new 4 to 20 digit PIN and click **Update PIN**.

---

### Reset Method 3: Demo Mode Access

If running with `ALLOW_DEMO=true`:
1. The Parent Console bypasses PIN requirements or allows one-click login with `parent@example.com` / `homeboard-demo`.
2. Once in Parent Mode, open **Settings** and update the fridge PIN.

---

## 🧪 Testing & Health Verification

Homeboard includes comprehensive verification scripts to test end-to-end functionality inside your deployment container:

### Run Stack Health & Functional Test
Validates database connectivity, creates an isolated temporary household, schedules chores, tests checkoffs, approvals, groups, routines, and reports, and cleans up after itself:
```bash
# In Docker Compose
docker compose exec -T web node scripts/verify-stack.mjs

# In Local Environment
node scripts/verify-stack.mjs
```

### Run Unit Tests
```bash
npm run test
```

---

## 📁 Project Layout

```text
├── db/
│   └── migrations/              # Incremental SQL migrations
├── docker-compose.yml           # Turnkey Docker Compose stack (postgres, app, worker)
├── helm/
│   └── homeboard/               # Production Kubernetes Helm chart
├── scripts/
│   ├── migrate.ts               # Migration runner script
│   ├── seed.ts                  # Seed script for initial household
│   └── verify-stack.mjs         # E2E functional test suite
├── src/
│   ├── app/                     # Next.js App Router (pages & REST API routes)
│   │   ├── api/v1/              # Chores, routines, members, auth, dashboard API
│   │   └── parent/              # Parent administration console
│   ├── components/              # React UI components (portrait dashboard, widgets)
│   ├── lib/                     # Auth, DB, recurrence rules, crypto utilities
│   └── worker.ts                # Background recurrence & overdue scheduler
└── Dockerfile                   # Multi-stage production container build
```

---

## 📄 License

Private household project. All rights reserved.
