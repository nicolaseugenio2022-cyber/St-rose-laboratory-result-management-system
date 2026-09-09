/**
 * The maintained examination catalogue, as the physician administration screen needs to show it.
 *
 * PRESENTATION DATA ONLY. This module holds the seventeen maintained examination codes, their
 * printed titles and the five families they group under, plus the pure functions that turn a set
 * of codes into something an Administrator can read at a glance. Nothing here validates,
 * authorizes or persists anything: the database owns the assignment rows, the server action owns
 * the authorization, and this module owns nothing but the words on the screen.
 *
 * The codes and titles are stated here rather than imported because a client component may not
 * reach into `@/domain` - the personnel and physician components are held to that boundary by
 * `verify-physician-directory.ts`, and a presentation catalogue is not a reason to breach it.
 * They are the same seventeen codes the registry seed declares, in the same five families
 * (`INITIAL_REPORT_TEMPLATES` in `src/services/registry-seed-data.ts`), so a title shown beside a
 * checkbox is the title the report prints under.
 *
 * The family short labels exist for one reason: a directory row must summarise an assignment set
 * without listing seventeen codes inline, and "Chemistry x6" fits a table cell at any width where
 * "Clinical Chemistry x6" does not. The long label is what the editor's group headings use, and
 * what a screen reader is given, so the abbreviation is never the only form of the word.
 */

export interface MaintainedExamination {
  /** The registry's natural key - the value an assignment row stores in `template_code`. */
  readonly code: string;
  /** The printed title of the examination, as the registry declares it. */
  readonly title: string;
}

export interface ExaminationFamily {
  readonly id: string;
  /** The full family name, used for group headings and for accessible text. */
  readonly label: string;
  /** The compact form used in a table-cell tally. Never the only place the family is named. */
  readonly shortLabel: string;
  readonly examinations: readonly MaintainedExamination[];
}

export const EXAMINATION_FAMILIES: readonly ExaminationFamily[] = [
  {
    id: "HEMATOLOGY",
    label: "Hematology",
    shortLabel: "Hematology",
    examinations: [
      { code: "CBC", title: "Complete Blood Count" },
      { code: "CT_BT", title: "Clotting Time & Bleeding Time" },
      { code: "ESR", title: "Erythrocyte Sedimentation Rate" },
    ],
  },
  {
    id: "CLINICAL_CHEMISTRY",
    label: "Clinical Chemistry",
    shortLabel: "Chemistry",
    examinations: [
      { code: "CHEM_8", title: "Chemistry 8 Panel" },
      { code: "CHEM_10", title: "Chemistry 10 Panel" },
      { code: "HDL_LDL", title: "Lipid Profile Panel (HDL/LDL)" },
      { code: "OGTT", title: "Oral Glucose Tolerance Test" },
      { code: "RBS", title: "Random Blood Sugar" },
      { code: "HBA1C", title: "HbA1c Report" },
    ],
  },
  {
    id: "CLINICAL_MICROSCOPY",
    label: "Clinical Microscopy",
    shortLabel: "Microscopy",
    examinations: [
      { code: "FECALYSIS", title: "Fecalysis Examination" },
      { code: "URINALYSIS", title: "Urinalysis Examination" },
    ],
  },
  {
    id: "SEROLOGY_IMMUNOLOGY",
    label: "Serology & Immunology",
    shortLabel: "Serology",
    examinations: [
      { code: "HBSAG", title: "Hepatitis B (HBsAg) Screening" },
      { code: "RPR", title: "RPR Syphilis Test" },
      { code: "DENGUE_DUO", title: "Dengue Duo Rapid Test" },
      { code: "PREG_TEST", title: "Pregnancy Test (Urine)" },
      { code: "HIV_RESULT", title: "AIDS Free Certificate / HIV Result" },
    ],
  },
  {
    id: "BLOOD_BANK",
    label: "Blood Bank",
    shortLabel: "Blood Bank",
    examinations: [{ code: "BLOOD_TYPING", title: "Blood Typing Report" }],
  },
];

interface CatalogueRecord {
  readonly examination: MaintainedExamination;
  readonly family: ExaminationFamily;
  /** Position in catalogue order, so any set of codes can be shown in one stable order. */
  readonly order: number;
}

const CATALOGUE: ReadonlyMap<string, CatalogueRecord> = (() => {
  const index = new Map<string, CatalogueRecord>();
  let order = 0;
  for (const family of EXAMINATION_FAMILIES) {
    for (const examination of family.examinations) {
      index.set(examination.code, { examination, family, order });
      order += 1;
    }
  }
  return index;
})();

/** The seventeen maintained codes, in catalogue order. */
export const MAINTAINED_EXAMINATION_CODES: readonly string[] = Array.from(CATALOGUE.keys());

export const MAINTAINED_EXAMINATION_COUNT = MAINTAINED_EXAMINATION_CODES.length;

/** True only for a code this screen actually maintains. An unknown code is never shown as one. */
export function isMaintainedExamination(code: string): boolean {
  return CATALOGUE.has(code);
}

/** The printed title, falling back to the code itself so an unknown value is still legible. */
export function examinationTitle(code: string): string {
  return CATALOGUE.get(code)?.examination.title ?? code;
}

/** The full family name an examination belongs to, or an empty string for an unknown code. */
export function examinationFamilyLabel(code: string): string {
  return CATALOGUE.get(code)?.family.label ?? "";
}

/** Catalogue order, so two physicians with the same assignments read identically. */
export function sortExaminationCodes(codes: readonly string[]): string[] {
  return [...codes].sort(
    (left, right) =>
      (CATALOGUE.get(left)?.order ?? Number.MAX_SAFE_INTEGER) -
      (CATALOGUE.get(right)?.order ?? Number.MAX_SAFE_INTEGER)
  );
}

