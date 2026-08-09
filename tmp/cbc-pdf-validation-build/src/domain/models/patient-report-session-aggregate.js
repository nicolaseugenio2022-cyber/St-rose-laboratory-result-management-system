"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientReportSessionAggregate = void 0;
const errors_1 = require("../../lib/errors");
const utils_1 = require("../../lib/utils");
class PatientReportSessionAggregate {
    constructor(props) {
        this.id = props.id;
        this.accessionNumber = props.accessionNumber;
        this.status = props.status || "Draft";
        this.demographics = props.demographics;
        this.reports = props.reports;
        this.createdAt = props.createdAt || new Date().toISOString();
        this.completedAt = props.completedAt || null;
        this.expiresAt = props.expiresAt || null;
    }
    /**
     * Validates patient demographics.
     */
    validateDemographics(options = {}) {
        const errors = {};
        if (!this.demographics.fullName || !this.demographics.fullName.trim()) {
            errors.fullName = "Patient full name is required.";
        }
        if (this.demographics.age === undefined || this.demographics.age === null || this.demographics.age < 0) {
            errors.age = "Valid patient age is required.";
        }
        if (!this.demographics.sex) {
            errors.sex = "Patient sex is required.";
        }
        if (options.requiresPatientStatus !== false && !this.demographics.patientStatus) {
            errors.patientStatus = "Patient status (OutPatient, InPatient, ER) is required.";
        }
        if (!this.demographics.examinationDate) {
            errors.examinationDate = "Examination date is required.";
        }
        if (!this.demographics.requestingPhysician || !this.demographics.requestingPhysician.trim()) {
            errors.requestingPhysician = "Requesting physician is required.";
        }
        if (Object.keys(errors).length > 0) {
            throw new errors_1.ValidationError("Invalid patient demographics.", errors);
        }
    }
    /**
     * Completes the Patient Report Session.
     * Performs signatory validation, scrubs deselected results, updates status to Completed,
     * sets completedAt, and computes retention expiration date (completedAt + 30 days).
     */
    completeSession(getRequirements) {
        if (this.status === "Completed") {
            throw new errors_1.DomainInvariantError(`Session '${this.accessionNumber}' is already completed.`);
        }
        const requiresPatientStatus = this.reports.some((report) => getRequirements(report.templateCode).requiresPatientStatus !== false);
        this.validateDemographics({ requiresPatientStatus });
        if (!this.reports || this.reports.length === 0) {
            throw new errors_1.DomainInvariantError("Cannot complete session without at least one laboratory report.");
        }
        // Validate signatories and scrub results per report
        for (const report of this.reports) {
            const req = getRequirements(report.templateCode);
            report.validateSignatories(req.requiredPathologistsCount, req.requiredMedtechsCount);
            report.scrubDeselectedResults();
        }
        const nowISO = new Date().toISOString();
        this.status = "Completed";
        this.completedAt = nowISO;
        this.expiresAt = (0, utils_1.calculateExpirationDate)(new Date(nowISO)).toISOString();
    }
    /**
     * Replaces a report in a completed session (Single-record replacement workflow).
     */
    replaceReport(updatedReport, getRequirements) {
        if (this.status !== "Completed") {
            throw new errors_1.DomainInvariantError("Report replacement is only allowed on completed sessions.");
        }
        if (this.isExpired()) {
            throw new errors_1.DomainInvariantError(`Cannot edit or replace report: retention period of 30 days has expired.`);
        }
        const index = this.reports.findIndex((r) => r.id === updatedReport.id || r.templateCode === updatedReport.templateCode);
        if (index === -1) {
            throw new errors_1.DomainInvariantError(`Report with template code '${updatedReport.templateCode}' not found in session.`);
        }
        const req = getRequirements(updatedReport.templateCode);
        updatedReport.validateSignatories(req.requiredPathologistsCount, req.requiredMedtechsCount);
        updatedReport.scrubDeselectedResults();
        this.reports[index] = updatedReport;
    }
    /**
     * Checks if session retention has expired.
     */
    isExpired() {
        if (!this.expiresAt)
            return false;
        return new Date().getTime() > new Date(this.expiresAt).getTime();
    }
}
exports.PatientReportSessionAggregate = PatientReportSessionAggregate;
