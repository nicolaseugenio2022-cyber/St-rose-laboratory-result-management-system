# Personnel Directory — P3: Signature Management (Implementation Handoff)

**Repository:** `C:\Projects\St-rose-laboratory-result-management-system`
**Published baseline:** `236481b55a138c7a99c982baddbaf26e2320bc0b`
**Supabase project:** `ruxsmcypeisbkotibzfs`
**Executor:** OpenCode / Big Pickle · **Reasoning effort:** `xhigh` (credential handling, storage security, security boundary)

> **The implementer never applies production SQL and never touches Supabase configuration.** No migration,
> no DDL, no bucket creation, no bucket policy change. P3 requires **no schema change at all** — see §2.
> If work appears to need one, **stop and report**.

---

## 1. Baseline / preflight

Verified at plan time:

| Check | Value |
|---|---|
| Local HEAD | `236481b55a138c7a99c982baddbaf26e2320bc0b` |
| `origin/main` | `236481b55a138c7a99c982baddbaf26e2320bc0b` |
| Ahead / behind | `0 / 0` |
| Working tree | Clean, including untracked |

Re-confirm at freeze time. A dirty tree or a different baseline is a **hard stop**.

Prior slices already published: P1 (UI shell) and P2 (Admin-only write boundary, live-accepted).

---

## 2. Verified repository facts

Established by direct inspection at `236481b`. Do not re-derive.

**Schema — no change required.**

- `personnel.signature_image_url TEXT` (nullable) already exists — `supabase/migrations/02_tables.sql:27-39`.
- `report_signatories.signature_image_url TEXT` already exists as part of the frozen snapshot row — `02_tables.sql:140-151`.
- `IPersonnelRepository.update(id, Partial<IPersonnel>)` already carries `signatureImageUrl`, and
  `toPersonnelUpdateRow` assigns only keys that are `!== undefined`. **No repository or interface change
  is needed or permitted** — the interface is shape-pinned by M6C.

**Rendering consumes the column as an image source, browser-side, in both paths.**

- Preview: an `img` element whose `src` is `primitive.source` — `src/rendering/native/NativeReportPreview.tsx:44-55`.
- PDF: `browserNativePdfAssetResolver` calls `fetch(source)` — `src/rendering/native/native-pdf-exporter.ts:170-181`.
- Both are **same-origin browser requests, so the session cookie is transmitted automatically.**
  This is the single most important fact in this handoff: it is what makes a custom token unnecessary.
- `sanitizeOptionalSignatureSource` (`src/rendering/model/render-model-adapters.ts:106-116`) accepts
  root-relative paths (leading `/`, but not `//`) and `http:`/`https:` only; it rejects control characters.
  Only the Pathologist slot resolves an image at all (`:132-134`).

**Pinned rendering behaviour (C1, `scripts/verify-checkpoint-c1.ts:272-283`)** — must not regress:

- missing signature resolves to `signatureAsset === null` with textual pathologist data retained;
- a `javascript:` source resolves to `null`;
- a root-relative `/missing-signature.png` resolves to a real signature asset carrying `failurePolicy: "OmitImage"`.
  **A root-relative proxy URL is therefore already proven compatible with pinned rendering.**

**The custom token is dead code.**

- `securityService.generateSignatureAccessToken` (`src/services/security-service.ts:70-73`) has
  **zero callers** — its only occurrence across `src/` and `scripts/` is its own definition.
- It mints an **unsigned, forgeable** base64url of `path:expiry`; anyone can construct a valid-looking
  `path:futureTimestamp` pair.
- `src/app/api/signatures/proxy/route.ts` **verifies no session**, uses the **anon** client
  (`getSupabaseClient()`), and falls back to a 1x1 transparent PNG when Supabase is unconfigured.
- **No verifier references `security-service.ts`, `generateSignatureAccessToken`, `signatures/proxy`, or
  the token encoding.** The token and the proxy are entirely unpinned, so both may be changed freely.
- The proxy is the only *signature-path* consumer of `src/lib/supabase/client.ts`. **That module is NOT unused** — `src/repositories/supabase-auto-suggestion-repository.ts:2` imports it via a relative path, which an earlier `@/`-prefixed grep missed. Corrected 2026-08-19.

