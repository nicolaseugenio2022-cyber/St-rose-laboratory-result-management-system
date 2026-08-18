# Personnel Directory — Backend Handoff (P2)

**Repo:** `C:\Projects\St-rose-laboratory-result-management-system`
**Supabase project:** `ruxsmcypeisbkotibzfs`
**Executor:** OpenCode / Big Pickle · **Reasoning effort:** `xhigh` (authorization boundary)

> **OpenCode must never apply production SQL.** No `psql`, no Supabase dashboard SQL, no CLI `db push`,
> no DDL, no data backfill. P2 requires **no migration at all** (see §3). If work ever appears to need
> one, **stop and report** — the user applies production SQL manually.

---

## 1. Baseline and P1 state

- **Published baseline:** `2b33ad8`.
- **P1 (UI shell) is complete and manually verified**, but at the time of writing sits **uncommitted in
  the working tree**. P2's real baseline is the commit P1 lands as — **confirm the actual `HEAD` SHA at
  freeze time**, do not assume `2b33ad8`.
- P1 added **8 files, zero modifications** to existing files:

| P1 file | P2 disposition |
|---|---|
| `src/app/(app)/personnel/page.tsx` | **Modify** — pass real personnel, drop `isPreviewData` and the fixture import |
| `src/app/(app)/personnel/loading.tsx` | Unchanged |
| `src/lib/validations/personnelValidation.ts` | **Extend** — already exists, see §5 |
| `src/features/personnel/components/PersonnelDirectoryView.tsx` | **Modify** — receive `onSubmit` / `onToggleStatus`; remove the preview banner block |
| `src/features/personnel/components/PersonnelTable.tsx` | Unchanged |
| `src/features/personnel/components/PersonnelForm.tsx` | Unchanged |
| `src/features/personnel/components/PersonnelFormModal.tsx` | Unchanged |
| `src/features/personnel/components/preview-fixture.ts` | **Delete** |

P1 is presentational only: no persistence, no server actions, and no new guard — it reuses the existing route-access and profile-resolution path. `PersonnelDirectoryView`
already accepts optional `onSubmit` / `onToggleStatus` props — **P2 wires it by supplying them, not by
refactoring it.** With neither supplied, submit throws a "not connected yet" message and toggle shows a
notice; both paths disappear once the real callbacks arrive.

---

## 2. Existing DB and repository facts (verified — do not re-derive)

**`personnel` table — `supabase/migrations/02_tables.sql:27-39`, already complete:**

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
first_name TEXT NOT NULL, last_name TEXT NOT NULL, middle_initial TEXT,
credentials TEXT NOT NULL,
prc_license_number TEXT NOT NULL UNIQUE,
role TEXT NOT NULL CHECK (role IN ('Pathologist','MedicalTechnologist')),
signature_image_url TEXT,
is_active BOOLEAN NOT NULL DEFAULT TRUE,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

- No Postgres enum — a TEXT CHECK. Active flag is **`is_active BOOLEAN`**, not a status string.
- `trg_personnel_updated_at` moves `updated_at` on every update (`03_indexes_and_triggers.sql:9-11`).
- RLS **enabled with zero policies** — deny-all defence-in-depth; the server bypasses it with the
  secret key. `05_rls_policies.sql` must create no policies (pinned by M6A).
- **No seed rows anywhere in the repo.** Any rows in `ruxsmcypeisbkotibzfs` were entered out-of-band.

**`IPersonnelRepository` — `src/repositories/interfaces/index.ts:160-167` — already full CRUD:**

```ts
findById(id) · findAllActive() · findAll() · create(Omit<IPersonnel,"id"|"createdAt"|"updatedAt">)
update(id, Partial<IPersonnel>) · toggleActiveStatus(id, isActive)
```

**`SupabasePersonnelRepository`** implements all six with snake↔camel mappers.
`create` / `update` / `toggleActiveStatus` currently have **zero callers** — P2 is their first consumer.
**No repository or interface change is needed or permitted.**

`toPersonnelUpdateRow` only assigns keys that are `!== undefined`, which is the mechanism that lets P2
preserve an existing signature URL by simply omitting the key.

