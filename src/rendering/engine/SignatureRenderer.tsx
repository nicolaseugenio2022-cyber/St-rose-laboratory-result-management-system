/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import { PositionedSignature } from "./render-payload";
import { CoordinateTransformer } from "./CoordinateTransformer";

export interface SignatureRendererProps {
  signatures: PositionedSignature[];
  transformer: CoordinateTransformer;
}

/**
 * SignatureRenderer (Layer 5 — z-index: 50)
 * Renders Medical Technologist and Pathologist digital signatures, printed names, and license numbers.
 * Positions elements strictly at designated footer layout coordinates.
 * MUST NEVER draw signature line rules, borders, or static footer artwork.
 */
export function SignatureRenderer({
  signatures,
  transformer,
}: SignatureRendererProps) {
  return (
    <>
      {signatures.map((signature) => (
      <React.Fragment key={signature.key}>
        {/* Signature Overlay Image */}
        {signature.imageConfig && signature.imageUrl && (
          <img
            src={signature.imageUrl}
            alt="Digital Signature"
            style={{
              ...transformer.transformImageStyle(signature.imageConfig),
              zIndex: 50,
            }}
            className="pointer-events-none select-none object-contain"
          />
        )}

        {/* Printed Name */}
        {signature.name.value && (
          <div
            style={{
              ...transformer.transformFieldStyle(signature.name.config),
              zIndex: 50,
              textDecoration: signature.name.config.underline ? "underline" : undefined,
            }}
          >
            {signature.name.value}
          </div>
        )}

        {/* Professional Title */}
        {signature.title?.value && (
          <div
            style={{
              ...transformer.transformFieldStyle(signature.title.config),
              zIndex: 50,
            }}
          >
            {signature.title.value}
          </div>
        )}

        {/* Professional License Number */}
        {signature.licenseNo.value && (
          <div
            style={{
              ...transformer.transformFieldStyle(signature.licenseNo.config),
              zIndex: 50,
            }}
          >
            {signature.licenseNo.value}
          </div>
        )}
      </React.Fragment>
      ))}
    </>
  );
}
