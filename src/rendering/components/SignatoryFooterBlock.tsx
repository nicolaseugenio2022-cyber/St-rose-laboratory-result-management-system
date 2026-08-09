import React from "react";
import Image from "next/image";
import { SignatorySnapshot } from "@/domain/types";

export interface SignatoryFooterBlockProps {
  signatories: SignatorySnapshot[];
  templateCode: string;
}

export function SignatoryFooterBlock({ signatories, templateCode }: SignatoryFooterBlockProps) {
  const isHivReport = templateCode === "HIV_RESULT";

  // Filter signatories by role
  const medtechs = signatories.filter((s) => s.role === "MedicalTechnologist");
  const pathologists = signatories.filter((s) => s.role === "Pathologist");

  if (isHivReport) {
    // 3-Signatory Block for HIV_RESULT
    const medtech1 = medtechs[0];
    const medtech2 = medtechs[1] || medtechs[0];
    const pathologist = pathologists[0];

    const medtech1Name = medtech1 ? `${medtech1.printedFullName}, ${medtech1.printedCredentials}` : "SANDRA ANNE P. GROSPE, RMT,MLS(ASCPi)";
    const medtech1Lic = medtech1?.printedPrcLicenseNumber ? `License no. ${medtech1.printedPrcLicenseNumber}` : "License no. 0124239";

    const medtech2Name = medtech2 ? `${medtech2.printedFullName}, ${medtech2.printedCredentials}` : "LOVERNA MARI M. CASTILLO, RMT";
    const medtech2Lic = medtech2?.printedPrcLicenseNumber ? `License no. ${medtech2.printedPrcLicenseNumber}` : "License no. 0135199";

    const pathologistName = pathologist ? `${pathologist.printedFullName}, ${pathologist.printedCredentials}` : "PAULO ANTONIO E. CLEMENTE, MD, DPSP";
    const pathologistLic = pathologist?.printedPrcLicenseNumber ? `License no. ${pathologist.printedPrcLicenseNumber}` : "License no. 113927";

    const rawSig = pathologist?.signatureImageUrl || "/pathologist-signature.png";
    const hasPathologistSig = Boolean(rawSig && rawSig.trim() !== "" && !rawSig.includes("logo"));

    return (
      <div className="w-full mt-6 space-y-6 text-black font-sans text-[12px] leading-tight">
        {/* Top Tier: Performed By & Verified By (MedTechs - Text only) */}
        <div>
          <div className="flex justify-between font-bold mb-2">
            <span className="w-1/2 text-center">PERFORMED BY:</span>
            <span className="w-1/2 text-center">VERIFIED BY:</span>
          </div>

          <div className="grid grid-cols-2 gap-8 text-center">
            {/* MedTech 1 */}
            <div className="flex flex-col items-center justify-end">
              <p className="font-bold">{medtech1Name}</p>
              <p>{medtech1Lic}</p>
              <p>Medical Technologist</p>
            </div>

            {/* MedTech 2 */}
            <div className="flex flex-col items-center justify-end">
              <p className="font-bold">{medtech2Name}</p>
              <p>{medtech2Lic}</p>
              <p>Medical Technologist</p>
            </div>
          </div>
        </div>

        {/* Bottom Tier: Pathologist Centered */}
        <div className="flex flex-col items-center text-center pt-4">
          <div className="h-10 flex items-end justify-center mb-1">
            {hasPathologistSig && (
              <Image
                src={rawSig}
                alt={pathologistName}
                width={120}
                height={40}
                className="object-contain max-h-10"
                priority
              />
            )}
          </div>
          <p className="font-bold">{pathologistName}</p>
          <p>{pathologistLic}</p>
          <p>Pathologist</p>
        </div>
      </div>
    );
  }

  // Standard 2-Signatory Block (16 Templates)
  const pathologist = pathologists[0];
  const medtech = medtechs[0];

  const pathologistName = pathologist ? `${pathologist.printedFullName}, ${pathologist.printedCredentials}` : "PAULO ANTONIO E. CLEMENTE, MD, DPSP";
  const pathologistLic = pathologist?.printedPrcLicenseNumber ? `License no. ${pathologist.printedPrcLicenseNumber}` : "License no. 113927";

  const medtechName = medtech ? `${medtech.printedFullName}, ${medtech.printedCredentials}` : "SANDRA ANNE P. GROSPE, RMT, MLS(ASCPi)";
  const medtechLic = medtech?.printedPrcLicenseNumber ? `License no. ${medtech.printedPrcLicenseNumber}` : "License no. 0124239";

  // Data-driven asset resolution: Read directly from Pathologist signatureImageUrl property.
  // Render signature ONLY if a valid non-logo signature URL exists on the personnel record.
  const rawPathologistSigUrl = pathologist?.signatureImageUrl;
  const hasPathologistSignature = Boolean(
    rawPathologistSigUrl && rawPathologistSigUrl.trim() !== "" && !rawPathologistSigUrl.includes("logo")
  );

  if (typeof window !== "undefined") {
    console.log("[DEBUG SignatoryFooterBlock] templateCode:", templateCode);
    console.log("[DEBUG SignatoryFooterBlock] pathologist object:", pathologist);
    console.log("[DEBUG SignatoryFooterBlock] rawPathologistSigUrl:", rawPathologistSigUrl);
    console.log("[DEBUG SignatoryFooterBlock] hasPathologistSignature:", hasPathologistSignature);
  }

  return (
    <table className="w-full border-collapse border-none mt-2 text-black font-sans text-[12px] leading-tight">
      <tbody>
        <tr>
          {/* Left Column: Pathologist with Overlapping E-Signature & Name Underline */}
          <td className="w-1/2 align-bottom text-center pr-6 border-none relative">
            <div className="flex flex-col items-center relative">
              <div className="h-10 w-full relative flex items-end justify-center -mb-3 z-10">
                {hasPathologistSignature && (
                  <Image
                    src={rawPathologistSigUrl || ""}
                    alt={pathologistName}
                    width={150}
                    height={45}
                    className="object-contain max-h-11 -mb-2"
                    priority
                  />
                )}
              </div>
              <p className="font-bold border-b border-black inline-block px-2 z-0">{pathologistName}</p>
              <p className="font-normal mt-0.5">{pathologistLic}</p>
              <p className="font-normal">Pathologist</p>
            </div>
          </td>

          {/* Right Column: Medical Technologist (Text only per official signature rule) */}
          <td className="w-1/2 align-bottom text-center pl-6 border-none">
            <div className="flex flex-col items-center justify-end">
              <div className="h-10 w-full" />
              <p className="font-bold border-b border-black inline-block px-2">{medtechName}</p>
              <p className="font-normal mt-0.5">{medtechLic}</p>
              <p className="font-normal">Medical Technologist</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

