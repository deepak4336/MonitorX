# MonitorX — Observability Platform

A production-grade error monitoring platform similar to Sentry, built with Next.js, Supabase, Prisma, and TypeScript.

---

## Architecture

```
Browser Application
      ↓
@monitorx/browser SDK  (packages/sdk-browser)
      ↓
POST /api/events        (apps/dashboard — ingestion API)
      ↓
Supabase / PostgreSQL   (via Prisma ORM)
      ↓
Dashboard UI            (apps/dashboard — Next.js App Router)
```

## Monorepo Structure

```
monitorx/
├── apps/
│   └── dashboard/               # Next.js 14 App (dashboard + ingestion API)
│       ├── prisma/
│       │   └── schema.prisma    # All DB models
│       └── src/
│           ├── app/
│           │   ├── (auth)/      # Login, Register pages
│           │   ├── (dashboard)/ # Protected dashboard pages
│           │   │   ├── projects/
│           │   │   │   └── [projectId]/
│           │   │   │       ├── issues/
│           │   │   │       │   └── [issueId]/   # Issue detail + stack trace
│           │   │   │       └── settings/        # DSN + SDK test tool
│           │   │   └── organizations/
│           │   └── api/
│           │       ├── events/          # POST — telemetry ingestion
│           │       ├── organizations/   # GET, POST
│           │       └── projects/        # GET, POST + nested issues routes
│           ├── components/
│           │   ├── layout/      # Sidebar, PageHeader
│           │   ├── dashboard/   # SDKTestClient
│           │   ├── issues/      # StackTraceViewer, IssueStatusToggle
│           │   ├── projects/    # CreateProjectButton
│           │   ├── orgs/        # CreateOrgButton
│           │   └── ui/          # LevelBadge
│           ├── lib/
│           │   ├── prisma.ts         # Prisma singleton
│           │   ├── supabase-server.ts
│           │   ├── supabase-browser.ts
│           │   ├── issue-grouping.ts  # Fingerprinting + upsert logic
│           │   ├── validations.ts     # Zod schemas
│           │   └── utils.ts
│           ├── store/           # Zustand stores
│           └── middleware.ts    # Auth session refresh
│
└── packages/
    ├── sdk-core/                # Event builder, stack parser, DSN utils
    ├── sdk-browser/             # Browser SDK (init, captureException, etc.)
    └── shared-types/            # Shared TypeScript interfaces
```

---

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- A [Supabase](https://supabase.com) account (free tier works)

---

## Setup

### 1. Clone & Install

```bash
git clone <your-repo>
cd monitorx
npm install   # or: pnpm install
```

### 2. Create a Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com) → New Project
2. Note your **Project URL** and **anon public key** (Settings → API)
3. Note your **Database password** (set during project creation)
4. Get the **connection strings** from Settings → Database → Connection string

### 3. Configure Environment Variables

```bash
cd apps/dashboard
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

DATABASE_URL=postgresql://postgres:[PASSWORD]@db.your-project.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.your-project.supabase.co:5432/postgres

NEXT_PUBLIC_INGEST_HOST=localhost:3000
```

### 4. Enable Supabase Auth

In your Supabase dashboard:
- Authentication → Settings → Enable **Email** provider
- Optionally disable email confirmation for local dev: Auth → Settings → "Confirm email" → Off

### 5. Push Database Schema

```bash
cd apps/dashboard
npx prisma db push
npx prisma generate
```

This creates all tables in your Supabase PostgreSQL database.

### 6. Run Development Server

From the monorepo root:

```bash
npm run dev
```

Or just the dashboard:

```bash
cd apps/dashboard
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Usage Flow

### Step 1 — Create Account
Navigate to `/register` and create an account.

### Step 2 — Create Organization
Go to **Organizations** → **New Organization**.

### Step 3 — Create Project
Go to **Projects** → **New Project**, select your organization.

### Step 4 — Get Your DSN
Click a project to view issues, then go to **Settings** to see the DSN:
```
http://abc123def456...@localhost:3000/project/uuid-here
```

### Step 5 — Initialize SDK in Your App

```typescript
import * as MonitorX from "@monitorx/browser";

MonitorX.init({
  dsn: "http://YOUR_KEY@localhost:3000/project/YOUR_PROJECT_ID",
  environment: "production",
  debug: true,
});
```

All unhandled errors and promise rejections are now automatically captured.

### Step 6 — Test the Integration
In the project **Settings** page, use the **Test SDK Integration** panel to trigger test errors and verify the full pipeline.

### Step 7 — View Issues
Navigate to **Projects → [Your Project] → Issues** to see grouped errors with stack traces.

---

## SDK API Reference

```typescript
import * as MonitorX from "@monitorx/browser";

// Initialize (required once)
MonitorX.init({ dsn: "...", environment: "production", debug: false });

// Capture an Error object
MonitorX.captureException(new Error("Something broke"), { userId: "123" });

// Capture a message
MonitorX.captureMessage("User exceeded rate limit", "warning");

// Send raw payload
MonitorX.sendEvent({
  message: "Custom event",
  level: "info",
  extra: { context: "value" },
});
```

---

## Ingestion API

**Endpoint:** `POST /api/events`

**Headers:**
```
Content-Type: application/json
X-MonitorX-Key: <your-public-key>
```

**Payload:**
```json
{
  "event_id": "optional-uuid",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "platform": "javascript",
  "message": "Error message",
  "level": "error",
  "environment": "production",
  "project_id": "your-project-uuid",
  "stacktrace": {
    "frames": [
      { "filename": "/app/index.js", "function": "handleClick", "lineno": 42, "in_app": true }
    ]
  },
  "url": "https://example.com/page",
  "user_agent": "Mozilla/5.0 ...",
  "extra": {}
}
```

**Response:**
```json
{ "success": true, "data": { "event_id": "...", "issue_id": "..." } }
```

---

## Issue Grouping

Events are grouped into **Issues** using a deterministic fingerprint:

```
fingerprint = message + top_in_app_frame_filename + lineno
```

- If an issue with the same fingerprint exists → increment `occurrences`, update `last_seen`
- If it's new → create a new `Issue` record
- If a resolved issue receives a new event → automatically reopen it

---

## Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# From apps/dashboard
vercel

# Set environment variables in Vercel dashboard
# Update NEXT_PUBLIC_INGEST_HOST to your Vercel domain
```

After deploying, update your SDK `dsn` to use the production URL:
```
https://YOUR_KEY@your-app.vercel.app/project/YOUR_PROJECT_ID
```

---

## Database Schema Overview

| Table | Description |
|-------|-------------|
| `users` | Mirror of Supabase auth users |
| `organizations` | Top-level workspace grouping |
| `organization_members` | User–org relationships with roles |
| `projects` | Individual monitored applications |
| `api_keys` | DSN public keys per project |
| `events` | Raw telemetry events |
| `issues` | Grouped/deduplicated events |

---

## Phase 2 Roadmap (not in scope here)

- Performance tracing (spans, transactions)
- Session replay
- Custom metrics / dashboards
- Kafka + ClickHouse for high-volume ingestion
- Redis for rate limiting
- AI-powered issue triage
- Mobile SDKs (React Native, Flutter)
- Slack / PagerDuty / webhook alerts
