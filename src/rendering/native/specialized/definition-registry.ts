import { ReportDefinitionRegistry } from "@/domain/definitions/report-definition-registry";
import type { ClinicalReportDefinition } from "@/domain/types/report-definition";
import type { SpecializedNativeCompositionDefinition } from "./types";

export function createSpecializedNativeCompositionDefinition(
  definition: ClinicalReportDefinition
): SpecializedNativeCompositionDefinition | null {
  const declared = definition.renderContract?.specializedComposition;
  if (!declared) return null;
  if (declared.kind === "Certificate") {
    if (definition.rendererFamily !== "Dedicated Certificate" && definition.rendererFamily !== "NarrativeCertificate") {
      throw new Error(`Certificate composition metadata conflicts with renderer family '${definition.rendererFamily}'.`);
    }
    return {
      templateCode: definition.templateCode,
      kind: declared.kind,
      layoutFamily: "Certificate",
      showRemarks: definition.supportsRemarks,
    };
  }
  if (definition.rendererFamily !== "DiagnosticGrid") {
    throw new Error(`Microscopy composition metadata conflicts with renderer family '${definition.rendererFamily}'.`);
  }
  return {
    templateCode: definition.templateCode,
    kind: declared.kind,
    layoutFamily: "MicroscopyTwoColumn",
    sections: structuredClone(declared.sections),
    conditionalParameterCodes: [...declared.conditionalParameterCodes],
    repeatableFindingCategories: [...declared.repeatableFindingCategories],
    showRemarks: definition.supportsRemarks,
  };
}

export function getSpecializedNativeCompositionDefinition(
  templateCode: string
): SpecializedNativeCompositionDefinition | null {
  const definition = ReportDefinitionRegistry.getDefinition(templateCode);
  return definition ? createSpecializedNativeCompositionDefinition(definition) : null;
}

export function getAllSpecializedNativeCompositionDefinitions(): SpecializedNativeCompositionDefinition[] {
  return ReportDefinitionRegistry.getAllDefinitions()
    .map(createSpecializedNativeCompositionDefinition)
    .filter((definition): definition is SpecializedNativeCompositionDefinition => definition !== null);
}
