import React from "react";
import Image from "next/image";

export interface LaboratoryInfoConfig {
  logo?: string;
  laboratoryName?: string;
  address1?: string;
  address2?: string;
  phone?: string;
}

export interface ReportHeaderBlockProps {
  colorPalette?: string;
  labInfo?: LaboratoryInfoConfig;
}

/**
 * ReportHeaderBlock - Pure Browser-Native Grid Header Component
 *
 * Architecture:
 * - 2-Column CSS Grid: `grid-cols-[165px_1fr] items-start`
 * - Column 1: Stable 165px fixed-width container for logo, preserving visual aspect ratio (`object-contain`).
 * - Column 2: Fills remaining printable width (`1fr`), text centered with deterministic spacing (`space-y-0.5`).
 * - Divider Line: Header-owned baseline rule (`border-b-[1.5pt] border-[#5B80A5]`).
 * - Pure Presentation: Laboratory details supplied via props / configuration object.
 */
export function ReportHeaderBlock({
  colorPalette = "#365F91",
  labInfo = {},
}: ReportHeaderBlockProps) {
  const logo = labInfo.logo || "/st-rose-logo-official.png";
  const laboratoryName = labInfo.laboratoryName || "ST. ROSE DIAGNOSTIC LABORATORY";
  const address1 = labInfo.address1 || "LA FUENTE, SANTA ROSA NUEVA ECIJA";
  const address2 = labInfo.address2 || "(IN FRONT OF LA FUENTE ELEMENTARY SCHOOL)";
  const phone = labInfo.phone || "CELLPHONE NO. 0905-309-3602";

  return (
    <header className="w-full grid grid-cols-[105px_1fr] items-start gap-4 border-b-[1.5pt] border-[#5B80A5] pb-2 mb-3">
      {/* Column 1: Calibrated 105px Logo Container */}
      <div className="w-full flex justify-start items-start">
        <Image
          src={logo}
          alt={laboratoryName}
          width={105}
          height={51}
          className="w-full h-auto object-contain block"
          priority
        />
      </div>

      {/* Column 2: Fills Remaining Width (1fr) with Deterministic Text Stack */}
      <div className="flex flex-col items-center text-center space-y-0.5 py-0.5">
        <h1
          className="text-[16pt] font-bold uppercase tracking-wide leading-none"
          style={{
            color: colorPalette,
            fontFamily: "'Copperplate Gothic Light', 'Copperplate', 'Arial', sans-serif",
          }}
        >
          {laboratoryName}
        </h1>
        <p className="text-[9pt] font-semibold leading-tight" style={{ color: colorPalette }}>
          {address1}
        </p>
        <p className="text-[9pt] font-medium leading-tight" style={{ color: colorPalette }}>
          {address2}
        </p>
        <p className="text-[9pt] font-medium leading-tight" style={{ color: colorPalette }}>
          {phone}
        </p>
      </div>
    </header>
  );
}

