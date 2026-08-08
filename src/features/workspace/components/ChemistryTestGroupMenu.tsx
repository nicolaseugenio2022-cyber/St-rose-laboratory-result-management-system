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
    <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-3 mb-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <FlaskConical className="h-4 w-4 text-brand-primary" />
        <h3 className="text-xs font-bold text-slate-800">Chemistry Shared Workflow Menu</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {chemistryTests.map((test) => {
          const isSelected = selectedTemplateCodes.includes(test.code);
          const isActive = activeTemplateCode === test.code;

          return (
            <div
              key={test.code}
              onClick={() => {
                if (!isSelected) onToggleTest(test.code);
                onSelectActiveTest(test.code);
              }}
              className={cn(
                "p-2.5 rounded-lg border text-left cursor-pointer transition-all duration-150 relative",
                isActive
                  ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                  : isSelected
                  ? "bg-blue-50/70 border-blue-300 text-brand-text hover:bg-blue-100/70"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70"
              )}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-bold truncate">{test.name}</span>
                {isSelected && (
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full flex items-center justify-center shrink-0 text-[10px]",
                      isActive ? "bg-white text-brand-primary" : "bg-brand-primary text-white"
                    )}
                  >
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className={cn("text-[10px] line-clamp-1", isActive ? "text-blue-100" : "text-slate-400")}>
                {test.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