**Authority already settles format and limits** — `architecture/PRODUCTION_DEPLOYMENT_ARCHITECTURE.md` §5.1:
bucket `personnel-signatures`, Public `FALSE`, allowed MIME `image/png`, max size `2 MB`.
PNG-only is a pre-existing product requirement (`SECURITY_MODEL.md` §9 and §10.1).
**Do not introduce other formats.**

**Authenticated-proxy delivery is explicitly permitted by authority.** `SECURITY_MODEL.md` §9 states that
assets are served exclusively via authenticated API proxy handlers **or** short-lived token-gated URLs.
The `PRODUCTION_DEPLOYMENT_ARCHITECTURE.md` §5.2 diagram already depicts session verification through
`validateActiveUser`.

**Audit infrastructure is ready.** `PersonnelCredential` is already in the `AuditCategory` union
(`src/services/audit-service.ts:9`); `audit_logs.category` and `event_type` are plain `TEXT` with no CHECK
constraint. P2 already writes `PersonnelRecordCreated`, `PersonnelRecordUpdated`, and
`PersonnelStatusToggled`. **No migration is needed for new event types.**

**P2 guards to reuse, not rebuild** — `src/lib/personnel-guard.ts`:
`requirePersonnelAdmin()` (strict `role === "Admin"`) and `requirePersonnelReader()` (Admin or Developer),
both emitting `SecurityDenial` / `PersonnelDirectoryAccessDenied` with a reason code before refusing.

**Report-visibility precedent** — `requireOperationalCaller()`
(`src/features/server-boundary/server-actions.ts:37-86`) admits **Admin and User** and denies Developer.
That is the correct authorization rule for reading a signature asset, matching ADR-006 report visibility.

---

## 3. Live Supabase bucket preflight — CONFIRMED (after correction)

**Repository evidence cannot prove the live bucket exists or is private.** There is no `createBucket` call,
no storage SQL, and no migration anywhere in the repository. The bucket name appears only as the constant
`STORAGE_BUCKETS.PERSONNEL_SIGNATURES` (`src/lib/constants.ts:35`), inside the proxy route, and in
documentation prose. These five properties are therefore verifiable only against the live project.

**Preflight history — the first confirmation was inaccurate, and that is recorded deliberately.**
An initial round reported all five checks as confirmed. Live acceptance then failed at the first upload with
`Bucket not found`, and a read-only probe showed **zero buckets** in `ruxsmcypeisbkotibzfs`. The bucket was
created manually by the operator. A second verification found `allowed_mime_types` still `null` rather than
`image/png`; that restriction was then corrected manually. Only after both corrections did all five verify.

**Status: all five verified live on 2026-08-19, after the corrections above.**

| # | Check | Verified value |
|---|---|---|
| 1 | Bucket `personnel-signatures` exists | present |
| 2 | Public = false | `public: false` |
| 3 | Allowed MIME types = `image/png` | `["image/png"]` |
| 4 | File size limit = 2 MB | `2097152` |
| 5 | No anon/authenticated direct read | anon download denied; public URL 400 |

Check 5 was proven against a **real uploaded object** with a positive control: the service credential
downloaded it successfully while the anon credential was denied. An empty-list result alone is not evidence,
because storage RLS filters rows rather than erroring.

**Big Pickle must never create, alter, or configure the bucket.** Provisioning and reconfiguration remain
operator actions. If any property is later observed to differ, that is a **stop and report** condition.

---

## 4. Exact file scope

**Create**

| File | Purpose |
|---|---|
| `src/lib/signature-storage.ts` | `server-only`. PNG magic-byte validation, 2 MB cap, server-generated object path, upload via `supabaseServer.storage`. No client-reachable export. |
| `src/features/server-boundary/personnel-signature-actions.ts` | `"use server"` plus `server-only`. Exposes `uploadPersonnelSignatureAction` and `removePersonnelSignatureAction`. |
| `src/features/personnel/components/PersonnelSignatureField.tsx` | Replaces the disabled placeholder; rendered for Pathologist only. |
| `scripts/verify-personnel-signatures.ts` | New verifier (assertions in §11, mutations in §12). |

**Modify**

| File | Change |
|---|---|
| `src/app/api/signatures/proxy/route.ts` | Session-authenticated rewrite (§7). Remove the token branch, the anon client, and the 1x1 PNG fallback. |
| `src/services/security-service.ts` | **Delete** `generateSignatureAccessToken` (dead, forgeable, unpinned). Leave the rest of the class untouched. |
| `src/features/personnel/components/PersonnelForm.tsx` | Swap the disabled placeholder for `PersonnelSignatureField`, still gated on the Pathologist role watch. |
| `src/lib/validations/personnelValidation.ts` | Add signature action schemas. **`signatureImageUrl` must remain absent from `createPersonnelSchema` and `updatePersonnelSchema`.** |

