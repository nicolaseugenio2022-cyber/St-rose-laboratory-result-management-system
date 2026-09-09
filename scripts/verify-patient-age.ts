/**
 * Patient Age Verification Script
 *
 * The clinical rule this pins - THREE tiers, finest first:
 *   - under one completed month, an age is reported in completed DAYS. A newborn rendered as
 *     "0 months" tells the reader nothing, and this is the tier that fixes it;
 *   - from one completed month and under twelve, it is reported in completed MONTHS;
 *   - from twelve completed months, it is reported in completed YEARS;
 *   - units are singular at one and plural otherwise;
 *   - the age is derived from the date of birth against the REPORT'S examination date, so a
 *     historical report keeps the age the patient was when the specimen was examined;
 *   - a session carrying no date of birth - every session encoded before this rule existed -
 *     still renders from its stored age and unit, unchanged.
 *
 * Behavioural first, textual second. The month arithmetic is driven with real fixtures rather
 * than matched in source, because a regex over `completedMonthsBetween` would pass just as
 * happily on arithmetic that is wrong.
 */

import {
  completedDaysBetween,
  completedMonthsBetween,
  formatPatientAge,
  isValidDateOfBirth,
  parseCalendarDate,
  resolveAgeFromCompletedMonths,
  resolvePatientAge,
} from "../src/domain/patient-age";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ReportCompletionService } from "../src/domain/completion/report-completion-service";
import { applyEncodingResultValue, buildEncodingReport } from "../src/app/(dashboard)/workspace/_lib/encoding/report-encoding";
import { ReportDefinitionRegistry } from "../src/domain/definitions/report-definition-registry";
import { resolveCompletedSessionRenderModel, resolveDraftSessionRenderModel, resolveSessionRenderModel } from "../src/rendering/model";
import type { CompletedSessionSnapshot } from "../src/domain/completion/completed-snapshot";
import type { PatientAgeUnit } from "../src/domain/patient-age";
import type { ILaboratoryReport, IPatientReportSession } from "../src/domain/models/interfaces";
import type { PatientDemographics, RendererFamily } from "../src/domain/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`❌ Patient age verification failed: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

// ── Calendar parsing: strict, and rejects dates the calendar does not have ──
assert(parseCalendarDate("2026-02-28") !== null, "parseCalendarDate accepts a real date");
assert(parseCalendarDate("2026-02-30") === null, "parseCalendarDate rejects 30 February rather than rolling it forward");
assert(parseCalendarDate("2026-13-01") === null, "parseCalendarDate rejects month 13");
assert(parseCalendarDate("2026-1-1") === null, "parseCalendarDate rejects an unpadded date");
assert(parseCalendarDate("") === null, "parseCalendarDate rejects an empty string");
assert(parseCalendarDate(null) === null, "parseCalendarDate rejects null");
assert(parseCalendarDate("2024-02-29") !== null, "parseCalendarDate accepts a real leap day");
assert(parseCalendarDate("2026-02-29") === null, "parseCalendarDate rejects a leap day in a non-leap year");

// ── Completed months: a partially elapsed month does not count ──
function months(birth: string, reference: string): number | null {
  const from = parseCalendarDate(birth);
  const to = parseCalendarDate(reference);
  assert(from && to, `fixture dates parse (${birth} -> ${reference})`);
  return completedMonthsBetween(from!, to!);
}

assert(months("2026-01-20", "2026-09-19") === 7, "born on the 20th, still 7 completed months on the 19th of the 8th month");
assert(months("2026-01-20", "2026-09-20") === 8, "the 8th completed month is reached on the day of month");
assert(months("2026-01-20", "2026-09-21") === 8, "a day past the boundary is still 8 completed months");
assert(months("2025-09-09", "2026-09-08") === 11, "one day short of a first birthday is 11 completed months");
assert(months("2025-09-09", "2026-09-09") === 12, "a first birthday is 12 completed months");
assert(months("2026-09-09", "2026-09-09") === 0, "a newborn examined on the day of birth is 0 completed months");
assert(months("2026-09-10", "2026-09-09") === null, "a birth date after the examination date yields null, never a negative age");

