import { ReportLayout } from "../types/layout.types";
import { cbcLayout } from "./cbc.layout";

/**
 * Report Layout Registry
 * Central registry mapping template code to its declarative ReportLayout configuration.
 */

const layoutRegistry: Record<string, ReportLayout> = {
  CBC: cbcLayout,
};

/**
 * Register a ReportLayout configuration.
 */
export function registerReportLayout(layout: ReportLayout): void {
  if (layout && layout.templateCode) {
    layoutRegistry[layout.templateCode] = layout;
  }
}

/**
 * Get ReportLayout for a given template code.
 * Returns null if layout has not yet been registered.
 */
export function getReportLayout(templateCode: string): ReportLayout | null {
  return layoutRegistry[templateCode] || null;
}

/**
 * Returns all registered layout codes.
 */
export function getRegisteredLayoutCodes(): string[] {
  return Object.keys(layoutRegistry);
}

export { cbcLayout };
