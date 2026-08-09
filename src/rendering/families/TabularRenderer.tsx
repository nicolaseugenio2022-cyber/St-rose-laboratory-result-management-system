import React from "react";
import { ILaboratoryReport, IPatientReportSession } from "@/domain/models/interfaces";
import { LaboratoryResultDomain } from "@/domain/models/laboratory-report-domain";
import { ReportHeaderBlock } from "../components/ReportHeaderBlock";
import { PatientDemographicsBlock } from "../components/PatientDemographicsBlock";
import { getReportDemographicPolicy } from "@/domain/report-demographic-policy";
import { SignatoryFooterBlock } from "../components/SignatoryFooterBlock";

export interface TabularPresentationConfig {
  headerWording: [string, string, string];
  columnWidths: [string, string, string];
  headerFontSize: "10pt" | "14pt" | "16pt";
  bodyFontSize: "10pt" | "14pt";
  headerFontWeight: "normal" | "bold";
  colorPalette: string;
  headerShadingColor?: string;
  alternateShadingColor?: string;
  uppercaseParameters?: boolean;
  embeddedTitleRow?: string | null;
  hasDifferentialSection?: boolean;
  supportsRemarks: boolean;
}

export const TABULAR_PRESENTATION_CONFIGS: Record<string, TabularPresentationConfig> = {
  CBC: {
    headerWording: ["EXAMINATION", "RESULT", "NORMAL VALUES"],
    columnWidths: ["31%", "30%", "39%"],
    headerFontSize: "10pt",
    bodyFontSize: "10pt",
    headerFontWeight: "bold",
    colorPalette: "#365F91",
    headerShadingColor: "#EAE6F3",
    alternateShadingColor: "#EAE6F3",
    uppercaseParameters: true,
    hasDifferentialSection: true,
    supportsRemarks: true,
  },
  CHEM_8: {
    headerWording: ["EXAMINATION", "RESULTS", "NORMAL VALUES"],
    columnWidths: ["32.3%", "31.8%", "35.9%"],
    headerFontSize: "14pt",
    bodyFontSize: "14pt",
    headerFontWeight: "bold",
    colorPalette: "#002060",
    headerShadingColor: "#EAE6F3",
    alternateShadingColor: "#EAE6F3",
    uppercaseParameters: true,
    hasDifferentialSection: false,
    supportsRemarks: true,
  },
  CHEM_10: {
    headerWording: ["EXAMINATION", "RESULTS", "NORMAL VALUES"],
    columnWidths: ["35%", "28.8%", "36.2%"],
    headerFontSize: "14pt",
    bodyFontSize: "14pt",
    headerFontWeight: "bold",
    colorPalette: "#365F91",
    headerShadingColor: "#EAE6F3",
    alternateShadingColor: "#EAE6F3",
    uppercaseParameters: true,
    hasDifferentialSection: false,
    supportsRemarks: true,
  },
  HDL_LDL: {
    headerWording: ["EXAMINATION", "RESULTS", "NORMAL VALUES"],
    columnWidths: ["32.3%", "31.8%", "35.9%"],
    headerFontSize: "14pt",
    bodyFontSize: "14pt",
    headerFontWeight: "bold",
    colorPalette: "#215868",
    headerShadingColor: "#EAE6F3",
    alternateShadingColor: "#EAE6F3",
    uppercaseParameters: true,
    hasDifferentialSection: false,
    supportsRemarks: true,
  },
  ESR: {
    headerWording: ["TEST", "RESULT", "NORMAL VALUES"],
    columnWidths: ["33%", "33.8%", "33.2%"],
    headerFontSize: "16pt",
    bodyFontSize: "14pt",
    headerFontWeight: "bold",
    colorPalette: "#365F91",
    embeddedTitleRow: "ERYTHROCYTE SEDIMENTATION RATE",
    hasDifferentialSection: false,
    supportsRemarks: false,
  },
};

