import React from "react";
import Image from "next/image";

export interface ReportHeaderBlockProps {
  colorPalette?: string;
}

export function ReportHeaderBlock({ colorPalette = "#093982" }: ReportHeaderBlockProps) {
  return (
    <div className="w-full pb-3 mb-4 border-b-2" style={{ borderColor: colorPalette }}>
      <div className="flex items-center justify-between gap-4">
        {/* Logo Emblem */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 relative shrink-0">
            <Image
              src="/logo.png"
              alt="St. Rose Diagnostic Laboratory Logo"
              width={56}
              height={56}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-lg font-extrabold uppercase tracking-tight" style={{ color: colorPalette }}>
              ST. ROSE DIAGNOSTIC LABORATORY
            </h1>
            <p className="text-[11px] font-medium text-slate-600">
              San Roque, Sta. Rosa, Nueva Ecija | Contact No: 0917-123-4567
            </p>
            <p className="text-[10px] italic text-slate-500">
              Licensed Diagnostic Laboratory Services
            </p>
          </div>
        </div>

        {/* Official Header Badge */}
        <div className="text-right shrink-0">
          <span className="px-2.5 py-1 text-[10px] font-bold rounded uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            OFFICIAL LABORATORY REPORT
          </span>
        </div>
      </div>
    </div>
  );
}