// ── Completed days, the finest tier ──
function days(birth: string, reference: string): number | null {
  const from = parseCalendarDate(birth);
  const to = parseCalendarDate(reference);
  assert(from && to, `fixture dates parse (${birth} -> ${reference})`);
  return completedDaysBetween(from!, to!);
}
assert(days("2026-09-09", "2026-09-09") === 0, "a patient examined on the day of birth is 0 completed days");
assert(days("2026-09-08", "2026-09-09") === 1, "one elapsed day is 1 completed day");
assert(days("2026-08-28", "2026-09-09") === 12, "12 elapsed days is 12 completed days, across a month boundary");
// The pair is the point: the same two calendar dates are 1 day apart in a common year and 2 in a
// leap year, so this fails on any implementation that assumes a fixed month length.
assert(days("2026-02-28", "2026-03-01") === 1, "28 February to 1 March is 1 completed day in a common year");
assert(days("2024-02-28", "2024-03-01") === 2, "the same span is 2 completed days in a leap year, because 29 February exists");
assert(days("2026-09-10", "2026-09-09") === null, "a birth date after the examination date yields null days, never a negative count");

// ── The months/years cutover. The DAYS tier is decided in resolvePatientAge, not here, because a
// month count alone cannot distinguish a newborn from a three-week-old.
assert(resolveAgeFromCompletedMonths(0).unit === "months", "the month/year cutover still reports 0 as months; the days tier is applied above it");
assert(resolveAgeFromCompletedMonths(11).value === 11 && resolveAgeFromCompletedMonths(11).unit === "months", "11 completed months reports as 11 months");
assert(resolveAgeFromCompletedMonths(12).value === 1 && resolveAgeFromCompletedMonths(12).unit === "years", "12 completed months reports as 1 year");
assert(resolveAgeFromCompletedMonths(23).value === 1 && resolveAgeFromCompletedMonths(23).unit === "years", "23 completed months is still 1 year, never rounded up");
assert(resolveAgeFromCompletedMonths(96).value === 8 && resolveAgeFromCompletedMonths(96).unit === "years", "96 completed months reports as 8 years");

// ── Wording ──
assert(formatPatientAge(1, "months") === "1 month", `formatPatientAge(1, months) = "1 month"`);
assert(formatPatientAge(8, "months") === "8 months", `formatPatientAge(8, months) = "8 months"`);
assert(formatPatientAge(0, "months") === "0 months", `formatPatientAge(0, months) = "0 months"`);
assert(formatPatientAge(1, "years") === "1 year", `formatPatientAge(1, years) = "1 year"`);
assert(formatPatientAge(8, "years") === "8 years", `formatPatientAge(8, years) = "8 years"`);
assert(formatPatientAge(1, "days") === "1 day", `formatPatientAge(1, days) = "1 day"`);
assert(formatPatientAge(2, "days") === "2 days", `formatPatientAge(2, days) = "2 days"`);

// ── The three tiers, end to end, through the one resolver every surface uses ──
// Below one completed month an age is reported in DAYS: "0 months" tells a clinician nothing
// about a neonate.
function derived(dateOfBirth: string, examinationDate = "2026-09-09"): string {
  return resolvePatientAge({ dateOfBirth, examinationDate, age: 0, ageUnit: "years" }).display;
}
assert(derived("2026-09-09") === "0 days", "a patient examined on the day of birth displays \"0 days\"");
assert(derived("2026-09-08") === "1 day", "a one-day-old displays \"1 day\", singular");
assert(derived("2026-08-28") === "12 days", "a twelve-day-old displays \"12 days\", not \"0 months\"");
assert(derived("2026-08-10") === "30 days", "a patient one day short of a completed month is still reported in days");
assert(derived("2026-08-09") === "1 month", "the first completed month switches to months, singular");
assert(derived("2026-01-09") === "8 months", "an eight-month-old displays \"8 months\"");
assert(derived("2025-10-09") === "11 months", "eleven completed months is still reported in months");
assert(derived("2025-09-09") === "1 year", "twelve completed months switches to years, singular");
assert(derived("2018-09-09") === "8 years", "an eight-year-old displays \"8 years\"");
assert(!derived("2026-08-28").includes("month"), "a twelve-day-old never displays a month unit");
assert(!derived("2026-01-09").includes("year"), "an eight-month-old never displays a year unit");

// ── The reported defect: an eight-month-old must never print as "8 years" ──
const eightMonthOld = resolvePatientAge({
  dateOfBirth: "2026-01-09",
  examinationDate: "2026-09-09",
  age: 8,
  ageUnit: "years",
});
assert(eightMonthOld.display === "8 months", `an 8-month-old displays "8 months"`);
assert(eightMonthOld.source === "DateOfBirth", "a date of birth outranks the stored age and unit");
assert(!eightMonthOld.display.includes("year"), `an 8-month-old never displays a "year" unit`);

