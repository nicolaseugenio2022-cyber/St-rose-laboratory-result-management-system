import React from "react";
import type { PatientDemographics } from "@/domain/types";
import type {
  PatientStatusOutputMode,
  ReportDemographicPolicy,
} from "@/domain/report-demographic-policy";

export interface PatientDemographicsBlockProps {
  demographics: PatientDemographics;
  accessionNumber?: string;
  patientStatusOutputMode?: PatientStatusOutputMode;
  ageOutputMode?: ReportDemographicPolicy["age"]["outputMode"];
}

export function PatientDemographicsBlock({
  demographics,
  patientStatusOutputMode = "label-and-value",
  ageOutputMode = "number-with-unit",
}: PatientDemographicsBlockProps) {
  const ageDisplay = demographics.age
    ? ageOutputMode === "number-only"
      ? String(demographics.age)
      : `${demographics.age} ${demographics.ageUnit || ""}`.trim()
    : "";

  let statusDisplay = "";
  if (demographics.patientStatus === "InPatient") {
    statusDisplay = "In-Patient";
  } else if (demographics.patientStatus === "OutPatient") {
    statusDisplay = "Out-Patient";
  } else if (demographics.patientStatus) {
    statusDisplay = demographics.patientStatus;
  }

  return (
    <div className="w-full mb-1 text-[11px] leading-tight font-sans text-black">
      <table className="w-full border-collapse border border-[#7E749C]">
        <tbody>
          {/* Row 0: Name (46%) | Age (18%) | Date (36%) */}
          <tr className="border-b border-[#7E749C]">
            <td className="w-[46%] py-0.75 px-2 align-top font-bold">
              <span className="font-bold">Name: </span>
              <span className="font-bold uppercase">{demographics.fullName || ""}</span>
            </td>
            <td className="w-[18%] py-0.75 px-2 align-top font-bold border-l border-[#7E749C]">
              <span className="font-bold">Age: </span>
              <span className="font-bold">{ageDisplay}</span>
            </td>
            <td className="w-[36%] py-0.75 px-2 align-top font-bold border-l border-[#7E749C]">
              <span className="font-bold">Date: </span>
              <span className="font-bold uppercase">{demographics.examinationDate || ""}</span>
            </td>
          </tr>

          {/* Row 1: Address (colSpan 2: 64%) vs Sex (36% with purple shading #EAE6F3) */}
          <tr className="border-b border-[#7E749C]">
            <td className="py-0.75 px-2 align-top font-bold" colSpan={2}>
              <span className="font-bold">Address: </span>
              <span className="font-bold uppercase">{demographics.address || ""}</span>
            </td>
            <td className="py-0.75 px-2 align-top font-bold bg-[#EAE6F3] border-l border-[#7E749C]">
              <span className="font-bold">Sex: </span>
              <span className="font-bold uppercase">{demographics.sex || ""}</span>
            </td>
          </tr>

          {/* Row 2: Requested by (colSpan 2: 64%) vs Status (36% with purple shading #EAE6F3) */}
          <tr>
            <td className="py-0.75 px-2 align-top font-bold" colSpan={2}>
              <span className="font-bold">Requested by: </span>
              <span className="font-bold">{demographics.requestingPhysician || ""}</span>
            </td>
            <td className="py-0.75 px-2 align-top font-bold bg-[#EAE6F3] border-l border-[#7E749C]">
              <span className="font-bold">
                {patientStatusOutputMode === "static-label-only" ? "Status" : "Status: "}
              </span>
              {patientStatusOutputMode === "label-and-value" && (
                <span className="font-bold">{statusDisplay}</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
