import type { ResolvedLayoutFamily } from "@/rendering/model";

export interface CertificateNativeCompositionDefinition {
  templateCode: string;
  kind: "Certificate";
  layoutFamily: Extract<ResolvedLayoutFamily, "Certificate">;
  showRemarks: boolean;
}

export interface MicroscopySectionDefinition {
  id: string;
  label: string;
  parameterCodes: string[];
}

export interface MicroscopyNativeCompositionDefinition {
  templateCode: string;
  kind: "MicroscopyTwoColumn";
  layoutFamily: Extract<ResolvedLayoutFamily, "MicroscopyTwoColumn">;
  sections: MicroscopySectionDefinition[];
  conditionalParameterCodes: string[];
  repeatableFindingCategories: string[];
  showRemarks: boolean;
}

export type SpecializedNativeCompositionDefinition =
  | CertificateNativeCompositionDefinition
  | MicroscopyNativeCompositionDefinition;