// ── Historical accuracy: the age is measured at the report's own examination date ──
const olderReport = resolvePatientAge({ dateOfBirth: "2018-05-01", examinationDate: "2020-05-01", age: 0, ageUnit: "years" });
const newerReport = resolvePatientAge({ dateOfBirth: "2018-05-01", examinationDate: "2026-05-01", age: 0, ageUnit: "years" });
assert(olderReport.display === "2 years", "a report examined in 2020 prints the age the patient was in 2020");
assert(newerReport.display === "8 years", "a report examined in 2026 prints the age the patient was in 2026");

// ── Legacy fallback: a session with no date of birth is preserved exactly ──
const legacy = resolvePatientAge({ dateOfBirth: null, examinationDate: "2026-09-09", age: 35, ageUnit: "years" });
assert(legacy.display === "35 years" && legacy.source === "StoredAge", "a record without a date of birth falls back to its stored age and unit");

const legacyMonths = resolvePatientAge({ dateOfBirth: undefined, examinationDate: "2026-09-09", age: 8, ageUnit: "months" });
assert(legacyMonths.display === "8 months" && legacyMonths.source === "StoredAge", "a stored months unit is preserved rather than restated as years");

// ── Invalid and future dates of birth fall back rather than inventing an age ──
const malformed = resolvePatientAge({ dateOfBirth: "09/09/2026", examinationDate: "2026-09-09", age: 4, ageUnit: "years" });
assert(malformed.source === "StoredAge" && malformed.display === "4 years", "a malformed date of birth falls back to the stored age");

const future = resolvePatientAge({ dateOfBirth: "2027-01-01", examinationDate: "2026-09-09", age: 4, ageUnit: "years" });
assert(future.source === "StoredAge", "a date of birth after the examination date is refused, never clamped to zero");

const unresolvable = resolvePatientAge({ dateOfBirth: null, examinationDate: "2026-09-09", age: 0, ageUnit: "years" });
assert(unresolvable.value === null && unresolvable.display === "", "with neither a date of birth nor a positive stored age, nothing is invented");

// ── Validity predicate, used by the form and by completion ──
assert(isValidDateOfBirth("2026-01-09", "2026-09-09"), "a date of birth before the examination date is valid");
assert(!isValidDateOfBirth("2027-01-09", "2026-09-09"), "a date of birth after the examination date is invalid");
assert(!isValidDateOfBirth("2026-02-30", "2026-09-09"), "a date the calendar does not have is invalid");
assert(!isValidDateOfBirth("", "2026-09-09"), "an empty date of birth is invalid");
assert(!isValidDateOfBirth(null, "2026-09-09"), "a null date of birth is invalid");

// ── The render model: what Preview, Print and PDF actually receive ──
// All three outputs are composed from one resolved render model, so pinning `ageDisplay` here
// pins the printed sheet and the exported PDF with it.

// CHEM_8 is the ordinary case: a standard report that prints age WITH its unit. CBC is asserted
// separately below because it declares `ageDisplay: "NumberOnly"`.
const chem8 = ReportDefinitionRegistry.getDefinition("CHEM_8")!;

function reportFixture(definition = chem8): ILaboratoryReport {
  const cbc = definition;
  return {
    id: "age-report",
    sessionId: "age-session",
    templateCode: cbc.templateCode,
    templateTitle: cbc.templateTitle,
    rendererFamily: cbc.rendererFamily as RendererFamily,
    remarks: "",
    reagentKitInfo: null,
    encodingData: { requestedBy: "Requested By", additionalFields: {}, repeatableFindings: {} },
    results: cbc.parameters.map((parameter) => ({
      id: `age-${parameter.parameterCode}`,
      reportId: "age-report",
      parameterCode: parameter.parameterCode,
      parameterName: parameter.parameterName,
      resultValue: "",
      evaluationOutcome: "NoEvaluation" as const,
      displayOrder: parameter.displayOrder,
    })),
    signatories: [],
  };
}

