import type { EvaluationOutcome, PatientDemographics, ReagentKitInfo, RendererFamily, SignatorySnapshot } from "@/domain/types";
import type { IRepeatableFindingValue } from "@/domain/models/interfaces";
import type { PatientAgeUnit } from "@/domain/patient-age";

export const CURRENT_COMPLETED_SNAPSHOT_VERSION = 2 as const;

export interface FrozenRenderContractMetadata {
  renderContractVersion: number;
  printedTitle: string | null;
  staticContentVersion: string;
}

export interface CompletedResultSnapshot {
  parameterCode: string;
  parameterName: string;
  rawResultValue: string | null;
  formattedResultValue: string;
  referenceDisplay: string | null;
  referenceRule: Record<string, unknown> | null;
  unit: string | null;
  suffix: string | null;
  evaluationOutcome: EvaluationOutcome;
  computationMetadata: Record<string, unknown> | null;
  displayOrder: number;
}

export interface CompletedReportSnapshot {
  templateCode: string;
  templateTitle: string;
  rendererFamily: RendererFamily;
  /**
   * Present on snapshot v2+ only. A v1 snapshot froze none of these three fields, so its render
   * presentation resolves at the BASELINE contract version (1) - never the definition's current
   * one, which would re-present an already-issued report under presentation rules introduced after
   * it was issued. Printed-title and static-content metadata still come from the current
   * definition, exactly as the established legacy compatibility policy has always resolved them.
   */
  renderContractVersion?: number;
  printedTitle?: string | null;
  staticContentVersion?: string;
  requestedBy: string;
  additionalFields: Record<string, string>;
  results: CompletedResultSnapshot[];
  remarks: string;
  reagentKitInfo: ReagentKitInfo | null;
  repeatableFindings: Record<string, IRepeatableFindingValue[]>;
  signatories: SignatorySnapshot[];
}

/**
 * The patient's age, frozen at completion.
 *
 * Age is DERIVED from a date of birth against the examination date, so the wording a report prints
 * depends on the rule in force when it is RENDERED, not on the rule in force when it was issued.
 * Correcting that rule - as the days tier did - would therefore silently restate reports that have
 * already gone out, which is exactly what a completed snapshot exists to prevent.
 *
 * Freezing the resolved value, unit AND final wording removes that dependency: a completed report
 * prints what it printed on the day it was issued, whatever the resolver does afterwards.
 *
 * OPTIONAL, and it must stay optional. Every snapshot written before this field existed has none,
 * and those reports render from their stored age and unit under the wording rule of their own era.
 * Absence is therefore MEANINGFUL - it means 'issued under the legacy wording' - so it is never
 * backfilled, and no existing database row is rewritten.
 */
export interface FrozenPatientAge {
  value: number;
  unit: PatientAgeUnit;
  /** The exact printed wording, already pluralized, as issued. */
  display: string;
}

export interface CompletedSessionSnapshot {
  snapshotVersion: 1 | typeof CURRENT_COMPLETED_SNAPSHOT_VERSION;
  completedAt: string;
  demographics: PatientDemographics;
  /**
   * Session-level rather than per-report: one session has one patient and one examination date, so
   * a per-report copy could only ever disagree with itself.
   */
  frozenAge?: FrozenPatientAge | null;
  reports: CompletedReportSnapshot[];
}

export function cloneAndFreezeSnapshot(snapshot: CompletedSessionSnapshot): CompletedSessionSnapshot {
  const clone = structuredClone(snapshot);
  const freeze = (value: unknown): unknown => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  return freeze(clone) as CompletedSessionSnapshot;
}
