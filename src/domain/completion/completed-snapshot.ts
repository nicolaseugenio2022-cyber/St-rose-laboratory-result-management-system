import type { EvaluationOutcome, PatientDemographics, ReagentKitInfo, RendererFamily, SignatorySnapshot } from "@/domain/types";
import type { IRepeatableFindingValue } from "@/domain/models/interfaces";

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
  /** Present on snapshot v2+. Absent legacy v1 metadata is resolved by the current versioned static definition only. */
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

export interface CompletedSessionSnapshot {
  snapshotVersion: 1 | typeof CURRENT_COMPLETED_SNAPSHOT_VERSION;
  completedAt: string;
  demographics: PatientDemographics;
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
