import React, { useCallback, useMemo, useRef } from "react";
import { ILaboratoryReport } from "@/domain/models/interfaces";
import { LaboratoryReportDomain, LaboratoryResultDomain } from "@/domain/models/laboratory-report-domain";
import { ClinicalReportDefinition } from "@/domain/types/report-definition";
import { applyAllSelectableParameters, applyCalculationMode, applyEncodingResultValue, applyParameterSelection, getEditableResultValue } from "../_lib/encoding/report-encoding";
import { getReportEncodingProgress } from "../_lib/encoding/encoding-progress";
import { advanceToNextResultInput, collectResultInputs } from "../_lib/encoding/result-tab-navigation";
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
import { PanelIcon } from "./PanelIcon";
import { Button } from "@/components/ui/Button";
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

  // One handler at the grid boundary rather than an onKeyDown on every control: the event
  // bubbles here anyway, and duplicating this across six control components would be six
  // places for the skip rules to drift apart.
  const resultGridRef = useRef<HTMLDivElement>(null);
  const handleResultGridKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const container = resultGridRef.current;
    if (!container) return;
    advanceToNextResultInput(
      {
        key: event.key,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        target: event.target,
        preventDefault: () => event.preventDefault(),
      },
      collectResultInputs(container)
    );
  }, []);

  // Completion is the shared Workspace rule (encoding-progress.ts), not a local calculation: the
  // session-level indicator counts whole reports from the same rule, and a second copy of what
  // counts as encoded would be free to drift from this rendered counter.
  const { selectedCount, completedCount, completionPercent } = getReportEncodingProgress(report, definition);
  const allSelected = sortedParameters.every((parameter) => {
    if (!parameter.isSelectable) return true;
    return (report.results.find((result) => result.parameterCode === parameter.parameterCode) as LaboratoryResultDomain | undefined)?.isSelected ?? true;
  });

  return <div
    // The tabpanel identity lives on the Workspace wrapper that holds this form AND the
    // report footer, so remarks, kit information and signatories belong to the same labelled
    // panel as the results they sign off. Declaring it here would leave the footer outside
    // the panel, or create a second nested tabpanel for the same tab.
    className="mb-3 overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low"
  >
    {/* One heading per report. The active tab already names this report AND labels this
        panel, and the worksheet used to carry a third "Laboratory Results Encoding"
        heading inside its own bordered card - three titles and four frames for one table. */}
    {/* Structural header band on a white card: the report identity and its progress are
        chrome for the grid below, so they recede while the results stay the brightest
        thing in the panel. */}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-brand-border bg-brand-structural px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <PanelIcon icon={FileSpreadsheet} />
        <h2 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-brand-navy">{definition.templateTitle}</h2>
        <span className="shrink-0 font-mono text-xs text-brand-text-muted">{definition.templateCode}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Deliberately not animated. This advances on almost every keystroke, and a
            width transition is both a layout-property animation and a moving target
            beside the field being typed into. */}
        <div
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={selectedCount}
          aria-label={`${definition.templateTitle} results encoded`}
          className="h-1.5 w-24 overflow-hidden rounded-full bg-brand-border sm:w-36"
        >
          <div className="h-full rounded-full bg-brand-primary" style={{ width: `${completionPercent}%` }} />
        </div>
        <span className="font-mono text-xs font-semibold tabular-nums text-brand-text-muted">{completedCount}/{selectedCount}</span>
        {completionPercent === 100 && <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-brand-primary" />}
      </div>
      {/* Was a hand-rolled button with no hover and no focus ring at all. */}
      <Button type="button" variant="outline" size="sm" onClick={() => handleSelectAllToggle(!allSelected)} className="ml-auto shrink-0">
        {allSelected ? <Square aria-hidden="true" className="h-3.5 w-3.5" /> : <CheckSquare aria-hidden="true" className="h-3.5 w-3.5" />}
        {allSelected ? "Deselect optional" : "Select optional"}
      </Button>
    </div>
    {/* Report setup in one recessed band, then the worksheet full-bleed to the card
        edges - the grid gets the whole width instead of losing it to a nested frame. */}
    <div className="space-y-3 border-b border-brand-border bg-brand-structural px-4 py-3">
      <RequestedBySection policy={definition.requestedByPolicy} value={report.encodingData?.requestedBy || ""} onChange={(requestedBy) => updateEncodingData({ requestedBy })} />
      <AdditionalEncodingFieldsSection fields={definition.additionalEncodingFields || []} values={report.encodingData?.additionalFields || {}} onChange={(fieldCode, value) => updateEncodingData({ additionalFields: { ...(report.encodingData?.additionalFields || {}), [fieldCode]: value } })} />
    </div>
    <div>
        {/* Worksheet column header, laid out from PARAMETER_ROW_TRACKS so it cannot drift out of
            alignment with the rows. aria-hidden because it is a visual scanning aid only: the real
            semantics live on each control, which already carries its own accessible name, and
            announcing these as headers without genuine table markup would describe a structure
            that is not there. Hidden below sm, where the row reflows and the columns do not exist. */}
        <div
          aria-hidden="true"
          className={cn(
            // Column header is structural too - it labels the grid, it is not part of it. Same
            // band and navy uppercase labels as the shared Table header.
            "hidden gap-x-2 border-b border-l-2 border-l-transparent border-b-brand-border bg-brand-structural px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-navy sm:grid sm:items-center",
            PARAMETER_ROW_TRACKS
          )}
        >
          <span className="pl-[1.375rem]">Parameter</span>
          <span>Result</span>
          <span>Unit</span>
          <span>Reference</span>
          <span>Status</span>
        </div>
        {/* The scope of the forward-Tab fast path. Requested By, the additional encoding
            fields and everything in the report footer also carry data-encoding-input, and
            none of them belong to this sequence - bounding the query to this container is
            what excludes them. */}
        <div
          ref={resultGridRef}
          onKeyDown={handleResultGridKeyDown}
          className="divide-y divide-brand-border-subtle"
        >{sortedParameters.map((parameter) => {
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
          // muted fill and a focused row keeps its brand wash. The stripe is the same quiet
          // tone the shared striped Table uses, so no text loses contrast against it.
          return <div key={parameter.parameterCode} data-param-code={parameter.parameterCode} className="even:bg-[#F8FAFC]">{control}</div>;
        })}</div>
    </div>
  </div>;
}
