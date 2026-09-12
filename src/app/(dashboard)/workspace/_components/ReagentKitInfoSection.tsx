import React from "react";
import { ReagentKitInfo } from "@/domain/types";
import { Input } from "@/components/ui/Input";
import { Package } from "lucide-react";
import { isRoutedInvalidControl } from "../_lib/encoding/completion-issue-routing";

export interface ReagentKitInfoSectionProps {
  kitInfo?: ReagentKitInfo | null;
  onChange: (info: ReagentKitInfo) => void;
  /**
   * Selector of the single control a completion failure resolved to, so the field focus lands on is
   * also announced as invalid. Optional, and absent marks nothing.
   */
  invalidFieldSelector?: string | null;
}

export function ReagentKitInfoSection({ kitInfo, onChange, invalidFieldSelector }: ReagentKitInfoSectionProps) {
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
    // A structural tint group like every other footer section. Whether the kit information is
    // still outstanding is stated in words by the footer summary bar, not by tinting this
    // whole block amber.
    <div className="rounded-lg border border-brand-border bg-brand-structural p-3">
      <div className="mb-3 flex items-center gap-2">
        <Package aria-hidden="true" className="h-4 w-4 text-brand-primary" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted">Reagent Kit Information (Mandatory for Rapid Test Templates)</h3>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input
          label="Lot Number *"
          type="text"
          data-kit-field="lotNumber"
          data-encoding-input
          aria-invalid={isRoutedInvalidControl(invalidFieldSelector, '[data-kit-field="lotNumber"]') || undefined}
          value={current.lotNumber}
          onChange={(e) => handleChange("lotNumber", e.target.value)}
          placeholder="e.g. LOT-2026-X89"
          required
        />

        <Input
          label="Kit Expiration Date *"
          type="text"
          data-kit-field="expirationDate"
          data-encoding-input
          aria-invalid={isRoutedInvalidControl(invalidFieldSelector, '[data-kit-field="expirationDate"]') || undefined}
          value={current.expirationDate}
          onChange={(e) => handleChange("expirationDate", e.target.value)}
          required
        />
      </div>
    </div>
  );
}
