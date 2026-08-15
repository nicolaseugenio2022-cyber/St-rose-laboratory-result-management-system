"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { IPatientReportSession, ILaboratoryReport } from "@/domain/models/interfaces";
import { createNativeSessionPdf, NativeLivePreviewPage } from "./native";
import { resolveSessionRenderModel } from "./model";
import "./styles/a4-document.css";
import { Printer, Download, Eye, Layers, Loader2 } from "lucide-react";

export interface SharedRenderingEngineProps {
  session: IPatientReportSession;
  targetOutput?: "ScreenPreview" | "BrowserPrint" | "PDFOutput";
}

export function SharedRenderingEngine({
  session,
  targetOutput = "ScreenPreview",
}: SharedRenderingEngineProps) {
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<number>(0);

  const pagesContainerRef = useRef<HTMLDivElement>(null);

  // Filter only active, selected laboratory reports in the session
  const activeReports = session.reports;
  const resolvedSession = useMemo(() => resolveSessionRenderModel(session), [session]);
  const isAccessionAssigned = session.accessionNumber !== null;

  // Handle Browser Print Target
  const handlePrint = () => {
    if (!isAccessionAssigned) return;
    window.print();
  };

  // Handle Native PDF export from the resolved session composition.
  const handleExportPDF = () => {
    if (!isAccessionAssigned) return;
    if (isExportingPDF) return;
    setPdfProgress(10);
    setIsExportingPDF(true);
  };

  useEffect(() => {
    if (!isAccessionAssigned) return;
    if (!isExportingPDF) return;
    let cancelled = false;
    async function runExport() {
      try {
        const pdf = await createNativeSessionPdf(resolvedSession, undefined, {
          onProgress: (percent) => {
            if (!cancelled) setPdfProgress(percent);
          },
        });
        const accessionClean = resolvedSession.accessionNumber.replace(/[^a-zA-Z0-9-]/g, "_");
        const patientNameClean = (resolvedSession.demographics.fullName || "Patient").replace(
          /[^a-zA-Z0-9-]/g,
          "_"
        );
        const fileName = `LabReport_${accessionClean}_${patientNameClean}.pdf`;
        if (!cancelled) pdf.save(fileName);
      } catch (err: unknown) {
        console.error("PDF Export Error:", err);
        const message = err instanceof Error ? err.message : "Unknown PDF export error.";
        if (!cancelled) alert(`Failed to export PDF report: ${message}`);
      } finally {
        if (!cancelled) {
          setIsExportingPDF(false);
          setPdfProgress(0);
        }
      }
    }
    void runExport();
    return () => {
      cancelled = true;
    };
  }, [isAccessionAssigned, isExportingPDF, resolvedSession]);

  // Helper to render individual report
  const renderReportPage = (report: ILaboratoryReport, index: number, isLastPage: boolean) => {
    const resolvedReport = resolvedSession.reports.find((candidate) => candidate.templateCode === report.templateCode);
    if (!resolvedReport) throw new Error(`Resolved render model is missing report '${report.templateCode}'.`);
    return (
      <NativeLivePreviewPage
        key={report.id || `${report.templateCode}-${index}`}
        resolvedSession={resolvedSession}
        resolvedReport={resolvedReport}
        reportTitle={report.templateTitle}
        zoomLevel={zoomLevel}
        isLastPage={isLastPage}
      />
    );
  };

  if (activeReports.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
        No active laboratory reports selected in session.
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Screen Preview Interactive Toolbar (Suppressed during print) */}
      <div className="no-print bg-slate-900 text-white rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-800 text-blue-400">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Shared Rendering Engine — Preview & Export Target
            </h3>
            <p className="text-[11px] text-slate-400">
              Accession: <span className="font-mono text-blue-300 font-semibold">{session.accessionNumber}</span> | Total A4 Pages: {activeReports.length}
            </p>
          </div>
        </div>

        {/* Viewport Zoom & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Zoom Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg p-1 text-xs">
            <button
              type="button"
              onClick={() => setZoomLevel(75)}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                zoomLevel === 75 ? "bg-brand-primary text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              75%
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                zoomLevel === 100 ? "bg-brand-primary text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              100%
            </button>
          </div>

          {/* Action Buttons */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={!isAccessionAssigned}
            title={isAccessionAssigned ? undefined : "Save the session to assign an accession number before printing"}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-brand-primary text-white hover:bg-blue-700 transition-colors shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Report
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF || !isAccessionAssigned}
            title={isAccessionAssigned ? undefined : "Save the session to assign an accession number before exporting"}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating PDF ({pdfProgress}%)...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export PDF Stream
              </>
            )}
          </button>
        </div>
      </div>

      {/* Page Navigation Tabs (Suppressed during print) */}
      {activeReports.length > 1 && (
        <div className="no-print flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider text-[10px] mr-1 inline-flex items-center gap-1">
            <Layers className="h-3 w-3" /> PAGES:
          </span>
          {activeReports.map((rep, idx) => (
            <button
              key={rep.id || rep.templateCode}
              type="button"
              onClick={() => setActivePageIndex(idx)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
                activePageIndex === idx
                  ? "bg-brand-primary text-white border-brand-primary"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Page {idx + 1}: {rep.templateTitle}
            </button>
          ))}
        </div>
      )}

      {/* Render Pages Container */}
      {!isAccessionAssigned ? (
        <div data-unassigned-print-notice="true" className="hidden">Save the session before printing.</div>
      ) : null}
      <div
        ref={pagesContainerRef}
        data-live-preview-viewport="true"
        data-accession-unassigned={isAccessionAssigned ? undefined : "true"}
        className="w-full max-h-[calc(100dvh-16rem)] overflow-auto bg-slate-100/60 rounded-xl border border-slate-200"
      >
        <div
          data-live-preview-page-track="true"
          className="flex w-max min-w-full flex-col items-center gap-8 py-4"
        >
          {targetOutput === "ScreenPreview" ? (
            // Render only the selected report in the interactive preview viewport.
            activeReports.map((report, idx) => {
              if (activeReports.length > 1 && idx !== activePageIndex) return null;
              return renderReportPage(report, idx, idx === activeReports.length - 1);
            })
          ) : (
            // Render all pages sequentially for Print / PDF Stream.
            activeReports.map((report, idx) => renderReportPage(report, idx, idx === activeReports.length - 1))
          )}
        </div>
      </div>
    </div>
  );
}
