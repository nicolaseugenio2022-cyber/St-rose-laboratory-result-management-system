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
```

Both completed without TypeScript or ESLint errors.

### Production Build

`npm run build` was attempted but the Next.js build worker exited because of a native Node.js **out-of-memory (OOM)** condition.

This was not reported as a TypeScript or ESLint failure.

Possible future test:

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

## Current Working State

Recent work includes:

* Authentication stabilization
* Login logo fix
* RBAC improvements
* User Management improvements
* Admin/Developer navigation updates
* Audit navigation
* Developer Monitoring Dashboard
* Real Supabase health monitoring
* Protected user APIs
* User persistence improvements
* README/handoff documentation

## Known Issues / Pending Work

1. Supabase Developer Dashboard health check is slow (~7148 ms).
2. Production build requires investigation of Node.js memory usage.
3. Prototype passwords must be hashed before production.
4. File-backed user persistence must eventually be replaced with a proper database.
5. Production session secret must be configured securely.

## Next Recommended Task

**Profile and optimize the ~7148 ms Supabase health check.**

Before implementation:

1. Read this README.
2. Inspect the current code.
3. Identify the exact slow query/operation.
4. Create an implementation plan.
5. Optimize only the verified bottleneck.
6. Run TypeScript and lint.
7. Re-test the real Supabase connection status.
8. Verify authentication/RBAC, Audit Logs, and Personnel Directory remain intact.
9. Update this README after implementation.

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