export interface FamilyTally {
  readonly familyId: string;
  readonly label: string;
  readonly shortLabel: string;
  /** How many of this family's examinations are in the given set. Always at least one. */
  readonly count: number;
  /** How many the family holds in total, so "3 of 3" can be said rather than implied. */
  readonly total: number;
}

/**
 * The per-family counts for a set of codes, in catalogue order, families with none omitted.
 *
 * This is what lets a directory row stay one line at every width: five tallies at most, and in
 * practice one or two, instead of up to seventeen codes.
 */
export function tallyByFamily(codes: readonly string[]): FamilyTally[] {
  const counts = new Map<string, number>();
  for (const code of codes) {
    const record = CATALOGUE.get(code);
    if (!record) continue;
    counts.set(record.family.id, (counts.get(record.family.id) ?? 0) + 1);
  }
  const tallies: FamilyTally[] = [];
  for (const family of EXAMINATION_FAMILIES) {
    const count = counts.get(family.id) ?? 0;
    if (count === 0) continue;
    tallies.push({
      familyId: family.id,
      label: family.label,
      shortLabel: family.shortLabel,
      count,
      total: family.examinations.length,
    });
  }
  return tallies;
}

/**
 * The one-line tally, spelled out with the FULL family names.
 *
 * This is the text equivalent behind the compact badges: the badges abbreviate, this does not,
 * and it is what a screen reader is given so the abbreviation is never the only form available.
 */
export function summarizeByFamily(codes: readonly string[]): string {
  return tallyByFamily(codes)
    .map((tally) => `${tally.label} ${tally.count} of ${tally.total}`)
    .join(", ");
}

/** Every examination title in the set, in catalogue order - the full detail, as words. */
export function listExaminationTitles(codes: readonly string[]): string[] {
  return sortExaminationCodes(codes).map(examinationTitle);
}

/** De-duplicated, restricted to maintained codes, in catalogue order. */
export function normalizeExaminationCodes(codes: readonly string[]): string[] {
  return sortExaminationCodes(Array.from(new Set(codes)).filter(isMaintainedExamination));
}

/**
 * The default set narrowed to the assignments that actually exist.
 *
 * The structural rule, stated once: a default is a property OF an assignment. The database says
 * the same thing by carrying `is_default` on the assignment row, so a default without an
 * assignment has no row to live in and is unrepresentable. This function is how the editor keeps
 * its own state honest the instant an examination stops being assigned - the control is disabled
 * so it cannot be set, and this narrowing means an already-set default does not survive the
 * assignment being withdrawn.
 */
export function defaultsWithinAssignments(
  defaults: readonly string[],
  assigned: readonly string[]
): string[] {
  const assignedSet = new Set(normalizeExaminationCodes(assigned));
  return normalizeExaminationCodes(defaults).filter((code) => assignedSet.has(code));
}

/** True when the two sets hold the same codes, whatever order they arrived in. */
export function sameExaminationSet(left: readonly string[], right: readonly string[]): boolean {
  const a = normalizeExaminationCodes(left);
  const b = normalizeExaminationCodes(right);
  return a.length === b.length && a.every((code, index) => code === b[index]);
}

/**
 * One physician's assignment set, as the directory row and the editor both need it.
 *
 * Two code lists rather than a list of rows, because every consumer on this screen asks one of
 * exactly two questions - "which examinations" and "which of those are defaults" - and the row
 * shape would make both of them a filter. `defaultCodes` is always a subset of `assignedCodes`;
 * `groupAssignmentsByPhysician` guarantees it on the way in and `defaultsWithinAssignments`
 * re-establishes it on every edit.
 */
export interface PhysicianExaminationAssignments {
  readonly assignedCodes: readonly string[];
  readonly defaultCodes: readonly string[];
}

/** The state of a physician nobody has assigned anything to. Shared so it is one object. */
export const NO_EXAMINATION_ASSIGNMENTS: PhysicianExaminationAssignments = {
  assignedCodes: [],
  defaultCodes: [],
};

/** The row shape the server-action boundary returns, named structurally so this module keeps
 *  no import of its own. */
export interface PhysicianAssignmentRow {
  readonly physicianId: string;
  readonly templateCode: string;
  readonly isDefault: boolean;
}

/**
 * Fold the flat assignment rows into one entry per physician.
 *
 * An unmaintained template code is dropped rather than shown: this screen maintains seventeen
 * examinations, and a row naming something else is a fact about a registry it cannot present.
 * Dropping it keeps the tallies honest instead of rendering a code with no title beside it.
 */
export function groupAssignmentsByPhysician(
  rows: readonly PhysicianAssignmentRow[]
): Record<string, PhysicianExaminationAssignments> {
  const assigned = new Map<string, string[]>();
  const defaults = new Map<string, string[]>();

  for (const row of rows) {
    if (!isMaintainedExamination(row.templateCode)) continue;
    const forPhysician = assigned.get(row.physicianId) ?? [];
    forPhysician.push(row.templateCode);
    assigned.set(row.physicianId, forPhysician);
    if (row.isDefault) {
      const defaultsForPhysician = defaults.get(row.physicianId) ?? [];
      defaultsForPhysician.push(row.templateCode);
      defaults.set(row.physicianId, defaultsForPhysician);
    }
  }

  const grouped: Record<string, PhysicianExaminationAssignments> = {};
  for (const [physicianId, codes] of assigned) {
    const assignedCodes = normalizeExaminationCodes(codes);
    grouped[physicianId] = {
      assignedCodes,
      defaultCodes: defaultsWithinAssignments(defaults.get(physicianId) ?? [], assignedCodes),
    };
  }
  return grouped;
}
