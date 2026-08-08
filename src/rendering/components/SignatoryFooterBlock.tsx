import React from "react";
import Image from "next/image";
import { SignatorySnapshot } from "@/domain/types";

export interface SignatoryFooterBlockProps {
  signatories: SignatorySnapshot[];
  templateCode: string;
}

export function SignatoryFooterBlock({ signatories, templateCode }: SignatoryFooterBlockProps) {
  const isHivReport = templateCode === "HIV_RESULT";

  // Filter signatories
  const medtechs = signatories.filter((s) => s.role === "MedicalTechnologist");
  const pathologists = signatories.filter((s) => s.role === "Pathologist");

  if (isHivReport) {
    // 3-Signatory Block for HIV_RESULT
    const medtech1 = medtechs[0];
    const medtech2 = medtechs[1] || medtechs[0];
    const pathologist = pathologists[0];

    return (
      <div className="w-full mt-10 pt-4 border-t border-slate-200">
        <div className="grid grid-cols-3 gap-6 text-center text-xs">
          {/* Performed By: MedTech 1 */}
          <div className="flex flex-col items-center">
            <div className="h-12 flex items-end justify-center mb-1">
              {medtech1?.signatureImageUrl ? (
                <Image
                  src={medtech1.signatureImageUrl}
                  alt={medtech1.printedFullName}
                  width={120}
                  height={48}
                  className="object-contain max-h-12"
                />
              ) : null}
            </div>
            <div className="w-full border-b border-slate-400 font-bold text-slate-900 pb-0.5">
              {medtech1 ? `${medtech1.printedFullName}, ${medtech1.printedCredentials}` : "__________________"}
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-1">Medical Technologist</p>
            {medtech1?.printedPrcLicenseNumber && (
              <p className="text-[9px] text-slate-400">PRC Lic. No. {medtech1.printedPrcLicenseNumber}</p>
            )}
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">PERFORMED BY</p>
          </div>

          {/* Approved By: Pathologist */}
          <div className="flex flex-col items-center">
            <div className="h-12 flex items-end justify-center mb-1">
              {pathologist?.signatureImageUrl ? (
                <Image
                  src={pathologist.signatureImageUrl}
                  alt={pathologist.printedFullName}
                  width={120}
                  height={48}
                  className="object-contain max-h-12"
                />
              ) : null}
            </div>
            <div className="w-full border-b border-slate-400 font-bold text-slate-900 pb-0.5">
              {pathologist ? `${pathologist.printedFullName}, ${pathologist.printedCredentials}` : "__________________"}
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-1">Pathologist</p>
            {pathologist?.printedPrcLicenseNumber && (
              <p className="text-[9px] text-slate-400">PRC Lic. No. {pathologist.printedPrcLicenseNumber}</p>
            )}
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">PATHOLOGIST</p>
          </div>

          {/* Verified By: MedTech 2 */}
          <div className="flex flex-col items-center">
            <div className="h-12 flex items-end justify-center mb-1">
              {medtech2?.signatureImageUrl ? (
                <Image
                  src={medtech2.signatureImageUrl}
                  alt={medtech2.printedFullName}
                  width={120}
                  height={48}
                  className="object-contain max-h-12"
                />
              ) : null}
            </div>
            <div className="w-full border-b border-slate-400 font-bold text-slate-900 pb-0.5">
              {medtech2 ? `${medtech2.printedFullName}, ${medtech2.printedCredentials}` : "__________________"}
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-1">Medical Technologist</p>
            {medtech2?.printedPrcLicenseNumber && (
              <p className="text-[9px] text-slate-400">PRC Lic. No. {medtech2.printedPrcLicenseNumber}</p>
            )}
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">VERIFIED BY</p>
          </div>
        </div>
      </div>
    );
  }

  // Standard 2-Signatory Block (16 Templates)
  const medtech = medtechs[0];
  const pathologist = pathologists[0];

  return (
    <div className="w-full mt-12 pt-4 border-t border-slate-200">
      <div className="grid grid-cols-2 gap-12 text-center text-xs">
        {/* Left: Medical Technologist */}
        <div className="flex flex-col items-center">
          <div className="h-12 flex items-end justify-center mb-1">
            {medtech?.signatureImageUrl ? (
              <Image
                src={medtech.signatureImageUrl}
                alt={medtech.printedFullName}
                width={140}
                height={48}
                className="object-contain max-h-12"
              />
            ) : null}
          </div>
          <div className="w-full border-b border-slate-400 font-bold text-slate-900 pb-0.5">
            {medtech ? `${medtech.printedFullName}, ${medtech.printedCredentials}` : "__________________"}
          </div>
          <p className="text-[10px] text-slate-600 font-medium mt-1">Medical Technologist</p>
          {medtech?.printedPrcLicenseNumber && (
            <p className="text-[9px] text-slate-400">PRC Lic. No. {medtech.printedPrcLicenseNumber}</p>
          )}
        </div>

        {/* Right: Pathologist */}
        <div className="flex flex-col items-center">
          <div className="h-12 flex items-end justify-center mb-1">
            {pathologist?.signatureImageUrl ? (
              <Image
                src={pathologist.signatureImageUrl}
                alt={pathologist.printedFullName}
                width={140}
                height={48}
                className="object-contain max-h-12"
              />
            ) : null}
          </div>
          <div className="w-full border-b border-slate-400 font-bold text-slate-900 pb-0.5">
            {pathologist ? `${pathologist.printedFullName}, ${pathologist.printedCredentials}` : "__________________"}
          </div>
          <p className="text-[10px] text-slate-600 font-medium mt-1">Pathologist</p>
          {pathologist?.printedPrcLicenseNumber && (
            <p className="text-[9px] text-slate-400">PRC Lic. No. {pathologist.printedPrcLicenseNumber}</p>
          )}
        </div>
      </div>
    </div>
  );
}