**Explicitly NOT modified**

- `architecture/PRODUCTION_DEPLOYMENT_ARCHITECTURE.md` — see §15. Its §5.2 token wording conflict is
  recorded for post-acceptance documentation sync and must **not** be edited during implementation.
- `src/lib/supabase/client.ts` — **leave it in place.** It retains a consumer
  (`src/repositories/supabase-auto-suggestion-repository.ts`), so it is not dead code, and removing it is out
  of scope regardless. An earlier revision of this handoff wrongly described it as unused.

---

## 5. Frozen / pinned files — must not change

| File | Pin |
|---|---|
| `src/lib/auth-guards.ts` | Byte-frozen against the Milestone 6B commit — `verify-checkpoint-m6c.ts:346-357`. Also hash-pinned to `5eac3f7` by `verify-personnel-directory.ts`. |
| `src/features/server-boundary/server-actions.ts` | B5 function-ordering pin, plus the `5eac3f7` hash pin in `verify-personnel-directory.ts`. New actions go in their own module. |
| `src/repositories/interfaces/index.ts` | `IPersonnelRepository` shape-pinned (M6C). |
| `src/repositories/supabase-personnel-repository.ts` | B4 pins the `server-only` import, the `implements IPersonnelRepository` clause, `findAllActive`'s `is_active` filter, and the absence of concrete Supabase types. |
| `src/lib/password.ts`, `username.ts`, `first-login-gate.ts`, `session.ts` | Byte-frozen (M6C). |
| `src/features/auth/authActions.ts`, `src/lib/login-rate-limit.ts` | SHA-256 pinned (M6C). |
| `supabase/migrations/**` | M6A shape and SHA pins. P3 touches none of it. |
| `Project.md` / `PROJECT.md` | Never modified by the implementer. |

Both hash-pinned files are unchanged at `236481b`, so the `5eac3f7` pins remain valid. **If P3 appears to
require touching either, stop and report.** Never weaken, edit, or evade an existing verifier assertion.

---

## 6. Upload / replace / remove contracts

| Concern | Decision |
|---|---|
| **Format** | **PNG only.** Validate the magic bytes `89 50 4E 47 0D 0A 1A 0A` server-side. **Never trust the client-supplied MIME type or file extension.** |
| **Max size** | **2 MB** (`2 * 1024 * 1024` bytes), enforced server-side before upload. |
| **Object path** | **Server-generated and immutable**: `personnel/<personnelUuid>/<objectUuid>.png`, where `<personnelUuid>` is the target personnel id and `<objectUuid>` is a fresh `crypto.randomUUID()`. The client never supplies a path, filename, URL, or any component of them. |
| **Stored value** | `personnel.signature_image_url` is set to `/api/signatures/proxy?path=<objectPath>` — root-relative, passes the C1-pinned sanitizer, and requires **zero** rendering changes. |
| **Upload** | Permitted only when the target personnel exists **and** `role === "Pathologist"`. |
| **Replace** | **Always writes a NEW `<objectUuid>`. Never overwrite an existing object, and never reuse a path.** This is the mechanism that keeps historical snapshots resolving the original image. |
| **Remove** | Sets `personnel.signature_image_url = NULL` **only**. **The storage object is retained**, because frozen report snapshots may still reference it. |
| **Ordering / rollback** | Storage upload **first**, database update **second**. A storage failure leaves no database change. A database failure leaves an orphaned object and no database change. **The database must never point at an object that does not exist.** |
| **Orphans** | **Never deleted in P3.** Retention is the safe default; garbage collection risks breaking frozen reports and is out of scope. Record as an accepted residual. |
| **Ordinary edits** | `updatePersonnelAction` must continue to omit `signatureImageUrl` for a Pathologist, preserving the stored value, and continue to force `null` for a Medical Technologist including on reclassification. **P2 behaviour must not regress.** |

---

## 7. Proxy / access design

**No custom token. No HMAC.** Repository inspection proves an authenticated same-origin private proxy is
sufficient: both consumers are browser same-origin requests that carry the session cookie automatically
(§2), and `SECURITY_MODEL.md` §9 explicitly permits authenticated proxy handlers. Building a MAC would add
a second secret and a second failure mode for no security gain.

