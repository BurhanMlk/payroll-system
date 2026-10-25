# EduPayroll — Multi-Tenant SaaS Payroll Management System

A production-ready, subscription-based **multi-tenant payroll platform** for schools, colleges, universities, academies, and training institutes. Any number of institutions can register and use the same application while all tenant data remains completely isolated.

> **Not a payroll system for one college.** It is a SaaS product where the platform owner sells access to institutions on a monthly/yearly subscription basis.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Platform Hierarchy](#platform-hierarchy)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Database & Migrations](#database--migrations)
7. [Seed Data & Demo Credentials](#seed-data--demo-credentials)
8. [API Overview](#api-overview)
9. [Multi-Tenancy & Security](#multi-tenancy--security)
10. [RBAC & Permissions](#rbac--permissions)
11. [Subscription Engine](#subscription-engine)
12. [Payroll Engine](#payroll-engine)
13. [Background Jobs](#background-jobs)
14. [Testing](#testing)
15. [Deployment](#deployment)
16. [Project Structure](#project-structure)

---

## Architecture Overview

```
Platform Owner / Super Admin
        ↓
Tenant / Institution (School, College, University, Academy, ...)
        ↓
Branches / Campuses
        ↓
Institution Users (Owner, Principal, HR, Accountant, Managers)
        ↓
Employees
```

The system is a monorepo with two applications:

- **`server/`** — Node.js + Express + TypeScript REST API (`/api/v1/*`), Prisma ORM on PostgreSQL, Redis + BullMQ for queues.
- **`client/`** — React + Vite + TypeScript SPA with Tailwind CSS, TanStack Query, React Hook Form, Zod, and Recharts.

The platform owner gets a dedicated **Super Admin control panel** (`/platform`) with tenant management, subscription management, plan management, revenue analytics, audit logs, and system jobs.

---

## Technology Stack

| Layer       | Technology |
|-------------|-----------|
| Frontend    | React 18, Vite, React Router, TypeScript, Tailwind CSS, shadcn-style components, TanStack Query, React Hook Form, Zod, Recharts, Axios |
| Backend     | Node.js, Express, TypeScript, REST API, Prisma ORM, PostgreSQL |
| Auth        | JWT access token + rotating refresh token (HTTP-only cookies), bcrypt password hashing, RBAC, tenant authorization |
| Automation  | Redis + BullMQ queues, repeatable schedulers, idempotent jobs |
| Files       | PDF payslips (PDFKit), CSV export (csv-stringify), Excel export (ExcelJS), pluggable storage abstraction (local/S3/GCS) |
| Deployment  | Docker, Docker Compose, Nginx, environment validation, graceful shutdown |

**No PHP.**

---

## Platform Hierarchy

Every tenant-owned record carries a `tenantId`. Tenant identity is resolved **only** from the authenticated user's session — never from the frontend, request body, query string, or headers.

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- PostgreSQL (15+ recommended)
- Redis (optional in development — the app degrades gracefully)
- Docker & Docker Compose (for the full stack)

### Option A — Docker (recommended for a full environment)

```bash
cp .env.example .env            # then edit values
docker compose up --build
```

This starts PostgreSQL, Redis, the API server (with migrations), the SPA, and Nginx.

### Option B — Local development

```bash
# 1. Install dependencies (npm workspaces)
npm install --legacy-peer-deps

# 2. Start infrastructure (PostgreSQL + Redis)
docker compose up -d postgres redis
#   or use a local PostgreSQL and set DATABASE_URL accordingly

# 3. Configure environment
cp .env.example server/.env      # edit as needed

# 4. Run migrations + seed
npm run db:migrate -w server
npm run db:seed -w server

# 5. Start API and client (concurrently)
npm run dev
#   API:    http://localhost:4000
#   Client: http://localhost:5173
```

---

## Environment Variables

See [`.env.example`](./.env.example) for the full annotated list. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase session pooler in prod) |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets (min 32 chars) |
| `BCRYPT_ROUNDS` | Password hashing cost |
| `STORAGE_DRIVER` | `local` \| `s3` \| `gcs` |
| `PAYMENT_PROVIDER` | `manual` \| `stripe` \| `paddle` \| `razorpay` |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Initial platform admin |
| `SEED_DEMO_DATA` | `true` to seed demo tenants |

> **Never use development credentials in production.**

---

## Database & Migrations

```bash
npm run db:generate -w server     # generate Prisma client
npm run db:migrate -w server      # apply migrations (deploy)
npm run db:migrate:dev -w server  # create a new migration (dev)
npm run db:seed -w server         # seed permissions, plans, demo data
```

The Prisma schema (`server/prisma/schema.prisma`) defines 50+ normalized models with foreign keys, indexes, and tenant-scoped unique constraints.

### Supabase (production database)

Production runs on Supabase Postgres (project `gzyweswnvzkevcmqgytx`, region `ap-northeast-1`) as a plain PostgreSQL connection — no Supabase client library or RLS policies are used, Prisma remains the only data layer.

The connection string uses the **session pooler** (port `5432`), which supports both Prisma runtime queries and `prisma migrate deploy`:

```
postgresql://postgres.<project-ref>:<password>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?connection_limit=5
```

> Do **not** use the transaction pooler (port `6543`) here: Prisma migrations take session-level advisory locks and hang through pgbouncer transaction mode.

Notes:

- `%40` must be used in place of `@` when the database password contains an `@`.
- Keep `connection_limit` low (5) so dynos and local sessions stay within Supabase's connection budget.
- Point `DATABASE_URL` at the session pooler in both `.env` (Docker/local) and the Heroku config vars. The local `docker compose` Postgres URLs are kept commented in `.env` for offline development.
- Apply schema changes with `npm run db:migrate -w server`; the Heroku `release` phase runs the same command on every deploy.
- Row Level Security is enabled on every `public` table. The app connects as the `postgres` role (which has `bypassrls`), so Prisma is unaffected, while Supabase's auto-generated REST API cannot read or write tenant data with an `anon`/`authenticated` key. Enable RLS on any new table created outside Prisma migrations.

---

## Seed Data & Demo Credentials

| Account | Email | Password | Scope |
|---------|-------|----------|-------|
| Super Admin | `admin@example.com` | `Admin@123456` | Platform |
| ABC College admin | `admin@abc-college.com` | `Password@123` | Tenant |
| XYZ School admin | `admin@xyz-school.com` | `Password@123` | Tenant |

Demo data includes plans (Starter/Professional/Enterprise), two tenants, departments, designations, employees, salary structures, a loan, attendance, and a generated payroll run.

The seeded payroll for **EMP-001 (ABC College)** reproduces the documented example:

| Line | Value |
|------|-------|
| Basic Salary | 60,000 |
| House / Transport / Medical / Overtime | +20,500 |
| **Gross** | **80,500** |
| Absence (2 days) / Loan installment | −8,000 |
| **Net** | **72,500** |

---

## API Overview

All endpoints are versioned under `/api/v1`.

### Auth
- `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`

### Onboarding (public)
- `GET /api/v1/onboarding/plans`, `POST /api/v1/onboarding/register`

### Tenant (requires auth + tenant context)
- `GET /api/v1/dashboard`
- `/api/v1/employees`, `/api/v1/departments`, `/api/v1/designations`, `/api/v1/branches`
- `/api/v1/attendance`, `/api/v1/shifts`, `/api/v1/holidays`
- `/api/v1/leaves`, `/api/v1/salary`, `/api/v1/payroll`
- `/api/v1/finance/loans`, `/api/v1/finance/advances`, `/api/v1/finance/overtime`
- `/api/v1/reports/*` (CSV/Excel export via `?format=csv|excel`)
- `/api/v1/notifications`, `/api/v1/billing`, `/api/v1/users`, `/api/v1/rbac`, `/api/v1/me`

### Platform (Super Admin)
- `GET /api/v1/platform/dashboard`, `/api/v1/platform/tenants`, `/api/v1/platform/subscriptions`, `/api/v1/platform/plans`, `/api/v1/platform/revenue`, `/api/v1/platform/audit-logs`, `/api/v1/platform/jobs`, `/api/v1/platform/health`

### Standard response format

```json
{ "success": true, "data": { } }

{ "success": false, "error": { "code": "SUBSCRIPTION_EXPIRED", "message": "Your subscription has expired." } }
```

---

## Multi-Tenancy & Security

- **Tenant resolution** — `resolveTenant` middleware derives the tenant from the authenticated user only.
- **Automatic scoping** — `tenantClient(tenantId)` wraps Prisma and injects `tenantId` into every query on tenant-owned models (reads, writes, creates). Cross-tenant reads return nothing; cross-tenant writes are impossible.
- **Subscription gating** — `requireActiveSubscription` / `requireWritableSubscription` block payroll, employee creation, and sensitive writes when a subscription lapses. Login and billing pages remain available.
- **RBAC** — `requireRole`, `requirePermission`, `requireFeature` enforce granular access. Every endpoint validates permissions on the backend.
- **Hardening** — bcrypt hashing, JWT + rotating refresh tokens, HTTP-only cookies, rate limiting, Helmet, secure CORS, Zod validation, parameterized queries via Prisma, file upload validation, sensitive-response filtering, audit logs, brute-force lockout, centralized error handling.

---

## RBAC & Permissions

Default roles:

| Scope | Roles |
|-------|-------|
| Platform | `super_admin`, `platform_support` |
| Tenant | `owner`, `principal`, `hr_manager`, `accountant`, `branch_manager`, `department_manager`, `employee` |

Permissions are granular (`employee.create`, `payroll.generate`, `payroll.approve`, `payroll.mark_paid`, `leave.approve`, `loan.create`, `reports.export`, `billing.manage`, …). Roles and permissions are stored dynamically, not hardcoded.

---

## Subscription Engine

- Plans: **Starter**, **Professional**, **Enterprise** — with monthly/yearly pricing, employee/branch/user limits, trial days, and dynamic feature flags.
- Statuses: `trialing`, `active`, `past_due`, `grace_period`, `expired`, `cancelled`, `suspended`.
- Expiry is handled by background jobs: lapsed subscriptions enter a 7-day grace period, then `expired`. **Tenant data is never deleted.**
- Reminders are sent at 14/7/3/1 days before expiry and on expiry (deduplicated via `SubscriptionReminder`).
- Renewal reactivates the tenant, restores features, extends the expiry date, and preserves all data.
- Super Admin actions: activate, extend, change plan, give free subscription, add trial days, cancel, suspend, view billing history/usage, impersonate a tenant admin.

---

## Payroll Engine

The payroll engine is a **pure, fully-tested function** (`payroll.calculator.ts`) that produces a detailed breakdown for every employee:

```
Basic Salary
+ Earnings (fixed / percentage / formula)
+ Overtime
− Absence deduction (daily-rate based)
− Late deduction
− Loan installment
− Salary advance
− Tax (fixed / percentage / slabs)
= NET SALARY
```

- Every line item carries a human-readable **calculation trace**.
- Full **snapshot** of salary structure, attendance, allowances, deductions, tax, loan, and net is stored per payroll item — historical payroll never changes when future salary rules change.
- Duplicate payroll per period is prevented; exceptions (missing salary, missing bank details, negative net) are surfaced before approval.
- Approval workflow: `DRAFT → CALCULATED → PENDING_REVIEW → APPROVED → PROCESSING → PAID → LOCKED`.
- Paid payroll can be **locked**; unlocking requires a special permission, a reason, and an audit log.
- Beautiful **PDF payslips** are generated with institution, employee, earnings, deductions, gross, net, and payment details.

---

## Background Jobs

BullMQ queues (`subscription-jobs`, `payroll-jobs`, `notification-jobs`, `general-jobs`) run:

- Subscription expiry checks (daily)
- Subscription reminders (hourly)
- Automatic payroll generation (daily)

Jobs are idempotent, logged to `BackgroundJobLog`, and safe against duplicate execution.

---

## Testing

```bash
npm test                     # server (vitest) + client (vitest)
npm run test -w server       # server tests only
```

The critical pure payroll calculation engine and tax slab engine are covered by unit tests. Integration coverage (tenant isolation, permissions, subscription expiry, payroll generation, loan deduction) is validated against the seeded PostgreSQL database — the seed data is specifically designed to exercise tenant isolation.

---

## Deployment

```bash
npm run build                 # build server + client
docker compose up --build     # full stack (Postgres, Redis, API, SPA, Nginx)
```

- Nginx serves the SPA and reverse-proxies `/api` and `/storage` to the API.
- The server validates environment variables at startup, exposes `/api/v1/health`, logs with Pino, and shuts down gracefully on `SIGTERM`/`SIGINT`.
- Additional payment gateways (Stripe, Paddle, Razorpay) plug into the `PaymentProvider` interface; webhook endpoints must verify signatures and be idempotent.

---

## Project Structure

```
root/
├── client/                     # React SPA
│   └── src/
│       ├── api/ (client in lib/)
│       ├── components/ui/      # design system
│       ├── contexts/           # auth context
│       ├── layouts/            # app shell
│       ├── pages/              # tenant + platform pages
│       └── lib/                # api client, types, utils
├── server/
│   ├── prisma/                 # schema + seed
│   └── src/
│       ├── config/             # env, logger
│       ├── constants/          # permissions, roles
│       ├── lib/                # prisma, jwt, errors, tenant scope
│       ├── middlewares/        # auth, tenant, rbac, subscription, validation
│       ├── modules/            # feature modules (service + controller + routes)
│       ├── jobs/               # BullMQ queues, workers, schedulers
│       ├── services/           # audit, email, storage, payments
│       ├── utils/              # dates, money, csv, excel, payslip pdf
│       └── app.ts / server.ts
├── deploy/nginx.conf
├── docker-compose.yml
└── README.md
```

---

## License

Proprietary — built as a reference implementation of a commercial SaaS payroll product.
