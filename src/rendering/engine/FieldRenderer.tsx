"use client";

import React from "react";
import { TextField } from "../types/layout.types";
import { CoordinateTransformer } from "./CoordinateTransformer";

export interface FieldItem {
  key: string;
  value: string;
  config?: TextField;
}

export interface FieldRendererProps {
  fields: FieldItem[];
  transformer: CoordinateTransformer;
  zIndex?: number;
}

/**
 * FieldRenderer (Layer 2 / Layer 4 — z-index: 20 / 40)
 * Renders dynamic patient demographics and clinical remarks text fields.
 * Renders ONLY values. MUST NOT render static labels, colons, borders, or background boxes.
 */
export function FieldRenderer({
  fields,
  transformer,
  zIndex = 20,
}: FieldRendererProps) {
  return (
    <>
      {fields.map(({ key, value, config }) => {
        if (!config || !value) return null;

        const style = transformer.transformFieldStyle(config);
        return (
          <div
            key={key}
            style={{
              ...style,
              zIndex,
              textDecoration: config.underline ? "underline" : undefined,
            }}
            title={value}
          >
            {value}
          </div>
        );
      })}
    </>
  );
}