Rewrite `src/app/api/signatures/proxy/route.ts` as follows.

1. **Authenticate.** Resolve the session. Require an **Active** profile whose role is **`Admin` or `User`**,
   mirroring `requireOperationalCaller`. Developer and anonymous callers are denied. Enforce the
   first-login gate.
2. **Validate the path shape strictly.** Accept only paths matching
   `^personnel/<uuid>/<uuid>\.png$`, where `<uuid>` is the strict canonical lowercase form
   `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`.
   Reject everything else outright — no traversal, no nesting, no alternative extension, no uppercase.
3. **Authorize the object.** The requested path **must be referenced by** either the current
   `personnel.signature_image_url` **or** a frozen `report_signatories.signature_image_url`.
   A path that is well-formed but unreferenced is refused. **This is the control that defeats bucket
   enumeration by an otherwise-legitimate authenticated user, and it is what the forgeable MAC was only
   pretending to provide.** Both lookups are required: current personnel covers live signatures, and
   `report_signatories` covers superseded objects that historical reports still need.
4. **Serve.** Download through `supabaseServer` (the server-only secret credential) and stream the bytes
   with `Content-Type: image/png` and `Cache-Control: private, max-age=300`.
5. **Deny cleanly.** Emit `SecurityDenial` / `SignatureAssetAccessDenied` with a reason code —
   `unauthenticated`, `first_login_incomplete`, `account_inactive`, `role_not_authorized`,
   `malformed_path`, or `path_not_referenced`. Return 403 for authorization failures and 404 for a missing
   object. **Remove the 1x1 transparent-PNG fallback**, which masks misconfiguration as success.

The server-only secret credential must never reach the browser, a `NEXT_PUBLIC_*` variable, application
logs, or a committed file.

---

## 8. Audit requirements

Category **`PersonnelCredential`**, following the P2 writers exactly.

| Event | `eventType` | `details` |
|---|---|---|
| First upload | `PersonnelSignatureUploaded` | `personnelId`, `personnelRole`, `objectPath` |
| Replacement | `PersonnelSignatureReplaced` | `personnelId`, `personnelRole`, `objectPath`, `previousObjectPath` |
| Removal | `PersonnelSignatureRemoved` | `personnelId`, `personnelRole`, `previousObjectPath` |

- **`target_role` must be `null` on every personnel event** — it is typed `AuthRole | null`, and a personnel
  classification is not an authentication role (ADR-005). The classification belongs in `details.personnelRole`.
- `targetReference` carries the printed full name.
- **Never place file bytes, base64 content, or credential material in `details`.** The audit service's
  `SENSITIVE_DETAIL_KEY` guard rejects credential-shaped keys and will throw.
- Denials use category `SecurityDenial` — `PersonnelDirectoryAccessDenied` for the write boundary,
  `SignatureAssetAccessDenied` for the proxy.
- This satisfies `SECURITY_MODEL.md` §10.1(2), which mandates auditing Pathologist PNG signature asset
  uploads and replacements.
- Audit writes remain non-atomic with the mutation they record — the existing accepted project-wide
  residual. Do not attempt to fix it here.

---

## 9. Historical-report invariants

1. **Immutable object paths plus never-overwrite** means changing a personnel signature later cannot alter
   any completed report. A superseded object remains in storage and remains reachable through the proxy
   because `report_signatories` still references it.
2. **No P3 write touches `report_signatories` or `patient_report_sessions.completed_snapshot`.** Signatory
   identity is frozen twice — relational snapshot rows and a deep-frozen JSONB copy.
3. **Removal clears only the current personnel pointer.** Frozen snapshots keep their own
   `signature_image_url` value and continue to render.
4. Report rendering keeps its Pathologist-only signature rule and its `OmitImage` degradation policy.

---

## 10. Validation / security invariants

1. **Admin-only** upload, replace, and remove, via `requirePersonnelAdmin()`. Developer stays read-only.
2. **A Medical Technologist can never carry a signature.** Reject server-side, not merely by hiding UI.
3. **The client never supplies a storage path, object name, or `signatureImageUrl`.** These fields stay
   absent from every client-facing schema; the path is generated server-side.
