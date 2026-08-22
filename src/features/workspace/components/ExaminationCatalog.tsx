import React, { useState, useMemo } from "react";
import { HydratedTemplateSpec } from "@/services/interfaces";
import { Search, ChevronDown, ChevronRight, Check, Plus, FlaskConical, Stethoscope, Microscope, ShieldCheck, HeartPulse, X } from "lucide-react";

export interface ExaminationCatalogProps {
  allTemplates: HydratedTemplateSpec[];
  selectedTemplateCodes: string[];
  activeTemplateCode: string | null;
  onSelectTemplate: (templateCode: string) => void;
  onToggleTemplateSelection: (templateCode: string) => void;
}

const FAMILY_ICONS: Record<string, React.ReactNode> = {
  Hematology: <FlaskConical className="h-4 w-4 text-red-500" />,
  "Clinical Chemistry": <Stethoscope className="h-4 w-4 text-blue-500" />,
  "Clinical Microscopy": <Microscope className="h-4 w-4 text-amber-500" />,
  "Serology & Immunology": <ShieldCheck className="h-4 w-4 text-emerald-500" />,
  "Blood Bank": <HeartPulse className="h-4 w-4 text-rose-500" />,
};

const RENDERER_DISPLAY_LABELS: Record<string, string> = {
  Tabular: "Tabular",
  SimpleResult: "Simple",
  DiagnosticGrid: "Diagnostic",
  NarrativeCertificate: "Narrative",
};

const ALIASES: Record<string, string[]> = {
  CBC: ["blood", "complete blood count", "hema", "hematology", "platelet", "wbc", "rbc"],
  ESR: ["blood", "sedimentation", "erythrocyte", "hema"],
  CT_BT: ["blood", "clotting", "bleeding", "time", "hema"],
  BLOOD_TYPING: ["blood", "group", "rh", "type", "bank"],
  CHEM_8: ["chem", "chemistry", "panel", "fbs", "sugar"],
  CHEM_10: ["chem", "chemistry", "panel", "lipid", "ldl", "hdl"],
  HDL_LDL: ["chem", "lipid", "cholesterol", "triglycerides"],
  RBS: ["chem", "sugar", "glucose", "random"],
  HBA1C: ["chem", "diabetes", "glycated", "a1c"],
  OGTT: ["chem", "glucose", "tolerance", "sugar"],
  URINALYSIS: ["urine", "microscopy", "urinalysis", "uti"],
  FECALYSIS: ["stool", "feces", "microscopy", "parasite"],
  HBSAG: ["serology", "hep", "hepatitis", "screening"],
  RPR: ["serology", "syphilis", "vdrl"],
  PREG_TEST: ["serology", "urine", "pregnancy", "hcg"],
  DENGUE_DUO: ["serology", "dengue", "ns1", "igg", "igm"],
  HIV_RESULT: ["serology", "hiv", "aids", "certificate"],
};

