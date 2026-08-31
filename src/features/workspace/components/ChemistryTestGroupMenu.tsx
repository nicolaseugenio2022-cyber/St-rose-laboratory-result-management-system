import React from "react";
import { FlaskConical, Check } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ChemistryTestGroupMenuProps {
  selectedTemplateCodes: string[];
  activeTemplateCode: string;
  onToggleTest: (code: string) => void;
  onSelectActiveTest: (code: string) => void;
}

export function ChemistryTestGroupMenu({
  selectedTemplateCodes,
  activeTemplateCode,
  onToggleTest,
  onSelectActiveTest,
}: ChemistryTestGroupMenuProps) {
  const chemistryTests = [
    { code: "CHEM_8", name: "Chemistry 8 Panel", desc: "FBS, BUN, Creatinine, BUA, Lipid Profile" },
    { code: "CHEM_10", name: "Chemistry 10 Panel", desc: "Chem 8 + Liver Enzymes (SGOT/SGPT)" },
    { code: "HDL_LDL", name: "Lipid Profile Panel", desc: "Cholesterol, Triglycerides, HDL, Computed LDL" },
    { code: "RBS", name: "Random Blood Sugar", desc: "Rapid Blood Glucose Level" },
  ];

  return (
    // A structural tint group with an eyebrow label; the panel tiles are the only white in it.
    <div className="mb-4 rounded-lg border border-brand-border bg-brand-structural p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <FlaskConical aria-hidden="true" className="h-4 w-4 text-brand-primary" />
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted">Chemistry Shared Workflow Menu</h3>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {chemistryTests.map((test) => {
          const isSelected = selectedTemplateCodes.includes(test.code);
          const isActive = activeTemplateCode === test.code;

          return (
            // Active: the brand tint with a teal edge and a navy label; selected: white with the
            // teal check; unselected: white and muted. The check is the selected cue, the fill
            // is the active cue, so neither state relies on colour alone.
            <div
              key={test.code}
              onClick={() => {
                if (!isSelected) onToggleTest(test.code);
                onSelectActiveTest(test.code);
              }}
              className={cn(
                "relative cursor-pointer rounded-md border p-2.5 text-left transition-colors duration-150",
                isActive
                  ? "border-brand-primary bg-brand-tint text-brand-navy"
                  : isSelected
                  ? "border-brand-border bg-brand-surface text-brand-text hover:bg-brand-surface-hover"
                  : "border-brand-border bg-brand-surface text-brand-text-muted hover:bg-brand-surface-hover"
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="truncate text-xs font-semibold">{test.name}</span>
                {isSelected && (
                  <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 stroke-[2.5] text-brand-primary" />
                )}
              </div>
              <p className="line-clamp-1 text-[10px] text-brand-text-muted">
                {test.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