**Domain types:** `IPersonnel` (`src/domain/models/interfaces.ts:26-38`),
`PersonnelRole = "Pathologist" | "MedicalTechnologist"` (`src/domain/types/index.ts:16`). Both are pure
type modules with no `server-only` import.

---

## 3. No migration for basic CRUD

Everything CRUD needs already exists: table, columns, CHECK, unique constraint, trigger, RLS.
`audit_logs.category` and `event_type` are plain `TEXT` with **no CHECK**, and `PersonnelCredential` is
already in the `AuditCategory` union — **so auditing needs no migration either.**

**P2 writes no SQL and no migration file.** This deliberately sidesteps every M6A schema pin.

---

## 4. Authorization: Admin-only writes, Developer read-only

Authority: ADR-005:29 · `SECURITY_MODEL.md` §5 line 172 ("no Personnel Directory writes") and §8 line 268
(administrative writes to `personnel` authorized for active `Admin` only).

- **Admin** — full create / update / activate / deactivate.
- **Developer** — **read only.** Reaches `/personnel` through the existing `checkRouteAccess` grant and
  receives `canManage={false}`. Must be rejected by every write action.
- **User** — no access to `/personnel` at all (already enforced).

**`src/lib/auth-guards.ts` is byte-frozen** — the new guard **must** live in a new file. P1 already
derives `canManage = role === "Admin"` in `page.tsx`; that stays, and the server actions enforce the
same boundary independently. **UI gating is not authorization** — every write action re-checks.

---

## 5. Exact new backend surface

### 5.1 `src/lib/personnel-guard.ts` — NEW

Mirrors `src/lib/developer-guard.ts` in shape.

- `requirePersonnelReader()` — Admin **or** Developer, active, first-login complete. Backs the read action.
- `requirePersonnelAdmin()` — strict `role === "Admin"` only.
- Both emit `SecurityDenial` / `PersonnelDirectoryAccessDenied` with a `reasonCode` of
  `unauthenticated` | `first_login_incomplete` | `account_inactive` | `role_not_authorized` **before**
  denying — follow the four-reason pattern in `src/features/server-boundary/audit-actions.ts:15-66`.
- Deny by **throwing `ForbiddenError`** (`@/lib/errors`), not `redirect()` — these are client-invoked
  mutations that need an error, not a navigation. *Deliberate deviation from `requireDeveloper()`;
  record it in the report.*

### 5.2 `src/lib/validations/personnelValidation.ts` — EXTEND (already exists from P1)

P1 already exports `personnelRoleSchema`, `PERSONNEL_ROLE_OPTIONS`, `PERSONNEL_STATUS_OPTIONS`,
`personnelRoleLabel`, `personnelFormSchema`, `PersonnelFormValues`. **Do not rewrite or reshape these —
the P1 form depends on them.** Add alongside:

- `createPersonnelSchema` — `.strict()`: `firstName`, `lastName`, `middleInitial?`, `credentials`,
  `prcLicenseNumber`, `role`, `isActive`.
- `updatePersonnelSchema` — the same plus `id`.
- `personnelStatusSchema` — `.strict()`: `{ id, isActive: boolean }`.
- `emptyPersonnelActionSchema` = `z.object({}).strict()`.

**`signatureImageUrl` appears in no schema** — it is unsettable from the client in P2, which closes an
arbitrary-URL injection route into the report render path.

**Boundary mapping to handle:** the P1 form speaks `status: "Active" | "Inactive"`; the domain and DB
speak `isActive: boolean`. Convert at the view/action seam. Do not change the P1 form's shape.

### 5.3 `src/features/server-boundary/personnel-actions.ts` — NEW

`"use server"` + `import "server-only"`. **Must be a new file — `server-actions.ts` has its function
ordering pinned by B5.** Each action takes `input: unknown`; order is **guard → parse → repository → audit → return**.

