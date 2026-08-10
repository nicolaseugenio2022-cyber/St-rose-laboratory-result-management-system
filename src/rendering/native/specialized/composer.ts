import type { ResolvedReportRenderModel, ResolvedSessionRenderModel } from "@/rendering/model";
import { appendNativeFlowSection, assertNativeUpperHalfBounds } from "../flow";
import type { NativeComposedPage, NativePagePrimitive } from "../types";
import {
  STANDARD_FONT_ROLES,
  composeDemographics,
  composeOfficialHeader,
  composeRemarks,
  composeStandardSignatories,
  composeTitle,
} from "../standard/sections";
import { STANDARD_PAGE } from "../standard/types";
import { NATIVE_REPORT_THEME } from "../theme";
import { composeCertificateSpecializedBody } from "./certificate";
import { composeMicroscopySpecializedBody } from "./microscopy";
import type {
  CertificateNativeCompositionDefinition,
  MicroscopyNativeCompositionDefinition,
  SpecializedNativeCompositionDefinition,
} from "./types";

type SpecializedStrategy = (
  definition: SpecializedNativeCompositionDefinition,
  session: ResolvedSessionRenderModel,
  report: ResolvedReportRenderModel,
  primitives: NativePagePrimitive[]
) => void;

const composeCertificateStrategy: SpecializedStrategy = (definition, session, report, primitives) => {
  const header = composeOfficialHeader(session);
  appendNativeFlowSection(primitives, header);
  appendNativeFlowSection(
    primitives,
    composeCertificateSpecializedBody(definition as CertificateNativeCompositionDefinition, session, report, NATIVE_REPORT_THEME.header.contentStartYmm)
  );
};

const composeMicroscopyStrategy: SpecializedStrategy = (definition, session, report, primitives) => {
  let cursorY = appendNativeFlowSection(primitives, composeOfficialHeader(session));
  cursorY = appendNativeFlowSection(primitives, composeDemographics(session, report, { demographicsVariant: "Standard" }, NATIVE_REPORT_THEME.header.contentStartYmm));
  cursorY = appendNativeFlowSection(primitives, composeTitle(report, cursorY));
  cursorY = appendNativeFlowSection(
    primitives,
    composeMicroscopySpecializedBody(definition as MicroscopyNativeCompositionDefinition, report, cursorY)
  );
  if (definition.showRemarks) cursorY = appendNativeFlowSection(primitives, composeRemarks(report, cursorY + 1));
  appendNativeFlowSection(primitives, composeStandardSignatories(report, cursorY + 2));
};

export const SPECIALIZED_COMPOSITION_STRATEGIES: Readonly<Record<
  SpecializedNativeCompositionDefinition["kind"],
  SpecializedStrategy
>> = {
  Certificate: composeCertificateStrategy,
  MicroscopyTwoColumn: composeMicroscopyStrategy,
};

export function composeSpecializedNativeReportPage(
  definition: SpecializedNativeCompositionDefinition,
  session: ResolvedSessionRenderModel,
  report: ResolvedReportRenderModel
): NativeComposedPage {
  if (definition.templateCode !== report.templateCode) {
    throw new Error(`Specialized native definition '${definition.templateCode}' cannot compose '${report.templateCode}'.`);
  }
  if (definition.layoutFamily !== report.layoutFamily) {
    throw new Error(`Specialized native layout '${definition.layoutFamily}' does not match resolved layout '${report.layoutFamily}'.`);
  }
  const primitives: NativePagePrimitive[] = [];
  SPECIALIZED_COMPOSITION_STRATEGIES[definition.kind](definition, session, report, primitives);
  return {
    templateCode: report.templateCode,
    compositionSource: definition.layoutFamily,
    widthMm: STANDARD_PAGE.widthMm,
    heightMm: STANDARD_PAGE.heightMm,
    contentBottomMm: assertNativeUpperHalfBounds(report.templateCode, primitives),
    fontRoles: STANDARD_FONT_ROLES,
    primitives,
  };
}
