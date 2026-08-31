import type { User, UserRole, UserStatus } from "@/types/user";

/**
 * The only account shapes permitted to cross into client code.
 *
 * `User` fuses the directory facts an operator reads with the authentication lifecycle the server
 * uses to run sessions: `tokenVersion`, `mustChangePassword`, `mustSetRecovery`,
 * `passwordUpdatedAt`, `updatedAt`. None of that is rendered anywhere, and all of it was being
 * serialized - into the `/api/users` GET body, into every POST/PATCH response, and into the
 * password-reset action result. `tokenVersion` and `passwordUpdatedAt` in particular describe the
 * state of a credential, which is exactly the class of value SECURITY_MODEL.md §74 excludes from
 * every browser-reachable projection.
 *
 * Three shapes, because there are three genuinely different audiences - and the narrowest one is
 * the whole point of the slice rather than an afterthought.
 */

/**
 * What Admin reads on /users.
 *
 * `id` is present because Admin's row actions address a record by it. That is the justification,
 * and it is why the Developer shape below does not get one: an identifier a role can never act on
 * is an identifier that role has no reason to hold.
 */
export interface AdminAccountEntry {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

/**
 * What Developer reads on /users.
 *
 * Exactly the three fields ADR-005 and SECURITY_MODEL.md §6.4 name: **"a restricted directory
 * projection limited to `username`, `role`, and `status`"**. No `id`, and no `createdAt` - the
 * authorities enumerate three fields, and a projection that quietly carries a fourth is not the
 * projection they approved.
 *
 * Declaring it as its own type rather than a `Partial<AdminAccountEntry>` is deliberate: a
 * structural type with no optional members is what makes "this cannot carry an id" a compile-time
 * fact instead of a convention.
 */
export interface DeveloperDirectoryEntry {
  username: string;
  role: UserRole;
  status: UserStatus;
}

/**
 * What the separate Developer Accounts module reads.
 *
 * Scoped to the four fields its table and actions actually consume - `id` for the row actions,
 * `username`, `status`, and `createdAt` for display. It carries no `role`, because every record in
 * that module is a Developer and the column does not exist, and none of the lifecycle metadata,
 * because nothing there displays it. Developer Accounts keeps its authorized operations; it simply
 * stops receiving fields it never reads.
 */
export interface DeveloperAccountEntry {
  id: string;
  username: string;
  status: UserStatus;
  createdAt: string;
}

/**
 * The projections.
 *
 * Field by field, never a spread-and-delete. A spread would silently carry whatever field is added
 * to `User` next across the boundary, which is precisely the failure these exist to prevent - and
 * `User` is the type most likely to grow another lifecycle column.
 */

export function toAdminAccountEntry(user: User): AdminAccountEntry {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

export function toDeveloperDirectoryEntry(user: User): DeveloperDirectoryEntry {
  return {
    username: user.username,
    role: user.role,
    status: user.status,
  };
}

export function toDeveloperAccountEntry(user: User): DeveloperAccountEntry {
  return {
    id: user.id,
    username: user.username,
    status: user.status,
    createdAt: user.createdAt,
  };
}

/**
 * The /users directory as served to one caller.
 *
 * A discriminated union rather than a widened record, so the client cannot read an `id` off a
 * Developer entry without TypeScript objecting. The discriminant is the reader's own access level,
 * which keeps "what may I see" and "what may I do" as one decision instead of two that can drift.
 */
export type AccountDirectory =
  | { access: "manage"; entries: AdminAccountEntry[] }
  | { access: "read-only"; entries: DeveloperDirectoryEntry[] };

/**
 * Build the directory for a caller's role.
 *
 * The single place the read projection is chosen. Everything that serves /users routes through
 * here, so the Admin and Developer shapes cannot diverge between the server-rendered page and the
 * API route the client refetches from.
 *
 * Anything that is not Admin resolves to the restricted shape. Fail-closed on purpose: `/users` is
 * already gated to Admin and Developer upstream, and if a fourth role ever reaches this function
 * the safe default is the narrower projection rather than the wider one.
 */
export function toAccountDirectory(users: readonly User[], callerRole: UserRole): AccountDirectory {
  if (callerRole === "Admin") {
    return { access: "manage", entries: users.map(toAdminAccountEntry) };
  }
  return { access: "read-only", entries: users.map(toDeveloperDirectoryEntry) };
}
