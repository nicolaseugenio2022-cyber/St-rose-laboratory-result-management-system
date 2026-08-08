import React, { useCallback, useMemo } from "react";
import { HydratedTemplateSpec } from "@/services/interfaces";
import { ILaboratoryReport, IPersonnel } from "@/domain/models/interfaces";
import { LaboratoryReportDomain, LaboratoryResultDomain } from "@/domain/models/laboratory-report-domain";
import { evaluateLDL } from "../utils/computed-formulas";
import { NumericTextInput } from "./controls/NumericTextInput";
import { SingleSelectInput } from "./controls/SingleSelectInput";
import { ComboboxInput } from "./controls/ComboboxInput";
import { FreeTextInput } from "./controls/FreeTextInput";
import { ComputedInput } from "./controls/ComputedInput";
import { SignatorySelectionSection } from "./SignatorySelectionSection";
import { TemplateRemarksSection } from "./TemplateRemarksSection";
import { ReagentKitInfoSection } from "./ReagentKitInfoSection";
import { FileSpreadsheet, CheckSquare, Square, FlaskConical, MessageSquare, UserCheck, CheckCircle2 } from "lucide-react";

export interface DynamicResultFormProps {
  spec: HydratedTemplateSpec;
  report: ILaboratoryReport;
  availablePersonnel: IPersonnel[];
  onChangeReport: (updatedReport: ILaboratoryReport) => void;
}

