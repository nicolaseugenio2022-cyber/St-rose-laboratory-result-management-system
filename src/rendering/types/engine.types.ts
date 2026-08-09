import { IPatientReportSession, ILaboratoryReport } from "@/domain/models/interfaces";
import { ReportLayout } from "./layout.types";

export type OutputTarget = "ScreenPreview" | "BrowserPrint" | "PDFOutput";

export interface ScaleOptions {
  previewScale?: number; // e.g. 0.5 for live preview (half-A4)
  pdfScale?: number;     // e.g. 1.0 for print/PDF export
}

export interface RenderingEngineProps {
  session: IPatientReportSession;
  report: ILaboratoryReport;
  layout: ReportLayout;
  targetOutput?: OutputTarget;
  previewScale?: number;
  showValidationOverlay?: boolean;
  backgroundOnlyDiagnostic?: boolean;
}

export interface DynamicFieldPayload {
  key: string;
  value: string;
}
