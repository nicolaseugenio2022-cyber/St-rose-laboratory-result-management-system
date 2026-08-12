import type { ResolvedSessionRenderModel } from "@/rendering/model";
import type jsPDF from "jspdf";
import { composeNativeLivePreviewReportPage } from "./live-preview-composer";
import {
  createNativeMultiPagePdf,
  type NativePdfAssetResolver,
} from "./native-pdf-exporter";

export interface NativeSessionPdfOptions {
  fileName?: string;
  onProgress?: (percent: number) => void;
}

export async function createNativeSessionPdf(
  resolvedSession: ResolvedSessionRenderModel,
  resolver?: NativePdfAssetResolver,
  options: NativeSessionPdfOptions = {}
): Promise<jsPDF> {
  const pages = resolvedSession.reports.map((report) =>
    composeNativeLivePreviewReportPage(resolvedSession, report)
  );
  const pdf = await createNativeMultiPagePdf(pages, resolver, options.onProgress);

  const accessionClean = resolvedSession.accessionNumber.replace(/[^a-zA-Z0-9-]/g, "_");
  const patientNameClean = (resolvedSession.demographics.fullName || "Patient").replace(
    /[^a-zA-Z0-9-]/g,
    "_"
  );
  const defaultFileName = `LabReport_${accessionClean}_${patientNameClean}.pdf`;
  pdf.setProperties({ title: options.fileName || defaultFileName });

  return pdf;
}
