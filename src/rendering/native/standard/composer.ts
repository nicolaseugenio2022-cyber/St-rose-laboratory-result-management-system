import type { ResolvedReportRenderModel, ResolvedSessionRenderModel } from "@/rendering/model";
import type { NativeComposedPage, NativePagePrimitive } from "../types";
import { appendNativeFlowSection, assertNativeUpperHalfBounds } from "../flow";
import {
  STANDARD_FONT_ROLES,
  STANDARD_RESULT_FAMILY_COMPOSERS,
  composeDemographics,
  composeKit,
  composeOfficialHeader,
  composeRemarks,
  composeStandardSignatories,
  composeTitle,
} from "./sections";
import { STANDARD_PAGE, type StandardNativeCompositionDefinition } from "./types";
import { NATIVE_REPORT_THEME } from "../theme";

export function composeStandardNativeReportPage(
  definition: StandardNativeCompositionDefinition,
  session: ResolvedSessionRenderModel,
  report: ResolvedReportRenderModel
): NativeComposedPage {
  if (definition.templateCode !== report.templateCode) {
    throw new Error(`Standard native definition '${definition.templateCode}' cannot compose '${report.templateCode}'.`);
  }
  if (definition.layoutFamily !== report.layoutFamily) {
    throw new Error(`Standard native layout '${definition.layoutFamily}' does not match resolved layout '${report.layoutFamily}'.`);
  }

  const primitives: NativePagePrimitive[] = [];
  let cursorY = appendNativeFlowSection(primitives, composeOfficialHeader(session));
  cursorY = appendNativeFlowSection(primitives, composeDemographics(session, report, definition, NATIVE_REPORT_THEME.header.contentStartYmm));
  cursorY = appendNativeFlowSection(primitives, composeTitle(report, cursorY));
  const familyComposer = STANDARD_RESULT_FAMILY_COMPOSERS[definition.layoutFamily];
  cursorY = appendNativeFlowSection(primitives, familyComposer(report, definition, cursorY));
  if (definition.showRemarks) cursorY = appendNativeFlowSection(primitives, composeRemarks(report, cursorY + 1));
  if (definition.showKitInfo) cursorY = appendNativeFlowSection(primitives, composeKit(report, cursorY));
  appendNativeFlowSection(primitives, composeStandardSignatories(report, cursorY + 2));

  const contentBottomMm = assertNativeUpperHalfBounds(report.templateCode, primitives);
  return {
    templateCode: report.templateCode,
    compositionSource: definition.layoutFamily,
    widthMm: STANDARD_PAGE.widthMm,
    heightMm: STANDARD_PAGE.heightMm,
    contentBottomMm,
    fontRoles: STANDARD_FONT_ROLES,
    primitives,
  };
}
