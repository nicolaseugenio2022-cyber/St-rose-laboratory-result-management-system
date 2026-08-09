/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import { ImageField } from "../types/layout.types";
import { CoordinateTransformer } from "./CoordinateTransformer";

export interface LogoRendererProps {
  logoConfig: ImageField;
  transformer: CoordinateTransformer;
}

/**
 * LogoRenderer (Layer 1 — z-index: 10)
 * Renders the official St. Rose header logo from public/report-assets/docs-logo.png.
 * Ignores any embedded logo inside the template PNG.
 */
export function LogoRenderer({ logoConfig, transformer }: LogoRendererProps) {
  const logoStyle = transformer.transformImageStyle(logoConfig);

  return (
    <img
      src="/st-rose-logo-official.png"
      alt="St. Rose Diagnostic Laboratory Official Logo"
      style={{
        ...logoStyle,
        zIndex: 10,
      }}
      className="pointer-events-none select-none"
    />
  );
}
