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

/**
 * Fail closed on an incoherent column declaration.
 *
 * The header row and the ratio list are two halves of one contract: the grid places a header per
 * ratio and sizes each cell from it, so a mismatch silently drops a column or divides by a track
 * that was never declared. A non-positive or non-finite ratio is worse - it yields a zero-width or
 * NaN cell that text then fails to wrap into, surfacing far from its cause. Both are declaration
 * errors, so they are rejected at resolution rather than rendered.
 */
function validatedColumns(
  templateCode: string,
  resultHeaders: readonly string[],
  columnRatios: readonly number[]
): void {
  if (resultHeaders.length !== columnRatios.length) {
    throw new Error(
      `Standard composition for '${templateCode}' declares ${resultHeaders.length} result header(s) but ${columnRatios.length} column ratio(s); they must match.`
    );
  }
  const invalid = columnRatios.findIndex((ratio) => !Number.isFinite(ratio) || ratio <= 0);
  if (invalid !== -1) {
    throw new Error(
      `Standard composition for '${templateCode}' declares an invalid column ratio at index ${invalid}: every ratio must be a finite number greater than zero.`
    );
  }
}

export function createStandardNativeCompositionDefinition(
  definition: ClinicalReportDefinition,
  renderContractVersion?: number
): StandardNativeCompositionDefinition | null {
  const layoutFamily = STANDARD_LAYOUT_FAMILIES[definition.rendererFamily];
  if (!layoutFamily) return null;
  const defaults = FAMILY_DEFAULTS[layoutFamily];
  const contract = definition.renderContract;
  // Absent an explicit version this resolves the definition's current contract, which is what a
  // draft renders at. A completed report passes the version frozen into its snapshot, and a
  // composition introduced after that version is not applied to it.
  const effectiveVersion = renderContractVersion ?? contract?.renderContractVersion ?? 1;
  const candidate = contract?.standardComposition;
  const declared =
    candidate && effectiveVersion >= (candidate.sinceRenderContractVersion ?? 0) ? candidate : undefined;
  const resultHeaders = declared?.resultHeaders ?? defaults.resultHeaders;
  const columnRatios = declared?.columnRatios ?? defaults.columnRatios;
  validatedColumns(definition.templateCode, resultHeaders, columnRatios);
  return {
    templateCode: definition.templateCode,
    layoutFamily,
    demographicsVariant: contract?.demographics?.layoutVariant ?? "Standard",
    resultHeaders,
    columnRatios,
    uppercaseParameterLabels: declared?.uppercaseParameterLabels ?? defaults.uppercaseParameterLabels,
    showRemarks: definition.supportsRemarks,
    showKitInfo: definition.requiresKitInfo,
  };
}

export function getStandardNativeCompositionDefinition(
  templateCode: string,
  renderContractVersion?: number
): StandardNativeCompositionDefinition | null {
  const definition = ReportDefinitionRegistry.getDefinition(templateCode);
  return definition ? createStandardNativeCompositionDefinition(definition, renderContractVersion) : null;
}

export function getAllStandardNativeCompositionDefinitions(): StandardNativeCompositionDefinition[] {
  return ReportDefinitionRegistry.getAllDefinitions()
    .map(createStandardNativeCompositionDefinition)
    .filter((definition): definition is StandardNativeCompositionDefinition => definition !== null);
}
