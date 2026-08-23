# St. Rose Laboratory Result Management System

Modern Laboratory Result Management System for **St. Rose Diagnostic Laboratory**.

> **Status:** Active Development

## Tech Stack

* Next.js 15 / App Router
* React
* TypeScript
* Tailwind CSS
* React Hook Form
* Zod
* Supabase integration
* Server-side authentication and RBAC

## Current Features

* Login / authentication
* Session management with HMAC-signed tokens
* Remember Me session handling
* Server-side route protection
* Role-based access control
* Admin, Developer, and User roles
* Dashboard
* Developer Monitoring Dashboard
* User Management
* Personnel Directory
* Audit Logs
* Session Workspace
* Completed History
* Protected API routes
* Supabase health monitoring

## Role Access

### Admin

* Dashboard
* Session Workspace
* Completed History
* Audit Logs
* User Management
* Personnel Directory

### Developer

* Dashboard
* Session Workspace
* Completed History
* Audit Logs
* User Management
* Personnel Directory
* Developer Monitoring Dashboard

### User

* Dashboard
* Session Workspace
* Completed History

UI visibility is not the security boundary. Server-side route/API authorization remains enforced.

## Authentication / RBAC

Authentication uses the shared server-side `userService.authenticate()` flow.

Relevant files:

* `src/lib/session.ts`
* `src/lib/auth-guards.ts`
* `src/services/userService.ts`
* `src/features/auth/authActions.ts`
* `src/middleware.ts`

Supported roles:

* `Admin`
* `Developer`
* `User`

Accounts are persisted in Supabase, in the `user_profiles` table, reached only through the
server-side client in `src/lib/supabase/server.ts`. The prototype `data/users.json` file is gone and
nothing reads from disk on the authentication path.

Passwords are hashed with **scrypt** (N=32768, r=8, p=1) in `src/lib/password.ts`, verified with a
constant-time comparison. Recovery answers are hashed the same way.

### Production Security TODO

Before production:

* Configure a strong `SESSION_SECRET` in the deployment environment.
* Provision the retention purge schedule. `purgeExpiredSessions` is wired and reachable through the
  Admin-guarded `POST /api/purge`, but no cron, platform schedule or `pg_cron` entry invokes it.

## Developer Monitoring Dashboard

Developer monitoring is implemented in:

`src/features/dashboard/components/DeveloperDashboardSection.tsx`

and integrated into:

`src/features/dashboard/components/DashboardView.tsx`

The Developer Dashboard displays:

* Application health
* Supabase connection status
* Supabase response time
* Last successful connection
* Authentication/session status
* API availability
* User statistics
* Personnel/signatory statistics
* Laboratory result statistics
* Audit log statistics
* Recent audit activity
* Runtime/environment information

The Supabase status is based on a real server-side query and is **not hardcoded**.

## Supabase Health Check

Implementation:

`src/services/developer-dashboard-service.ts`

The service reuses the project's existing Supabase client and performs a real server-side database query.

Errors are handled safely without exposing sensitive raw database errors to the UI.

The health check now uses a 30-second cache TTL and a 10-second `AbortController` timeout to prevent hangs and repeated overhead.

Do **not** fake the status or remove the real connectivity check.

## User Management / API

Relevant files:

* `src/services/userService.ts`
* `src/app/api/users/route.ts`
* `src/app/api/users/[id]/route.ts`
* `src/app/api/users/summary/route.ts`
* `src/lib/api/users.ts`

Additional API:

* `src/app/api/purge/route.ts`

Utility scripts:

* `scripts/checkSupabase.js`
* `scripts/check-navigation.js`

## Audit Logs

Audit Logs remain part of the Admin and Developer Core Menu.

The Developer Dashboard can display audit statistics and recent audit activity.

Do not remove or bypass audit logging when modifying authentication, RBAC, or dashboard functionality.

## Personnel Directory

Personnel Directory remains available to Admin and Developer roles.

It must remain protected by server-side authorization.

## Validation

Successfully completed:

