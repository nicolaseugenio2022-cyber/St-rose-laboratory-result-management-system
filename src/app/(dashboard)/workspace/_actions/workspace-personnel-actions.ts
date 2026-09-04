"use server";

import "server-only";

import type { IPersonnel } from "@/domain/models/interfaces";
import type {
  WorkspacePersonnelDirectory,
  WorkspacePersonnelEntry,
} from "@/features/workspace/signatory-contracts";
import { listActivePersonnelAction } from "@/features/server-boundary/server-actions";

/**
 * The Workspace's personnel boundary.
 *
 * A new module rather than an edit to `listActivePersonnelAction`, deliberately. That action's
 * body is sha256-pinned in `verify-personnel-directory.ts` and `verify-personnel-signatures.ts`,
 * and `verify-checkpoint-b4.ts` matches its exact `Promise<IPersonnel[]>` signature. Changing it
 * would invalidate three frozen assertions to achieve something a new action achieves with none,
 * and the architecture already directs new server actions away from the pinned module. The old
 * action is left byte-identical and simply loses its Workspace caller.
 *
 * The split this file introduces is the whole point. `IPersonnel` fuses two things the Workspace
 * has always received together and should never have: the identity a signatory is *selected* by,
 * and the signature reference a report is *rendered* from. Fused, a browser that needs the second
 * to paint a preview is handed the first as forgeable authority. Split, the reference arrives on
 * a channel that nothing reads back.
 *
 * Authorization is *delegated*, never restated. This module calls `listActivePersonnelAction`
 * rather than re-deriving a caller check, so `requireOperationalCaller` - its authentication gate,
 * its first-login gate, its Active-status check, its Developer exclusion and its SecurityDenial
 * audit emissions - runs unchanged and cannot drift from a second copy. A projection is not a
 * reason to reimplement a guard. It also leaves the pinned action with a live caller instead of
 * orphaning it.
 */

/**
 * Project an authoritative personnel record onto the Workspace's selection entry.
 *
 * Field by field, never a spread: a spread would carry whatever field is added to `IPersonnel`
 * next across the boundary, which is precisely the failure this projection exists to prevent.
 * `createdAt` / `updatedAt` are dropped too - the Workspace never displayed them.
 */
function toWorkspaceEntry(person: IPersonnel): WorkspacePersonnelEntry {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    middleInitial: person.middleInitial ?? null,
    credentials: person.credentials,
    prcLicenseNumber: person.prcLicenseNumber,
    role: person.role,
    isActive: person.isActive,
    hasSignature: Boolean(person.signatureImageUrl),
  };
}

/**
 * Active personnel, projected. Nothing else.
 *
 * This action previously also returned a `signatureAssets` map whose values were each record's
 * stored `signatureImageUrl` - that is, `/api/signatures/proxy?path=<storage object path>`. The
 * DTO withheld the field and the response handed the same string back under another name, so the
 * storage path reached the browser anyway. The map is gone from the server contract entirely.
 *
 * The Workspace now derives its render-only addresses from `id` and `hasSignature`, both of which
 * are already on the entry below, and the proxy route resolves the path server-side.
 */
export async function listWorkspacePersonnelAction(): Promise<WorkspacePersonnelDirectory> {
  const personnel = await listActivePersonnelAction();
  return { personnel: personnel.map(toWorkspaceEntry) };
}
