import { IPersonnel } from "@/domain/models/interfaces";
import { SignatorySnapshot } from "@/domain/types";

export interface ISuggestedSignatoryProvider {
  getSuggestedSignatories(
    templateCode: string,
    requiredPathologistsCount: number,
    requiredMedtechsCount: number,
    availablePersonnel: IPersonnel[]
  ): SignatorySnapshot[];
}

export class SuggestedSignatoryProvider implements ISuggestedSignatoryProvider {
  /**
   * Resolves suggested signatories by matching active personnel roles cleanly,
   * completely eliminating positional array index assumptions.
   */
  public getSuggestedSignatories(
    templateCode: string,
    requiredPathologistsCount: number,
    requiredMedtechsCount: number,
    availablePersonnel: IPersonnel[]
  ): SignatorySnapshot[] {
    const activePersonnel = availablePersonnel.filter((p) => p.isActive);
    const pathologists = activePersonnel.filter((p) => p.role === "Pathologist");
    const medtechs = activePersonnel.filter((p) => p.role === "MedicalTechnologist");

    const suggestions: SignatorySnapshot[] = [];
    let displayOrder = 1;

    // 1. Resolve required Pathologists by role
    for (let i = 0; i < requiredPathologistsCount; i++) {
      const p = pathologists[i];
      if (p) {
        suggestions.push({
          personnelId: p.id,
          role: "Pathologist",
          printedFullName: `${p.firstName} ${p.lastName}`,
          printedCredentials: p.credentials,
          printedPrcLicenseNumber: p.prcLicenseNumber,
          signatureImageUrl: p.signatureImageUrl,
          displayOrder: displayOrder++,
        });
      }
    }

    // 2. Resolve required Medical Technologists by role
    for (let i = 0; i < requiredMedtechsCount; i++) {
      const mt = medtechs[i];
      if (mt) {
        suggestions.push({
          personnelId: mt.id,
          role: "MedicalTechnologist",
          printedFullName: `${mt.firstName} ${mt.lastName}`,
          printedCredentials: mt.credentials,
          printedPrcLicenseNumber: mt.prcLicenseNumber,
          signatureImageUrl: mt.signatureImageUrl,
          displayOrder: displayOrder++,
        });
      }
    }

    return suggestions;
  }
}

export const suggestedSignatoryProvider = new SuggestedSignatoryProvider();