The PowerShell execution policy on the development machine blocks the `npm` and `npx` shims, so
the toolchain is invoked through `node` directly:

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next lint
node node_modules/next/dist/bin/next build
```

Checkpoint verifiers run the same way, through `tsx`:

```bash
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/<name>.ts
```

`--conditions=react-server` is required by verifiers whose import graph reaches a `server-only`
module and breaks the ones that render markup through `react-dom/server`. `CLAUDE.md` records which
verifier needs which invocation; a verifier that fails to start has proved nothing and must not be
reported as a gate result.

### Production Build

Possible future test if Node.js memory usage becomes an issue:

```powershell
$env:NODE_OPTIONS="--max_old_space_size=4096"
npm run build
```

Only use this when sufficient RAM is available.

## Architecture

```text
src/
├── app/
│   ├── (app)/          # dashboard, history, audit, users, personnel, developer
│   ├── (dashboard)/    # workspace
│   ├── api/
│   └── login/
├── components/
│   ├── layout/
│   └── ui/             # shared Table, Button, Badge, Alert, Input, Select, Modal
├── config/
├── domain/             # models, types, declarative report definitions
├── features/
│   ├── audit/
│   ├── auth/
│   ├── dashboard/
│   ├── developer-accounts/
│   ├── history/
│   ├── personnel/
│   ├── server-boundary/
│   ├── users/
│   └── workspace/
├── hooks/
├── lib/
├── rendering/          # shared render engine, native layout families, A4 styles
├── repositories/       # Supabase data access
├── services/
├── types/
└── utils/
```

Architecture principles:

* Feature-based organization
* Reusable components
* Service abstraction
* Type safety
* Separation of concerns
* Server-side authorization
* **Per-request Authentication Deduplication**: Uses React `cache()` for `getCurrentUserProfile()`.
* **Instant Navigation**: Uses `loading.tsx` skeleton pattern to provide immediate visual feedback during route transitions.

## Performance Optimizations

Recent major performance improvements include:

* **Request-Scoped Authentication**: `resolveAuthenticatedRequest` validates the authenticated user once per request, keyed by cookie, and every guard reuses that result. It replaced an earlier
  `getCurrentUserProfile()` cache that assumed a disk lookup; there is no disk read on this path.
* **Single-Owner Read Transport**: `resilientFetch` in `src/lib/supabase/server.ts` bounds read
  latency with an 8 s total budget across at most two attempts. Writes are delegated untouched with
  no retry, because a client-side abort on a write leaves an ambiguous outcome. postgrest-js's own
  retry layer is disabled so this wrapper is the only retry layer end to end.
* **Server-Rendered Initial Data**: History, Workspace and the `/users` directory are delivered with
  the page instead of being fetched after hydration. `/users` went from three reads across two
  requests to one request, and recent sessions with their ownership now resolve in a single query.
* **Workspace Bundle**: moving auto-suggestion reads to a server action removed the browser Supabase
  client from the workspace graph, taking `/workspace` First Load JS from 213 kB to 149 kB with
  GoTrue and Realtime absent from the initial chunks.
* **Developer Dashboard Suspense Streaming**: The heavy `DeveloperDashboardSection` is wrapped in `<Suspense>`, allowing the main dashboard shell to render instantly while the diagnostics stream in.
* **Supabase Monitoring Optimizations**: `getSupabaseCounts()` executes queries in parallel. Queries now have a 10-second `AbortController` timeout and a 30-second cache TTL to prevent hangs and repeated overhead.
* **Route Loading Skeletons**: `loading.tsx` files across routes (dashboard, workspace, history, audit, users) provide immediate visual feedback.
* **Workspace Template Cache Parallelization**: Template metadata loading uses parallel/bulk Supabase queries (`Promise.all()`) instead of sequential loading. Reduces 52 sequential browser-to-Supabase queries to 3 parallel bulk queries, cutting cache warm-up from ~5–26 seconds to ~300–500ms.

## Current Working State

Recent work includes:

* Authentication stabilization
* Login logo fix
* RBAC improvements
* User Management improvements
* Admin/Developer navigation updates
* Audit navigation
* Developer Monitoring Dashboard
* Real Supabase health monitoring with 30s cache TTL and 10s timeout
* Protected user APIs
* README/handoff documentation
* **Suspense streaming for Developer Dashboard**
* **Next.js loading.tsx skeletons for responsive navigation**
* **Workspace examination loading optimization (parallel Supabase template hydration)**
* Milestone 6 read transport policy, request-scoped authentication, and removal of the
  post-hydration read waterfalls on History, Workspace and `/users`
* Login no longer reports an infrastructure failure as an invalid credential
* The authenticated shell fails closed with a retryable account state when a profile read fails in
  transit, rather than treating a transport fault as a signed-out session
* UI consistency program across the encoding workspace, the Live Preview toolbar, the User and
  Personnel directories, and the History and Audit viewers
* `src/rendering/**` added to the Tailwind `content` globs, which had left twelve live-preview
  classes uncompiled

## Known Issues / Pending Work

1. Production session secret must be configured securely in the deployment environment.
2. Retention purge has no scheduler. It runs only when `POST /api/purge` is invoked, and the
   `AutomatedRetentionPurgeExecuted` event is emitted only when the run deleted something, so a
   zero-count run leaves no evidence it executed.
3. The page title is rendered twice on most routes: the global header derives it from
   `src/config/navigation.ts` while each view also renders its own heading, with two different
   subtitles. The pattern is app-wide, so it needs one decision rather than per-route fixes.
4. Brand colours are defined as bare `var(...)` values, so Tailwind opacity modifiers on them
   (`text-brand-text-muted/90`, `focus:ring-brand-primary/20`) compile to nothing and are silently
   inert. Do not introduce new brand-token opacity utilities.
5. One commit, `a16965d`, carries a pasted status line as its subject. History has not been
   rewritten to correct it.

Items 1 to 4 of the previous list are resolved: the `(dashboard)` route group has its own
`layout.tsx`, audit logs persist to the Supabase `audit_logs` table, passwords are scrypt-hashed,
and file-backed user storage was replaced by `user_profiles`.

## AI Handoff Rules

For any new AI coding agent:

* Read `README.md` first.
* Inspect existing code before editing.
* Do not start from scratch.
* Preserve working authentication and RBAC.
* Preserve Audit Logs and Personnel Directory.
* Do not fake Supabase connectivity.
* Do not expose service-role credentials.
* Do not invent environment variables or credentials.
* Validate changes with TypeScript and lint.
* Update this README after actual implementation.
