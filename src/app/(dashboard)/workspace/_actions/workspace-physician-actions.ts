"use server";

import "server-only";

import type { WorkspacePhysicianOption } from "@/features/physicians/physician-directory-entry";
import { listActivePhysiciansAction } from "@/features/server-boundary/server-actions";

/**
 * The Workspace's physician boundary.
 *
 * A new module beside `workspace-personnel-actions`, and for the same reasons. The Workspace needs
 * the managed physician directory while encoding, but it needs almost nothing from it - the name
 * that prints on a report, and which examinations that name is offered for.
 *
 * The narrowing that matters is no longer done here. `listActivePhysiciansAction` itself now
 * returns `WorkspacePhysicianOption`, so the row `id` and the `createdAt` / `updatedAt`
 * administration timestamps never leave the server boundary at all. That is deliberate: every
 * exported function in the server-boundary module is separately registered in the production
 * server-action manifest and reachable from client code on its own, so a wrapper that narrowed an
 * authoritative record AFTERWARDS closed nothing - the wide action stayed callable beside it. This
 * module narrows further still (to bare names) for the control that wants only names, but it is a
 * convenience over an already-closed boundary, not the boundary itself.
 *
 * Authorization is *delegated*, never restated. This module calls `listActivePhysiciansAction`
 * rather than re-deriving a caller check, so `requireOperationalCaller` - its authentication gate,
 * its first-login gate, its Active-status check, its Developer exclusion and its SecurityDenial
 * audit emissions - runs unchanged and cannot drift from a second copy. A projection is not a
 * reason to reimplement a guard.
 *
 * It is also the reason this module does not reach for a repository. `SupabasePhysicianRepository`
 * is instantiated exactly once, behind that guard, in `server-actions`. A second instantiation here
 * would be a second unguarded path to the same rows.
 *
 * `requireOperationalCaller` is the correct guard and the only correct one: it admits Admin and
 * User - the ordinary laboratory operator who encodes reports. The physician ADMINISTRATION
 * actions in `physician-actions` are guarded by `requirePersonnelReader`, which is Admin and
 * Developer only; calling those from here would hand every operator an empty roster and leave no
 * trace that it had.
 */

/**
 * Project an authoritative physician record onto the one field the control renders.
 *
 * Field by field, never a spread: a spread would carry whatever field is added to `IPhysician`
 * next across the boundary, which is precisely the failure this projection exists to prevent.
 */
function toWorkspacePhysicianName(physician: WorkspacePhysicianOption): string {
  return physician.fullName;
}

/**
 * Active physicians, projected to their display names. Nothing else.
 *
 * `listActivePhysiciansAction` already filters deactivated physicians out in SQL, so a retired
 * doctor stops being offered for new work while every report that already names them is untouched.
 */
export async function listWorkspacePhysiciansAction(): Promise<string[]> {
  const physicians = await listActivePhysiciansAction();
  return physicians.map(toWorkspacePhysicianName);
}

/**
 * The same roster, keeping the per-examination assignment facts.
 *
 * What the "Requested By" control needs beyond a list of names is two answers about the ONE
 * examination being encoded: which of these names are assigned to it, and which one of them - if
 * any - is its default. Both are already in the projection, so this returns it unchanged rather
 * than re-deriving anything. The guard is delegated exactly as above; nothing is restated.
 */
export async function listWorkspacePhysicianOptionsAction(): Promise<WorkspacePhysicianOption[]> {
  return listActivePhysiciansAction();
}
