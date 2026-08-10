"use client";

import React, { useState, useEffect, useRef } from "react";
import { IPatientReportSession, ILaboratoryReport } from "@/domain/models/interfaces";
import { reportRegistryService } from "@/services/report-registry-service";
import { HydratedTemplateSpec } from "@/services/interfaces";
import { TabularRenderer } from "./families/TabularRenderer";
import { SimpleResultRenderer } from "./families/SimpleResultRenderer";
import { DiagnosticGridRenderer } from "./families/DiagnosticGridRenderer";
import { NarrativeCertificateRenderer } from "./families/NarrativeCertificateRenderer";
import { PDFStreamAdapter } from "./adapters/pdf-stream-adapter";
import { RenderingEngine } from "./engine/RenderingEngine";
import { getReportLayout } from "./layouts";
import {
  getNativeLivePreviewCompositionDefinition,
  NativeLivePreviewPage,
} from "./native";
import { resolveSessionRenderModel } from "./model";
import "./styles/a4-document.css";
import { Printer, Download, Eye, Layers, Loader2, Sparkles, Image as ImageIcon } from "lucide-react";

type PreviewRendererMode = "native" | "experimental" | "legacy";

export interface SharedRenderingEngineProps {
  session: IPatientReportSession;
  targetOutput?: "ScreenPreview" | "BrowserPrint" | "PDFOutput";
}