function renderedAgeDisplay(
  demographics: Partial<PatientDemographics>,
  definition = chem8
): string {
  const session: IPatientReportSession = {
    id: "age-session",
    accessionNumber: "ACC-AGE",
    status: "Draft",
    demographics: {
      fullName: "Age Patient",
      age: 0,
      ageUnit: "years",
      sex: "Female",
      address: "STA. ROSA, NUEVA ECIJA",
      patientStatus: "OutPatient",
      examinationDate: "2026-09-09",
      requestingPhysician: "",
      ...demographics,
    } as PatientDemographics,
    reports: [reportFixture(definition)],
    createdAt: "2026-09-09T00:00:00.000Z",
    completedAt: null,
  };
  return resolveDraftSessionRenderModel(session).reports[0].ageDisplay;
}

assert(
  renderedAgeDisplay({ dateOfBirth: "2026-01-09", age: 8, ageUnit: "months" }) === "8 months",
  `the rendered report prints "8 months" for an eight-month-old`
);
assert(
  renderedAgeDisplay({ dateOfBirth: "2025-09-09", age: 1, ageUnit: "years" }) === "1 year",
  `the rendered report prints "1 year" at exactly twelve completed months`
);
assert(
  renderedAgeDisplay({ dateOfBirth: "2018-09-09", age: 8, ageUnit: "years" }) === "8 years",
  `the rendered report prints "8 years" for an eight-year-old`
);
assert(
  renderedAgeDisplay({ age: 21, ageUnit: "years" }) === "21 years",
  "a record with no date of birth renders exactly its stored age and unit, unchanged"
);
assert(
  renderedAgeDisplay({ age: 8, ageUnit: "months" }) === "8 months",
  "a stored months unit renders as months even with no date of birth"
);
assert(
  renderedAgeDisplay({ dateOfBirth: "2027-01-01", age: 21, ageUnit: "years" }) === "21 years",
  "a date of birth after the examination date does not disturb the stored age on the report"
);
assert(
  renderedAgeDisplay({ age: 0, ageUnit: "years" }) === "",
  "an unresolvable age renders as an empty field rather than a fabricated one"
);

// Historical accuracy at the render boundary: the same patient, two reports, two examination
// dates. A report reopened years later must still print the age at ITS examination date.
assert(
  renderedAgeDisplay({ dateOfBirth: "2018-05-01", examinationDate: "2020-05-01", age: 2, ageUnit: "years" }) === "2 years" &&
    renderedAgeDisplay({ dateOfBirth: "2018-05-01", examinationDate: "2026-05-01", age: 8, ageUnit: "years" }) === "8 years",
  "the report prints the age the patient was at its own examination date"
);

// CBC corrected its age presentation under render contract v2: v1 printed a bare number, v2
// prints the number with its unit. Both halves are pinned, because the whole point of the version
// gate is that already-issued output survives unchanged.
const cbcDefinition = ReportDefinitionRegistry.getDefinition("CBC")!;
assert(
  cbcDefinition.renderContract?.renderContractVersion === 2 &&
    cbcDefinition.renderContract?.supersededRenderContractVersions?.includes(1) === true,
  "CBC declares render contract v2 and can still render a v1 snapshot"
);
assert(
  cbcDefinition.renderContract?.demographics?.ageDisplay === "NumberWithUnit" &&
    cbcDefinition.renderContract?.demographics?.supersededAgeDisplay === "NumberOnly" &&
    cbcDefinition.renderContract?.demographics?.sinceRenderContractVersion === 2,
  "CBC gates its unit-bearing age at v2 and keeps NumberOnly for anything frozen earlier"
);
assert(
  renderedAgeDisplay({ dateOfBirth: "2026-01-09", age: 8, ageUnit: "months" }, cbcDefinition) === "8 months",
  `a new CBC prints "8 months" for an eight-month-old`
);
assert(
  renderedAgeDisplay({ dateOfBirth: "2018-09-09", age: 8, ageUnit: "years" }, cbcDefinition) === "8 years",
  `a new CBC prints "8 years" for an eight-year-old`
);