4. **PNG verified by magic bytes**, never by MIME or extension. **2 MB** cap enforced server-side.
5. **Private storage only.** Never generate or return a public URL or a Supabase signed URL.
6. **Proxy access is session-authorized and reference-checked** (§7).
7. Ordinary Pathologist edits preserve an existing non-null signature; MedTech writes force `null`.
8. **No hard delete of personnel**, and no deletion of storage objects.
9. **No coupling between `personnel` and `user_profiles`** — zero foreign keys, no joins, no shared identity.
10. Server-boundary discipline: `"use server"` plus `import "server-only"`, parameters typed `unknown`,
    guard **before** parse, `.strict()` schemas, and no concrete Supabase type outside the repository or
    the storage helper.

---

## 11. Deterministic gates

The implementer runs every gate. Use direct `node` invocations only — the PowerShell execution policy
blocks the `npm` and `npx` shims.

```
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next lint
node node_modules/next/dist/bin/next build
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-personnel-signatures.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-personnel-directory.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-checkpoint-c1.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-checkpoint-m6a.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-checkpoint-m6c.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-checkpoint-m6d.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-checkpoint-b5.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-developer-boundary.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-admin-invariants.ts
node node_modules/tsx/dist/cli.mjs scripts/verify-checkpoint-b4.ts
```

`--conditions=react-server` is required, or the verifiers fail on the `server-only` import.

**`verify-checkpoint-b4.ts` is the one exception and must run WITHOUT that flag**, because it imports
`react-dom/server`, which the `react-server` condition forbids. This quirk is **pre-existing at baseline
`236481b`** — it reproduces on a clean checkout — and **must NOT be fixed in P3.** Run it as shown above
and move on.

`verify-checkpoint-c1.ts` is mandatory here because it pins signature degradation behaviour.

New assertions required in `scripts/verify-personnel-signatures.ts`, at minimum:

1. Every signature write action calls `requirePersonnelAdmin()` **before** any storage or repository call.
2. Upload rejects any role other than `Pathologist`.
3. The object path is server-generated; no client-supplied path or filename reaches storage.
4. Replacement never reuses or overwrites a path — a fresh `randomUUID()` is generated per upload.
5. No storage `.remove(` or `.delete(` call exists in the signature modules.
6. The proxy authenticates the session and restricts to `Admin` or `User` before any storage access.
7. The proxy enforces the strict UUID path pattern and the reference check.
8. `generateSignatureAccessToken` no longer exists anywhere in `src/`.
9. `signatureImageUrl` is absent from `createPersonnelSchema` and `updatePersonnelSchema`.
10. `auth-guards.ts` and `server-actions.ts` still match their `5eac3f7` baseline hashes.

Assertions must be genuinely falsifiable. An assertion that cannot fail is not evidence.

---

## 12. Mutation proofs

Required — these are new security-critical assertions. One representative mutation per invariant, run
against the candidate tree.

| # | Invariant | Mutation | Assertion that must fire |
|---|---|---|---|
| 1 | Admin-only signature writes | swap `requirePersonnelAdmin()` for `requirePersonnelReader()` in the upload action | admin-authorization assertion |
| 2 | MedTech never carries a signature | remove the Pathologist role check in the upload action | MedTech-signature-prohibited assertion |
| 3 | Server-generated path | accept a client-supplied path or filename | server-generated-path assertion |
| 4 | Replacement immutability | reuse the existing object path instead of a fresh UUID | never-overwrite assertion |
| 5 | Proxy authentication | remove the session and role check from the proxy | proxy-authentication assertion |
| 6 | Proxy reference check | accept any well-formed path without the reference lookup | path-not-referenced assertion |

Rules: restore **only** from a byte-verified backup kept **outside the repository** — never use
`git checkout --`. Anchor matching must be line-ending independent, since this working copy is CRLF; on
anchor failure, **fail closed**. Capture full stderr on the first execution and record, for every mutation,
the invariant tested, the intended assertion, the assertion that **actually** fired, and the restore hash.
**If the wrong assertion fires, the mutation is not proof** — isolate it and rerun.

---

## 13. Independent review

**A fresh read-only independent reviewer is MANDATORY.** P3 touches credential and secret handling,
storage security, an authorization boundary, and a security-relevant route rewrite.

