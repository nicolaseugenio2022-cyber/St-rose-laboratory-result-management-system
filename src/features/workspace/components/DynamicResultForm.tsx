import React, { useCallback, useMemo } from "react";
import { ILaboratoryReport } from "@/domain/models/interfaces";
import { LaboratoryReportDomain, LaboratoryResultDomain } from "@/domain/models/laboratory-report-domain";
import { ClinicalReportDefinition } from "@/domain/types/report-definition";
import { applyAllSelectableParameters, applyCalculationMode, applyEncodingResultValue, applyParameterSelection, getEditableResultValue } from "../encoding/report-encoding";
import { getReportEncodingProgress } from "../encoding/encoding-progress";
import { normalizeCalculationModes, resolveCalculationMode, type CalculationMode } from "@/domain/calculation-mode";
import type { PatientSex } from "@/domain/types";
import { NumericTextInput } from "./controls/NumericTextInput";
import { SingleSelectInput } from "./controls/SingleSelectInput";
import { ComboboxInput } from "./controls/ComboboxInput";
import { FreeTextInput } from "./controls/FreeTextInput";
import { ComputedInput } from "./controls/ComputedInput";
import { ConditionalChoiceInput } from "./ConditionalChoiceInput";
import { PARAMETER_ROW_TRACKS } from "./controls/ParameterRow";
import { RequestedBySection } from "./RequestedBySection";
import { AdditionalEncodingFieldsSection } from "./AdditionalEncodingFieldsSection";
import { cn } from "@/utils/cn";
import { CheckCircle2, CheckSquare, FileSpreadsheet, Square } from "lucide-react";

export interface DynamicResultFormProps {
  definition: ClinicalReportDefinition;
  report: ILaboratoryReport;
  patientSex?: PatientSex | null;
  onChangeReport: (updatedReport: ILaboratoryReport) => void;
  /**
   * Manual -> Auto discards an operator-entered clinical result, so the Workspace owns that
   * confirmation. Auto -> Manual loses nothing and is applied here directly.
   */
  onRequestManualToAuto?: (templateCode: string, parameterCode: string, parameterName: string) => void;
}

