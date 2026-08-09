"use client";

import React from "react";
import { CoordinateTransformer } from "../engine/CoordinateTransformer";

export interface TemplateFidelityOverlayProps {
  templateCode: string;
  templateTitle: string;
  transformer: CoordinateTransformer;
}

/**
 * TemplateFidelityOverlay (Layer 6 — z-index: 60)
 * Developer & QA Millimeter Grid Overlay for visual calibration of field coordinates.
 * Renders a 10mm x 10mm grid over the rendering canvas to verify field alignment against the template PNG.
 * Active strictly in DEV/QA environments; skipped in production.
 */
export function TemplateFidelityOverlay({
  templateCode,
  templateTitle,
  transformer,
}: TemplateFidelityOverlayProps) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const dims = transformer.getCanvasDimensions();
  const step10mmPx = transformer.mmToPx(10);

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[60] border border-blue-500/40 select-none"
      style={{
        width: `${dims.width}px`,
        height: `${dims.height}px`,
        backgroundImage: `
          linear-gradient(to right, rgba(59, 130, 246, 0.2) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(59, 130, 246, 0.2) 1px, transparent 1px)
        `,
        backgroundSize: `${step10mmPx}px ${step10mmPx}px`,
      }}
    >
      <div className="absolute top-1 left-1 bg-slate-900/90 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[9px] font-mono font-bold z-[70]">
        DEV CALIBRATION GRID (10mm x 10mm) | {templateCode} - {templateTitle}
      </div>
    </div>
  );
}
