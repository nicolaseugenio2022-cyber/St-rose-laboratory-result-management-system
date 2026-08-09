import type { PatientDemographics, PersonnelRole } from "@/domain/types";

export type NativeTextAlignment = "left" | "center" | "right";
export type NativeFontWeight = "normal" | "bold";
export type NativeFontRole = string;

export interface NativeFrame {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface NativeTextStyle {
  fontRole: NativeFontRole;
  fontSizePt: number;
  fontWeight?: NativeFontWeight;
  color?: string;
  align?: NativeTextAlignment;
  lineHeightMm?: number;
  uppercase?: boolean;
  underline?: boolean;
}

export type NativeTextBinding =
  | {
      source: "demographic";
      field: keyof PatientDemographics;
      formatter?: "plain" | "positive-number" | "age-with-unit" | "long-date-uppercase" | "patient-status";
    }
  | { source: "session"; field: "accessionNumber" }
  | { source: "report"; field: "remarks" }
  | { source: "result"; parameterCode: string; field: "resultValue" }
  | {
      source: "signatory";
      role: PersonnelRole;
      field: "name-with-credentials" | "license-number";
    }
  | { source: "signatory"; role: PersonnelRole; field: "signature-image" };

export interface NativeTextDefinition extends NativeFrame, NativeTextStyle {
  kind: "text";
  id: string;
  text?: string;
  binding?: Exclude<NativeTextBinding, { source: "signatory"; field: "signature-image" }>;
  fit?: {
    mode: "shrink-to-width";
    guardMm?: number;
  };
}

export interface NativeAdaptiveTextFitProfile {
  maxLines: 1 | 2 | 3;
  oneLineMinFontSizePt: number;
  twoLineMinFontSizePt?: number;
  threeLineMinFontSizePt?: number;
  guardMm?: number;
}

export interface NativeAdaptiveRowTextDefinition extends NativeTextStyle {
  id: string;
  x: number;
  width: number;
  text?: string;
  binding?: Exclude<NativeTextBinding, { source: "signatory"; field: "signature-image" }>;
  fit?: NativeAdaptiveTextFitProfile;
}

export interface NativeAdaptiveRowDefinition {
  id: string;
  baseHeightMm: number;
  fields: NativeAdaptiveRowTextDefinition[];
  fill?: string;
  verticalSeparatorsX?: number[];
  bottomSeparator?: {
    color: string;
    widthMm: number;
  };
}

export interface NativeAdaptiveRowsDefinition {
  kind: "adaptive-rows";
  id: string;
  x: number;
  y: number;
  width: number;
  rows: NativeAdaptiveRowDefinition[];
  propagateHeightToFollowing?: boolean;
}

export interface NativeRichTextRun {
  text: string;
  fontSizePt?: number;
  riseMm?: number;
}

export interface NativeRichTextDefinition extends NativeFrame, NativeTextStyle {
  kind: "rich-text";
  id: string;
  lines: NativeRichTextRun[][];
}

export interface NativeImageDefinition extends NativeFrame {
  kind: "image";
  id: string;
  source?: string;
  binding?: Extract<NativeTextBinding, { source: "signatory"; field: "signature-image" }>;
  fit?: "contain" | "fill";
}

export interface NativeLineDefinition {
  kind: "line";
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  widthMm: number;
}

export interface NativeRectDefinition extends NativeFrame {
  kind: "rect";
  id: string;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidthMm?: number;
}

export interface NativeTableRowDefinition {
  height: number;
  fill?: string;
  topBorder?: boolean;
  bottomBorder?: boolean;
  topBorderWidthMm?: number;
  bottomBorderWidthMm?: number;
}

export interface NativeTableDefinition extends NativeFrame {
  kind: "table";
  id: string;
  width: number;
  columns: number[];
  rows: NativeTableRowDefinition[];
  borderColor?: string;
  borderWidthMm?: number;
  drawOuterBorder?: boolean;
  drawVerticalBorders?: boolean;
}

export interface NativeResultRowDefinition {
  id: string;
  parameterCode?: string;
  label?: string;
  reference?: string[];
  y: number;
  height: number;
  labelIndentMm?: number;
  displayPrecision?: number;
}

export interface NativeResultRowsDefinition {
  kind: "result-rows";
  id: string;
  x: number;
  width: number;
  columns: [number, number, number];
  rows: NativeResultRowDefinition[];
  labelStyle: NativeTextStyle;
  resultStyle: NativeTextStyle;
  referenceStyle: NativeTextStyle;
  cellPaddingMm: number;
}

export type NativeDefinitionElement =
  | NativeTextDefinition
  | NativeRichTextDefinition
  | NativeImageDefinition
  | NativeLineDefinition
  | NativeRectDefinition
  | NativeTableDefinition
  | NativeResultRowsDefinition
  | NativeAdaptiveRowsDefinition;

export interface NativeFontRoleDefinition {
  pdfFamily: "helvetica";
  previewFamily: string;
}

export interface NativeReportDefinition {
  templateCode: string;
  page: {
    widthMm: number;
    heightMm: number;
    contentBottomMm: number;
  };
  fontRoles: Record<NativeFontRole, NativeFontRoleDefinition>;
  elements: NativeDefinitionElement[];
  notes?: readonly string[];
}

export interface NativeTextPrimitive extends NativeFrame, NativeTextStyle {
  kind: "text";
  id: string;
  text: string;
}

export interface NativeRichTextPrimitive extends NativeFrame, NativeTextStyle {
  kind: "rich-text";
  id: string;
  lines: NativeRichTextRun[][];
}

export interface NativeImagePrimitive extends NativeFrame {
  kind: "image";
  id: string;
  source: string;
  fit: "contain" | "fill";
}

export type NativePagePrimitive =
  | NativeTextPrimitive
  | NativeRichTextPrimitive
  | NativeImagePrimitive
  | NativeLineDefinition
  | NativeRectDefinition;

export interface NativeComposedPage {
  templateCode: string;
  widthMm: number;
  heightMm: number;
  contentBottomMm: number;
  fontRoles: NativeReportDefinition["fontRoles"];
  primitives: NativePagePrimitive[];
}