export function DynamicResultForm({ definition, report, patientSex, onChangeReport, onRequestManualToAuto }: DynamicResultFormProps) {
  const sortedParameters = useMemo(() => [...definition.parameters].sort((a, b) => a.displayOrder - b.displayOrder), [definition]);
  const calculationModes = useMemo(() => normalizeCalculationModes(report.encodingData?.calculationModes), [report.encodingData?.calculationModes]);
  const updateEncodingData = useCallback((patch: Partial<NonNullable<ILaboratoryReport["encodingData"]>>) => {
    onChangeReport(new LaboratoryReportDomain({ ...report, encodingData: { ...(report.encodingData || {}), ...patch } }));
  }, [report, onChangeReport]);

  const handleToggleSelect = useCallback((paramCode: string, selected: boolean) => {
    onChangeReport(applyParameterSelection(report, definition, paramCode, selected));
  }, [definition, report, onChangeReport]);

  const handleSelectAllToggle = useCallback((selected: boolean) => {
    onChangeReport(applyAllSelectableParameters(report, definition, selected));
  }, [definition, report, onChangeReport]);

  // Completion is the shared Workspace rule (encoding-progress.ts), not a local calculation: the
  // session-level indicator counts whole reports from the same rule, and a second copy of what
  // counts as encoded would be free to drift from this rendered counter.
  const { selectedCount, completedCount, completionPercent } = getReportEncodingProgress(report, definition);
  const allSelected = sortedParameters.every((parameter) => {
    if (!parameter.isSelectable) return true;
    return (report.results.find((result) => result.parameterCode === parameter.parameterCode) as LaboratoryResultDomain | undefined)?.isSelected ?? true;
  });

  return <div
    id={`report-panel-${definition.templateCode}`}
    role="tabpanel"
    aria-labelledby={`report-tab-${definition.templateCode}`}
    className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    data-encoding-report={definition.templateCode}
  >
    <div className="border-b border-slate-200 bg-slate-50/90 px-3.5 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 items-center gap-2"><FileSpreadsheet className="h-4 w-4 shrink-0 text-brand-primary" /><h2 className="truncate text-sm font-bold text-slate-800">{definition.templateTitle}</h2><span className="shrink-0 rounded border border-slate-200 bg-white px-1.5 text-[10px] font-bold">{definition.templateCode}</span></div>
        <div className="flex shrink-0 items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 sm:w-36"><div className="h-full rounded-full bg-brand-primary" style={{ width: `${completionPercent}%` }} /></div><span className="text-[10px] font-bold text-slate-600">{completedCount}/{selectedCount}</span>{completionPercent === 100 && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}</div>
        <button type="button" onClick={() => handleSelectAllToggle(!allSelected)} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{allSelected ? <Square className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}{allSelected ? "Deselect optional" : "Select optional"}</button>
      </div>
    </div>
    <div className="space-y-2.5 p-3 sm:p-3.5">
      <RequestedBySection policy={definition.requestedByPolicy} value={report.encodingData?.requestedBy || ""} onChange={(requestedBy) => updateEncodingData({ requestedBy })} />
      <AdditionalEncodingFieldsSection fields={definition.additionalEncodingFields || []} values={report.encodingData?.additionalFields || {}} onChange={(fieldCode, value) => updateEncodingData({ additionalFields: { ...(report.encodingData?.additionalFields || {}), [fieldCode]: value } })} />
      <section className="overflow-hidden rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-2.5 py-1.5"><FileSpreadsheet aria-hidden="true" className="h-3.5 w-3.5 text-brand-primary" /><h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">Laboratory Results Encoding</h3></div>
        {/* Worksheet column header, laid out from PARAMETER_ROW_TRACKS so it cannot drift out of
            alignment with the rows. aria-hidden because it is a visual scanning aid only: the real
            semantics live on each control, which already carries its own accessible name, and
            announcing these as headers without genuine table markup would describe a structure
            that is not there. Hidden below sm, where the row reflows and the columns do not exist. */}
        <div
          aria-hidden="true"
          className={cn(
            "hidden gap-x-2 border-b border-l-2 border-l-transparent border-b-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:grid sm:items-center",
            PARAMETER_ROW_TRACKS
          )}
        >
          <span className="pl-[1.375rem]">Parameter</span>
          <span>Result</span>
          <span>Unit</span>
          <span>Reference</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-slate-100">{sortedParameters.map((parameter) => {
          const result = report.results.find((item) => item.parameterCode === parameter.parameterCode);
          const value = getEditableResultValue(parameter, result?.resultValue || "");
          const isSelected = (result as LaboratoryResultDomain | undefined)?.isSelected ?? true;
          const common = { parameter, value, isSelected, patientSex, onToggleSelect: (selected: boolean) => handleToggleSelect(parameter.parameterCode, selected) };
          const onChange = (nextValue: string, outcome: LaboratoryResultDomain["evaluationOutcome"]) => onChangeReport(applyEncodingResultValue(report, definition, parameter.parameterCode, nextValue, outcome, { sex: patientSex }));
          let control: React.ReactNode;
          if (parameter.conditionalChoiceSpec) control = <ConditionalChoiceInput {...common} onChange={onChange} />;
          else if (parameter.inputType === "NumericText") control = <NumericTextInput {...common} onChange={onChange} />;
          else if (parameter.inputType === "SingleSelect") control = <SingleSelectInput {...common} onChange={onChange} />;
          else if (parameter.inputType === "Combobox") control = <ComboboxInput {...common} onChange={onChange} />;
          else if (parameter.inputType === "FreeText") control = <FreeTextInput {...common} onChange={onChange} />;
          else control = <ComputedInput
            {...common}
            evaluationOutcome={result?.evaluationOutcome}
            computationMetadata={result?.computationMetadata}
            calculationMode={resolveCalculationMode(parameter.formulaBinding, parameter.parameterCode, calculationModes)}
            onChange={onChange}
            onRequestModeChange={(next: CalculationMode) => {
              if (next === "Manual") {
                onChangeReport(applyCalculationMode(report, definition, parameter.parameterCode, "Manual", { sex: patientSex }));
                return;
              }
              onRequestManualToAuto?.(definition.templateCode, parameter.parameterCode, parameter.parameterName);
            }}
          />;
          // Zebra lives on the row wrapper, not inside ParameterRow: a selected row paints no
          // background of its own so the stripe shows through, while a deselected row keeps its
          // muted fill and a focused row keeps its brand wash. Quiet enough that no text loses
          // contrast against it.
          return <div key={parameter.parameterCode} data-param-code={parameter.parameterCode} className="even:bg-slate-50/60">{control}</div>;
        })}</div>
      </section>
    </div>
  </div>;
}