export function SharedRenderingEngine({
  session,
  targetOutput = "ScreenPreview",
}: SharedRenderingEngineProps) {
  const [specsMap, setSpecsMap] = useState<Map<string, HydratedTemplateSpec>>(new Map());
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<number>(0);

  // Production Native is the default; historical comparison modes stay explicit.
  const [previewRendererMode, setPreviewRendererMode] = useState<PreviewRendererMode>("native");
  const [isDiagnosticBackgroundOnly, setIsDiagnosticBackgroundOnly] = useState<boolean>(false);

  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const legacyPdfContainerRef = useRef<HTMLDivElement>(null);

  // Filter only active, selected laboratory reports in the session
  const activeReports = session.reports;
  const selectedReport = activeReports[activePageIndex] || activeReports[0];
  const resolvedSession = resolveSessionRenderModel(session);
  const selectedResolvedReport = selectedReport
    ? resolvedSession.reports.find((candidate) => candidate.templateCode === selectedReport.templateCode)
    : null;
  const selectedNativePreviewDefinition = selectedResolvedReport
    ? getNativeLivePreviewCompositionDefinition(selectedResolvedReport)
    : null;

  // Comparison modes never carry implicitly between report tabs.
  useEffect(() => {
    setPreviewRendererMode("native");
    setIsDiagnosticBackgroundOnly(false);
  }, [selectedReport?.templateCode]);

  // Load hydrated template specifications for all reports
  useEffect(() => {
    async function loadSpecs() {
      const map = new Map<string, HydratedTemplateSpec>();
      for (const report of activeReports) {
        const spec = await reportRegistryService.getTemplateByCode(report.templateCode);
        if (spec) {
          map.set(report.templateCode, spec);
        }
      }
      setSpecsMap(map);
    }
    loadSpecs();
  }, [activeReports]);

  // Handle Browser Print Target
  const handlePrint = () => {
    window.print();
  };

  // Handle Native PDF Stream Export consuming SharedRenderingEngine DOM
  const handleExportPDF = () => {
    if (isExportingPDF) return;
    setPdfProgress(10);
    setIsExportingPDF(true);
  };

  // The legacy PDF DOM is mounted only for the duration of an explicit export.
  // This keeps it out of the production Native Live Preview layout and scroll area.
  useEffect(() => {
    if (!isExportingPDF) return;
    const exportContainer = legacyPdfContainerRef.current;
    if (!exportContainer) {
      setIsExportingPDF(false);
      setPdfProgress(0);
      return;
    }
    const mountedExportContainer: HTMLDivElement = exportContainer;
    let cancelled = false;
    async function runExport() {
      try {
        await PDFStreamAdapter.generatePDFFromSharedEngine(session, mountedExportContainer, {
          onProgress: (percent) => {
            if (!cancelled) setPdfProgress(percent);
          },
        });
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
  }, [isExportingPDF, session]);

  const renderLegacyReportPage = (
    report: ILaboratoryReport,
    index: number,
    isLastPage: boolean,
    forPdfExport = false
  ) => {
    const spec = specsMap.get(report.templateCode);
    const rendererFamily = spec?.template.rendererFamily || report.rendererFamily || "Tabular";
    const colorPalette = spec?.template.colorPalette || "#093982";
    const supportsRemarks = spec?.template.supportsRemarks ?? true;
    const requiresKitInfo = spec?.template.requiresKitInfo ?? false;
    return (
      <div
        key={`${forPdfExport ? "pdf-legacy" : "preview-legacy"}-${report.id || `${report.templateCode}-${index}`}`}
        data-live-preview-renderer={forPdfExport ? "legacy-export" : "legacy"}
        className={`a4-page-container ${forPdfExport ? "" : "a4-preview-shadow"} ${!isLastPage ? "a4-page-break" : ""}`}
        style={{ transform: !forPdfExport && targetOutput === "ScreenPreview" ? `scale(${zoomLevel / 100})` : undefined }}
      >
        {rendererFamily === "Tabular" && (
          <TabularRenderer report={report} session={session} colorPalette={colorPalette} supportsRemarks={supportsRemarks} />
        )}
        {rendererFamily === "SimpleResult" && (
          <SimpleResultRenderer report={report} session={session} colorPalette={colorPalette} supportsRemarks={supportsRemarks} requiresKitInfo={requiresKitInfo} />
        )}
        {rendererFamily === "DiagnosticGrid" && (
          <DiagnosticGridRenderer report={report} session={session} colorPalette={colorPalette} supportsRemarks={supportsRemarks} />
        )}
        {rendererFamily === "NarrativeCertificate" && (
          <NarrativeCertificateRenderer report={report} session={session} colorPalette={colorPalette} requiresKitInfo={requiresKitInfo} />
        )}
      </div>
    );
  };

  // Helper to render individual report
  const renderReportPage = (report: ILaboratoryReport, index: number, isLastPage: boolean) => {
    if (targetOutput === "ScreenPreview" && previewRendererMode === "native") {
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
    }

    // Check if new Template Engine layout exists for this report (CBC in Phase 3)
    const layoutConfig = getReportLayout(report.templateCode);
    if (layoutConfig && previewRendererMode === "experimental") {
      return (
        <div
          key={report.id || `${report.templateCode}-${index}`}
          data-live-preview-renderer="experimental"
          className={`a4-preview-shadow ${!isLastPage ? "a4-page-break" : ""}`}
          style={{ transform: targetOutput === "ScreenPreview" && zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined }}
        >
          <RenderingEngine
            session={session}
            report={report}
            layout={layoutConfig}
            targetOutput={targetOutput}
            previewScale={0.5}
            backgroundOnlyDiagnostic={isDiagnosticBackgroundOnly}
          />
        </div>
      );
    }

    return renderLegacyReportPage(report, index, isLastPage);
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

        {/* Viewport Zoom, Engine Pilot Switch & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {selectedNativePreviewDefinition ? (
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-0.5">
              {([
                ["native", `Native ${selectedReport?.templateCode || "Preview"}`],
                ["experimental", "Experimental"],
                ["legacy", "Legacy HTML"],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setPreviewRendererMode(mode);
                    if (mode !== "experimental") setIsDiagnosticBackgroundOnly(false);
                  }}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    previewRendererMode === mode
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={`${label} preview path`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPreviewRendererMode(
                previewRendererMode === "experimental" ? "legacy" : "experimental"
              )}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                previewRendererMode === "experimental"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              }`}
              title="Toggle between experimental Template Engine and Legacy HTML Form Renderer"
            >
              <Sparkles className="h-3 w-3 text-amber-400" />
              {previewRendererMode === "experimental" ? "Template Engine (Active)" : "Legacy HTML Renderer"}
            </button>
          )}

          {/* Diagnostic Mode Toggle: Layer 0 Background Only */}
          {previewRendererMode === "experimental" && (
            <button
              type="button"
              onClick={() => setIsDiagnosticBackgroundOnly(!isDiagnosticBackgroundOnly)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                isDiagnosticBackgroundOnly
                  ? "bg-purple-600 text-white border-purple-500"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              }`}
              title="Diagnostic Mode: Render ONLY Layer 0 (CBC.png background)"
            >
              <ImageIcon className="h-3 w-3" />
              {isDiagnosticBackgroundOnly ? "Layer 0 Only (Diagnostic ON)" : "Layer 0 Only (OFF)"}
            </button>
          )}

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
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-brand-primary text-white hover:bg-blue-700 transition-colors shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Report
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
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
      <div
        ref={pagesContainerRef}
        data-live-preview-viewport="true"
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

      {/* C4 keeps the existing raster/legacy PDF route isolated from the native Live Preview DOM. */}
      {isExportingPDF && (
        <div
          ref={legacyPdfContainerRef}
          className="no-print fixed top-0 -left-[10000px] pointer-events-none"
          aria-hidden="true"
          data-c4-preserved-pdf-route="legacy"
          data-export-dom-active="true"
        >
          {activeReports.map((report, index) =>
            renderLegacyReportPage(report, index, index === activeReports.length - 1, true)
          )}
        </div>
      )}
    </div>
  );
}
