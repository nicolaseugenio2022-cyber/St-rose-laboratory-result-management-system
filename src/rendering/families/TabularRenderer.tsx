import React from "react";
import { ILaboratoryReport, IPatientReportSession } from "@/domain/models/interfaces";
import { LaboratoryResultDomain } from "@/domain/models/laboratory-report-domain";
import { ReportHeaderBlock } from "../components/ReportHeaderBlock";
import { PatientDemographicsBlock } from "../components/PatientDemographicsBlock";
import { TemplateRemarksBlock } from "../components/TemplateRemarksBlock";
import { SignatoryFooterBlock } from "../components/SignatoryFooterBlock";

export interface TabularRendererProps {
  report: ILaboratoryReport;
  session: IPatientReportSession;
  colorPalette?: string;
  supportsRemarks?: boolean;
}

export function TabularRenderer({
  report,
  session,
  colorPalette = "#093982",
  supportsRemarks = true,
}: TabularRendererProps) {
  // Cast results to domain models to access isSelected and reference formatting
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

        {/* Tabular Result Table */}
        <div className="w-full overflow-hidden border border-slate-300 rounded mb-4">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 uppercase font-bold border-b border-slate-300 text-[10px]">
                <th className="py-2 px-3 border-r border-slate-200 w-[35%]">EXAMINATION / PARAMETER</th>
                <th className="py-2 px-3 border-r border-slate-200 text-center w-[20%]">RESULT</th>
                <th className="py-2 px-3 border-r border-slate-200 text-center w-[15%]">UNIT</th>
                <th className="py-2 px-3 border-r border-slate-200 text-center w-[20%]">REFERENCE RANGE</th>
                <th className="py-2 px-3 text-center w-[10%]">FLAG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {selectedResults.map((res) => {
                const isAbnormal = res.evaluationOutcome === "Abnormal";
                const isInvalid = res.evaluationOutcome === "Invalid";
                const refRule = res.referenceRuleSnapshot;
                let refDisplay = "Normal";
                if (refRule?.minValue !== undefined && refRule?.maxValue !== undefined) {
                  refDisplay = `${refRule.minValue} – ${refRule.maxValue}`;
                } else if (refRule?.maxValue !== undefined) {
                  refDisplay = `< ${refRule.maxValue}`;
                }

                return (
                  <tr key={res.id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-semibold text-slate-800 border-r border-slate-200">
                      {res.parameterName}
                    </td>
                    <td className={`py-2 px-3 font-extrabold text-center border-r border-slate-200 ${
                      isInvalid ? "text-rose-600 font-bold bg-rose-50/40" : isAbnormal ? "text-rose-700 font-black" : "text-slate-900"
                    }`}>
                      {res.resultValue || "—"}
                    </td>
                    <td className="py-2 px-3 text-slate-600 text-center border-r border-slate-200 font-mono text-[11px]">
                      {res.unit || "—"}
                    </td>
                    <td className="py-2 px-3 text-slate-600 text-center border-r border-slate-200 text-[11px]">
                      {refDisplay}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      {isInvalid ? (
                        <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-rose-100 text-rose-900 border border-rose-300">
                          INVALID
                        </span>
                      ) : isAbnormal ? (
                        <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-rose-100 text-rose-800 border border-rose-200">
                          HIGH
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal">N</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
