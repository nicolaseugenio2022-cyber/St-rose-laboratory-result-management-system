/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import { CoordinateTransformer } from "./CoordinateTransformer";

export interface BackgroundRendererProps {
  backgroundAssetPath: string;
  transformer: CoordinateTransformer;
}

/**
 * BackgroundRenderer (Layer 0 — z-index: 0)
 * Renders the immutable PNG template background as the sole visual source of truth.
 * Must NEVER render HTML tables, borders, cell backgrounds, labels, or decorations.
 */
export function BackgroundRenderer({
  backgroundAssetPath,
  transformer,
}: BackgroundRendererProps) {
  const dims = transformer.getCanvasDimensions();

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none select-none z-0"
      style={{
        width: `${dims.width}px`,
        height: `${dims.height}px`,
      }}
    >
      <img
        src={backgroundAssetPath}
        alt="Laboratory Report Template Background"
        className="w-full h-full object-fill block"
        style={{
          width: `${dims.width}px`,
          height: `${dims.height}px`,
        }}
      />
    </div>
  );
}
