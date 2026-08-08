import React from "react";
import { PatientDemographics } from "@/domain/types";

export interface PatientDemographicsBlockProps {
  demographics: PatientDemographics;
  accessionNumber: string;
}

export function PatientDemographicsBlock({ demographics, accessionNumber }: PatientDemographicsBlockProps) {
  return (
    <div className="w-full bg-slate-50/80 rounded-md border border-slate-200 p-3 mb-4 text-xs font-sans">
      <div className="grid grid-cols-12 gap-x-4 gap-y-2">
        {/* Row 1 */}
        <div className="col-span-5 flex items-baseline gap-1.5">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">PATIENT NAME:</span>
          <span className="font-extrabold text-slate-900 truncate uppercase">{demographics.fullName || "N/A"}</span>
        </div>
        <div className="col-span-3 flex items-baseline gap-1.5">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">AGE / SEX:</span>
          <span className="font-bold text-slate-900">
            {demographics.age} {demographics.ageUnit} / {demographics.sex}
          </span>
        </div>
        <div className="col-span-4 flex items-baseline gap-1.5 justify-end">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">ACCESSION NO:</span>
          <span className="font-mono font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[11px]">
            {accessionNumber}
          </span>
        </div>

        {/* Row 2 */}
        <div className="col-span-5 flex items-baseline gap-1.5">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">ADDRESS:</span>
          <span className="font-semibold text-slate-800 truncate">{demographics.address || "N/A"}</span>
        </div>
        <div className="col-span-4 flex items-baseline gap-1.5">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">REQUESTED BY:</span>
          <span className="font-semibold text-slate-800 truncate">{demographics.requestingPhysician || "N/A"}</span>
        </div>
        <div className="col-span-3 flex items-baseline gap-1.5 justify-end">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">DATE:</span>
          <span className="font-semibold text-slate-800">{demographics.examinationDate || "N/A"}</span>
        </div>
      </div>
    </div>
  );
}
