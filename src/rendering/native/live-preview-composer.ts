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

type LivePreviewDefinitionResolver = (templateCode: string) => NativeLivePreviewCompositionDefinition | null;
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
  return LIVE_PREVIEW_DEFINITION_RESOLVERS[report.layoutFamily](report.templateCode);
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