| Action | Guard | Behaviour |
|---|---|---|
| `listPersonnelAction` | `requirePersonnelReader()` | `findAll()` — **must include inactive** so they can be reactivated. Not audited (read). |
| `createPersonnelAction` | `requirePersonnelAdmin()` | `create({ ...parsed, signatureImageUrl: null })` — explicit `null`, never client-supplied. Audit `PersonnelRecordCreated`. |
| `updatePersonnelAction` | `requirePersonnelAdmin()` | `update(id, updates)`; `id` destructured out and **never** inside `updates`. Signature rules in §7. Audit `PersonnelRecordUpdated`. |
| `togglePersonnelStatusAction` | `requirePersonnelAdmin()` | `toggleActiveStatus(id, isActive)`. Audit `PersonnelStatusToggled`. |

### 5.4 `scripts/verify-personnel-directory.ts` — NEW

1. Every write action calls `requirePersonnelAdmin()` **before** any repository call (index-ordering assertion, as B4 does for `listActivePersonnelAction`).
2. `requirePersonnelAdmin` accepts `"Admin"` only — Developer and User rejected.
3. No hard-delete path in `personnel-actions.ts` (no `.delete(`, no `remove`, no `DELETE FROM`).
4. `signatureImageUrl` is never read from parsed client input; a MedTech write always sends `signature_image_url: null`.
5. `listPersonnelAction` uses `requirePersonnelReader`; no write action reuses that reader.
6. `personnel-actions.ts` imports `server-only` and introduces no concrete Supabase type.
7. `auth-guards.ts` and `server-actions.ts` unmodified relative to baseline.

### 5.5 UI wiring (small)

`page.tsx` calls `listPersonnelAction()`, passes the result plus `onSubmit`/`onToggleStatus` into
`PersonnelDirectoryView`, drops `isPreviewData`, and **deletes `preview-fixture.ts`**. Remove the
preview-notice block from the view. Refresh after mutation by re-fetching, following
`DeveloperAccountManagementView`'s `submitAndRefresh` pattern — **`revalidatePath` is used nowhere in
this repo; do not introduce it.**

---

## 6. Frozen / pinned — must not change

| File | Pin |
|---|---|
| `src/lib/auth-guards.ts` | **Byte-frozen**, exact equality vs the `feat(6B): authentication foundation` commit — `verify-checkpoint-m6c.ts:346-357`. New guards go in a new file. |
| `src/repositories/interfaces/index.ts` | `IPersonnelRepository` **shape-pinned** — M6C `verifyRenamedContractsOnly`. Adding or renaming a method fails the gate. |
| `src/repositories/supabase-personnel-repository.ts` | B4 pins the `server-only` import, `implements IPersonnelRepository`, `findAllActive`'s `.eq("is_active", true)`, and no concrete Supabase types. |
| `src/features/server-boundary/server-actions.ts` | B5 pins internal function ordering. Do not add personnel actions here. |
| `supabase/migrations/**` | M6A shape + SHA pins. P2 touches none of it. |
| `src/lib/password.ts`, `username.ts`, `first-login-gate.ts`, `session.ts` | Byte-frozen (M6C). |
| `src/features/auth/authActions.ts`, `src/lib/login-rate-limit.ts` | SHA-256 pinned (M6C). |
| `Project.md` / `PROJECT.md`, `architecture/**` | Never modified by the implementer. |

**Never weaken or edit an existing verifier assertion to make a candidate pass.** If correct code
conflicts with a verifier's assumption, **stop and report** the conflict.

---

## 7. Domain invariants the backend must enforce

1. **MedTech signature is always `null`.** Enforced server-side on every write, independently of the
   render path's existing Pathologist-only guard. Includes the reclassification case: if an update
   results in `role === "MedicalTechnologist"`, explicitly pass `signatureImageUrl: null` to clear any
   image left behind by a Pathologist→MedTech change.
2. **Pathologist signature is preserved across edits.** For a Pathologist update, **omit the
   `signatureImageUrl` key entirely** so `toPersonnelUpdateRow`'s `!== undefined` check leaves the
   stored URL intact. Never write `null` over an existing Pathologist signature during an ordinary
   detail edit.
