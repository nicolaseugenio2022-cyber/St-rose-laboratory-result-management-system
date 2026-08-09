import React from "react";
import { TextField, ImageField } from "../types/layout.types";

/**
 * CoordinateTransformer
 * Centralized unit conversion authority for millimeter-to-pixel and point math.
 * Standard A4 canvas: 210mm x 297mm.
 * Manages presentation scaling (preview 0.5 vs print/export 1.0) without changing
 * logical millimeter layout coordinates.
 */
export class CoordinateTransformer {
  private readonly baseDpi: number = 96;
  private readonly mmToPxRatio: number = 96 / 25.4; // 3.779527559 pixels per mm at 96 DPI
  private readonly mmToPtRatio: number = 72 / 25.4; // 2.834645669 points per mm

  constructor(private readonly scale: number = 1.0) {}

  /**
   * Converts millimeters to screen pixels at current scale factor.
   */
  public mmToPx(mm: number): number {
    return mm * this.mmToPxRatio * this.scale;
  }

  /**
   * Converts millimeters to PDF points (72 DPI).
   */
  public mmToPt(mm: number): number {
    return mm * this.mmToPtRatio;
  }

  /**
   * Converts millimeters to 300 DPI high-resolution canvas pixels.
   */
  public mmToHighDpiPx(mm: number): number {
    return mm * (300 / 25.4);
  }

  /**
   * Returns current scale factor.
   */
  public getScale(): number {
    return this.scale;
  }

  /**
   * Returns standard A4 canvas width and height in pixels for current scale.
   */
  public getCanvasDimensions(): { width: number; height: number; widthMm: number; heightMm: number } {
    return {
      width: this.mmToPx(210),
      height: this.mmToPx(297),
      widthMm: 210,
      heightMm: 297,
    };
  }

  /**
   * Transforms a TextField definition into absolute CSS style properties.
   */
  public transformFieldStyle(field: TextField): React.CSSProperties {
    return {
      position: "absolute",
      left: `${this.mmToPx(field.x)}px`,
      top: `${this.mmToPx(field.y)}px`,
      width: field.width ? `${this.mmToPx(field.width)}px` : "auto",
      height: field.height ? `${this.mmToPx(field.height)}px` : "auto",
      fontSize: field.fontSize ? `${this.mmToPx(field.fontSize)}px` : `${this.mmToPx(3.2)}px`,
      fontWeight: field.fontWeight || "normal",
      color: field.color || "#000000",
      textAlign: field.align || "left",
      lineHeight: field.lineHeight ? `${field.lineHeight}` : "1.2",
      fontFamily: field.fontFamily || "Arial, Helvetica, sans-serif",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      textTransform: field.textTransform === "uppercase" ? "uppercase" : undefined,
      boxSizing: "border-box",
      pointerEvents: "none",
    };
  }

  /**
   * Transforms an ImageField definition into absolute CSS style properties.
   */
  public transformImageStyle(image: ImageField): React.CSSProperties {
    return {
      position: "absolute",
      left: `${this.mmToPx(image.x)}px`,
      top: `${this.mmToPx(image.y)}px`,
      width: `${this.mmToPx(image.width)}px`,
      height: `${this.mmToPx(image.height)}px`,
      objectFit: "contain",
      boxSizing: "border-box",
      pointerEvents: "none",
    };
  }
}
