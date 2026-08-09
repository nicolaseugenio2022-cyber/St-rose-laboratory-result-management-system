import React, { useCallback, useMemo } from "react";
import { HydratedTemplateSpec } from "@/services/interfaces";
import { ILaboratoryReport, IPersonnel } from "@/domain/models/interfaces";
import { LaboratoryReportDomain, LaboratoryResultDomain } from "@/domain/models/laboratory-report-domain";
import { ClinicalReportDefinition } from "@/domain/types/report-definition";
import { applyAllSelectableParameters, applyEncodingResultValue, applyParameterSelection, getEditableResultValue } from "../encoding/report-encoding";
import type { PatientSex } from "@/domain/types";
import { NumericTextInput } from "./controls/NumericTextInput";
import { SingleSelectInput } from "./controls/SingleSelectInput";
import { ComboboxInput } from "./controls/ComboboxInput";
import { FreeTextInput } from "./controls/FreeTextInput";
import { ComputedInput } from "./controls/ComputedInput";
import { ConditionalChoiceInput } from "./ConditionalChoiceInput";
import { RequestedBySection } from "./RequestedBySection";
import { AdditionalEncodingFieldsSection } from "./AdditionalEncodingFieldsSection";
import { RepeatableFindingsSection } from "./RepeatableFindingsSection";
import { SignatorySelectionSection } from "./SignatorySelectionSection";
import { TemplateRemarksSection } from "./TemplateRemarksSection";
import { ReagentKitInfoSection } from "./ReagentKitInfoSection";
import { CheckCircle2, CheckSquare, FileSpreadsheet, Square } from "lucide-react";

export interface DynamicResultFormProps {
  spec: HydratedTemplateSpec;
  definition: ClinicalReportDefinition;
  report: ILaboratoryReport;
  availablePersonnel: IPersonnel[];
  patientSex?: PatientSex | null;
  onChangeReport: (updatedReport: ILaboratoryReport) => void;
}

export function DynamicResultForm({ spec, definition, report, availablePersonnel, patientSex, onChangeReport }: DynamicResultFormProps) {
  const sortedParameters = useMemo(() => [...definition.parameters].sort((a, b) => a.displayOrder - b.displayOrder), [definition]);
  const updateEncodingData = useCallback((patch: Partial<NonNullable<ILaboratoryReport["encodingData"]>>) => {
    onChangeReport(new LaboratoryReportDomain({ ...report, encodingData: { ...(report.encodingData || {}), ...patch } }));
  }, [report, onChangeReport]);

  const handleToggleSelect = useCallback((paramCode: string, selected: boolean) => {
    onChangeReport(applyParameterSelection(report, definition, paramCode, selected));
  }, [definition, report, onChangeReport]);

  const handleSelectAllToggle = useCallback((selected: boolean) => {
    onChangeReport(applyAllSelectableParameters(report, definition, selected));
  }, [definition, report, onChangeReport]);

  const selectedResults = report.results.filter((result) => definition.parameters.some((parameter) => parameter.parameterCode === result.parameterCode) && ((result as LaboratoryResultDomain).isSelected ?? true));
  const completedCount = selectedResults.filter((result) => result.resultValue.trim() !== "").length;
  const completionPercent = selectedResults.length ? Math.round(completedCount / selectedResults.length * 100) : 0;
  const allSelected = sortedParameters.every((parameter) => {
    if (!parameter.isSelectable) return true;
    return (report.results.find((result) => result.parameterCode === parameter.parameterCode) as LaboratoryResultDomain | undefined)?.isSelected ?? true;
  });

  return <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs" data-encoding-report={definition.templateCode}>
    <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-brand-primary" /><h2 className="text-sm font-bold text-slate-800">{definition.templateTitle}</h2><span className="rounded border border-slate-200 bg-white px-1.5 text-[10px] font-bold">{definition.templateCode}</span></div>
          <div className="mt-1 flex items-center gap-2"><div className="h-1.5 w-36 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-primary" style={{ width: `${completionPercent}%` }} /></div><span className="text-[10px] font-bold text-slate-600">{completedCount}/{selectedResults.length}</span>{completionPercent === 100 && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}</div>
        </div>
        <button type="button" onClick={() => handleSelectAllToggle(!allSelected)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">{allSelected ? <Square className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}{allSelected ? "Deselect optional" : "Select optional"}</button>
      </div>
    </div>
    <div className="space-y-3 p-3.5 sm:p-4">
      <RequestedBySection policy={definition.requestedByPolicy} value={report.encodingData?.requestedBy || ""} onChange={(requestedBy) => updateEncodingData({ requestedBy })} />
      <AdditionalEncodingFieldsSection fields={definition.additionalEncodingFields || []} values={report.encodingData?.additionalFields || {}} onChange={(fieldCode, value) => updateEncodingData({ additionalFields: { ...(report.encodingData?.additionalFields || {}), [fieldCode]: value } })} />
      <section>
        <div className="mb-2.5 flex items-center gap-2 border-b border-slate-100 pb-2"><FileSpreadsheet className="h-4 w-4 text-brand-primary" /><h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Laboratory Results Encoding</h3></div>
        <div className="space-y-1">{sortedParameters.map((parameter) => {
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
          else control = <ComputedInput {...common} evaluationOutcome={result?.evaluationOutcome} computationMetadata={result?.computationMetadata} />;
          return <div key={parameter.parameterCode} data-param-code={parameter.parameterCode}>{control}</div>;
        })}</div>
      </section>
      {(definition.repeatableFindings?.length || 0) > 0 && <RepeatableFindingsSection specs={definition.repeatableFindings || []} values={report.encodingData?.repeatableFindings || {}} onChange={(category, findings) => updateEncodingData({ repeatableFindings: { ...(report.encodingData?.repeatableFindings || {}), [category]: findings } })} />}
      {definition.requiresKitInfo && <ReagentKitInfoSection kitInfo={report.reagentKitInfo} onChange={(reagentKitInfo) => onChangeReport(new LaboratoryReportDomain({ ...report, reagentKitInfo }))} />}
      {definition.supportsRemarks && <TemplateRemarksSection remarks={report.remarks} onChange={(remarks) => onChangeReport(new LaboratoryReportDomain({ ...report, remarks }))} />}
      <SignatorySelectionSection templateCode={definition.templateCode} signatories={report.signatories} requiredPathologistsCount={spec.signatoryRequirement.requiredPathologistsCount} requiredMedtechsCount={spec.signatoryRequirement.requiredMedtechsCount} availablePersonnel={availablePersonnel} onChange={(signatories) => onChangeReport(new LaboratoryReportDomain({ ...report, signatories }))} />
    </div>
  </div>;
}