3. **No hard delete, anywhere.** Retirement is `is_active = false` only. Structurally guaranteed too:
   `report_signatories.personnel_id UUID NOT NULL REFERENCES personnel(id)` has no `ON DELETE` clause,
   so Postgres blocks deletion of anyone who has ever signed. `IPersonnelRepository` correctly exposes
   no `delete` — do not add one.
4. **Existing UUIDs are immutable.** `id` is never inside an update payload; `create` always allocates a
   fresh `gen_random_uuid()`; no client ever supplies an id on create.
5. **Inactive exclusion is untouched.** `findAllActive()`'s `.eq("is_active", true)` feeds the workspace
   signatory dropdowns and stays exactly as is. `listPersonnelAction` is a **separate directory read**
   that intentionally includes inactive rows — it must **never** be substituted into the workspace path.
   `SignatorySelectionSection` additionally filters `p.isActive` client-side; leave that in place.
6. **Historical signatories are untouchable.** No P2 write reaches `report_signatories` or
   `completed_snapshot`. Signatory identity is frozen twice — relational snapshot rows carrying
   `printed_full_name` / `printed_credentials` / `printed_prc_license_number` / `signature_image_url`,
   plus a deep-frozen JSONB copy. Editing a personnel record must not alter any completed report.
7. **Zero coupling to `user_profiles`.** No FK, no join, no shared identity. A personnel record never
   grants login (ADR-005).
8. **Server boundary discipline.** `"use server"` + `import "server-only"`; `input: unknown`; guard
   before parse; `.strict()` schemas; no concrete Supabase type outside the repository; no DB credential
   reachable from the browser.

---

## 8. `PersonnelCredential` audit requirements

`PersonnelCredential` is already in the `AuditCategory` union (`src/services/audit-service.ts:9`) and in
`AUDIT_CATEGORIES`, with **zero writers today**. `Project.md:606` lists this writer as outstanding —
**P2 closes it.** Mandated events per `SECURITY_MODEL.md` §10.1(2): personnel record creation or
modification, PRC licence number updates, and signature asset uploads (upload itself is deferred).

| Event | `eventType` | `details` |
|---|---|---|
| Create | `PersonnelRecordCreated` | `personnelId`, `personnelRole`, `isActive` |
| Update | `PersonnelRecordUpdated` | `personnelId`, `personnelRole`, `changedFields: string[]` — include `prcLicenseNumber` when it changed |
| Toggle | `PersonnelStatusToggled` | `personnelId`, `personnelRole`, `isActive` |
| Denial | `PersonnelDirectoryAccessDenied` (category `SecurityDenial`) | `reasonCode` |

**`targetRole` must be `null` on every personnel event.** It is typed `AuthRole | null`, and a personnel
classification is **not** an authentication role (ADR-005). Put the personnel role in
`details.personnelRole`. `targetReference` may carry the printed full name.

No credential material in `details` — the audit service's `SENSITIVE_DETAIL_KEY` guard rejects keys
matching `pass|answer|hash|secret|token|cookie` and will throw.

**Known residual (do not try to fix here):** audit writes are not atomic with the operation they record —
a project-wide accepted residual to be addressed across all writers at once (`Project.md:606`).
`IAuditLogRepository.append` throws; follow the session-lifecycle writers in `server-actions.ts` and let
it propagate rather than swallowing it.

---

## 9. Duplicate PRC licence handling

`prc_license_number` is `UNIQUE` **across both roles**, so a collision surfaces as a raw Postgres
`23505`. Next.js also **redacts server-action error messages in production builds**, so an unmapped
error reaches the Admin as a generic failure.

