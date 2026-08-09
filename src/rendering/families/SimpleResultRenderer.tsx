import React from "react";
import { ILaboratoryReport, IPatientReportSession } from "@/domain/models/interfaces";
import { LaboratoryResultDomain } from "@/domain/models/laboratory-report-domain";
import { ReportHeaderBlock } from "../components/ReportHeaderBlock";
import { PatientDemographicsBlock } from "../components/PatientDemographicsBlock";
import { ReagentKitBlock } from "../components/ReagentKitBlock";
import { TemplateRemarksBlock } from "../components/TemplateRemarksBlock";
import { SignatoryFooterBlock } from "../components/SignatoryFooterBlock";

export interface SimpleResultRendererProps {
  report: ILaboratoryReport;
  session: IPatientReportSession;
  colorPalette?: string;
  supportsRemarks?: boolean;
  requiresKitInfo?: boolean;
}

export function SimpleResultRenderer({
  report,
  session,
  colorPalette = "#093982",
  supportsRemarks = false,
  requiresKitInfo = false,
}: SimpleResultRendererProps) {
  const domainResults = report.results as LaboratoryResultDomain[];
  const selectedResults = domainResults.filter((r) => r.isSelected ?? true);

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div>
        {/* Header Block */}
        <ReportHeaderBlock colorPalette={colorPalette} />

        {/* Patient Demographics */}
        <PatientDemographicsBlock
          demographics={session.demographics}
          accessionNumber={session.accessionNumber}
        />

        {/* Examination Title */}
        <div className="text-center my-3 pb-1 border-b border-slate-200">
          <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-800">
            {report.templateTitle}
          </h2>
        </div>

        {/* Prominent Diagnostic Result Panel */}
        <div className="w-full bg-slate-50 rounded-lg border-2 border-slate-300 p-6 my-4 text-center">
          <div className="space-y-4">
            {selectedResults.map((res) => {
              const isInvalid = res.evaluationOutcome === "Invalid";
              // Special formatting for HbA1c per HBA1C.md (auto append %)
              const rawVal = res.resultValue || "";
              const displayVal =
                report.templateCode === "HBA1C" && rawVal && !rawVal.includes("%")
                  ? `${rawVal}%`
                  : rawVal || "—";

              const refRule = res.referenceRuleSnapshot;
              let refDisplay = "";
              if (refRule?.expectedValue) {
                refDisplay = refRule.expectedValue;
              } else if (refRule?.maxValue !== undefined) {
                refDisplay = `< ${refRule.maxValue}`;
              }

              return (
                <div key={res.id} className="py-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5">
                    {res.parameterName}
                    {isInvalid && (
                      <span className="text-[9px] font-extrabold bg-rose-100 text-rose-900 border border-rose-300 px-1.5 py-0.2 rounded-full">
                        INVALID INPUT
                      </span>
                    )}
                  </p>
                  <p className={`text-2xl font-black tracking-tight uppercase ${isInvalid ? "text-rose-600" : "text-slate-900"}`}>
                    {displayVal}
                  </p>
                  {refDisplay && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Reference Value: <span className="font-semibold text-slate-700">{refDisplay}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Reagent Kit Info Section */}
        {requiresKitInfo && <ReagentKitBlock kitInfo={report.reagentKitInfo} />}

        {/* Remarks Section */}
        {supportsRemarks && <TemplateRemarksBlock remarks={report.remarks} />}
      </div>

      {/* Signatory Footer */}
      <SignatoryFooterBlock
        signatories={report.signatories}
        templateCode={report.templateCode}
      />
    </div>
  );
}
