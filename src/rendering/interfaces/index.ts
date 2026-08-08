import { IPatientReportSession, ILaboratoryReport } from "../../domain/models/interfaces";
import { RendererFamily } from "../../domain/types";

export interface RenderedPage {
  pageIndex: number;
  templateCode: string;
  templateTitle: string;
  rendererFamily: RendererFamily;
  colorPalette: string;
  htmlContent: string;
}

export interface RenderContext {
  session: IPatientReportSession;
  activeReports: ILaboratoryReport[];
}

export interface IRendererFamilyEngine {
  readonly family: RendererFamily;
  renderReport(report: ILaboratoryReport, session: IPatientReportSession, pageIndex: number): RenderedPage;
}

export interface IRenderingEngine {
  renderSession(context: RenderContext): RenderedPage[];
  renderSingleReport(report: ILaboratoryReport, session: IPatientReportSession): RenderedPage;
}

export interface IRenderOutputAdapter {
  outputTargetName: "ScreenPreview" | "BrowserPrint" | "PDFOutput";
  formatOutput(pages: RenderedPage[]): unknown;
}
