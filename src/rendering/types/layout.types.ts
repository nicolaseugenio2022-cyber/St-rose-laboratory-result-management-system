/**
 * Strongly Typed Layout Model
 * Standardized canonical layout configuration interfaces in millimeters (mm)
 * relative to standard A4 page (210mm x 297mm).
 */

export type TextAlignment = "left" | "center" | "right";

export interface Coordinate2D {
  x: number; // Position in mm from left margin (0mm to 210mm)
  y: number; // Position in mm from top margin (0mm to 297mm)
}

export interface TextField extends Coordinate2D {
  width?: number;       // Width in mm
  height?: number;      // Height in mm
  align?: TextAlignment;
  fontSize?: number;    // Font size in mm (or pt equivalent)
  fontWeight?: number | string;
  color?: string;
  fontFamily?: string;
  lineHeight?: number;
  maxChars?: number;
  textTransform?: "none" | "uppercase";
  underline?: boolean;
}

export interface ArtworkMask extends Coordinate2D {
  width: number;
  height: number;
  color: string;
}

export interface ImageField extends Coordinate2D {
  width: number;        // Width in mm
  height: number;       // Height in mm
}

export interface ResultColumnConfig {
  key: string;          // e.g. "parameter", "result", "unit", "referenceRange", "flag"
  x: number;            // X-coordinate in mm for column start
  width?: number;       // Width in mm
  align?: TextAlignment;
}

export interface ResultRowConfig {
  testKey: string;      // Matching test result parameter key (e.g. "hemoglobin", "wbc")
  y: number;            // Y-coordinate in mm for row baseline
  displayPrecision?: number;
}

export interface ResultGridConfig {
  columns: Record<string, ResultColumnConfig>;
  rows: ResultRowConfig[];
  defaultFontSize?: number; // In mm
  rowHeight?: number;       // In mm
}

export interface SignatoryPositionConfig {
  signatureImage?: ImageField;
  name: TextField;
  title?: TextField;
  licenseNo: TextField;
}

export interface SignatoryConfig {
  medicalTechnologist: SignatoryPositionConfig;
  pathologist: SignatoryPositionConfig;
}

export interface ReportLayout {
  templateCode: string;               // e.g. "CBC", "CHEM_8", "URINALYSIS"
  backgroundAssetPath: string;        // e.g. "/templates/render/CBC.png"
  logo?: ImageField;                  // Optional overlay logo when it is not already part of the artwork
  artworkMasks?: ArtworkMask[];       // Covers source-only sample values before dynamic values are rendered
  fields: Record<string, TextField>;  // Patient demographic fields
  results: ResultGridConfig;          // Examination result matrix positions
  remarks?: TextField;                // Remarks / clinical comments position
  signatories: SignatoryConfig;       // Signatory positioning
}
