/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import type { NativeComposedPage, NativePagePrimitive, NativeTextStyle } from "./types";

const PX_PER_MM = 96 / 25.4;
const PX_PER_PT = 96 / 72;

export interface NativeReportPreviewProps {
  page: NativeComposedPage;
  scale?: number;
  className?: string;
}

function textStyle(
  page: NativeComposedPage,
  primitive: NativeTextStyle & { x: number; y: number; width?: number; height?: number },
  scale: number
): React.CSSProperties {
  const font = page.fontRoles[primitive.fontRole];
  return {
    position: "absolute",
    left: primitive.x * PX_PER_MM * scale,
    top: primitive.y * PX_PER_MM * scale,
    width: primitive.width ? primitive.width * PX_PER_MM * scale : undefined,
    height: primitive.height ? primitive.height * PX_PER_MM * scale : undefined,
    color: primitive.color || "#000000",
    fontFamily: font?.previewFamily || "Helvetica, Arial, sans-serif",
    fontSize: primitive.fontSizePt * PX_PER_PT * scale,
    fontWeight: primitive.fontWeight === "bold" ? 700 : 400,
    lineHeight: primitive.lineHeightMm
      ? `${primitive.lineHeightMm * PX_PER_MM * scale}px`
      : 1.05,
    textAlign: primitive.align || "left",
    textDecoration: primitive.underline ? "underline" : undefined,
    textTransform: primitive.uppercase ? "uppercase" : undefined,
    whiteSpace: "nowrap",
    overflow: "hidden",
    boxSizing: "border-box",
  };
}

function renderPrimitive(page: NativeComposedPage, primitive: NativePagePrimitive, scale: number) {
  if (primitive.kind === "text") {
    return (
      <div
        key={primitive.id}
        data-native-primitive-id={primitive.id}
        data-native-font-size-pt={primitive.fontSizePt}
        style={textStyle(page, primitive, scale)}
      >
        {primitive.text}
      </div>
    );
  }

  if (primitive.kind === "rich-text") {
    return (
      <div
        key={primitive.id}
        data-native-primitive-id={primitive.id}
        style={textStyle(page, primitive, scale)}
      >
        {primitive.lines.map((line, lineIndex) => (
          <div key={`${primitive.id}-line-${lineIndex}`}>
            {line.map((run, runIndex) => (
              <span
                key={`${primitive.id}-line-${lineIndex}-run-${runIndex}`}
                style={{
                  position: "relative",
                  top: (run.riseMm || 0) * PX_PER_MM * scale,
                  fontSize: run.fontSizePt ? run.fontSizePt * PX_PER_PT * scale : undefined,
                }}
              >
                {run.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (primitive.kind === "image") {
    return (
      <img
        key={primitive.id}
        data-native-primitive-id={primitive.id}
        src={primitive.source}
        alt=""
        style={{
          position: "absolute",
          left: primitive.x * PX_PER_MM * scale,
          top: primitive.y * PX_PER_MM * scale,
          width: (primitive.width || 0) * PX_PER_MM * scale,
          height: (primitive.height || 0) * PX_PER_MM * scale,
          objectFit: primitive.fit,
        }}
      />
    );
  }

  if (primitive.kind === "line") {
    const horizontal = primitive.y1 === primitive.y2;
    return (
      <div
        key={primitive.id}
        data-native-primitive-id={primitive.id}
        style={{
          position: "absolute",
          left: Math.min(primitive.x1, primitive.x2) * PX_PER_MM * scale,
          top: Math.min(primitive.y1, primitive.y2) * PX_PER_MM * scale,
          width: horizontal
            ? Math.abs(primitive.x2 - primitive.x1) * PX_PER_MM * scale
            : Math.max(primitive.widthMm * PX_PER_MM * scale, 0.5),
          height: horizontal
            ? Math.max(primitive.widthMm * PX_PER_MM * scale, 0.5)
            : Math.abs(primitive.y2 - primitive.y1) * PX_PER_MM * scale,
          backgroundColor: primitive.color,
        }}
      />
    );
  }

  return (
    <div
      key={primitive.id}
      data-native-primitive-id={primitive.id}
      style={{
        position: "absolute",
        left: primitive.x * PX_PER_MM * scale,
        top: primitive.y * PX_PER_MM * scale,
        width: primitive.width * PX_PER_MM * scale,
        height: primitive.height * PX_PER_MM * scale,
        backgroundColor: primitive.fill || "transparent",
        border: primitive.stroke
          ? `${Math.max((primitive.strokeWidthMm || 0.15) * PX_PER_MM * scale, 0.5)}px solid ${primitive.stroke}`
          : undefined,
        boxSizing: "border-box",
      }}
    />
  );
}

export function NativeReportPreview({
  page,
  scale = 0.5,
  className = "",
}: NativeReportPreviewProps) {
  return (
    <div
      className={`relative overflow-hidden bg-white text-black ${className}`}
      data-native-report-preview={page.templateCode}
      data-content-bottom-mm={page.contentBottomMm}
      style={{
        width: page.widthMm * PX_PER_MM * scale,
        height: page.heightMm * PX_PER_MM * scale,
      }}
    >
      {page.primitives.map((primitive) => renderPrimitive(page, primitive, scale))}
    </div>
  );
}
