import type { ResolvedLayoutFamily } from "@/rendering/model";
import type { NativePagePrimitive } from "../types";
import { NATIVE_REPORT_THEME } from "../theme";

export type StandardNativeLayoutFamily = Extract<
  ResolvedLayoutFamily,
  "StandardAdaptiveTabular" | "CompactResultGrid"
>;

export interface StandardNativeCompositionDefinition {
  templateCode: string;
  layoutFamily: StandardNativeLayoutFamily;
  demographicsVariant: "Standard" | "CBC";
  resultHeaders: [string, string, string];
  columnRatios: [number, number, number];
  uppercaseParameterLabels: boolean;
  showRemarks: boolean;
  showKitInfo: boolean;
}

export interface NativeFlowSectionResult {
  primitives: NativePagePrimitive[];
  bottomMm: number;
}

export const STANDARD_PAGE = {
  widthMm: NATIVE_REPORT_THEME.page.widthMm,
  heightMm: NATIVE_REPORT_THEME.page.heightMm,
  marginMm: NATIVE_REPORT_THEME.page.marginMm,
  contentWidthMm: NATIVE_REPORT_THEME.page.contentWidthMm,
  contentBottomLimitMm: NATIVE_REPORT_THEME.page.contentBottomLimitMm,
  accentColor: NATIVE_REPORT_THEME.colors.primary,
  bodyColor: NATIVE_REPORT_THEME.colors.text,
} as const;

export class NativeCompositionOverflowError extends Error {
  readonly templateCode: string;
  readonly primitiveId: string;
  readonly calculatedBottomMm: number;
  readonly permittedBottomMm: number;

  constructor(options: {
    templateCode: string;
    primitiveId: string;
    calculatedBottomMm: number;
    permittedBottomMm?: number;
  }) {
    const permittedBottomMm = options.permittedBottomMm ?? STANDARD_PAGE.contentBottomLimitMm;
    super(
      `Native composition overflow for ${options.templateCode}: ${options.primitiveId} ends at ${options.calculatedBottomMm.toFixed(3)} mm; permitted boundary is ${permittedBottomMm.toFixed(3)} mm.`
    );
    this.name = "NativeCompositionOverflowError";
    this.templateCode = options.templateCode;
    this.primitiveId = options.primitiveId;
    this.calculatedBottomMm = options.calculatedBottomMm;
    this.permittedBottomMm = permittedBottomMm;
  }
}