export function ExaminationCatalog({
  allTemplates,
  selectedTemplateCodes,
  activeTemplateCode,
  onSelectTemplate,
  onToggleTemplateSelection,
}: ExaminationCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedFamilies, setCollapsedFamilies] = useState<Record<string, boolean>>({});

  const groupedTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const groups: Record<string, HydratedTemplateSpec[]> = {
      Hematology: [],
      "Clinical Chemistry": [],
      "Clinical Microscopy": [],
      "Serology & Immunology": [],
      "Blood Bank": [],
    };

    allTemplates.forEach((spec) => {
      const family = spec.template.examinationFamily || "Clinical Chemistry";
      const code = spec.template.templateCode;
      const aliases = ALIASES[code] || [];

      const matchesSearch =
        query === "" ||
        code.toLowerCase().includes(query) ||
        spec.template.templateTitle.toLowerCase().includes(query) ||
        spec.template.examinationFamily.toLowerCase().includes(query) ||
        spec.template.rendererFamily.toLowerCase().includes(query) ||
        aliases.some((alias) => alias.toLowerCase().includes(query));

      if (matchesSearch) {
        if (!groups[family]) {
          groups[family] = [];
        }
        groups[family].push(spec);
      }
    });

    return groups;
  }, [allTemplates, searchQuery]);

  const toggleFamilyCollapse = (family: string) => {
    setCollapsedFamilies((prev) => ({ ...prev, [family]: !prev[family] }));
  };

  const totalMatchingTemplates = useMemo(() => {
    return Object.values(groupedTemplates).reduce((acc, list) => acc + list.length, 0);
  }, [groupedTemplates]);

  const selectedCount = selectedTemplateCodes.length;
  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header & Search Bar with 2-Level Visual Hierarchy */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/70 shrink-0 space-y-2">
        <div>
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4 text-brand-primary" />
            Examination Catalog
          </h3>
          <p className="text-[11px] font-medium text-slate-400 font-mono mt-0.5 pl-5">
            {isSearchActive
              ? `Showing ${totalMatchingTemplates} of ${allTemplates.length} examinations · ${selectedCount} selected`
              : `${Math.max(0, allTemplates.length - selectedCount)} Available · ${selectedCount} Selected`}
          </p>
        </div>

        {/* Enhanced Search Input with Clear Action */}
        <div className="relative">
          <Search aria-hidden="true" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400/80" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search examinations..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50/60 border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary/60 transition-colors placeholder:text-slate-500 font-medium text-slate-700"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md transition-colors"
              title="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Family Groups Container (+4px vertical spacing between categories) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {Object.entries(groupedTemplates).map(([family, specs]) => {
          if (specs.length === 0) return null;
          const isCollapsed = collapsedFamilies[family];
          const selectedInFamily = specs.filter((s) => selectedTemplateCodes.includes(s.template.templateCode)).length;
          const isAllSelected = selectedInFamily === specs.length && specs.length > 0;
          const isPartialSelected = selectedInFamily > 0 && selectedInFamily < specs.length;

          const categoryHeaderClass = isAllSelected
            ? "sticky top-0 z-10 w-full min-h-[38px] px-2 py-1 bg-emerald-50/95 border-l-4 border-l-emerald-500 border-b border-emerald-200/80 flex items-center justify-between text-left transition-all shadow-sm"
            : isPartialSelected
            ? "sticky top-0 z-10 w-full min-h-[38px] px-2 py-1 bg-blue-50/95 border-l-4 border-l-brand-primary border-b border-blue-200/80 flex items-center justify-between text-left transition-all shadow-sm"
            : "sticky top-0 z-10 w-full min-h-[38px] px-2 py-1 bg-slate-100/95 backdrop-blur-sm hover:bg-slate-200/90 border-b border-slate-200 flex items-center justify-between text-left transition-all shadow-sm";

          const statsText = isAllSelected
            ? `All ${specs.length} examinations selected ✓`
            : isPartialSelected
            ? `${specs.length} examinations · ${selectedInFamily} selected`
            : `${specs.length} examinations`;

          return (
            <div key={family} className="border border-slate-200/70 rounded-lg overflow-hidden bg-slate-50/40">
              {/* Sticky Progressive Category Header Accordion (Two-Level Compact Layout) */}
              <button
                type="button"
                onClick={() => toggleFamilyCollapse(family)}
                className={categoryHeaderClass}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  {/* Line 1: Category Icon + Primary Title (Vertically Centered Baseline) */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center justify-center shrink-0">
                      {FAMILY_ICONS[family] || <FlaskConical className="h-3.5 w-3.5 text-slate-600 shrink-0" />}
                    </div>
                    <span
                      className={`text-xs font-extrabold tracking-tight leading-none ${
                        isAllSelected
                          ? "text-emerald-950"
                          : isPartialSelected
                          ? "text-blue-950"
                          : "text-slate-900"
                      }`}
                    >
                      {family}
                    </span>
                  </div>

                  {/* Line 2: Secondary Descriptive Metadata Subtext (Subtle Contrast) */}
                  <p
                    className={`text-[9.5px] font-mono mt-0.25 pl-6 ${
                      isAllSelected
                        ? "font-bold text-emerald-700"
                        : isPartialSelected
                        ? "font-bold text-blue-700"
                        : "font-medium text-slate-500"
                    }`}
                  >
                    {statsText}
                  </p>
                </div>

                <div className="flex items-center shrink-0 ml-1">
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>

              {/* Examination Cards */}
              {!isCollapsed && (
                <div className="p-1 pt-1.5 space-y-1 bg-white">
                  {specs.map((spec) => {
                    const code = spec.template.templateCode;
                    const isSelected = selectedTemplateCodes.includes(code);
                    const isActive = activeTemplateCode === code;
                    const rendererLabel = RENDERER_DISPLAY_LABELS[spec.template.rendererFamily] || spec.template.rendererFamily;
                    const displayTitle = spec.template.catalogTitle || spec.template.templateTitle;

                    return (
                      <div
                        key={code}
                        className={`group relative h-[48px] px-2.5 py-1 rounded-lg border transition-all flex items-center justify-between gap-1.5 shrink-0 ${
                          isActive
                            ? "bg-blue-50/50 border-l-2 border-l-brand-primary border-y-slate-200/80 border-r-slate-200/80 shadow-sm"
                            : isSelected
                            ? "bg-slate-50/70 border-slate-200/90 hover:border-slate-300"
                            : "bg-white border-slate-200/80 hover:border-blue-300/80 hover:shadow-sm hover:bg-blue-50/10"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (!isSelected) {
                              onToggleTemplateSelection(code);
                            }
                            onSelectTemplate(code);
                          }}
                          className="flex min-w-0 flex-1 h-full cursor-pointer flex-col justify-between py-0.5 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                        >
                          {/* Row 1: Primary Title (Catalog Display Title from Template Metadata) */}
                          <span
                            className={`text-xs leading-tight block truncate ${
                              isActive ? "font-extrabold text-blue-950" : "font-bold text-slate-800 group-hover:text-brand-primary"
                            }`}
                            title={spec.template.templateTitle}
                          >
                            {displayTitle}
                          </span>

                          {/* Row 2: Secondary Non-Wrapping Metadata (Softened Contrast Code • Renderer) */}
                          <div className="flex items-center gap-2 whitespace-nowrap text-[9.5px] text-slate-500 font-mono overflow-hidden">
                            <span className="font-semibold text-slate-600 bg-slate-100/70 px-1.5 py-0.5 rounded border border-slate-200/60 shrink-0">
                              {code}
                            </span>
                            <span aria-hidden="true" className="text-slate-300/80">•</span>
                            <span className="inline-flex items-center justify-center h-3.5 px-1.5 py-0 text-[8.5px] font-semibold text-indigo-600 bg-indigo-50/70 border border-indigo-100/60 rounded shrink-0 leading-none">
                              {rendererLabel}
                            </span>
                          </div>
                        </button>

                        {/* Softened Guidance Selection Control Button (~15% Weight Reduction) */}
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTemplateSelection(code);
                          }}
                          className={`h-5 w-5 inline-flex items-center justify-center rounded-md transition-colors pointer-events-auto shrink-0 border ${
                            isSelected
                              ? "bg-slate-100/70 text-brand-primary/80 border-slate-200/90 hover:bg-slate-200/60"
                              : "bg-slate-50/80 text-slate-500 border-slate-200/60 hover:bg-slate-100 hover:text-slate-600"
                          }`}
                          title={isSelected ? "Deselect Examination" : "Select Examination"}
                          aria-label={`${isSelected ? "Deselect" : "Select"} ${displayTitle}`}
                        >
                          {isSelected ? <Check className="h-2.5 w-2.5 stroke-[2]" /> : <Plus className="h-2.5 w-2.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
