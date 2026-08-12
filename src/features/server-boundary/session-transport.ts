import type { IPatientReportSession } from "@/domain/models/interfaces";
import { LaboratoryReportDomain } from "@/domain/models/laboratory-report-domain";
import { PatientReportSessionAggregate } from "@/domain/models/patient-report-session-aggregate";

export type PatientReportSessionTransport = IPatientReportSession;

export function toSessionTransport(
  session: IPatientReportSession
): PatientReportSessionTransport {
  return JSON.parse(JSON.stringify(session)) as PatientReportSessionTransport;
}

export function fromSessionTransport(
  session: PatientReportSessionTransport
): PatientReportSessionAggregate {
  return new PatientReportSessionAggregate({
    ...session,
    reports: session.reports.map((report) => new LaboratoryReportDomain({
      ...report,
      results: report.results,
      signatories: report.signatories,
    })),
  });
}
