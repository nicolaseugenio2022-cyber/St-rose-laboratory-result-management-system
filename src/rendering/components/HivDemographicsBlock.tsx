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
  orderTime = "",
}: HivDemographicsBlockProps) {
  const ageDisplay = demographics.age ? `${demographics.age} ${demographics.ageUnit || ""}`.trim() : "";

  return (
    <div className="w-full mb-4 text-[14px] leading-snug font-bold font-sans text-black space-y-1">
      <div className="flex items-center gap-8">
        <span>Order Date: {demographics.examinationDate || ""}</span>
        {orderTime && <span>Order Time: {orderTime}</span>}
      </div>
      <div className="flex items-center gap-6">
        <span>Name: <span className="uppercase">{demographics.fullName || ""}</span></span>
        <span>Age: {ageDisplay}</span>
        <span>Sex: <span className="uppercase">{demographics.sex || ""}</span></span>
      </div>
      <div className="flex items-center gap-8">
        <span>Referring Doctor: {demographics.requestingPhysician || ""}</span>
        <span>Company: {companyName}</span>
      </div>
    </div>
  );
}

