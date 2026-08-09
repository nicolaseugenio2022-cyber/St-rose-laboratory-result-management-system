"use client";

import React, { useMemo } from "react";
import { RenderingEngineProps } from "../types/engine.types";
import { CoordinateTransformer } from "./CoordinateTransformer";
import { BackgroundRenderer } from "./BackgroundRenderer";
import { ArtworkMaskRenderer } from "./ArtworkMaskRenderer";
import { LogoRenderer } from "./LogoRenderer";
import { FieldRenderer, FieldItem } from "./FieldRenderer";
import { SignatureRenderer } from "./SignatureRenderer";
import { TemplateFidelityOverlay } from "../validation/TemplateFidelityOverlay";
import { buildReportRenderPayload } from "./render-payload";

/**
 * RenderingEngine (Generic Report-Agnostic Engine Container)
 * 
 * Conceptually executes only this sequence:
 * Load PNG -> Render docs-logo.png -> Render Patient Information -> Render Laboratory Results -> Render Remarks -> Render Signatures -> Preview/Export
 * 
 * Must NEVER contain report-specific logic (no CBC, Urinalysis, or Chemistry code).
 * Consumes ReportLayout configurations strictly as data assets.
 */
export function RenderingEngine({
  session,
  report,
  layout,
  targetOutput = "ScreenPreview",
  previewScale = 0.5,
  showValidationOverlay = false,
  backgroundOnlyDiagnostic = false,
}: RenderingEngineProps) {
  // Determine presentation scale factor: 0.5 for preview (half-A4), 1.0 for print/export
  const effectiveScale = targetOutput === "ScreenPreview" ? previewScale : 1.0;

  // Single authority for coordinate math
  const transformer = useMemo(() => new CoordinateTransformer(effectiveScale), [effectiveScale]);
  const dims = transformer.getCanvasDimensions();

  const payload = useMemo(
    () => buildReportRenderPayload(session, report, layout),
    [layout, report, session]
  );

  if (!layout) {
    return (
      <div className="bg-white p-6 rounded-lg border border-red-200 text-red-600 text-xs">
        Rendering Engine Error: No ReportLayout configuration provided for template &quot;{report?.templateCode}&quot;.
      </div>
    );
  }

  return (
    <div
      className={`relative bg-white box-border select-none overflow-hidden ${
        targetOutput === "ScreenPreview" ? "a4-preview-shadow rounded-sm" : ""
      }`}
      style={{
        width: `${dims.width}px`,
        height: `${dims.height}px`,
      }}
    >
      {/* Layer 0: Immutable Background Template PNG */}
      <BackgroundRenderer
        backgroundAssetPath={layout.backgroundAssetPath}
        transformer={transformer}
      />

      {/* Layer 1: Cover source-only sample values without duplicating static artwork */}
      {layout.artworkMasks && (
        <ArtworkMaskRenderer masks={layout.artworkMasks} transformer={transformer} />
      )}

      {/* Diagnostic Background-Only Mode: Suppress Layers 1-6 when active */}
      {!backgroundOnlyDiagnostic && (
        <>
          {/* Optional logo overlay for templates whose logo is not already baked into the artwork */}
          {layout.logo && <LogoRenderer logoConfig={layout.logo} transformer={transformer} />}

          {/* Layer 2: Dynamic Patient Demographics */}
          <FieldRenderer
            fields={payload.demographics as FieldItem[]}
            transformer={transformer}
            zIndex={20}
          />

          {/* Layer 3: Dynamic Examination Results Grid */}
          <FieldRenderer
            fields={payload.results as FieldItem[]}
            transformer={transformer}
            zIndex={30}
          />

          {/* Layer 4: Dynamic Clinical Remarks */}
          <FieldRenderer
            fields={payload.remarks as FieldItem[]}
            transformer={transformer}
            zIndex={40}
          />

          {/* Layer 5: Dynamic Signatures & Personnel Metadata */}
          <SignatureRenderer
            signatures={payload.signatures}
            transformer={transformer}
          />

          {/* Layer 6: Dev/QA Calibration Overlay (Optional) */}
          {showValidationOverlay && (
            <TemplateFidelityOverlay
              templateCode={layout.templateCode}
              templateTitle={report.templateTitle || layout.templateCode}
              transformer={transformer}
            />
          )}
        </>
      )}
    </div>
  );
}