// The gate proven on a real frozen snapshot: the SAME patient, one CBC completed under v1 and one
// under v2. The v1 report must still print the bare number it was issued with.
function completedCbcAgeDisplay(frozenRenderContractVersion: number): string {
  const snapshot: CompletedSessionSnapshot = {
    snapshotVersion: 2,
    completedAt: "2026-09-09T01:00:00.000Z",
    demographics: {
      fullName: "Age Patient",
      dateOfBirth: "2026-01-09",
      age: 8,
      ageUnit: "months",
      sex: "Female",
      address: "STA. ROSA, NUEVA ECIJA",
      patientStatus: "OutPatient",
      examinationDate: "2026-09-09",
      requestingPhysician: "",
    },
    reports: [{
      templateCode: "CBC",
      templateTitle: cbcDefinition.templateTitle,
      rendererFamily: cbcDefinition.rendererFamily as RendererFamily,
      renderContractVersion: frozenRenderContractVersion,
      printedTitle: cbcDefinition.reportTitle ?? null,
      staticContentVersion: "standard-report-v1",
      requestedBy: "Dr. Requested",
      additionalFields: {},
      results: [],
      remarks: "",
      reagentKitInfo: null,
      repeatableFindings: {},
      signatories: [],
    }],
  };
  return resolveCompletedSessionRenderModel(snapshot).reports[0].ageDisplay;
}

assert(completedCbcAgeDisplay(1) === "8", "a CBC completed under v1 still prints the bare number it was issued with");
assert(completedCbcAgeDisplay(2) === "8 months", "a CBC completed under v2 prints the age with its unit");


// ── Manual entry: with no date of birth the operator states BOTH number and unit ──
// All three units survive a round trip through the resolver unchanged. This is what makes the
// manual path able to express a neonate at all; before it, the unit was hardcoded to years.
for (const [value, unit, expected] of [
  [12, "days", "12 days"],
  [1, "days", "1 day"],
  [8, "months", "8 months"],
  [1, "months", "1 month"],
  [35, "years", "35 years"],
  [1, "years", "1 year"],
] as const) {
  const manual = resolvePatientAge({ dateOfBirth: null, examinationDate: "2026-09-09", age: value, ageUnit: unit });
  assert(manual.source === "StoredAge", `a manually entered ${unit} age is read from the stored record, not derived`);
  assert(manual.display === expected, `a manual age of ${value} ${unit} displays "${expected}"`);
  assert(manual.unit === unit, `a manual ${unit} age keeps its stored unit when the record is edited`);
}

// The form must offer exactly those three units when there is no date of birth, and must keep the
// age read-only when there is one. Source-matched: a headless render cannot express which control
// an operator sees.
const completionServiceSource = readFileSync(
  join(process.cwd(), "src/domain/completion/report-completion-service.ts"),
  "utf8"
);
const demographicsFormSource = readFileSync(
  join(process.cwd(), "src/app/(dashboard)/workspace/_components/PatientDemographicsForm.tsx"),
  "utf8"
).replace(/\r\n/g, "\n");
for (const unit of ["days", "months", "years"] as const) {
  assert(
    new RegExp(`<option value="${unit}">`).test(demographicsFormSource),
    `the manual age unit selector offers ${unit}`
  );
}
assert(/data-patient-age-unit/.test(demographicsFormSource), "the manual age unit control is addressable");

// Anchored to the DERIVED input's own element, not to the whole file. A bare /readOnly/ over the
// source passed if the token appeared on any element anywhere, so moving readOnly off the derived
// age - the exact regression this claims to prevent - would not have failed it.
const derivedAgeStart = demographicsFormSource.indexOf("data-patient-age-derived");
const derivedAgeElement = derivedAgeStart < 0
  ? ""
  : demographicsFormSource.slice(derivedAgeStart, demographicsFormSource.indexOf("/>", derivedAgeStart));
assert(derivedAgeElement !== "", "the derived age is rendered by an addressable input element");
assert(/\breadOnly\b/.test(derivedAgeElement), "the DERIVED age input is read-only, so a typed value can never disagree with the date of birth");
assert(/value=\{resolvedAge\.display\}/.test(derivedAgeElement), "the derived age input shows the resolved wording rather than a separately computed one");

// The manual controls must be ABSENT while an age is derived, not merely hidden behind it: an
// editable control still in the tree could be reached and would let a typed value disagree.
assert(
  demographicsFormSource.indexOf("data-patient-age-derived") < demographicsFormSource.indexOf("data-patient-age-unit"),
  "the derived and manual age controls are exclusive branches of one conditional, never rendered together"
);

