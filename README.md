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

Current prototype user persistence uses:

`data/users.json`

User data persists across navigations and server restarts for the current development setup.

### Production Security TODO

Before production:

* Hash passwords with bcrypt/Argon2.
* Configure a strong `SESSION_SECRET`.
* Replace file-backed user storage with a proper database/service.

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

### Known Performance Issue

The health check currently reports approximately:

**7148 ms (~7.1 seconds)**

This is too slow for a health check.

### Next Priority

Profile the health check before changing it.

Investigate:

* Duplicate queries
* Sequential queries
* Expensive count queries
* RLS/auth overhead
* Retries/timeouts
* Unnecessary health-check operations
* Development-mode overhead

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

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All validations passed without TypeScript or ESLint errors. The production build was successfully generated.

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
│   ├── (app)/
│   ├── api/
│   └── login/
├── components/
│   ├── layout/
│   └── ui/
├── config/
├── domain/
├── features/
│   ├── dashboard/
│   └── users/
├── lib/
├── services/
└── types/
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

* **userService Disk-Read Caching**: A 2-second in-memory cache TTL prevents redundant `fs.readFileSync` calls during a single render path.
* **Authentication Lookup Deduplication**: React `cache()` wraps `getCurrentUserProfile()` so that within a single request, the HMAC verification and disk lookup only execute once.
* **Developer Dashboard Suspense Streaming**: The heavy `DeveloperDashboardSection` is wrapped in `<Suspense>`, allowing the main dashboard shell to render instantly while the diagnostics stream in.
* **Supabase Monitoring Optimizations**: `getSupabaseCounts()` executes queries in parallel. Queries now have a 10-second `AbortController` timeout and a 30-second cache TTL to prevent hangs and repeated overhead.
* **Route Loading Skeletons**: `loading.tsx` files across routes (dashboard, workspace, history, audit, users) provide immediate visual feedback.

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
* User persistence improvements with 2s disk-read cache
* README/handoff documentation
* **Suspense streaming for Developer Dashboard**
* **Next.js loading.tsx skeletons for responsive navigation**

## Known Issues / Pending Work

1. `(dashboard)` route-group authentication layout is missing, falling back to middleware.
2. Audit logs are purely in-memory and are not persistent across restarts.
3. Prototype passwords must be hashed before production.
4. File-backed user persistence must eventually be replaced with a proper database.
5. Production session secret must be configured securely.

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
