import "server-only";

import type { IPersonnel } from "@/domain/models/interfaces";
import type { SignatorySnapshot } from "@/domain/types";
import { ValidationError } from "@/lib/errors";

/**
 * Server-side resolution of the signature reference carried by a completing report.
 *
 * The client transports a full `SignatorySnapshot`, including `signatureImageUrl`, and until now
 * that value travelled untouched into `completedSnapshot` **and** into `report_signatories` -
 * `report-completion-service.ts` copies `report.signatories` directly and
 * `supabase-session-repository.ts` copies `sig.signatureImageUrl` directly. Neither re-reads
 * personnel. A stale or forged reference therefore became a permanent, authoritative part of a
 * completed clinical record.
 *
 * This unit removes that trust. Whatever the client sent is discarded; the reference is read
 * from the authoritative personnel record by `personnelId`.
 *
 * **Scope is deliberately narrow.** Printed name, credentials, PRC number, role and display
 * order are preserved exactly as transported: those are printed-at-the-time facts that the
 * operator saw and approved, and silently rewriting them would change what the report says a
 * person's credentials were at completion. Only the signature reference is canonicalized.
 *
 * It returns fresh objects and never mutates its input, so an already-frozen historical
 * snapshot passed anywhere near this code cannot be rewritten.
 */

/** The only capability this unit needs. Narrowed so a test can supply a fake. */
export interface PersonnelLookup {
  findById(id: string): Promise<IPersonnel | null>;
}

/**
 * Resolve one report's signatories against authoritative personnel.
 *
 * Fails closed - before any persistence - when a selected signatory names a personnel record
 * that does not exist, or whose authoritative role disagrees with the role the signatory was
 * selected under. Both are integrity faults: a signature attributed to the wrong person, or to
 * nobody, must never reach a frozen record.
 *
 * A Pathologist with no uploaded signature resolves to `null`. That is a valid, existing state
 * and the renderer's OmitImage behaviour already covers it.
 *
 * A Medical Technologist always resolves to `null`. MedTech records never carry a signature -
 * `updatePersonnelAction` actively clears it - so this is the same rule stated where it is now
 * enforced rather than merely expected.
 */
export async function resolveSignatoriesForPersistence(
  signatories: readonly SignatorySnapshot[],
  personnel: PersonnelLookup
): Promise<SignatorySnapshot[]> {
  const resolved: SignatorySnapshot[] = [];

  for (const signatory of signatories) {
    const record = await personnel.findById(signatory.personnelId);

    if (!record) {
      throw new ValidationError("Signatory personnel record could not be resolved.", {
        signatories: `Personnel record '${signatory.personnelId}' does not exist.`,
      });
    }

    if (record.role !== signatory.role) {
      throw new ValidationError("Signatory role does not match the personnel record.", {
        signatories: `Personnel record '${signatory.personnelId}' is a ${record.role}, not a ${signatory.role}.`,
      });
    }

    // The incoming signatureImageUrl is not read. It is overwritten unconditionally, which is
    // what makes a client-supplied value unreachable rather than merely unlikely.
    resolved.push({
      personnelId: signatory.personnelId,
      role: signatory.role,
      printedFullName: signatory.printedFullName,
      printedCredentials: signatory.printedCredentials,
      printedPrcLicenseNumber: signatory.printedPrcLicenseNumber,
      displayOrder: signatory.displayOrder,
      signatureImageUrl:
        record.role === "Pathologist" ? record.signatureImageUrl ?? null : null,
    });
  }

  return resolved;
}

/**
 * Apply resolved signatories to every report of a session, in place.
 *
 * In place, and returning nothing, on purpose. The aggregate holds `LaboratoryReportDomain`
 * instances; substituting plain objects would strip their behaviour, and `signatories` is a
 * plain writable field on that class, so assigning the resolved array is the whole operation.
 *
 * Both persistence consumers then read the same resolved values, which is what makes the JSON
 * snapshot and the relational rows incapable of diverging:
 *   - `ReportCompletionService.validateAndCompose` snapshots `report.signatories`;
 *   - the RPC payload independently re-reads the same live `report.signatories`.
 *
 * Must be awaited BEFORE `completeSession()` / `recompleteSession()`. Resolving afterwards
 * would leave the already-frozen snapshot holding the client value while only the relational
 * rows were corrected.
 */
export async function applyResolvedSignatories(
  reports: readonly { signatories: SignatorySnapshot[] }[],
  personnel: PersonnelLookup
): Promise<void> {
  for (const report of reports) {
    report.signatories = await resolveSignatoriesForPersistence(report.signatories, personnel);
  }
}