**Environment note:** the Codex CLI is **not installed** on this machine — only `opencode` is present in the
global npm bin, and `~/.codex` holds configuration belonging to a different tool. The reviewer must
therefore be arranged deliberately; do not assume `codex exec` is available. If a mandatory reviewer
cannot run after correct stdin handling and verified environment diagnosis, report
**INDEPENDENT REVIEW PENDING**. The requirement stays open until a healthy reviewer completes, or the
operator explicitly waives it having seen the residual risk.

The review packet must include: the frozen contract and invariants; the full proxy rewrite; the upload,
replace, and remove paths; the storage helper; every new verifier assertion together with the guard that
gives it meaning; the `personnel-guard.ts` and `personnel-actions.ts` same-layer precedents; and the
verification summary.

---

## 14. Live acceptance scenarios

Run against a **production build** (`next build` followed by `next start`), not a development server, so
that Server Action semantics match deployment.

Before any live mutation, capture the complete baseline for every affected record — `id`, names,
credentials, PRC licence number, role, `signature_image_url`, `is_active`, `created_at`, and
**`updated_at`** — plus audit counts. Never assert that a field is unchanged if it was not captured.

1. Admin uploads a valid PNG to a Pathologist; `signature_image_url` is set to the proxy URL and the object
   is present in storage.
2. Non-PNG content is rejected, including a file renamed to `.png` and sent with a false MIME type.
3. A file larger than 2 MB is rejected.
4. **A MedTech upload is rejected server-side**, not merely hidden in the UI.
5. Replacement produces a **new** object path, and **the previous object remains downloadable**.
6. Removal nulls the column while **the storage object is retained**.
7. The proxy serves Admin and User, and **denies Developer and anonymous** callers.
8. The proxy rejects a malformed path, a traversal attempt, and a well-formed but **unreferenced** path.
9. **Complete a report, then change that Pathologist's signature, and prove the completed report still
   renders the original image.** Verify `report_signatories` and `completed_snapshot` are byte-identical by
   SHA-256 before and after.
10. An ordinary Pathologist detail edit **preserves** the existing signature. This closes the P2 residual
    recording that non-null signature preservation had never been live-tested.
11. The expected `PersonnelCredential` and `SecurityDenial` audit events are observed, with
    `target_role: null`.

Do not hard-delete personnel. Clearly identify any acceptance records created and state whether they are
retained or retired; park acceptance personnel **inactive** so they cannot reach clinical signatory selection.

---

## 15. Out of scope

- **Creating or configuring the storage bucket** — operator action, see §3.
- Migrations, DDL, SQL, or any Supabase configuration change.
- **Editing `architecture/PRODUCTION_DEPLOYMENT_ARCHITECTURE.md`.** Its §5.2 bullet, which states that
  assets are delivered exclusively through token-gated proxy endpoints of the form
  `/api/signatures/proxy?path=...&token=...`, contradicts both its own §5.2 diagram (which depicts session
  verification) and the design in this handoff. **Record the conflict for a post-acceptance documentation
  sync; do not edit the file during implementation.**
- **Fixing the `verify-checkpoint-b4.ts` invocation quirk** described in §11 — pre-existing, unrelated, and
  explicitly deferred.
- Deleting `src/lib/supabase/client.ts` — it still has a consumer and is not unused.
- Orphaned-object garbage collection.
- Signatures for Medical Technologists, or on any non-Pathologist slot, ever.
- Re-rendering, back-filling, or migrating historical reports.
- The P2 residual in which `middle_initial` SQL `NULL` normalizes to an empty string.
- Audit-write atomicity, which is an accepted project-wide residual.
- `Project.md` synchronization, commits, and pushes.

---

## 16. Stop conditions

Stop and report — do not widen scope, and do not improvise — if any of the following occur.

- Any of the five live bucket preflight checks in §3 fails or cannot be confirmed.
- The work appears to require a migration, DDL, or any production SQL.
- A frozen or pinned file listed in §5 would have to change.
- A verifier assertion would have to be weakened, edited, or evaded to make the candidate pass.
- Repository authority conflicts with this handoff, or documentation and implementation disagree beyond
  the already-recorded §5.2 wording conflict.
- Evidence emerges that a custom token genuinely **is** required, contradicting §2 and §7.
- The mandatory independent reviewer cannot run.
- The working tree is dirty at freeze time, or the baseline is not `236481b`.
- Correction rounds are exhausted — **two per slice**; re-slicing to obtain a fresh correction budget is a
  hard stop.

Leave everything in the working tree. **No commit, no push. No Supabase changes.**
