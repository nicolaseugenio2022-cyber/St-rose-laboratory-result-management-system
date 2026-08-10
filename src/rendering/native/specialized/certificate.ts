import type { ResolvedReportRenderModel, ResolvedSessionRenderModel } from "@/rendering/model";
import type { NativePagePrimitive } from "../types";
import { NATIVE_REPORT_THEME } from "../theme";
import { composeRemarks, composeTitle } from "../standard/sections";
import { STANDARD_PAGE, type NativeFlowSectionResult } from "../standard/types";
import {
  SPECIALIZED_LINE_HEIGHT_MM,
  addSpecializedLines,
  composeSpecializedSignatoryColumns,
  specializedLine,
  specializedText,
  wrapSpecializedText,
} from "./common";
import type { CertificateNativeCompositionDefinition } from "./types";

const { colors: COLOR, typography: TYPE, sectionInsets: INSET } = NATIVE_REPORT_THEME;

function splitExaminationDateTime(value: string): { date: string; time: string } {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[ T]+)(.+)$/.exec(value.trim());
  return match ? { date: match[1], time: match[2] } : { date: value, time: "" };
}

function fieldRow(options: {
  id: string;
  y: number;
  fields: Array<{ label: string; value: string; width: number; omitWhenBlank?: boolean }>;
}): NativeFlowSectionResult {
  const primitives: NativePagePrimitive[] = [];
  let x = STANDARD_PAGE.marginMm;
  let lineCount = 1;
  const resolved = options.fields.map((field, index) => {
    const omitted = Boolean(field.omitWhenBlank && !field.value);
    const lines = omitted ? [] : wrapSpecializedText(`${options.id}-field-${index + 1}`, field.value, field.width - 2.4, TYPE.resultLabelPt);
    lineCount = Math.max(lineCount, lines.length);
    const result = { ...field, x, lines, omitted };
    x += field.width;
    return result;
  });
  const height = 2.3 + lineCount * 3.35 + 0.4;
  resolved.forEach((field, index) => {
    if (field.omitted) return;
    primitives.push(specializedText({
      id: `${options.id}-field-${index + 1}-label`, text: field.label, x: field.x + 1.2, y: options.y + 0.3,
      width: field.width - 2.4, height: 2.1, fontSizePt: TYPE.demographicLabelPt, fontWeight: "bold", color: COLOR.mutedText,
    }));
    addSpecializedLines({ primitives, id: `${options.id}-field-${index + 1}`, lines: field.lines, x: field.x + 1.2, y: options.y + 2.3, width: field.width - 2.4, fontSizePt: TYPE.resultLabelPt, weight: "bold" });
  });
  return { primitives, bottomMm: options.y + height };
}

