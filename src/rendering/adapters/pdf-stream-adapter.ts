import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { IPatientReportSession } from "@/domain/models/interfaces";

export interface PDFExportOptions {
  fileName?: string;
  onProgress?: (progressPercent: number) => void;
}

/**
 * Native PDF Stream Adapter consuming SharedRenderingEngine DOM outputs.
 * Enforces Architectural Requirement: No independent PDF layout implementation permitted.
 * Captures 100% of physical A4 styling, typography, header, result tables, and signatories.
 */
export class PDFStreamAdapter {
  /**
   * Generates and downloads a multi-page PDF document stream directly from SharedRenderingEngine DOM containers.
   */
  public static async generatePDFFromSharedEngine(
    session: IPatientReportSession,
    containerElement: HTMLElement,
    options: PDFExportOptions = {}
  ): Promise<Blob> {
    const pageContainers = containerElement.querySelectorAll<HTMLElement>(".a4-page-container");

    if (!pageContainers || pageContainers.length === 0) {
      throw new Error("No A4 page containers rendered by SharedRenderingEngine found.");
    }

    // Standard A4 dimensions in mm (Portrait)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const totalPages = pageContainers.length;

    for (let i = 0; i < totalPages; i++) {
      const pageEl = pageContainers[i];

      if (options.onProgress) {
        options.onProgress(Math.round(((i + 1) / totalPages) * 100));
      }

      // Capture DOM page element at 2x scale (300 DPI high fidelity)
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          // Ensure cloned elements retain screen dimensions without zoom scaling transform
          const clonedPage = clonedDoc.querySelectorAll<HTMLElement>(".a4-page-container")[i];
          if (clonedPage) {
            clonedPage.style.transform = "none";
            clonedPage.style.boxShadow = "none";
            clonedPage.style.margin = "0";
          }
        },
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      if (i > 0) {
        pdf.addPage("a4", "portrait");
      }

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
    }

    // Generate output blob stream
    const pdfArrayBuffer = pdf.output("arraybuffer");
    const blob = new Blob([pdfArrayBuffer], { type: "application/pdf" });

    // Download PDF file with standardized naming convention
    const accessionClean = session.accessionNumber.replace(/[^a-zA-Z0-9-]/g, "_");
    const patientNameClean = (session.demographics.fullName || "Patient").replace(/[^a-zA-Z0-9-]/g, "_");
    const defaultFileName = `LabReport_${accessionClean}_${patientNameClean}.pdf`;
    const finalFileName = options.fileName || defaultFileName;

    pdf.save(finalFileName);

    return blob;
  }
}
