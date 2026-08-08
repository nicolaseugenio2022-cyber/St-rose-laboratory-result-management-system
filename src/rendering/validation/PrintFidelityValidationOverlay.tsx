"use client";

import React, { useState } from "react";
import { Grid, Eye, Sliders, Layers, Ruler, CheckCircle2, AlertTriangle, X } from "lucide-react";

export interface PrintFidelityValidationOverlayProps {
  templateCode: string;
  templateTitle: string;
  children: React.ReactNode;
}

/**
 * Developer-only & QA Print Fidelity Validation Overlay Tool.
 * Provides side-by-side & overlay comparison, transparency slider, alignment grid,
 * A4 page boundary guidelines (210mm x 297mm), and physical millimeter measurements for QA.
 * NEVER exposed to production laboratory end users.
 */
export function PrintFidelityValidationOverlay({
  templateCode,
  templateTitle,
  children,
}: PrintFidelityValidationOverlayProps) {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"overlay" | "sideBySide">("overlay");
  const [opacity, setOpacity] = useState<number>(50);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showMargins, setShowMargins] = useState<boolean>(true);
  const [showSpecsRuler, setShowSpecsRuler] = useState<boolean>(true);

  if (process.env.NODE_ENV === "production") {
    return <>{children}</>;
  }

  return (
    <div className="relative w-full">
      {/* Dev/QA Floating Controls Bar */}
      <div className="no-print bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-3 mb-4 shadow-xl text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-mono font-bold text-[10px]">
            DEV/QA VALIDATION TOOL
          </span>
          <span className="font-bold text-white">
            {templateCode} — {templateTitle}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsEnabled(!isEnabled)}
            className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 ${
              isEnabled ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            {isEnabled ? "Validation Mode Active" : "Enable Fidelity Overlay"}
          </button>
        </div>
      </div>

      {/* Extended Validation Tools Drawer */}
      {isEnabled && (
        <div className="no-print bg-slate-900 border border-slate-800 text-slate-300 rounded-xl p-3.5 mb-5 space-y-3 text-xs shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">Comparison Mode:</span>
              <button
                type="button"
                onClick={() => setViewMode("overlay")}
                className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                  viewMode === "overlay" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="h-3 w-3 inline mr-1" />
                Transparency Overlay
              </button>
              <button
                type="button"
                onClick={() => setViewMode("sideBySide")}
                className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                  viewMode === "sideBySide" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Eye className="h-3 w-3 inline mr-1" />
                Side-by-Side Comparison
              </button>
            </div>

            {/* Transparency Slider */}
            {viewMode === "overlay" && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400">Opacity ({opacity}%):</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-28 accent-blue-500 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Toggle Alignment Guides */}
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
              />
              <Grid className="h-3 w-3 text-slate-400" />
              <span>Millimeter Alignment Grid (10mm x 10mm)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showMargins}
                onChange={(e) => setShowMargins(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
              />
              <Ruler className="h-3 w-3 text-slate-400" />
              <span>A4 Margins (Top/Bottom 15mm, Left/Right 12mm)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSpecsRuler}
                onChange={(e) => setShowSpecsRuler(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
              />
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              <span>Frozen Specs Rulers (Table Width: 186mm)</span>
            </label>
          </div>
        </div>
      )}

      {/* Document Target with Interactive Overlay Guides */}
      <div className="relative overflow-hidden">
        {/* Render Main Children Document */}
        <div
          className="relative transition-opacity duration-200"
          style={{ opacity: isEnabled && viewMode === "overlay" ? opacity / 100 : 1 }}
        >
          {children}
        </div>

        {/* Dev Grid Lines */}
        {isEnabled && showGrid && (
          <div
            className="absolute inset-0 pointer-events-none z-40 border border-blue-500/30"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(59, 130, 246, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 130, 246, 0.15) 1px, transparent 1px)",
              backgroundSize: "37.8px 37.8px", // 10mm at 96 DPI screen resolution
            }}
          />
        )}

        {/* Dev Margin Lines */}
        {isEnabled && showMargins && (
          <div
            className="absolute inset-0 pointer-events-none z-50 border-2 border-dashed border-red-500/50"
            style={{
              top: "56.7px", // 15mm top
              bottom: "56.7px", // 15mm bottom
              left: "45.3px", // 12mm left
              right: "45.3px", // 12mm right
            }}
          >
            <span className="absolute top-1 left-1 text-[9px] font-mono font-bold text-red-500 bg-white/80 px-1 rounded">
              A4 Printable Area (186mm x 267mm)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
