"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { IPatientReportSession, ILaboratoryReport } from "@/domain/models/interfaces";
import { createNativeSessionPdf, NativeLivePreviewPage } from "./native";
import { resolveSessionRenderModel } from "./model";
import "./styles/a4-document.css";
import { Printer, Download, Loader2 } from "lucide-react";

export interface SharedRenderingEngineProps {
  session: IPatientReportSession;
  targetOutput?: "ScreenPreview" | "BrowserPrint" | "PDFOutput";
  /**
   * Render-only signature references, keyed by personnel id, for draft rendering.
   *
   * Optional, and consumed nowhere but the resolver below. History passes nothing and keeps
   * resolving from its frozen snapshot; the Workspace passes the current roster's assets because
   * its own client state no longer carries a signature reference to resolve from.
   */
  signatureAssets?: Readonly<Record<string, string>>;
}

export function SharedRenderingEngine({
  session,
  targetOutput = "ScreenPreview",
  signatureAssets,
}: SharedRenderingEngineProps) {
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<number>(0);

  const pagesContainerRef = useRef<HTMLDivElement>(null);

  // Filter only active, selected laboratory reports in the session
  const activeReports = session.reports;
  const resolvedSession = useMemo(
    () => resolveSessionRenderModel(session, undefined, signatureAssets),
    [session, signatureAssets]
  );
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
      <div className="rounded-lg border border-brand-card-border bg-brand-card p-6 text-center text-xs text-slate-500">
        No active laboratory reports selected in session.
      </div>
    );
  }

  const unassignedTitle = "Save the session to assign an accession number before printing";
  const unassignedExportTitle = "Save the session to assign an accession number before exporting";

  const zoomButtonClass = (isSelected: boolean) =>
    `inline-flex min-h-6 items-center rounded px-2 text-[11px] font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring ${
      isSelected ? "bg-brand-card text-brand-text shadow-sm ring-1 ring-brand-card-border" : "text-brand-text-muted hover:text-brand-text"
    }`;

  const chromeActionClass =
    "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none";

  return (
    <div className="flex w-full min-w-0 flex-col">
      {/* One compact operator toolbar. Everything interactive here is chrome and is
          suppressed in print; the document below is the only thing that prints. */}
      <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-lg border border-brand-card-border bg-brand-background px-3 py-2 print:hidden">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h3 className="shrink-0 text-xs font-semibold text-brand-text">Report preview</h3>
          <p className="min-w-0 truncate text-[11px] text-brand-text-muted">
            <span
              className={
                isAccessionAssigned ? "font-mono font-semibold text-brand-text" : "italic text-brand-text-muted"
              }
            >
              {session.accessionNumber ?? "Not assigned"}
            </span>
            <span aria-hidden="true" className="px-1.5 text-slate-300">
              ·
            </span>
            {activeReports.length === 1 ? "1 page" : `${activeReports.length} pages`}
          </p>
        </div>

        <div
          role="group"
          aria-label="Preview zoom level"
          className="flex shrink-0 items-center gap-0.5 rounded-md bg-brand-surface-hover p-0.5"
        >
          <button
            type="button"
            onClick={() => setZoomLevel(75)}
            aria-pressed={zoomLevel === 75}
            className={zoomButtonClass(zoomLevel === 75)}
          >
            75%
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(100)}
            aria-pressed={zoomLevel === 100}
            className={zoomButtonClass(zoomLevel === 100)}
          >
            100%
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrint}
            disabled={!isAccessionAssigned}
            title={isAccessionAssigned ? undefined : unassignedTitle}
            className={`${chromeActionClass} border border-brand-border bg-brand-card text-brand-text hover:border-slate-400 hover:bg-brand-surface-hover`}
          >
            <Printer aria-hidden="true" className="h-3.5 w-3.5" />
            Print report
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF || !isAccessionAssigned}
            title={isAccessionAssigned ? undefined : unassignedExportTitle}
            className={`${chromeActionClass} bg-brand-primary text-brand-primary-foreground shadow-sm hover:bg-brand-primary-hover active:shadow-none`}
          >
            {isExportingPDF ? (
              <>
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                Generating PDF ({pdfProgress}%)...
              </>
            ) : (
              <>
                <Download aria-hidden="true" className="h-3.5 w-3.5" />
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Page Navigation (Suppressed during print) */}
      {activeReports.length > 1 && (
        <nav
          aria-label="Report pages"
          className="no-print flex items-center gap-1 overflow-x-auto border-x border-b border-brand-card-border bg-brand-card px-2 py-1.5 print:hidden"
        >
          {activeReports.map((rep, idx) => {
            const isCurrent = activePageIndex === idx;
            return (
              <button
                key={rep.id || rep.templateCode}
                type="button"
                onClick={() => setActivePageIndex(idx)}
                aria-current={isCurrent ? "page" : undefined}
                className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border-b-2 px-2.5 text-xs transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring ${
                  isCurrent
                    ? "border-b-brand-primary bg-brand-tint font-semibold text-brand-text"
                    : "border-b-transparent font-medium text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-text"
                }`}
              >
                <span className="font-mono text-[11px] tabular-nums text-brand-text-muted">{idx + 1}</span>
                {rep.templateTitle}
              </button>
            );
          })}
        </nav>
      )}

      {/* Render Pages Container */}
      {!isAccessionAssigned ? (
        <div data-unassigned-print-notice="true" className="hidden">Save the session before printing.</div>
      ) : null}
      <div
        ref={pagesContainerRef}
        data-live-preview-viewport="true"
        data-accession-unassigned={isAccessionAssigned ? undefined : "true"}
        className="max-h-[calc(100dvh-14rem)] w-full overflow-auto rounded-b-lg border-x border-b border-brand-card-border bg-brand-background"
      >
        <div
          data-live-preview-page-track="true"
          className="flex w-max min-w-full flex-col items-center gap-6 py-4"
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