export function composeCertificateSpecializedBody(
  definition: CertificateNativeCompositionDefinition,
  session: ResolvedSessionRenderModel,
  report: ResolvedReportRenderModel,
  y: number
): NativeFlowSectionResult {
  const content = report.staticContent;
  if (!content || content.kind !== "Certificate") {
    throw new Error(`Specialized certificate composition requires resolved versioned static content for '${report.templateCode}'.`);
  }
  const primitives: NativePagePrimitive[] = [];
  let cursorY = y;
  const title = composeTitle(report, cursorY);
  primitives.push(...title.primitives);
  cursorY = title.bottomMm;
  primitives.push(specializedText({
    id: "certificate-heading", text: content.heading, x: STANDARD_PAGE.marginMm, y: cursorY, width: STANDARD_PAGE.contentWidthMm,
    height: 4.7, fontSizePt: 10.5, fontWeight: "bold", color: COLOR.primaryDark, align: "center",
  }));
  cursorY += 4.7;
  primitives.push(specializedText({
    id: "certificate-salutation", text: content.salutation, x: STANDARD_PAGE.marginMm + 1, y: cursorY, width: STANDARD_PAGE.contentWidthMm - 2,
    height: 4, fontSizePt: TYPE.resultLabelPt, fontWeight: "bold", color: COLOR.primaryDark,
  }));
  cursorY += 4;
  for (const paragraph of content.narrativeParagraphs) {
    const paragraphText = paragraph.segments.map((segment) => segment.text).join("");
    const lines = wrapSpecializedText(`certificate-${paragraph.id}`, paragraphText, STANDARD_PAGE.contentWidthMm - 4, TYPE.resultLabelPt);
    addSpecializedLines({ primitives, id: `certificate-${paragraph.id}`, lines, x: STANDARD_PAGE.marginMm + 2, y: cursorY, width: STANDARD_PAGE.contentWidthMm - 4, fontSizePt: TYPE.resultLabelPt, color: COLOR.text });
    cursorY += Math.max(1, lines.length) * SPECIALIZED_LINE_HEIGHT_MM + 1;
  }

  const examination = splitExaminationDateTime(report.additionalFields.examinationDateTime || "");
  const orderRow = fieldRow({ id: "certificate-order", y: cursorY, fields: [
    { label: content.fieldLabels.orderDate, value: examination.date, width: 90 },
    { label: content.fieldLabels.orderTime, value: examination.time, width: 90 },
  ] });
  primitives.push(...orderRow.primitives);
  cursorY = orderRow.bottomMm;
  const identityRow = fieldRow({ id: "certificate-identity", y: cursorY, fields: [
    { label: content.fieldLabels.patientName, value: session.demographics.fullName, width: 105 },
    { label: content.fieldLabels.age, value: report.ageDisplay, width: 35 },
    { label: content.fieldLabels.sex, value: session.demographics.sex, width: 40 },
  ] });
  primitives.push(...identityRow.primitives);
  cursorY = identityRow.bottomMm;
  const company = report.additionalFields.companyName || "";
  const referralRow = fieldRow({ id: "certificate-referral", y: cursorY, fields: [
    { label: content.fieldLabels.referringDoctor, value: report.requestedBy.value, width: 90 },
    { label: content.fieldLabels.company, value: company, width: 90, omitWhenBlank: true },
  ] });
  primitives.push(...referralRow.primitives);
  cursorY = referralRow.bottomMm;
  primitives.push(specializedLine("certificate-demographics-bottom", STANDARD_PAGE.marginMm, cursorY, STANDARD_PAGE.marginMm + STANDARD_PAGE.contentWidthMm, cursorY, 0.1));
  cursorY += 1;

  primitives.push({ kind: "rect", id: "certificate-section-fill", x: STANDARD_PAGE.marginMm, y: cursorY, width: STANDARD_PAGE.contentWidthMm, height: 4.6, fill: COLOR.tealTint });
  primitives.push(specializedText({ id: "certificate-section-title", text: content.sectionTitle, x: STANDARD_PAGE.marginMm, y: cursorY + 0.35, width: STANDARD_PAGE.contentWidthMm, height: 4.1, fontSizePt: TYPE.resultHeaderPt, fontWeight: "bold", color: COLOR.primaryDark, align: "center" }));
  primitives.push({ kind: "line", id: "certificate-section-rule", x1: STANDARD_PAGE.marginMm, y1: cursorY + 4.6, x2: STANDARD_PAGE.marginMm + STANDARD_PAGE.contentWidthMm, y2: cursorY + 4.6, color: COLOR.primary, widthMm: 0.22 });
  cursorY += 4.6;
  const resultColumnWidth = 60;
  primitives.push(specializedText({ id: "certificate-test-header", text: content.resultTable.testHeader, x: STANDARD_PAGE.marginMm, y: cursorY + 0.3, width: STANDARD_PAGE.contentWidthMm - resultColumnWidth, height: 4.2, fontSizePt: TYPE.resultHeaderPt, fontWeight: "bold", color: COLOR.primaryDark, align: "center" }));
  primitives.push(specializedText({ id: "certificate-result-header", text: content.resultTable.resultHeader, x: STANDARD_PAGE.marginMm + STANDARD_PAGE.contentWidthMm - resultColumnWidth, y: cursorY + 0.3, width: resultColumnWidth, height: 4.2, fontSizePt: TYPE.resultHeaderPt, fontWeight: "bold", color: COLOR.primaryDark, align: "center" }));
  cursorY += 4.5 + INSET.resultBodyTopMm;
  const result = report.results.find((candidate) => candidate.omission === "Render");
  primitives.push(specializedText({ id: "certificate-test-label", text: content.resultTable.testLabel, x: STANDARD_PAGE.marginMm + 1, y: cursorY + 0.3, width: STANDARD_PAGE.contentWidthMm - resultColumnWidth - 2, height: 4.5, fontSizePt: TYPE.resultLabelPt, color: COLOR.text }));
  if (result?.formattedValue) primitives.push(specializedText({ id: "certificate-result-value", text: result.formattedValue, x: STANDARD_PAGE.marginMm + STANDARD_PAGE.contentWidthMm - resultColumnWidth, y: cursorY + 0.25, width: resultColumnWidth, height: 4.5, fontSizePt: TYPE.resultValuePt, fontWeight: "bold", color: COLOR.primaryDark, align: "center" }));
  cursorY += 4.8;
  primitives.push(specializedLine("certificate-result-bottom", STANDARD_PAGE.marginMm, cursorY, STANDARD_PAGE.marginMm + STANDARD_PAGE.contentWidthMm, cursorY));

  const kit = report.reagentKitInfo;
  primitives.push(specializedLine("certificate-kit-top", STANDARD_PAGE.marginMm, cursorY, STANDARD_PAGE.marginMm + STANDARD_PAGE.contentWidthMm, cursorY, 0.12));
  primitives.push(specializedText({ id: "certificate-kit-lot", text: `${content.kitLabels.lotNumber} ${kit?.lotNumber || ""}`, x: STANDARD_PAGE.marginMm + 1, y: cursorY + 0.45, width: 89, height: 4, fontSizePt: TYPE.referencePt, color: COLOR.text }));
  primitives.push(specializedText({ id: "certificate-kit-expiration", text: `${content.kitLabels.expirationDate} ${kit?.expirationDate || ""}`, x: STANDARD_PAGE.marginMm + 91, y: cursorY + 0.45, width: 88, height: 4, fontSizePt: TYPE.referencePt, color: COLOR.text }));
  cursorY += 5;
  primitives.push(specializedLine("certificate-kit-bottom", STANDARD_PAGE.marginMm, cursorY, STANDARD_PAGE.marginMm + STANDARD_PAGE.contentWidthMm, cursorY));
  if (definition.showRemarks && report.remarks) {
    const remarks = composeRemarks(report, cursorY + 1);
    primitives.push(...remarks.primitives);
    cursorY = remarks.bottomMm;
  }

  const examiner = report.signatories.find((slot) => slot.semanticRole === "Examiner");
  const verifier = report.signatories.find((slot) => slot.semanticRole === "Verifier");
  const pathologist = report.signatories.find((slot) => slot.semanticRole === "Pathologist");
  const signatories = composeSpecializedSignatoryColumns([
    { id: "certificate-examiner", heading: content.signatoryLabels.performedBy, roleLabel: content.signatoryLabels.medicalTechnologist, slot: examiner, allowSignatureImage: false },
    { id: "certificate-verifier", heading: content.signatoryLabels.verifiedBy, roleLabel: content.signatoryLabels.medicalTechnologist, slot: verifier, allowSignatureImage: false },
    { id: "certificate-pathologist", heading: "", roleLabel: content.signatoryLabels.pathologist, slot: pathologist, allowSignatureImage: true },
  ], cursorY + 2);
  primitives.push(...signatories.primitives);
  return { primitives, bottomMm: signatories.bottomMm };
}
