import React from "react";
import { PatientDemographics } from "@/domain/types";

export interface HivDemographicsBlockProps {
  demographics: PatientDemographics;
  companyName?: string;
  orderTime?: string;
}

export function HivDemographicsBlock({
  demographics,
  companyName = "St. Rose Diagnostic Laboratory",
  orderTime = "09:00 AM",
}: HivDemographicsBlockProps) {
  return (
    <div className="w-full border-b border-slate-300 pb-3 mb-5 text-xs font-sans">
      <div className="grid grid-cols-2 gap-y-2 gap-x-8">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-slate-600 uppercase text-[11px]">ORDER DATE / TIME:</span>
          <span className="font-semibold text-slate-900">{demographics.examinationDate} {orderTime}</span>
        </div>
        <div className="flex items-baseline gap-2 justify-end">
          <span className="font-bold text-slate-600 uppercase text-[11px]">COMPANY:</span>
          <span className="font-semibold text-slate-900">{companyName}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-slate-600 uppercase text-[11px]">NAME OF PATIENT:</span>
          <span className="font-extrabold text-slate-900 uppercase">{demographics.fullName}</span>
        </div>
        <div className="flex items-baseline gap-2 justify-end">
          <span className="font-bold text-slate-600 uppercase text-[11px]">AGE / SEX:</span>
          <span className="font-semibold text-slate-900">{demographics.age} {demographics.ageUnit} / {demographics.sex}</span>
        </div>
        <div className="flex items-baseline gap-2 col-span-2">
          <span className="font-bold text-slate-600 uppercase text-[11px]">REFERRING DOCTOR:</span>
          <span className="font-semibold text-slate-900">{demographics.requestingPhysician || "Dr. Ralph Roland Asperas"}</span>
        </div>
      </div>
    </div>
  );
}
