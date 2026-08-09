"use client";

import React from "react";
import { ArtworkMask } from "../types/layout.types";
import { CoordinateTransformer } from "./CoordinateTransformer";

export interface ArtworkMaskRendererProps {
  masks: ArtworkMask[];
  transformer: CoordinateTransformer;
}

export function ArtworkMaskRenderer({ masks, transformer }: ArtworkMaskRendererProps) {
  return (
    <>
      {masks.map((mask, index) => (
        <div
          key={`${mask.x}-${mask.y}-${index}`}
          className="absolute pointer-events-none"
          style={{
            left: `${transformer.mmToPx(mask.x)}px`,
            top: `${transformer.mmToPx(mask.y)}px`,
            width: `${transformer.mmToPx(mask.width)}px`,
            height: `${transformer.mmToPx(mask.height)}px`,
            backgroundColor: mask.color,
            zIndex: 10,
          }}
        />
      ))}
    </>
  );
}