export function DynamicResultForm({
  spec,
  report,
  availablePersonnel,
  onChangeReport,
}: DynamicResultFormProps) {
  const { template, parameters, signatoryRequirement } = spec;

  // Memoized parameter list sorted by display order
  const sortedParameters = useMemo(() => {
    return [...parameters].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [parameters]);

  // Toggle parameter selection (isSelected)
  const handleToggleSelect = useCallback(
    (paramCode: string, selected: boolean) => {
      const updatedResults = report.results.map((r) => {
        if (r.parameterCode === paramCode) {
          return new LaboratoryResultDomain({ ...r, isSelected: selected });
        }
        return r;
      });
      onChangeReport(new LaboratoryReportDomain({ ...report, results: updatedResults }));
    },
    [report, onChangeReport]
  );

  // Select All / Deselect All
  const handleSelectAllToggle = useCallback(
    (selectAll: boolean) => {
      const updatedResults = report.results.map((r) => new LaboratoryResultDomain({ ...r, isSelected: selectAll }));
      onChangeReport(new LaboratoryReportDomain({ ...report, results: updatedResults }));
    },
    [report, onChangeReport]
  );

  // Handle value change for a parameter with automatic LDL computation support for CHEM_10 and HDL_LDL
  const handleResultValueChange = useCallback(
    (paramCode: string, value: string, outcome: LaboratoryResultDomain["evaluationOutcome"]) => {
      let updatedResults = report.results.map((r) => {
        if (r.parameterCode === paramCode) {
          return new LaboratoryResultDomain({ ...r, resultValue: value, evaluationOutcome: outcome });
        }
        return r;
      });

      // Auto-calculate LDL for CHEM_10 and HDL_LDL per architecture/specifications/CHEM_10.md & HDL_LDL.md
      if (template.templateCode === "CHEM_10" || template.templateCode === "HDL_LDL") {
        const getVal = (code: string) => {
          const found = updatedResults.find((r) => r.parameterCode === code);
          return found && found.resultValue.trim() !== "" ? parseFloat(found.resultValue) : NaN;
        };

        const trig = getVal("TRIGLYCERIDES");
        const hdl = getVal("HDL");
        const chol = getVal("CHOLESTEROL");

        const computedLdl = evaluateLDL(trig, hdl, chol);

        updatedResults = updatedResults.map((r) => {
          if (r.parameterCode === "LDL") {
            if (computedLdl && computedLdl.value) {
              return new LaboratoryResultDomain({
                ...r,
                resultValue: computedLdl.value,
                evaluationOutcome: computedLdl.outcome,
              });
            } else {
              return new LaboratoryResultDomain({
                ...r,
                resultValue: "",
                evaluationOutcome: "NoEvaluation",
              });
            }
          }
          return r;
        });
      }

      onChangeReport(new LaboratoryReportDomain({ ...report, results: updatedResults }));
    },
    [report, template.templateCode, onChangeReport]
  );

  const selectedResults = useMemo(() => {
    return report.results.filter((r) => (r as LaboratoryResultDomain).isSelected ?? true);
  }, [report.results]);

  const completedCount = useMemo(() => {
    return selectedResults.filter((r) => r.resultValue && r.resultValue.trim() !== "").length;
  }, [selectedResults]);

  const completionPercent = useMemo(() => {
    if (selectedResults.length === 0) return 0;
    return Math.round((completedCount / selectedResults.length) * 100);
  }, [completedCount, selectedResults.length]);

  const allSelected = useMemo(() => {
    return sortedParameters.every((p) => {
      const res = report.results.find((r) => r.parameterCode === p.parameterCode);
      return res ? ((res as LaboratoryResultDomain).isSelected ?? true) : true;
    });
  }, [sortedParameters, report.results]);

  const handleKeyDownFocusNext = useCallback(
    (currentIndex: number) => {
      const nextIndex = currentIndex + 1;
      if (nextIndex < sortedParameters.length) {
        const nextParamCode = sortedParameters[nextIndex].parameterCode;
        const nextElement = document.querySelector(
          `[data-param-code="${nextParamCode}"] input, [data-param-code="${nextParamCode}"] select`
        ) as HTMLElement;
        if (nextElement) {
          nextElement.focus();
        }
      }
    },
    [sortedParameters]
  );

  const progressColorClass = useMemo(() => {
    if (completionPercent === 0) return "bg-slate-300";
    if (completionPercent === 100) return "bg-emerald-500";
    return "bg-brand-primary";
  }, [completionPercent]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs mb-4 overflow-hidden">
      {/* Static Non-Sticky Card Header & Progress Bar */}
      <div className="bg-slate-50/90 border-b border-slate-200 px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-100 text-brand-primary shrink-0">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">{template.templateTitle}</h2>
                <span className="px-1.5 py-0.2 text-[10px] font-mono font-extrabold bg-white text-slate-700 rounded border border-slate-200">
                  {template.templateCode}
                </span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded">
                  {template.rendererFamily}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-28 sm:w-36 h-1.5 bg-slate-200/80 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${progressColorClass}`}
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                {completionPercent === 100 ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                    Complete ({completedCount}/{selectedResults.length})
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-600 font-mono">
                    {completedCount} / {selectedResults.length} Completed ({completionPercent}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Select All / Deselect All Action */}
          <button
            type="button"
            onClick={() => handleSelectAllToggle(!allSelected)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 shadow-2xs shrink-0"
          >
            {allSelected ? (
              <>
                <Square className="h-3.5 w-3.5 text-slate-500" />
                Deselect All
              </>
            ) : (
              <>
                <CheckSquare className="h-3.5 w-3.5 text-brand-primary" />
                Select All
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-3.5 sm:p-4 space-y-3">
        {/* Natural Workflow Section Header: Laboratory Results Encoding */}
        <div>
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-brand-primary" />
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Laboratory Results Encoding
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-mono">
              {completedCount} / {selectedResults.length} Completed
            </span>
          </div>

          {/* Dynamic Input Controls List with Zebra Striping, Focus Row Highlight & Completed Left Accent */}
          <div className="space-y-1">
            {sortedParameters.map((param, index) => {
              const resultDomain = report.results.find((r) => r.parameterCode === param.parameterCode);
              const val = resultDomain ? resultDomain.resultValue : param.defaultValue || "";
              const isSelected = resultDomain ? ((resultDomain as LaboratoryResultDomain).isSelected ?? true) : true;
              const evaluationOutcome = resultDomain ? resultDomain.evaluationOutcome : "NoEvaluation";
              const isHasValue = Boolean(val && val.trim() !== "");

              const rowClass = `group rounded-lg transition-all p-1 even:bg-slate-100/70 odd:bg-white hover:bg-blue-50/40 focus-within:bg-blue-50/70 focus-within:ring-1 focus-within:ring-brand-primary/30 border ${
                isHasValue ? "border-l-2 border-l-emerald-500 border-y-transparent border-r-transparent" : "border-transparent"
              } focus-within:border-blue-300 shadow-2xs`;

              switch (param.inputType) {
                case "NumericText":
                  return (
                    <div key={param.parameterCode} data-param-code={param.parameterCode} className={rowClass}>
                      <NumericTextInput
                        parameter={param}
                        value={val}
                        isSelected={isSelected}
                        onChange={(newVal, outcome) => handleResultValueChange(param.parameterCode, newVal, outcome)}
                        onToggleSelect={(selected) => handleToggleSelect(param.parameterCode, selected)}
                        onKeyDown={() => handleKeyDownFocusNext(index)}
                      />
                    </div>
                  );
                case "SingleSelect":
                  return (
                    <div key={param.parameterCode} data-param-code={param.parameterCode} className={rowClass}>
                      <SingleSelectInput
                        parameter={param}
                        value={val}
                        isSelected={isSelected}
                        onChange={(newVal, outcome) => handleResultValueChange(param.parameterCode, newVal, outcome)}
                        onToggleSelect={(selected) => handleToggleSelect(param.parameterCode, selected)}
                        onKeyDown={() => handleKeyDownFocusNext(index)}
                      />
                    </div>
                  );
                case "Combobox":
                  return (
                    <div key={param.parameterCode} data-param-code={param.parameterCode} className={rowClass}>
                      <ComboboxInput
                        parameter={param}
                        value={val}
                        isSelected={isSelected}
                        onChange={(newVal, outcome) => handleResultValueChange(param.parameterCode, newVal, outcome)}
                        onToggleSelect={(selected) => handleToggleSelect(param.parameterCode, selected)}
                        onKeyDown={() => handleKeyDownFocusNext(index)}
                      />
                    </div>
                  );
                case "FreeText":
                  return (
                    <div key={param.parameterCode} data-param-code={param.parameterCode} className={rowClass}>
                      <FreeTextInput
                        parameter={param}
                        value={val}
                        isSelected={isSelected}
                        onChange={(newVal, outcome) => handleResultValueChange(param.parameterCode, newVal, outcome)}
                        onToggleSelect={(selected) => handleToggleSelect(param.parameterCode, selected)}
                        onKeyDown={() => handleKeyDownFocusNext(index)}
                      />
                    </div>
                  );
                case "Computed":
                  return (
                    <div key={param.parameterCode} data-param-code={param.parameterCode} className={rowClass}>
                      <ComputedInput
                        parameter={param}
                        value={val}
                        isSelected={isSelected}
                        evaluationOutcome={evaluationOutcome}
                        onToggleSelect={(selected) => handleToggleSelect(param.parameterCode, selected)}
                      />
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>
        </div>

        {/* Section 2: Reagent Kit Information (Rendered when template.requiresKitInfo === true) */}
        {template.requiresKitInfo && (
          <div className="border-t border-slate-200/80 pt-3">
            <ReagentKitInfoSection
              kitInfo={report.reagentKitInfo}
              onChange={(updatedKit) => {
                onChangeReport(
                  new LaboratoryReportDomain({
                    ...report,
                    reagentKitInfo: updatedKit,
                  })
                );
              }}
            />
          </div>
        )}

        {/* Section 3: Laboratory Remarks (Rendered when template.supportsRemarks === true) */}
        {template.supportsRemarks && (
          <div className="border-t border-slate-200/80 pt-3">
            <TemplateRemarksSection
              remarks={report.remarks}
              onChange={(newRemarks) => {
                onChangeReport(
                  new LaboratoryReportDomain({
                    ...report,
                    remarks: newRemarks,
                  })
                );
              }}
            />
          </div>
        )}

        {/* Section 4: Signatory Selection & Approval Metadata Section */}
        <div className="border-t border-slate-200/80 pt-3">
          <SignatorySelectionSection
            templateCode={template.templateCode}
            signatories={report.signatories}
            requiredPathologistsCount={signatoryRequirement.requiredPathologistsCount}
            requiredMedtechsCount={signatoryRequirement.requiredMedtechsCount}
            availablePersonnel={availablePersonnel}
            onChange={(updatedSignatories) => {
              onChangeReport(
                new LaboratoryReportDomain({
                  ...report,
                  signatories: updatedSignatories,
                })
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