// ── Every report family renders the resolved unit, not just the standard one ──
// One representative per layout family, all resolved through the same adapter.
for (const [templateCode, label] of [
  ["CHEM_8", "standard tabular"],
  ["HBSAG", "compact result grid"],
  ["URINALYSIS", "microscopy two-column"],
] as const) {
  const definition = ReportDefinitionRegistry.getDefinition(templateCode)!;
  assert(
    renderedAgeDisplay({ dateOfBirth: "2026-08-28", age: 12, ageUnit: "days" }, definition) === "12 days",
    `${templateCode} (${label}) renders a twelve-day-old as "12 days"`
  );
  assert(
    renderedAgeDisplay({ dateOfBirth: "2026-01-09", age: 8, ageUnit: "months" }, definition) === "8 months",
    `${templateCode} (${label}) renders an eight-month-old as "8 months"`
  );
}

// ── CBC: v2 carries the resolved unit through the days tier; v1 is untouched ──
assert(
  renderedAgeDisplay({ dateOfBirth: "2026-08-28", age: 12, ageUnit: "days" }, cbcDefinition) === "12 days",
  `a new CBC renders a twelve-day-old as "12 days" under render contract v2`
);
assert(completedCbcAgeDisplay(1) === "8", "a CBC completed under v1 is still unchanged by the days tier");


// ── The frozen-age boundary: a completed report prints what it printed when it was issued ──
//
// Age is DERIVED, so without a freeze the wording a report shows depends on the rule in force when
// it is RENDERED. Correcting the rule - as the days tier just did - would then silently restate
// reports that already went out. These assertions are the proof that it cannot.

function completedSnapshotAgeDisplay(
  snapshotDemographics: Partial<PatientDemographics>,
  frozenAge: { value: number; unit: PatientAgeUnit; display: string } | null | undefined,
  templateCode = "CHEM_8",
  frozenRenderContractVersion?: number
): string {
  const definition = ReportDefinitionRegistry.getDefinition(templateCode)!;
  const snapshot: CompletedSessionSnapshot = {
    snapshotVersion: 2,
    completedAt: "2026-09-09T01:00:00.000Z",
    demographics: {
      fullName: "Frozen Age Patient",
      age: 1,
      ageUnit: "years",
      sex: "Female",
      address: "STA. ROSA, NUEVA ECIJA",
      patientStatus: "OutPatient",
      examinationDate: "2026-09-09",
      requestingPhysician: "",
      ...snapshotDemographics,
    } as PatientDemographics,
    ...(frozenAge === undefined ? {} : { frozenAge }),
    reports: [{
      templateCode,
      templateTitle: definition.templateTitle,
      rendererFamily: definition.rendererFamily as RendererFamily,
      renderContractVersion: frozenRenderContractVersion ?? definition.renderContract?.renderContractVersion ?? 1,
      printedTitle: definition.reportTitle ?? null,
      staticContentVersion: definition.renderContract?.staticContentVersion ?? "standard-report-v1",
      requestedBy: "Dr. Requested",
      additionalFields: {},
      results: [],
      remarks: "",
      reagentKitInfo: null,
      repeatableFindings: {},
      signatories: [],
    }],
  };
  return resolveCompletedSessionRenderModel(snapshot).reports[0].ageDisplay;
}

// An OLD snapshot - written before the frozen field existed - keeps the wording of its own era,
// ungrammatical plural included. Restating an issued report is worse than a plural already on it.
assert(
  completedSnapshotAgeDisplay({ age: 1, ageUnit: "years" }, undefined) === "1 years",
  `a snapshot issued before the frozen age existed still prints "1 years", exactly as issued`
);
assert(
  completedSnapshotAgeDisplay({ age: 8, ageUnit: "months" }, undefined) === "8 months",
  "an old snapshot's other wordings are unchanged too"
);
assert(
  completedSnapshotAgeDisplay({ age: 35, ageUnit: "years" }, undefined) === "35 years",
  "an old snapshot with a plural age is unaffected by the freeze"
);

// A NEW snapshot carries the corrected wording, frozen at completion.
assert(
  completedSnapshotAgeDisplay({ age: 1, ageUnit: "years" }, { value: 1, unit: "years", display: "1 year" }) === "1 year",
  "a snapshot completed under the corrected rule prints its frozen grammar"
);
assert(
  completedSnapshotAgeDisplay({ dateOfBirth: "2026-08-28", age: 12, ageUnit: "days" }, { value: 12, unit: "days", display: "12 days" }) === "12 days",
  "a twelve-day-old completed under the corrected rule prints its frozen days wording"
);

