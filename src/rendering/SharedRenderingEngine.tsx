"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { IPatientReportSession, ILaboratoryReport } from "@/domain/models/interfaces";
import { createNativeSessionPdf, NativeLivePreviewPage } from "./native";
import { resolveSessionRenderModel } from "./model";
import "./styles/a4-document.css";
import { AlertTriangle, Download, FileText, Loader2, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

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
  /**
   * Export failure is surfaced in the panel, never through window.alert.
   *
   * The old alert interpolated the caught error message straight into a modal, which both blocked
   * the operator and put whatever the exporter threw - paths, stack text, internal identifiers -
   * in front of them. GuidedWorkspace already proves the rule this now follows: a caught value is
   * logged for developers and never rendered. The operator gets a fixed, actionable sentence.
   */
  const [exportError, setExportError] = useState<string | null>(null);

  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const pageTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
    setExportError(null);
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
        // Nothing from the caught value reaches the operator, and nothing but its class reaches
        // the console either. The composer throws messages carrying asset sources, template codes
        // and layout identifiers; the error name is enough to tell a layout fault from a data one
        // when triaging, and carries no path, identifier or patient value with it.
        console.error("PDF Export Error:", err instanceof Error ? err.name : "UnknownError");
        if (!cancelled) setExportError("The PDF could not be generated. Try exporting again.");
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
    // A missing resolved report used to throw from render, which unmounted the whole Workspace
    // behind a blank screen. It degrades to one skipped page instead: the operator keeps every
    // other report, the panel says which examination could not be composed, and the notice is
    // no-print so a composition gap can never reach a printed sheet.
    if (!resolvedReport) {
      return (
        <div
          key={report.id || `${report.templateCode}-${index}`}
          role="alert"
          data-preview-compose-error={report.templateCode}
          className="no-print mx-auto w-full max-w-[210mm] rounded-lg border border-brand-warning-border bg-brand-warning-bg px-4 py-3 text-xs font-medium text-brand-warning print:hidden"
        >
          {report.templateTitle} could not be composed for preview. Return to Encoding and check this
          examination, or reopen Live Preview to try again.
        </div>
      );
    }
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

  // Reports can disappear from the session while Live Preview is open - a deselected examination,
  // a replacement reload. A stale index used to match no page at all and render an empty viewport
  // with no explanation, so it is clamped to the last report that actually exists.
  const safePageIndex = activeReports.length > 0 ? Math.min(activePageIndex, activeReports.length - 1) : 0;

  if (activeReports.length === 0) {
    return (
      <div className="no-print flex w-full min-w-0 flex-col items-center justify-center rounded-lg border border-brand-border bg-brand-card px-6 py-12 text-center print:hidden">
        <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-structural text-brand-navy">
          <FileText aria-hidden="true" className="h-4 w-4" />
        </span>
        <h2 className="text-[15px] font-semibold leading-tight tracking-tight text-brand-navy">
          Nothing to preview yet
        </h2>
        <p className="mt-1 max-w-sm text-xs text-brand-text-muted">
          No examinations are selected for this session. Return to Encoding and add an examination to
          see its A4 output here.
        </p>
      </div>
    );
  }

  const unassignedTitle = "Save the session to assign an accession number before printing";
  const unassignedExportTitle = "Save the session to assign an accession number before exporting";

  // 44px on touch, the app's compact 36px from sm up - the same step every other control in the
  // Workspace uses, so the preview chrome does not become the one place with its own geometry.
  const chromeActionClass =
    "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:h-9";

  const zoomButtonClass = (isSelected: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded px-2.5 text-[11px] font-semibold tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring sm:h-6",
      // The selected level is a filled chip, not a tint: at 75/100 the two sit side by side and a
      // weak highlight left the operator unsure which one was actually applied.
      isSelected
        ? "bg-brand-primary text-brand-primary-foreground shadow-low"
        : "text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-navy"
    );

  // Horizontal sibling of the queue's vertical roving pattern: Home/End jump to the ends, arrows
  // step and wrap, and focus follows selection so the operator never tabs through every report.
  const handlePageKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const activateAt = (nextIndex: number) => {
      setActivePageIndex(nextIndex);
      pageTabRefs.current[nextIndex]?.focus();
    };
    if (event.key === "Home") {
      event.preventDefault();
      activateAt(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      activateAt(activeReports.length - 1);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    activateAt((currentIndex + direction + activeReports.length) % activeReports.length);
  };

  return (
    <div className="flex w-full min-w-0 flex-col">
      {/* One structural command band, the same tone and hairline the encoding worksheet header
          uses, so Live Preview reads as the same desk rather than a second application. Every
          control in here is chrome: it carries no-print AND print:hidden, and the stylesheet also
          suppresses bare button/nav, so nothing below can reach a printed sheet. */}
      <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-lg border border-brand-border bg-brand-structural px-3 py-2 print:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-card text-brand-navy ring-1 ring-brand-border">
            <FileText aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            {/* Named exactly as the command bar names it. It read "Report preview" here and
                "Live Preview" there for the same surface. */}
            <h2 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-brand-navy">
              Live Preview
            </h2>
            <p className="mt-0.5 min-w-0 truncate text-[11px] text-brand-text-muted">
              <span
                className={
                  isAccessionAssigned ? "font-mono font-semibold text-brand-text" : "italic text-brand-text-muted"
                }
              >
                {session.accessionNumber ?? "Not assigned"}
              </span>
              <span aria-hidden="true" className="px-1.5 text-brand-text-subtle">
                &middot;
              </span>
              {activeReports.length === 1 ? "1 report" : `${activeReports.length} reports`}
            </p>
          </div>
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
            className={`${chromeActionClass} border border-brand-border bg-brand-card text-brand-text hover:border-brand-border-strong hover:bg-brand-surface-hover`}
          >
            <Printer aria-hidden="true" className="h-3.5 w-3.5" />
            Print report
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF || !isAccessionAssigned}
            title={isAccessionAssigned ? undefined : unassignedExportTitle}
            className={`${chromeActionClass} bg-brand-primary text-brand-primary-foreground shadow-low hover:bg-brand-primary-hover`}
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

      {/* Why Print and Export are unavailable, stated on the surface rather than only in a title
          attribute - a tooltip is unreachable on touch, which is exactly where the operator is
          most likely to wonder why a disabled button will not respond. */}
      {!isAccessionAssigned && (
        <p className="no-print border-x border-brand-border bg-brand-warning-bg px-3 py-1.5 text-[11px] font-medium text-brand-warning print:hidden">
          Save this session to assign an accession number. Print and Export PDF stay unavailable until
          it is assigned.
        </p>
      )}

      {exportError && (
        <div
          role="alert"
          data-preview-export-error="true"
          className="no-print flex items-start gap-2 border-x border-brand-border bg-brand-danger-bg px-3 py-2 text-[11px] font-medium text-brand-danger print:hidden"
        >
          <AlertTriangle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">{exportError}</span>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="ml-auto shrink-0 rounded px-1.5 py-0.5 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Report navigation. A single-report session needs none, so the strip is absent rather than
          rendered as one inert control. */}
      {activeReports.length > 1 && (
        <nav
          aria-label="Reports in this session"
          className="no-print flex items-center gap-2 border-x border-b border-brand-border bg-brand-card px-2 py-1.5 print:hidden"
        >
          <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {activeReports.map((rep, idx) => {
              const isCurrent = safePageIndex === idx;
              return (
                <li key={rep.id || rep.templateCode} className="shrink-0">
                  <button
                    type="button"
                    ref={(node) => {
                      pageTabRefs.current[idx] = node;
                    }}
                    onClick={() => setActivePageIndex(idx)}
                    onKeyDown={(event) => handlePageKeyDown(event, idx)}
                    // Roving order: one stop for the whole strip, arrows move within it. Tabbing
                    // through eight reports to reach the document is not navigation.
                    tabIndex={isCurrent ? 0 : -1}
                    aria-current={isCurrent ? "page" : undefined}
                    title={rep.templateTitle}
                    className={cn(
                      "inline-flex min-h-11 max-w-[14rem] shrink-0 items-center gap-1.5 rounded-md border-b-2 px-2.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring sm:min-h-9",
                      isCurrent
                        ? "border-b-brand-primary bg-brand-tint font-semibold text-brand-navy"
                        : "border-b-transparent font-medium text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-navy"
                    )}
                  >
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-brand-text-muted">
                      {idx + 1}
                    </span>
                    {/* Truncation, not nowrap-and-grow: a long examination title used to widen the
                        strip until the whole band scrolled sideways. */}
                    <span className="min-w-0 truncate">{rep.templateTitle}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Position readout, so the operator knows where they are in the set without counting
              tabs - and it stays legible when the strip itself has scrolled. */}
          <span
            data-preview-position="true"
            className="shrink-0 whitespace-nowrap border-l border-brand-border pl-2 text-[11px] font-semibold tabular-nums text-brand-text-muted"
          >
            {safePageIndex + 1} of {activeReports.length}
          </span>
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
              if (activeReports.length > 1 && idx !== safePageIndex) return null;
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
