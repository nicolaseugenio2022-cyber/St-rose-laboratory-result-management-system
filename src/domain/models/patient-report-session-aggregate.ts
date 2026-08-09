import { IPatientReportSession } from "./interfaces";
import { PatientDemographics, SessionStatus } from "../types";
import { LaboratoryReportDomain } from "./laboratory-report-domain";
import { DomainInvariantError, ValidationError } from "../../lib/errors";
import { calculateExpirationDate } from "../../lib/utils";
import type { CompletedSessionSnapshot } from "@/domain/completion/completed-snapshot";
import { cloneAndFreezeSnapshot } from "@/domain/completion/completed-snapshot";
import { ReportCompletionService } from "@/domain/completion/report-completion-service";

export interface SignatoryRequirementsLookup {
  (templateCode: string): {
    requiredPathologistsCount: number;
    requiredMedtechsCount: number;
    requiresPatientStatus?: boolean;
  };
}

export class PatientReportSessionAggregate implements IPatientReportSession {
  public readonly id: string;
  public readonly accessionNumber: string;
  public status: SessionStatus;
  public demographics: PatientDemographics;
  public reports: LaboratoryReportDomain[];
  public readonly createdAt: string;
  public completedAt: string | null;
  public expiresAt: string | null;
  public readonly completedSnapshot: CompletedSessionSnapshot | null;

  constructor(props: {
    id: string;
    accessionNumber: string;
    status?: SessionStatus;
    demographics: PatientDemographics;
    reports: LaboratoryReportDomain[];
    createdAt?: string;
    completedAt?: string | null;
    expiresAt?: string | null;
    completedSnapshot?: CompletedSessionSnapshot | null;
  }) {
    this.id = props.id;
    this.accessionNumber = props.accessionNumber;
    this.status = props.status || "Draft";
    this.demographics = props.demographics;
    this.reports = props.reports;
    this.createdAt = props.createdAt || new Date().toISOString();
    this.completedAt = props.completedAt || null;
    this.expiresAt = props.expiresAt || null;
    this.completedSnapshot = props.completedSnapshot
      ? cloneAndFreezeSnapshot(props.completedSnapshot)
      : null;
  }

  /**
   * Validates patient demographics.
   */
  public validateDemographics(_options: { requiresPatientStatus?: boolean } = {}): void {
    const errors: Record<string, string> = {};

    if (!this.demographics.fullName || !this.demographics.fullName.trim()) {
      errors.fullName = "Patient full name is required.";
    }
    if (this.demographics.age === undefined || this.demographics.age === null || this.demographics.age < 0) {
      errors.age = "Valid patient age is required.";
    }
    if (!this.demographics.sex) {
      errors.sex = "Patient sex is required.";
    }
    if (!this.demographics.examinationDate) {
      errors.examinationDate = "Examination date is required.";
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError("Invalid patient demographics.", errors);
    }
  }

  /**
   * Completes the Patient Report Session.
   * Performs signatory validation, scrubs deselected results, updates status to Completed,
   * sets completedAt, and computes retention expiration date (completedAt + 30 days).
   */
  public completeSession(_getRequirements?: SignatoryRequirementsLookup): void {
    if (this.status === "Completed") {
      throw new DomainInvariantError(`Session '${this.accessionNumber}' is already completed.`);
    }

    const nowISO = new Date().toISOString();
    const snapshot = ReportCompletionService.validateAndCompose(this, nowISO);

    // Validation and snapshot composition complete before any mutable state changes.
    for (const report of this.reports) report.scrubDeselectedResults();
    Object.defineProperty(this, "completedSnapshot", {
      value: cloneAndFreezeSnapshot(snapshot),
      enumerable: true,
      configurable: false,
      writable: false,
    });
    this.status = "Completed";
    this.completedAt = nowISO;
    this.expiresAt = calculateExpirationDate(new Date(nowISO)).toISOString();
  }

  /**
   * Replaces a report in a completed session (Single-record replacement workflow).
   */
  public replaceReport(updatedReport: LaboratoryReportDomain, getRequirements: SignatoryRequirementsLookup): void {
    if (this.status !== "Completed") {
      throw new DomainInvariantError("Report replacement is only allowed on completed sessions.");
    }

    if (this.isExpired()) {
      throw new DomainInvariantError(`Cannot edit or replace report: retention period of 30 days has expired.`);
    }

    const index = this.reports.findIndex((r) => r.id === updatedReport.id || r.templateCode === updatedReport.templateCode);
    if (index === -1) {
      throw new DomainInvariantError(`Report with template code '${updatedReport.templateCode}' not found in session.`);
    }

    const req = getRequirements(updatedReport.templateCode);
    updatedReport.validateSignatories(req.requiredPathologistsCount, req.requiredMedtechsCount);
    updatedReport.scrubDeselectedResults();

    this.reports[index] = updatedReport;
  }

  /**
   * Checks if session retention has expired.
   */
  public isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date().getTime() > new Date(this.expiresAt).getTime();
  }
}