// The point of the freeze: the frozen wording WINS over anything the resolver would say today, so
// a later change to the age rule cannot reach an issued report. The demographics below would
// resolve to "8 months" now; the snapshot was issued saying "0 months" and must keep saying it.
assert(
  completedSnapshotAgeDisplay(
    { dateOfBirth: "2026-01-09", age: 0, ageUnit: "months" },
    { value: 0, unit: "months", display: "0 months" }
  ) === "0 months",
  "a frozen wording is printed verbatim even when today's resolver would word it differently"
);

// A branch-era snapshot that carries a dateOfBirth but NO frozen age is still rendered from its
// stored age and unit, never re-derived. This is the case that would otherwise let the resolver
// reach an issued report through the back door.
assert(
  completedSnapshotAgeDisplay({ dateOfBirth: "2026-01-09", age: 0, ageUnit: "months" }, undefined) === "",
  "a snapshot with a date of birth but no frozen age is read from its stored fields, not re-derived"
);
assert(
  completedSnapshotAgeDisplay({ dateOfBirth: "2026-01-09", age: 1, ageUnit: "years" }, undefined) === "1 years",
  "such a snapshot keeps its stored wording even though the resolver would now say 8 months"
);

// CBC keeps its NumberOnly contract on v1 and its unit on v2, with the freeze in place.
assert(
  completedSnapshotAgeDisplay({ age: 1, ageUnit: "years" }, { value: 1, unit: "years", display: "1 year" }, "CBC", 1) === "1",
  "CBC still prints a bare number for a v1 snapshot, frozen age notwithstanding"
);
assert(
  completedSnapshotAgeDisplay({ dateOfBirth: "2026-08-28", age: 12, ageUnit: "days" }, { value: 12, unit: "days", display: "12 days" }, "CBC", 2) === "12 days",
  "CBC v2 prints the frozen unit-bearing wording, including the days tier"
);

// Draft and completed agree at the moment of completion: what the operator approved is what is
// frozen, and what is frozen is what renders.
for (const [dateOfBirth, expected] of [
  ["2026-08-28", "12 days"],
  ["2026-08-09", "1 month"],
  ["2026-01-09", "8 months"],
  ["2025-09-09", "1 year"],
] as const) {
  const draftWording = renderedAgeDisplay({ dateOfBirth, age: 0, ageUnit: "years" });
  const resolved = resolvePatientAge({ dateOfBirth, examinationDate: "2026-09-09", age: 0, ageUnit: "years" });
  const frozen = { value: resolved.value!, unit: resolved.unit!, display: resolved.display };
  assert(draftWording === expected, `the draft renders "${expected}" before completion`);
  assert(
    completedSnapshotAgeDisplay({ dateOfBirth, age: frozen.value, ageUnit: frozen.unit }, frozen) === draftWording,
    `completing freezes exactly what the draft showed for "${expected}"`
  );
}

// ── The freeze SIDE, proven behaviourally through the real completion service ──
// A regex over the service source would pass against a freeze that wrote the wrong unit, a
// hand-built display string, or a different resolver. This drives validateAndCompose itself.
function completionFrozenAge(demographicsOverride: Partial<PatientDemographics>) {
  const definition = ReportDefinitionRegistry.getDefinition("CHEM_8")!;
  const report = buildEncodingReport({
    definition,
    sessionId: "freeze-session",
    reportId: "freeze-report",
    rendererFamily: definition.rendererFamily as RendererFamily,
    signatories: [
      { personnelId: "p-1", role: "Pathologist", printedFullName: "PATHOLOGIST", printedCredentials: "MD", printedPrcLicenseNumber: "P-1", signatureImageUrl: null, displayOrder: 1 },
      { personnelId: "m-1", role: "MedicalTechnologist", printedFullName: "MEDTECH", printedCredentials: "RMT", printedPrcLicenseNumber: "M-1", signatureImageUrl: null, displayOrder: 2 },
    ],
  });
  let populated = report;
  for (const parameter of definition.parameters) {
    if (parameter.inputType === "Computed") continue;
    populated = applyEncodingResultValue(populated, definition, parameter.parameterCode, "1", "Entered");
  }
  const session: IPatientReportSession = {
    id: "freeze-session",
    accessionNumber: "ACC-FREEZE",
    status: "Draft",
    demographics: {
      fullName: "Freeze Patient",
      age: 0,
      ageUnit: "years",
      sex: "Female",
      address: "STA. ROSA, NUEVA ECIJA",
      patientStatus: "OutPatient",
      examinationDate: "2026-09-09",
      requestingPhysician: "",
      ...demographicsOverride,
    } as PatientDemographics,
    reports: [populated],
    createdAt: "2026-09-09T00:00:00.000Z",
    completedAt: null,
  };
  return ReportCompletionService.validateAndCompose(session, "2026-09-09T01:00:00.000Z").frozenAge;
}

