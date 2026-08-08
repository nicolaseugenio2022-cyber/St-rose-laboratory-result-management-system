import React from "react";
import { ReagentKitInfo } from "@/domain/types";

export interface ReagentKitBlockProps {
  kitInfo?: ReagentKitInfo | null;
}

export function ReagentKitBlock({ kitInfo }: ReagentKitBlockProps) {
  if (!kitInfo) return null;

  return (
    <div className="w-full bg-amber-50/50 border border-amber-200 rounded p-2.5 my-3 text-xs">
      <div className="flex items-center justify-between text-slate-700 font-medium">
        <div>
          <span className="font-bold text-amber-900 uppercase tracking-wider text-[10px] mr-1.5">REAGENT / KIT:</span>
          <span>{kitInfo.kitBrand || "Standard Rapid Test Kit"}</span>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <span className="font-bold text-amber-900 uppercase tracking-wider text-[10px] mr-1">LOT NO:</span>
            <span className="font-mono font-semibold">{kitInfo.lotNumber || "N/A"}</span>
          </div>
          <div>
            <span className="font-bold text-amber-900 uppercase tracking-wider text-[10px] mr-1">EXP DATE:</span>
            <span className="font-mono font-semibold">{kitInfo.expirationDate || "N/A"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
