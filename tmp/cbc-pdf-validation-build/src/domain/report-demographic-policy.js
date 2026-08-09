"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReportDemographicPolicy = getReportDemographicPolicy;
const DEFAULT_REPORT_DEMOGRAPHIC_POLICY = {
    age: {
        outputMode: "number-with-unit",
    },
    patientStatus: {
        visibleInEncoding: true,
        requiredForCompletion: true,
        outputMode: "label-and-value",
    },
};
const REPORT_DEMOGRAPHIC_POLICIES = new Map([
    [
        "CBC",
        {
            age: {
                outputMode: "number-only",
            },
            patientStatus: {
                visibleInEncoding: false,
                requiredForCompletion: false,
                outputMode: "static-label-only",
            },
        },
    ],
]);
function getReportDemographicPolicy(templateCode) {
    if (!templateCode)
        return DEFAULT_REPORT_DEMOGRAPHIC_POLICY;
    return REPORT_DEMOGRAPHIC_POLICIES.get(templateCode) || DEFAULT_REPORT_DEMOGRAPHIC_POLICY;
}
