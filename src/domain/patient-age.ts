import type { PatientDemographics } from "@/domain/types";

/**
 * The single place patient age is computed and worded.
 *
 * Age reaches a report through two different histories and they must not be conflated. A session
 * encoded before this unit existed carries only the integer the operator typed plus a unit that
 * the Workspace hardcoded to "years" - which is exactly how an eight-month-old was printed as
 * "8 years". A session encoded from now on carries a date of birth, and its age is DERIVED here,
 * at the report's own examination date.
 *
 * Deriving against the examination date rather than today is what keeps a historical report
 * honest: a report issued two years ago must still print the age the patient was when the specimen
 * was examined, not the age they are now.
 *
 * DERIVATION IS THE DRAFT'S RULE, NOT THE ISSUED REPORT'S. A draft resolves through this module on
 * every render, so what the operator sees is what completion will freeze. Completion then freezes
 * the issued wording onto the snapshot, and completed rendering prints that frozen value verbatim
 * - a later correction to the rule below cannot reach an already-issued report. A snapshot written
 * before the frozen field existed is not re-derived either: it is reproduced with the wording rule
 * of its own era, ungrammatical plurals and all. Neither completed path calls into this module for
 * its printed string.
 *
 * Pure, string-in / string-out, and UTC throughout. Nothing here reads the system clock, so the
 * same session resolves identically on a workstation in Manila and in a verifier run on CI.
 */

export type PatientAgeUnit = "years" | "months" | "days";

/** How the resolved age was arrived at. Presentation never varies on it; validation does. */
export type PatientAgeSource = "DateOfBirth" | "StoredAge" | "None";

export interface ResolvedPatientAge {
  /**
   * Completed days below one month, completed months below one year, completed years from one
   * year. Null when unresolvable.
   */
  value: number | null;
  unit: PatientAgeUnit | null;
  /** The printed wording, already pluralized. Empty string when unresolvable. */
  display: string;
  source: PatientAgeSource;
}

const UNRESOLVED: ResolvedPatientAge = { value: null, unit: null, display: "", source: "None" };

const MONTHS_PER_YEAR = 12;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/**
 * A strict YYYY-MM-DD parse that also rejects a date the calendar does not have.
 *
 * `new Date("2026-02-30")` does not throw - it rolls forward to March 2nd - so a typo would
 * silently become a real, wrong date and derive a real, wrong age. Re-reading the constructed
 * date's own fields is what catches the rollover.
 */
export function parseCalendarDate(value: string | null | undefined): CalendarDate | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utc.getTime())) return null;
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Completed months between two calendar dates, or null when the birth date is after the reference
 * date. A partially elapsed month does not count: the day-of-month comparison is what makes this
 * "completed" rather than "started", so a patient born on the 20th is still eleven months old on
 * the 19th of their twelfth month.
 */
export function completedMonthsBetween(
  dateOfBirth: CalendarDate,
  referenceDate: CalendarDate
): number | null {
  const wholeMonths =
    (referenceDate.year - dateOfBirth.year) * MONTHS_PER_YEAR +
    (referenceDate.month - dateOfBirth.month);
  const months = referenceDate.day < dateOfBirth.day ? wholeMonths - 1 : wholeMonths;
  return months < 0 ? null : months;
}

/** Singular below two, plural otherwise. "1 month", "8 months", "1 year", "8 years". */
export function formatPatientAge(value: number, unit: PatientAgeUnit): string {
  const singular = unit === "years" ? "year" : unit === "months" ? "month" : "day";
  return `${value} ${value === 1 ? singular : `${singular}s`}`;
}

/**
 * Completed days between two calendar dates, or null when the birth date is after the reference
 * date. Whole elapsed days only, computed in UTC so no timezone or daylight-saving shift can move
 * a newborn's age by a day.
 */
export function completedDaysBetween(
  dateOfBirth: CalendarDate,
  referenceDate: CalendarDate
): number | null {
  const birthMs = Date.UTC(dateOfBirth.year, dateOfBirth.month - 1, dateOfBirth.day);
  const referenceMs = Date.UTC(referenceDate.year, referenceDate.month - 1, referenceDate.day);
  const days = Math.floor((referenceMs - birthMs) / MILLISECONDS_PER_DAY);
  return days < 0 ? null : days;
}

/**
 * The months/years half of the clinical rule: below twelve completed months an age is reported in
 * months, and from twelve completed months in whole years.
 *
 * The DAYS tier is decided in `resolvePatientAge`, not here, because it cannot be derived from a
 * month count - a patient with zero completed months is 0 to 30 days old and this function is not
 * given the information to tell those apart.
 */
export function resolveAgeFromCompletedMonths(months: number): { value: number; unit: PatientAgeUnit } {
  return months < MONTHS_PER_YEAR
    ? { value: months, unit: "months" }
    : { value: Math.floor(months / MONTHS_PER_YEAR), unit: "years" };
}

/**
 * Whether a date of birth is usable for a report examined on `examinationDate`.
 *
 * Two rejections, and they are different failures: a value the calendar does not have, and a value
 * that has not happened yet relative to the report. A date of birth in the future of the
 * examination date cannot produce an age, so it is refused rather than clamped to zero.
 */
export function isValidDateOfBirth(
  dateOfBirth: string | null | undefined,
  examinationDate: string | null | undefined
): boolean {
  const birth = parseCalendarDate(dateOfBirth);
  if (!birth) return false;
  const reference = parseCalendarDate(examinationDate);
  if (!reference) return true;
  return completedMonthsBetween(birth, reference) !== null;
}

/**
 * Resolve the age a report should print.
 *
 * Order of authority, and it is deliberate:
 *   1. a valid date of birth measured against the examination date - the derived, always-correct
 *      answer, and the only one that stays correct when the report is reopened years later;
 *   2. the stored integer and unit - what every session encoded before this unit existed carries,
 *      preserved exactly so no historical record is silently restated;
 *   3. nothing, when neither is usable.
 *
 * A stored age is never re-derived and a derived age is never written back over the stored one.
 * The two coexist; which is used is decided here, at read time, and nowhere else.
 */
export function resolvePatientAge(
  demographics: Pick<PatientDemographics, "age" | "ageUnit" | "examinationDate"> & {
    dateOfBirth?: string | null;
  }
): ResolvedPatientAge {
  const birth = parseCalendarDate(demographics.dateOfBirth);
  const reference = parseCalendarDate(demographics.examinationDate);

  if (birth && reference) {
    const months = completedMonthsBetween(birth, reference);
    if (months !== null) {
      // Three tiers, finest first. Below one completed month an age reported as "0 months" tells a
      // clinician nothing about a neonate, so it is reported in completed DAYS; from one completed
      // month in months; from twelve in whole years.
      const resolved =
        months < 1
          ? { value: completedDaysBetween(birth, reference) ?? 0, unit: "days" as PatientAgeUnit }
          : resolveAgeFromCompletedMonths(months);
      return {
        value: resolved.value,
        unit: resolved.unit,
        display: formatPatientAge(resolved.value, resolved.unit),
        source: "DateOfBirth",
      };
    }
  }

  // The legacy path. `age` is only meaningful above zero here because that is the value the old
  // demographics form could produce and the value the old completion rule already required; a
  // zero or negative stored age was never a valid record and is not made into one now.
  const storedValue = demographics.age;
  const storedUnit = demographics.ageUnit;
  if (Number.isFinite(storedValue) && storedValue > 0 && storedUnit) {
    return {
      value: storedValue,
      unit: storedUnit,
      display: formatPatientAge(storedValue, storedUnit),
      source: "StoredAge",
    };
  }

  return UNRESOLVED;
}
