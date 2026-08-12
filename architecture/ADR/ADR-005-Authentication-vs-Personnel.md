# ADR-005: Authentication Identity vs Personnel Classification

## Status

Accepted

## Context

The system has two concepts that are easily conflated: who may log in, and whose name is printed on a laboratory report. Conflating them would let a login account imply signatory authority, or require a medical professional to hold a system account merely to appear on a report.

## Decision

Authentication and personnel are strictly separate.

**Authentication roles** (`user_profiles`): `Admin`, `User`, `Developer`. Identity is a unique username. Passwords and security-question answers are application-owned and stored only as salted one-way scrypt hashes with independent salts and constant-time verification. No email or phone identifier is collected. Recovery is username and security-question based.

**Personnel classifications** (`personnel`): `Pathologist`, `MedicalTechnologist`. These are PRC-licensed medical professionals whose identities appear on report outputs.

- `user_profiles` and `personnel` carry zero foreign keys between them.
- A personnel record never grants login capability.
- An authentication identity never confers signatory authority.
- Pathologist and Medical Technologist are never authentication roles.
- A Pathologist signature image is optional; Medical Technologists are textual only.

**Username identity.** Usernames are canonicalized (NFKC normalization, outer-whitespace trim, locale-independent lowercasing) before storage and before every lookup, restricted to `a–z`, `0–9`, and the separators `.`, `_`, `-`, and unique on the canonical value. Logically duplicate accounts such as `Admin` and `admin` cannot coexist.

**Trust boundary.** Authentication is verified server-side on every protected operation. Protected application data is accessed only from server code; browser clients hold no database credentials or privileges. Authorization for Admin, User, and Developer is enforced at the server boundary. Database grants and row-level policies serve as defense against direct unauthorized access, not as the per-user authorization mechanism, because `auth.uid()` is unavailable under application-owned authentication.

**Developer least privilege.** Developer exists for technical monitoring and maintenance: system health, database health and status, diagnostics, and audit or technical information. It holds no user-management writes, no Personnel Directory writes, no routine patient or report operational access, and no routine Completed History access. Developer may read a restricted directory projection limited to `username`, `role`, and `status`, served through an authenticated server endpoint.

**Credential provenance.** Prototype credentials that existed before this decision are treated as permanently compromised and are never carried forward. Accounts are provisioned with fresh temporary credentials supplied outside source control, requiring password change and recovery setup at first login.

## Consequences

- The Personnel Directory is Admin-managed master data, independent of account management.
- Deactivating a login account does not remove a signatory from completed reports.
- Completed reports freeze signatory identity at completion, so later personnel edits never alter historical output.
- Two directories must be maintained, which is the accepted cost of the separation.
- Privileged database credentials exist only on the server and must never reach the browser.
- The first Developer account on a fresh database is created by a one-time operator bootstrap procedure, not by application functionality, preserving the rule that Admin cannot grant Developer.

## Related

`SECURITY_MODEL.md` §3.1 (Invariants 2, 3, 6, 8), §5, §6.1, §6.4, §6.5, §7, §8.0;
`DATABASE_DESIGN.md` §4.1.1, §4.1.4, §4.1.5, §4.2.1;
`Project.md` §Authentication and Personnel, §Data Access Boundary;
`ADR-006`.
