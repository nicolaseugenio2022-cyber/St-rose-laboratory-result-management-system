"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaboratoryReportDomain = exports.LaboratoryResultDomain = void 0;
const errors_1 = require("../../lib/errors");
class LaboratoryResultDomain {
    constructor(props) {
        this.id = props.id;
        this.reportId = props.reportId;
        this.parameterCode = props.parameterCode;
        this.parameterName = props.parameterName;
        this.resultValue = props.resultValue;
        this.unit = props.unit;
        this.evaluationOutcome = props.evaluationOutcome;
        this.referenceRuleSnapshot = props.referenceRuleSnapshot;
        this.displayOrder = props.displayOrder;
        this.isSelected = props.isSelected ?? true;
    }
}
exports.LaboratoryResultDomain = LaboratoryResultDomain;
class LaboratoryReportDomain {
    constructor(props) {
        this.id = props.id;
        this.sessionId = props.sessionId;
        this.templateCode = props.templateCode;
        this.templateTitle = props.templateTitle;
        this.rendererFamily = props.rendererFamily;
        this.reagentKitInfo = props.reagentKitInfo;
        this.remarks = props.remarks;
        this.results = props.results.map((r) => new LaboratoryResultDomain(r));
        this.signatories = props.signatories;
    }
    /**
     * Removes deselected parameters (isSelected = false) prior to session completion and persistence.
     */
    scrubDeselectedResults() {
        this.results = this.results.filter((r) => r.isSelected);
    }
    /**
     * Validates that signatory counts satisfy template requirements.
     */
    validateSignatories(requiredPathologists, requiredMedtechs) {
        const pathologistsCount = this.signatories.filter((s) => s.role === "Pathologist").length;
        const medtechsCount = this.signatories.filter((s) => s.role === "MedicalTechnologist").length;
        if (pathologistsCount < requiredPathologists) {
            throw new errors_1.DomainInvariantError(`Report '${this.templateTitle}' requires at least ${requiredPathologists} Pathologist(s), but has ${pathologistsCount}.`);
        }
        if (medtechsCount < requiredMedtechs) {
            throw new errors_1.DomainInvariantError(`Report '${this.templateTitle}' requires at least ${requiredMedtechs} Medical Technologist(s), but has ${medtechsCount}.`);
        }
    }
}
exports.LaboratoryReportDomain = LaboratoryReportDomain;
