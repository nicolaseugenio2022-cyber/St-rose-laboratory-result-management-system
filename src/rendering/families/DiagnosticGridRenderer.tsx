import React from "react";
import { ILaboratoryReport, IPatientReportSession } from "@/domain/models/interfaces";
import { LaboratoryResultDomain } from "@/domain/models/laboratory-report-domain";
import { ReportHeaderBlock } from "../components/ReportHeaderBlock";
import { PatientDemographicsBlock } from "../components/PatientDemographicsBlock";
import { TemplateRemarksBlock } from "../components/TemplateRemarksBlock";
import { SignatoryFooterBlock } from "../components/SignatoryFooterBlock";

export interface DiagnosticGridRendererProps {
  report: ILaboratoryReport;
  session: IPatientReportSession;
  colorPalette?: string;
  supportsRemarks?: boolean;
}

export function DiagnosticGridRenderer({
  report,
  session,
  colorPalette = "#093982",
  supportsRemarks = true,
}: DiagnosticGridRendererProps) {
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

        {/* Diagnostic Microscopy Grid */}
        <div className="w-full border border-slate-300 rounded mb-4 text-xs">
          <div className="bg-slate-100 px-3 py-1.5 font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-300 text-[10px]">
            LABORATORY FINDINGS
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-300">
            {/* Left Column Findings */}
            <div className="p-3 space-y-2">
              {selectedResults.slice(0, Math.ceil(selectedResults.length / 2)).map((res) => (
                <div key={res.id} className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <span className="font-bold text-slate-600 uppercase text-[11px]">{res.parameterName}:</span>
                  <span className="font-extrabold text-slate-900">{res.resultValue || "—"}</span>
                </div>
              ))}
            </div>

            {/* Right Column Findings */}
            <div className="p-3 space-y-2">
              {selectedResults.slice(Math.ceil(selectedResults.length / 2)).map((res) => (
                <div key={res.id} className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <span className="font-bold text-slate-600 uppercase text-[11px]">{res.parameterName}:</span>
                  <span className="font-extrabold text-slate-900">{res.resultValue || "—"}</span>
                </div>
              ))}
            </div>
          </div>
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
