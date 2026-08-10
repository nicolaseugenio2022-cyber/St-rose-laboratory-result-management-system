import { ReportDefinitionRegistry } from "@/domain/definitions/report-definition-registry";
import type { ClinicalReportDefinition } from "@/domain/types/report-definition";
import type { StandardNativeCompositionDefinition, StandardNativeLayoutFamily } from "./types";

const STANDARD_LAYOUT_FAMILIES: Readonly<Record<string, StandardNativeLayoutFamily | undefined>> = {
  Tabular: "StandardAdaptiveTabular",
  SimpleResult: "CompactResultGrid",
};

const FAMILY_DEFAULTS: Readonly<Record<StandardNativeLayoutFamily, Pick<
  StandardNativeCompositionDefinition,
  "resultHeaders" | "columnRatios" | "uppercaseParameterLabels"
>>> = {
  StandardAdaptiveTabular: {
    resultHeaders: ["EXAMINATION", "RESULT", "NORMAL VALUES"],
    columnRatios: [40, 25, 35],
    uppercaseParameterLabels: true,
  },
  CompactResultGrid: {
    resultHeaders: ["TEST", "RESULT", "REFERENCE VALUES"],
    columnRatios: [40, 30, 30],
    uppercaseParameterLabels: false,
  },
};

export function createStandardNativeCompositionDefinition(
  definition: ClinicalReportDefinition
): StandardNativeCompositionDefinition | null {
  const layoutFamily = STANDARD_LAYOUT_FAMILIES[definition.rendererFamily];
  if (!layoutFamily) return null;
  const defaults = FAMILY_DEFAULTS[layoutFamily];
  const declared = definition.renderContract?.standardComposition;
  return {
    templateCode: definition.templateCode,
    layoutFamily,
    demographicsVariant: definition.renderContract?.demographics?.layoutVariant ?? "Standard",
    resultHeaders: declared?.resultHeaders ?? defaults.resultHeaders,
    columnRatios: declared?.columnRatios ?? defaults.columnRatios,
    uppercaseParameterLabels: declared?.uppercaseParameterLabels ?? defaults.uppercaseParameterLabels,
    showRemarks: definition.supportsRemarks,
    showKitInfo: definition.requiresKitInfo,
  };
}

export function getStandardNativeCompositionDefinition(
  templateCode: string
): StandardNativeCompositionDefinition | null {
  const definition = ReportDefinitionRegistry.getDefinition(templateCode);
  return definition ? createStandardNativeCompositionDefinition(definition) : null;
}

export function getAllStandardNativeCompositionDefinitions(): StandardNativeCompositionDefinition[] {
  return ReportDefinitionRegistry.getAllDefinitions()
    .map(createStandardNativeCompositionDefinition)
    .filter((definition): definition is StandardNativeCompositionDefinition => definition !== null);
}
