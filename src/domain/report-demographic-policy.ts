export type PatientStatusOutputMode = "label-and-value" | "static-label-only" | "omitted";

export interface ReportDemographicPolicy {
  age: {
    outputMode: "number-with-unit" | "number-only";
  };
  patientStatus: {
    visibleInEncoding: boolean;
    requiredForCompletion: boolean;
    outputMode: PatientStatusOutputMode;
  };
}

/**
 * Locked Confirmed Client Decision:
 * Patient Status is NOT collected in Encoding UI for any report.
 */
const DEFAULT_REPORT_DEMOGRAPHIC_POLICY: ReportDemographicPolicy = {
  age: {
    outputMode: "number-with-unit",
  },
  patientStatus: {
    visibleInEncoding: false,
    requiredForCompletion: false,
    outputMode: "omitted",
  },
};

const REPORT_DEMOGRAPHIC_POLICIES: ReadonlyMap<string, ReportDemographicPolicy> = new Map([
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

export function getReportDemographicPolicy(templateCode?: string | null): ReportDemographicPolicy {
  if (!templateCode) return DEFAULT_REPORT_DEMOGRAPHIC_POLICY;
  return REPORT_DEMOGRAPHIC_POLICIES.get(templateCode) || DEFAULT_REPORT_DEMOGRAPHIC_POLICY;
}