Map `23505` on `personnel` to a clear field-level message (e.g. *"That PRC licence number is already
registered."*) in the action, and surface it in the form via
`setError("prcLicenseNumber", { type: "manual", message })` — the precedent is
`src/features/users/components/UserForm.tsx:94-101`. Do not swallow other Postgres error codes.

---

## 10. Gates, mutations, reviewer

**Deterministic suite — direct `node` only.** Never `npm`/`npx`: the PowerShell execution policy blocks
their shims.

```
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next lint
node node_modules/next/dist/bin/next build
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-personnel-directory.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-checkpoint-b4.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-checkpoint-b5.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-checkpoint-m6a.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-checkpoint-m6c.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-checkpoint-m6d.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-developer-boundary.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-admin-invariants.ts
```

`--conditions=react-server` is required or the verifiers fail on the `server-only` import.
M6C is non-negotiable — it catches an accidental edit to `auth-guards.ts` or `IPersonnelRepository`.

**Build note:** there is **no `.env` file in the repo**, so a bare `next build` fails during page-data
collection on the pre-existing `/api/users/summary` route with
`Missing required server environment variable SUPABASE_SECRET_KEY`. This is environmental, not a code
defect. Build with the placeholder values `src/lib/supabase/client.ts` already defines
(`https://placeholder-project.supabase.co` / `placeholder-anon-key` / a placeholder secret), and **never
create a `.env` file or use a real credential** to get a green build.

**Mutation proofs (Level C)** — against the candidate tree, restored only from a byte-verified backup
kept outside the repo. Never `git checkout --`. Anchors must be line-ending independent (this working
copy is CRLF); on anchor failure, fail closed.

| # | Invariant | Mutation | Assertion that must fire |
|---|---|---|---|
| 1 | Admin-only writes | swap `requirePersonnelAdmin()` for `requirePersonnelReader()` in `updatePersonnelAction` | "every personnel write action authorizes an Admin caller before mutating" |
| 2 | MedTech carries no signature | remove the `signatureImageUrl: null` clearing on a MedTech write | "MedicalTechnologist personnel can never carry a signature image" |
| 3 | No hard delete | add a `.delete()` against `personnel` in `personnel-actions.ts` | "personnel actions expose no hard-delete path" |
| 4 | Inactive exclusion intact | point `listActivePersonnelAction`'s repository call at `findAll()` | B4's "findAllActive filters is_active = true" |

Record per mutation: the invariant, the intended assertion, the assertion that **actually** fired (full
stderr captured on first execution), and the restore hash. **If the wrong assertion fires it is not
proof** — isolate and rerun.

**Independent review: a fresh read-only Codex Reviewer is MANDATORY.** The slice creates an
authorization boundary and touches Developer isolation. Claude supplies the bounded diff packet —
implementer must not skip this or self-review.

**Live acceptance:** before any live write, enumerate every field the post-write check asserts and
capture a baseline for **each one** — including `updated_at`, which the trigger moves on every update.
Never assert "unchanged" on a field that was not captured.

---

## 11. Deferred — explicitly NOT in P2

- **Signature upload and all storage work.** The `personnel-signatures` bucket is created by no
  migration and cannot be verified from the repo; it needs a manual dashboard check first.
- **Signature access-token security.** `securityService.generateSignatureAccessToken` mints an
  **unsigned, forgeable** `base64url(path:expiry)` token (`security-service.ts:70-73`), and
  `/api/signatures/proxy` verifies no session and uses the **anon** client. It is currently dead code
  with no callers, so nothing exploits it today — but building upload on top would make it live.
  Recommend folding HMAC signing + a session check into the signature slice. **Do not touch in P2.**
- **`DATABASE_DESIGN.md` is stale** — §4.2.1 documents `full_name` and a `status` string, §4.4.4
  documents `role_as_signatory`, `ON DELETE RESTRICT`, and `uq_report_personnel`. None exist; the
  migrations are authoritative. Doc correction is a separate authorized slice.
- Seeding personnel rows · `Project.md` sync · commit · push.

---

## 12. Stop conditions

Stop and report — do not widen scope — if any of these occur:

- The work appears to need a migration, DDL, or any production SQL.
- A frozen or pinned file would have to change.
- A verifier assertion would have to be weakened, edited, or evaded.
- Repository authority conflicts with this handoff, or documentation and implementation disagree.
- Correction rounds are exhausted (**2 per slice**; re-slicing to win a fresh budget is a hard stop).
- The working tree is dirty at freeze time.

Leave everything in the working tree. **No commit, no push.**
