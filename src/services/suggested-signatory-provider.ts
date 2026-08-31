import type {
  WorkspacePersonnelEntry,
  WorkspaceSignatorySelection,
} from "@/features/workspace/signatory-contracts";

/**
 * Turns the required signatory counts for a template into a default selection.
 *
 * Both its input and its output are now the client-safe Workspace contracts. It previously took
 * `IPersonnel[]` and returned `SignatorySnapshot[]`, copying `p.signatureImageUrl` into every
 * suggestion - including Medical Technologists, whose reference `signatory-resolution.ts` then
 * had to force back to `null`. That copy was the origin of the signature reference inside client
 * state: every draft the Workspace built carried it, every autosave wrote it to sessionStorage,
 * and every mutation sent it back to the server as if it were authority.
 *
 * Nothing is lost by dropping it. The renderer receives the reference on the separate render-only
 * channel, and persistence resolves it server-side from `personnelId`.
 */
export interface ISuggestedSignatoryProvider {
  getSuggestedSignatories(
    templateCode: string,
    requiredPathologistsCount: number,
    requiredMedtechsCount: number,
    availablePersonnel: WorkspacePersonnelEntry[]
  ): WorkspaceSignatorySelection[];
}

export class SuggestedSignatoryProvider implements ISuggestedSignatoryProvider {
  public getSuggestedSignatories(
    templateCode: string,
    requiredPathologistsCount: number,
    requiredMedtechsCount: number,
    availablePersonnel: WorkspacePersonnelEntry[]
  ): WorkspaceSignatorySelection[] {
    const activePersonnel = availablePersonnel.filter((p) => p.isActive);
    const pathologists = activePersonnel.filter((p) => p.role === "Pathologist");
    const medtechs = activePersonnel.filter((p) => p.role === "MedicalTechnologist");

    const suggestions: WorkspaceSignatorySelection[] = [];
    let displayOrder = 1;

    for (let i = 0; i < requiredPathologistsCount; i++) {
      const pathologist = pathologists[i];
      if (pathologist) {
        suggestions.push(toSelection(pathologist, "Pathologist", displayOrder++));
      }
    }

    for (let i = 0; i < requiredMedtechsCount; i++) {
      const medtech = medtechs[i];
      if (medtech) {
        suggestions.push(toSelection(medtech, "MedicalTechnologist", displayOrder++));
      }
    }

    return suggestions;
  }
}

/**
 * The single place a selection is built from a directory entry.
 *
 * `role` is taken from the slot being filled rather than from the record, matching the previous
 * behaviour exactly - the candidate lists are already filtered by role, so the two always agree,
 * and `signatory-resolution.ts` rejects any disagreement server-side before persistence.
 */
function toSelection(
  person: WorkspacePersonnelEntry,
  role: WorkspaceSignatorySelection["role"],
  displayOrder: number
): WorkspaceSignatorySelection {
  return {
    personnelId: person.id,
    role,
    printedFullName: `${person.firstName} ${person.lastName}`,
    printedCredentials: person.credentials,
    printedPrcLicenseNumber: person.prcLicenseNumber,
    displayOrder,
  };
}

export const suggestedSignatoryProvider = new SuggestedSignatoryProvider();