// Derived from a date of birth, across all three tiers.
for (const [dateOfBirth, value, unit, display] of [
  ["2026-08-28", 12, "days", "12 days"],
  ["2026-09-08", 1, "days", "1 day"],
  ["2026-08-09", 1, "months", "1 month"],
  ["2026-01-09", 8, "months", "8 months"],
  ["2025-09-09", 1, "years", "1 year"],
  ["2018-09-09", 8, "years", "8 years"],
] as const) {
  const frozen = completionFrozenAge({ dateOfBirth });
  assert(frozen?.value === value, `completion freezes the value ${value} for a patient born ${dateOfBirth}`);
  assert(frozen?.unit === unit, `completion freezes the unit "${unit}" for a patient born ${dateOfBirth}`);
  assert(frozen?.display === display, `completion freezes the wording "${display}" for a patient born ${dateOfBirth}`);
}

// Manually entered, no date of birth: the operator's own unit is what is frozen.
for (const [age, unit, display] of [
  [12, "days", "12 days"],
  [8, "months", "8 months"],
  [1, "years", "1 year"],
] as const) {
  const frozen = completionFrozenAge({ dateOfBirth: undefined, age, ageUnit: unit });
  assert(frozen?.unit === unit, `completion freezes a manually selected ${unit} unit exactly`);
  assert(frozen?.display === display, `completion freezes the manual wording "${display}"`);
}

// The frozen wording is the SAME string the draft showed, not a separately built one.
for (const dateOfBirth of ["2026-08-28", "2026-01-09", "2025-09-09"] as const) {
  assert(
    completionFrozenAge({ dateOfBirth })?.display === renderedAgeDisplay({ dateOfBirth, age: 0, ageUnit: "years" }),
    `what completion freezes for ${dateOfBirth} is exactly what the draft displayed`
  );
}

// ── The pre-snapshot legacy path, which has no snapshot at all ──
function legacyCompletedAgeDisplay(demographicsOverride: Partial<PatientDemographics>): string {
  const definition = ReportDefinitionRegistry.getDefinition("CHEM_8")!;
  const session: IPatientReportSession = {
    id: "legacy-session",
    accessionNumber: "ACC-LEGACY",
    status: "Completed",
    demographics: {
      fullName: "Legacy Patient",
      age: 1,
      ageUnit: "years",
      sex: "Female",
      address: "STA. ROSA, NUEVA ECIJA",
      patientStatus: "OutPatient",
      examinationDate: "2026-09-09",
      requestingPhysician: "",
      ...demographicsOverride,
    } as PatientDemographics,
    reports: [{
      id: "legacy-report",
      sessionId: "legacy-session",
      templateCode: definition.templateCode,
      templateTitle: definition.templateTitle,
      rendererFamily: definition.rendererFamily as RendererFamily,
      remarks: "",
      reagentKitInfo: null,
      encodingData: { requestedBy: "Dr. Requested", additionalFields: {}, repeatableFindings: {} },
      results: [],
      signatories: [],
    }],
    createdAt: "2026-09-09T00:00:00.000Z",
    completedAt: "2026-09-09T01:00:00.000Z",
  };
  const model = resolveSessionRenderModel(session);
  assert(model.origin === "Completed", "the pre-snapshot legacy path renders as a completed session");
  // Both the per-report wording and the session-level demographics must be as-issued.
  assert(
    model.demographics.ageDisplay === model.reports[0].ageDisplay,
    "the session-level and per-report age agree on the pre-snapshot legacy path"
  );
  return model.reports[0].ageDisplay;
}

assert(
  legacyCompletedAgeDisplay({ age: 1, ageUnit: "years" }) === "1 years",
  `a completed session with no snapshot still prints "1 years", exactly as issued`
);
assert(
  legacyCompletedAgeDisplay({ age: 8, ageUnit: "months" }) === "8 months",
  "the pre-snapshot legacy path prints its stored months wording unchanged"
);
assert(
  legacyCompletedAgeDisplay({ dateOfBirth: "2026-01-09", age: 1, ageUnit: "years" }) === "1 years",
  "the pre-snapshot legacy path is not re-derived even when a date of birth is present"
);

console.log("\n✅ Patient age verification passed.");
