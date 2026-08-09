import React from "react";
import { ILaboratoryReport, IPatientReportSession } from "@/domain/models/interfaces";
import { ReportHeaderBlock } from "../components/ReportHeaderBlock";
import { HivDemographicsBlock } from "../components/HivDemographicsBlock";
import { ReagentKitBlock } from "../components/ReagentKitBlock";
import { SignatoryFooterBlock } from "../components/SignatoryFooterBlock";

export interface NarrativeCertificateRendererProps {
  report: ILaboratoryReport;
  session: IPatientReportSession;
  colorPalette?: string;
  requiresKitInfo?: boolean;
}

export function NarrativeCertificateRenderer({
  report,
  session,
  colorPalette = "#093982",
  requiresKitInfo = true,
}: NarrativeCertificateRendererProps) {
  const hivResultObj = report.results.find((r) => r.parameterCode === "HIV_SCREENING") || report.results[0];
  const resultVal = hivResultObj?.resultValue || "Nonreactive";
  const isNonReactive = resultVal.toUpperCase().includes("NON");

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div>
        {/* Header Block */}
        <ReportHeaderBlock colorPalette={colorPalette} />

        {/* Certificate Heading */}
        <div className="text-center my-4">
          <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 border-b-2 border-slate-900 inline-block pb-0.5">
            AIDS FREE CERTIFICATE
          </h2>
        </div>

        {/* Dedicated HIV Demographics Block */}
        <HivDemographicsBlock
          demographics={session.demographics}
          companyName="St. Rose Diagnostic Laboratory"
        />

        {/* Certification Narrative Body */}
        <div className="my-6 text-xs text-slate-800 leading-relaxed text-justify space-y-4">
          <p>
            This is to certify that the blood sample of the patient identified above has been examined for 
            <strong className="font-bold"> Anti-HIV 1/2 (Screening Test)</strong> in accordance with official diagnostic laboratory standards.
          </p>

          {/* Dynamic Checkbox Block */}
          {hivResultObj?.evaluationOutcome === "Invalid" ? (
            <div className="bg-rose-50 border border-rose-300 rounded p-4 my-4 text-center font-mono text-rose-900">
              <span className="font-extrabold text-xs bg-rose-100 border border-rose-400 px-2 py-0.5 rounded uppercase">
                INVALID INPUT VALUE: {resultVal}
              </span>
              <p className="text-[11px] text-rose-700 mt-1">Please enter a valid result (&quot;Non-reactive&quot; or &quot;Reactive&quot;).</p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-300 rounded p-4 my-4 space-y-2 font-mono">
              <div className="flex items-center gap-3">
                <span className={`font-extrabold text-sm ${isNonReactive ? "text-emerald-700 font-black" : "text-slate-400"}`}>
                  {isNonReactive ? "[X]" : "[  ]"}
                </span>
                <span className={`font-bold ${isNonReactive ? "text-slate-900" : "text-slate-500"}`}>
                  Non-reactive or Negative
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-extrabold text-sm ${!isNonReactive ? "text-rose-700 font-black" : "text-slate-400"}`}>
                  {!isNonReactive ? "[X]" : "[  ]"}
                </span>
                <span className={`font-bold ${!isNonReactive ? "text-slate-900" : "text-slate-500"}`}>
                  Reactive or Positive
                </span>
              </div>
            </div>
          )}

          <p className="italic text-slate-600 text-[11px]">
            Notice: This certificate is issued for official screening reference purposes. Confidential test results are released strictly to authorized personnel.
          </p>
        </div>

        {/* Reagent Kit Info Section */}
        {requiresKitInfo && <ReagentKitBlock kitInfo={report.reagentKitInfo} />}
      </div>

      {/* 3-Signatory Footer */}
      <SignatoryFooterBlock
        signatories={report.signatories}
        templateCode={report.templateCode}
      />
    </div>
  );
}