const DEFAULT_TABULAR_CONFIG: TabularPresentationConfig = {
  headerWording: ["EXAMINATION", "RESULT", "NORMAL VALUES"],
  columnWidths: ["32%", "32%", "36%"],
  headerFontSize: "10pt",
  bodyFontSize: "10pt",
  headerFontWeight: "normal",
  colorPalette: "#365F91",
  hasDifferentialSection: false,
  supportsRemarks: true,
};

export interface TabularRendererProps {
  report: ILaboratoryReport;
  session: IPatientReportSession;
  colorPalette?: string;
  supportsRemarks?: boolean;
}

export function TabularRenderer({
  report,
  session,
  colorPalette,
  supportsRemarks,
}: TabularRendererProps) {
  const domainResults = report.results as LaboratoryResultDomain[];
  const selectedResults = domainResults.filter((r) => r.isSelected ?? true);

  // Retrieve presentation metadata for current template code, with safe default fallback
  const config: TabularPresentationConfig =
    TABULAR_PRESENTATION_CONFIGS[report.templateCode] || DEFAULT_TABULAR_CONFIG;

  const finalColorPalette = colorPalette || config.colorPalette;
  const finalSupportsRemarks = supportsRemarks ?? config.supportsRemarks;

  // Helper to format Normal Values matching official Word .docx source
  const formatNormalValues = (code: string, name: string, unit?: string | null, refRule?: any): React.ReactNode => {
    const codeUpper = (code || "").toUpperCase();
    const nameUpper = (name || "").toUpperCase();

    if (codeUpper.includes("HEMOGLOBIN") || nameUpper.includes("HEMOGLOBIN")) {
      return (
        <div className="leading-tight">
          <div>MALE: 130 – 160 G/L</div>
          <div>FEMALE: 120 – 140 G/L</div>
        </div>
      );
    }
    if (codeUpper.includes("HEMATOCRIT") || nameUpper.includes("HEMATOCRIT")) {
      return (
        <div className="leading-tight">
          <div>MALE: 0.40 – 0.52</div>
          <div>FEMALE: 0.37 – 0.42</div>
        </div>
      );
    }
    if (codeUpper.includes("RBC") || nameUpper.includes("RBC")) {
      return (
        <div className="leading-tight">
          <div>MALE: 4.5 – 6.0 x 10<sup>12</sup>/L</div>
          <div>FEMALE: 4.0 – 5.5 x 10<sup>12</sup>/L</div>
        </div>
      );
    }
    if (codeUpper.includes("WBC") || nameUpper.includes("WBC")) {
      return <span>5.0 – 10.0 x 10<sup>9</sup>/L</span>;
    }
    if (codeUpper.includes("PLATELET") || nameUpper.includes("PLATELET")) {
      return <span>150 – 450 x 10<sup>9</sup>/L</span>;
    }
    if (codeUpper.includes("NEUTROPHIL") || nameUpper.includes("NEUTROPHIL")) {
      return <span>0.50 – 0.70</span>;
    }
    if (codeUpper.includes("LYMPHOCYTE") || nameUpper.includes("LYMPHOCYTE")) {
      return <span>0.25 – 0.40</span>;
    }
    if (codeUpper.includes("EOSINOPHIL") || nameUpper.includes("EOSINOPHIL")) {
      return <span>0.01 – 0.04</span>;
    }
    if (codeUpper.includes("MONOCYTE") || nameUpper.includes("MONOCYTE")) {
      return <span>0.03 – 0.08</span>;
    }
    if (codeUpper.includes("BASOPHIL") || nameUpper.includes("BASOPHIL")) {
      return <span>0.00 – 0.01</span>;
    }
    if (codeUpper.includes("URIC") || nameUpper.includes("URIC")) {
      return (
        <div className="leading-tight">
          <div>FEMALE: 2.4-5.7 mg/dL</div>
          <div>MALE: 3.4-7.0 mg/dL</div>
        </div>
      );
    }
    if (codeUpper.includes("ESR") || nameUpper.includes("ERYTHROCYTE SEDIMENTATION")) {
      return (
        <div className="leading-tight">
          <div>MALE: 0-15 mm/hr</div>
          <div>FEMALE: 0-20 mm/hr</div>
          <div>Children: 0-13 mm/hr</div>
        </div>
      );
    }
    if (codeUpper.includes("FBS") || nameUpper.includes("FASTING BLOOD SUGAR")) {
      return <span>70-110 mg/dL</span>;
    }
    if (codeUpper.includes("CHOLESTEROL") || nameUpper.includes("CHOLESTEROL")) {
      return <span>&lt; 200 mg/dL</span>;
    }
    if (codeUpper.includes("TRIGLYCERIDES") || nameUpper.includes("TRIGLYCERIDES")) {
      return <span>35-165 mg/dL</span>;
    }
    if (codeUpper.includes("HDL") || nameUpper.includes("HDL")) {
      return <span>0-110 mg/dL</span>;
    }
    if (codeUpper.includes("LDL") || nameUpper.includes("LDL")) {
      return <span>&lt; 150 mg/dL</span>;
    }
    if (codeUpper.includes("SGPT") || nameUpper.includes("SGPT") || nameUpper.includes("ALT")) {
      return <span>4-41 IU/L</span>;
    }
    if (codeUpper.includes("SGOT") || nameUpper.includes("SGOT") || nameUpper.includes("AST")) {
      return <span>4-41 IU/L</span>;
    }
    if (codeUpper.includes("CREATININE") || nameUpper.includes("CREATININE")) {
      return <span>0.4-1.4 mg/dL</span>;
    }
    if (codeUpper.includes("BUN") || nameUpper.includes("BLOOD UREA NITROGEN")) {
      return <span>10-45 mg/dL</span>;
    }

    if (refRule?.minValue !== undefined && refRule?.maxValue !== undefined && refRule.minValue !== null && refRule.maxValue !== null) {
      return <span>{refRule.minValue} – {refRule.maxValue} {unit || ""}</span>;
    } else if (refRule?.maxValue !== undefined && refRule.maxValue !== null) {
      return <span>&lt; {refRule.maxValue} {unit || ""}</span>;
    }
    return <span>Normal</span>;
  };

  const remarksText = report.remarks || "TEST/S RECHECKED; RESULT/S VERIFIED";

  // Check differential count boundary for templates with hasDifferentialSection = true
  const mainResults = config.hasDifferentialSection
    ? selectedResults.filter((r) => !["NEUTROPHIL", "LYMPHOCYTE", "EOSINOPHIL", "MONOCYTE", "BASOPHIL"].includes(r.parameterCode.toUpperCase()))
    : selectedResults;

  const diffResults = config.hasDifferentialSection
    ? selectedResults.filter((r) => ["NEUTROPHIL", "LYMPHOCYTE", "EOSINOPHIL", "MONOCYTE", "BASOPHIL"].includes(r.parameterCode.toUpperCase()))
    : [];

  return (
    <div className="w-full font-sans text-black flex flex-col h-full">
      {/* 1. Header Region (Natural flow header at page top) */}
      <div className="a4-header-region">
        <ReportHeaderBlock colorPalette={finalColorPalette} />
      </div>

      {/* 2. Body Region (Sits naturally below Header Region with zero guessed padding-top) */}
      <div className="a4-body-region flex-grow">
        {/* Patient Demographics Block */}
        <PatientDemographicsBlock
          demographics={session.demographics}
          accessionNumber={session.accessionNumber}
          patientStatusOutputMode={getReportDemographicPolicy(report.templateCode).patientStatus.outputMode}
          ageOutputMode={getReportDemographicPolicy(report.templateCode).age.outputMode}
        />

        {/* 3-Column Tabular Result Table Driven 100% by Presentation Metadata */}
        <div className="w-full mt-2 mb-3">
          <table
            className="w-full leading-snug border-collapse border-none text-black"
            style={{ fontSize: config.bodyFontSize }}
          >
            <thead>
              {/* Optional Embedded Title Row inside Table (e.g. ESR Row 0) */}
              {config.embeddedTitleRow && (
                <tr>
                  <td
                    colSpan={3}
                    className="py-1 px-2 font-bold text-center border-none"
                    style={{ fontSize: config.headerFontSize, color: finalColorPalette }}
                  >
                    {config.embeddedTitleRow}
                  </td>
                </tr>
              )}

              {/* Table Column Headers driven by headerWording, columnWidths, headerFontSize, headerFontWeight, headerShadingColor */}
              <tr
                className="border-y border-[#7E749C]"
                style={{ backgroundColor: config.headerShadingColor || "transparent" }}
              >
                <th
                  className="py-0.5 px-1.5 text-left"
                  style={{
                    width: config.columnWidths[0],
                    fontSize: config.headerFontSize,
                    fontWeight: config.headerFontWeight,
                  }}
                >
                  {config.headerWording[0]}
                </th>
                <th
                  className="py-0.5 px-1.5 text-left"
                  style={{
                    width: config.columnWidths[1],
                    fontSize: config.headerFontSize,
                    fontWeight: config.headerFontWeight,
                  }}
                >
                  {config.headerWording[1]}
                </th>
                <th
                  className="py-0.5 px-1.5 text-left"
                  style={{
                    width: config.columnWidths[2],
                    fontSize: config.headerFontSize,
                    fontWeight: config.headerFontWeight,
                  }}
                >
                  {config.headerWording[2]}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Main Parameters */}
              {mainResults.map((res, index) => {
                const isShaded = config.alternateShadingColor && index % 2 === 0;
                const paramNameDisplay = config.uppercaseParameters
                  ? res.parameterName.toUpperCase()
                  : res.parameterName;

                return (
                  <tr
                    key={res.id}
                    style={{ backgroundColor: isShaded ? config.alternateShadingColor : "transparent" }}
                  >
                    <td className="py-0.25 px-1.5 font-bold align-top">{paramNameDisplay}</td>
                    <td className="py-0.25 px-1.5 font-bold align-top">{res.resultValue || ""}</td>
                    <td className="py-0.25 px-1.5 font-normal align-top">
                      {formatNormalValues(res.parameterCode, res.parameterName, res.unit, res.referenceRuleSnapshot)}
                    </td>
                  </tr>
                );
              })}

              {/* Optional Section Header Row for Differential Count (CBC) */}
              {config.hasDifferentialSection && diffResults.length > 0 && (
                <tr style={{ backgroundColor: config.alternateShadingColor || "transparent" }}>
                  <td colSpan={3} className="py-0.5 px-1.5 font-bold align-top uppercase">
                    DIFFERENTIAL COUNT
                  </td>
                </tr>
              )}

              {/* Differential Count Parameters (CBC) */}
              {config.hasDifferentialSection &&
                diffResults.map((res, index) => {
                  const isShaded = config.alternateShadingColor && index % 2 === 0;
                  const paramNameDisplay = config.uppercaseParameters
                    ? res.parameterName.toUpperCase()
                    : res.parameterName;

                  return (
                    <tr
                      key={res.id}
                      style={{ backgroundColor: isShaded ? config.alternateShadingColor : "transparent" }}
                    >
                      <td className="py-0.25 px-1.5 font-bold align-top pl-6">{paramNameDisplay}</td>
                      <td className="py-0.25 px-1.5 font-bold align-top">{res.resultValue || ""}</td>
                      <td className="py-0.25 px-1.5 font-normal align-top">
                        {formatNormalValues(res.parameterCode, res.parameterName, res.unit, res.referenceRuleSnapshot)}
                      </td>
                    </tr>
                  );
                })}

              {/* Embedded Remarks Row inside Table if supportsRemarks = true */}
              {finalSupportsRemarks && (
                <tr style={{ backgroundColor: config.alternateShadingColor || "transparent" }}>
                  <td colSpan={3} className="pt-1.5 pb-0.5 px-1.5 font-bold text-[9.5pt] align-top">
                    REMARKS: {remarksText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Footer Region (Independent Anchored Legal Validation Block at Bottom Margin 25.4mm) */}
      <div className="a4-footer-region">
        <SignatoryFooterBlock
          signatories={report.signatories}
          templateCode={report.templateCode}
        />
      </div>
    </div>
  );
}

