"use client";

import React from "react";
import { ResultGridConfig, TextField } from "../types/layout.types";
import { CoordinateTransformer } from "./CoordinateTransformer";

export interface ResultRendererProps {
  results: Record<string, any> | Array<{ parameterCode: string; resultValue: string; unit?: string | null; evaluationOutcome?: string }>;
  gridConfig: ResultGridConfig;
  transformer: CoordinateTransformer;
}

/**
 * ResultRenderer (Layer 3 — z-index: 30)
 * Renders dynamic laboratory examination values, units, reference intervals, and flags.
 * Positions values strictly at layout grid coordinates.
 * MUST NEVER draw <table>, <tr>, <td>, CSS grid borders, cell fills, or header text.
 */
export function ResultRenderer({
  results,
  gridConfig,
  transformer,
}: ResultRendererProps) {
  if (!results || !gridConfig || !gridConfig.rows) return null;

  const defaultFontSize = gridConfig.defaultFontSize || 3.2;

  // Build a normalized parameter map for easy case-insensitive lookup
  const resultMap: Record<string, any> = {};

  if (Array.isArray(results)) {
    results.forEach((item) => {
      if (item && item.parameterCode) {
        const keyUpper = item.parameterCode.toUpperCase();
        const keyLower = item.parameterCode.toLowerCase();
        resultMap[keyUpper] = item;
        resultMap[keyLower] = item;
        resultMap[item.parameterCode] = item;
      }
    });
  } else if (typeof results === "object") {
    Object.entries(results).forEach(([k, v]) => {
      resultMap[k] = v;
      resultMap[k.toUpperCase()] = v;
      resultMap[k.toLowerCase()] = v;
    });
  }

  return (
    <>
      {gridConfig.rows.map((row) => {
        const resultData = resultMap[row.testKey] || resultMap[row.testKey.toUpperCase()] || resultMap[row.testKey.toLowerCase()];
        if (!resultData) return null;

        // Extract dynamic value properties
        const rawValue = typeof resultData === "object" ? (resultData.resultValue ?? resultData.value ?? resultData.result) : resultData;
        const unit = typeof resultData === "object" ? resultData.unit : undefined;
        const referenceRange = typeof resultData === "object" ? resultData.referenceRange : undefined;
        const outcome = typeof resultData === "object" ? (resultData.evaluationOutcome || resultData.flag) : undefined;
        const isAbnormal = outcome === "Abnormal" || typeof resultData === "object" && Boolean(resultData.isAbnormal);
        const flagText = typeof resultData === "object" ? (resultData.flag || (isAbnormal ? "H" : "")) : "";

        return (
          <React.Fragment key={row.testKey}>
            {Object.entries(gridConfig.columns).map(([colKey, colConfig]) => {
              let cellValue: string | undefined;

              if (colKey === "result" || colKey === "value") {
                cellValue = rawValue !== undefined && rawValue !== null ? String(rawValue) : undefined;
              } else if (colKey === "unit") {
                cellValue = unit;
              } else if (colKey === "referenceRange" || colKey === "referenceInterval") {
                cellValue = referenceRange;
              } else if (colKey === "flag") {
                cellValue = flagText;
              } else if (typeof resultData === "object" && resultData[colKey] !== undefined) {
                cellValue = String(resultData[colKey]);
              }

              if (!cellValue) return null;

              const fieldConfig: TextField = {
                x: colConfig.x,
                y: row.y,
                width: colConfig.width,
                align: colConfig.align || "left",
                fontSize: defaultFontSize,
                fontWeight: isAbnormal || colKey === "flag" ? "bold" : "normal",
                color: isAbnormal && colKey === "flag" ? "#dc2626" : "#000000",
              };

              const style = transformer.transformFieldStyle(fieldConfig);

              return (
                <div
                  key={`${row.testKey}-${colKey}`}
                  style={{
                    ...style,
                    zIndex: 30,
                  }}
                  title={cellValue}
                >
                  {cellValue}
                </div>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}
