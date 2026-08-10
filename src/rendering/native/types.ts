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

export interface NativeRichTextRun {
  text: string;
  fontSizePt?: number;
  riseMm?: number;
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

export interface NativeFontRoleDefinition {
  pdfFamily: "helvetica";
  previewFamily: string;
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
  failurePolicy: "Error" | "OmitImage";
}

export type NativePagePrimitive =
  | NativeTextPrimitive
  | NativeRichTextPrimitive
  | NativeImagePrimitive
  | NativeLineDefinition
  | NativeRectDefinition;

export interface NativeComposedPage {
  templateCode: string;
  compositionSource:
    | "StandardAdaptiveTabular"
    | "CompactResultGrid"
    | "MicroscopyTwoColumn"
    | "Certificate";
  widthMm: number;
  heightMm: number;
  contentBottomMm: number;
  fontRoles: Record<NativeFontRole, NativeFontRoleDefinition>;
  primitives: NativePagePrimitive[];
}
