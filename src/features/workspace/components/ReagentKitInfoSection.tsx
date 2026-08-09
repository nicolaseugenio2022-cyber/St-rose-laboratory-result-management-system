import React from "react";
import { ReagentKitInfo } from "@/domain/types";
import { Package } from "lucide-react";

export interface ReagentKitInfoSectionProps {
  kitInfo?: ReagentKitInfo | null;
  onChange: (info: ReagentKitInfo) => void;
}

export function ReagentKitInfoSection({ kitInfo, onChange }: ReagentKitInfoSectionProps) {
  const current: ReagentKitInfo = kitInfo || {
    kitBrand: "",
    lotNumber: "",
    expirationDate: "",
  };

  const handleChange = (field: keyof ReagentKitInfo, val: string) => {
    onChange({
      ...current,
      [field]: val,
    });
  };

  return (
    <div className="bg-amber-50/60 rounded-xl border border-amber-200 p-3.5 mt-2.5">
      <div className="flex items-center gap-2 mb-3">
        <Package className="h-4 w-4 text-amber-700" />
        <h3 className="text-xs font-bold text-amber-900">Reagent Kit Information (Mandatory for Rapid Test Templates)</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-amber-900 mb-1">Lot Number *</label>
          <input
            type="text"
            data-kit-field="lotNumber"
            data-encoding-input
            value={current.lotNumber}
            onChange={(e) => handleChange("lotNumber", e.target.value)}
            placeholder="e.g. LOT-2026-X89"
            className="w-full px-2.5 py-1.5 text-xs rounded-md border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-amber-900 mb-1">Kit Expiration Date *</label>
          <input
            type="text"
            data-kit-field="expirationDate"
            data-encoding-input
            value={current.expirationDate}
            onChange={(e) => handleChange("expirationDate", e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-md border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            required
          />
        </div>
      </div>
    </div>
  );
}
