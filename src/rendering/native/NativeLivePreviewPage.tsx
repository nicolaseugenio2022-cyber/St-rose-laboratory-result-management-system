"use client";

import React from "react";
import type { ResolvedReportRenderModel, ResolvedSessionRenderModel } from "@/rendering/model";
import { composeNativeLivePreviewReportPage } from "./live-preview-composer";
import { NativeReportPreview } from "./NativeReportPreview";

export interface NativeLivePreviewPageProps {
  resolvedSession: ResolvedSessionRenderModel;
  resolvedReport: ResolvedReportRenderModel;
  reportTitle: string;
  zoomLevel?: number;
  isLastPage?: boolean;
}

export function NativeLivePreviewPage({
  resolvedSession,
  resolvedReport,
  reportTitle,
  zoomLevel = 100,
  isLastPage = true,
}: NativeLivePreviewPageProps) {
  try {
    const composedPage = composeNativeLivePreviewReportPage(resolvedSession, resolvedReport);
    const previewScale = zoomLevel / 100;
    const compositionProvider = composedPage.compositionSource === "StandardAdaptiveTabular" ||
      composedPage.compositionSource === "CompactResultGrid"
      ? "StandardNative"
      : "SpecializedNative";
    return (
      <div
        data-live-preview-production-path="native"
        data-live-preview-composition-source={composedPage.compositionSource}
        data-live-preview-composition-provider={compositionProvider}
        data-live-preview-scale={previewScale}
        data-live-preview-zoom-percent={zoomLevel}
        className={`shrink-0 ${!isLastPage ? "a4-page-break" : ""}`}
      >
        <NativeReportPreview page={composedPage} scale={previewScale} className="a4-preview-shadow" />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown native Live Preview composition failure.";
    return (
      <div
        role="alert"
        data-native-preview-composition-error={resolvedReport.templateCode}
        className="w-full max-w-2xl rounded-xl border border-red-300 bg-red-50 p-5 text-red-900 shadow-sm"
      >
        <h4 className="text-sm font-bold">Unable to compose {reportTitle}</h4>
        <p className="mt-1 text-xs leading-relaxed">{message}</p>
        <p className="mt-2 text-[11px] text-red-700">
          Shorten the overflowing report content or correct the reported asset/data issue, then reopen Live Preview.
        </p>
      </div>
    );
  }
}
