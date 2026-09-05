import type { ResolvedReportRenderModel, ResolvedSessionRenderModel } from "@/rendering/model";
import type { NativeComposedPage } from "./types";
import {
  composeSpecializedNativeReportPage,
  getSpecializedNativeCompositionDefinition,
  type SpecializedNativeCompositionDefinition,
} from "./specialized";
import {
  composeStandardNativeReportPage,
  getStandardNativeCompositionDefinition,
  type StandardNativeCompositionDefinition,
} from "./standard";

export type NativeLivePreviewCompositionDefinition =
  | StandardNativeCompositionDefinition
  | SpecializedNativeCompositionDefinition;

type LivePreviewDefinitionResolver = (
  templateCode: string,
  renderContractVersion: number
) => NativeLivePreviewCompositionDefinition | null;
type LivePreviewComposer = (
  definition: NativeLivePreviewCompositionDefinition,
  session: ResolvedSessionRenderModel,
  report: ResolvedReportRenderModel
) => NativeComposedPage;

const LIVE_PREVIEW_DEFINITION_RESOLVERS: Readonly<Record<
  ResolvedReportRenderModel["layoutFamily"],
  LivePreviewDefinitionResolver
>> = {
  StandardAdaptiveTabular: getStandardNativeCompositionDefinition,
  CompactResultGrid: getStandardNativeCompositionDefinition,
  MicroscopyTwoColumn: getSpecializedNativeCompositionDefinition,
  Certificate: getSpecializedNativeCompositionDefinition,
};

const LIVE_PREVIEW_COMPOSERS: Readonly<Record<
  ResolvedReportRenderModel["layoutFamily"],
  LivePreviewComposer
>> = {
  StandardAdaptiveTabular: (definition, session, report) =>
    composeStandardNativeReportPage(definition as StandardNativeCompositionDefinition, session, report),
  CompactResultGrid: (definition, session, report) =>
    composeStandardNativeReportPage(definition as StandardNativeCompositionDefinition, session, report),
  MicroscopyTwoColumn: (definition, session, report) =>
    composeSpecializedNativeReportPage(definition as SpecializedNativeCompositionDefinition, session, report),
  Certificate: (definition, session, report) =>
    composeSpecializedNativeReportPage(definition as SpecializedNativeCompositionDefinition, session, report),
};

export function getNativeLivePreviewCompositionDefinition(
  report: ResolvedReportRenderModel
): NativeLivePreviewCompositionDefinition | null {
  // The report's own contract version selects the composition, so a completed report keeps the
  // column layout it was issued with while a draft resolves the definition's current one.
  //
  // That holds for the STANDARD families. `getSpecializedNativeCompositionDefinition` takes only a
  // template code, so the version argument is dropped for MicroscopyTwoColumn and Certificate -
  // harmless only because `specializedComposition` declares no version gate, making those
  // compositions version-independent by construction. `verify-checkpoint-c2.ts` asserts that
  // remains true: the day a specialized composition gains a `sinceRenderContractVersion`, this
  // resolver must thread the version through FIRST, or completed specialized reports will silently
  // re-render at the current definition.
  //
  // Threading it pre-emptively would be worse than useless here: nothing consumes it, and
  // `getAllSpecializedNativeCompositionDefinitions` maps that factory point-free, so a second
  // parameter would arrive as the array INDEX - the defect already corrected once in the standard
  // registry.
  return LIVE_PREVIEW_DEFINITION_RESOLVERS[report.layoutFamily](report.templateCode, report.renderContractVersion);
}

export function composeNativeLivePreviewReportPage(
  session: ResolvedSessionRenderModel,
  report: ResolvedReportRenderModel
): NativeComposedPage {
  const definition = getNativeLivePreviewCompositionDefinition(report);
  if (!definition) {
    throw new Error(`No native Live Preview composition is registered for '${report.templateCode}'.`);
  }
  return LIVE_PREVIEW_COMPOSERS[report.layoutFamily](definition, session, report);
}
