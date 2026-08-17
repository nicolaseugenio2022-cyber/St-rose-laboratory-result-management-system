import "server-only";

import { IPatientReportSessionRepository } from "./interfaces";
import { IPatientReportSession } from "../domain/models/interfaces";
import { PatientReportSessionAggregate } from "../domain/models/patient-report-session-aggregate";
import { LaboratoryReportDomain } from "../domain/models/laboratory-report-domain";
import { autoSuggestionLearningService } from "../services/auto-suggestion-service";
import { supabaseServer } from "../lib/supabase/server";
import type { CompletedSessionSnapshot } from "@/domain/completion/completed-snapshot";

type SessionRepositoryCaller = {
  userId: string;
  role: "Admin" | "User";
};

type SessionOwnershipRow = {
  created_by_user_id: string;
};

type SessionOwnershipProjectionRow = {
  id: string;
  created_by_user_id: string;
};

type SessionRetentionRow = {
  status: string;
  expires_at: string | null;
};

export class SupabasePatientReportSessionRepository implements IPatientReportSessionRepository {
  constructor(private readonly caller?: SessionRepositoryCaller) {}

  private requireCaller(): SessionRepositoryCaller {
    if (!this.caller) throw new Error("An authenticated operational caller is required.");
    return this.caller;
  }

  private applyDraftOwnershipScope<T extends {
    or(filters: string): T;
  }>(query: T): T {
    const caller = this.requireCaller();
    return query.or(
      `status.eq.Completed,and(status.eq.Draft,created_by_user_id.eq.${caller.userId})`
    );
  }

  private async assertExistingSessionOwnership(id: string): Promise<void> {
    const caller = this.requireCaller();
    const { data, error } = await supabaseServer
      .from("patient_report_sessions")
      .select("created_by_user_id")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (data && (data as SessionOwnershipRow).created_by_user_id !== caller.userId) {
      throw new Error("Session ownership validation failed.");
    }
  }

  private async assertSessionWithinRetention(id: string): Promise<void> {
    const { data, error } = await supabaseServer
      .from("patient_report_sessions")
      .select("status, expires_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const row = data as SessionRetentionRow;
      if (
        row.status === "Completed" &&
        row.expires_at !== null &&
        new Date(row.expires_at).getTime() < Date.now()
      ) {
        throw new Error(
          "The session has passed its 30-day retention window and is permanently immutable."
        );
      }
    }
  }

  async findById(id: string): Promise<IPatientReportSession | null> {
    const { data, error } = await this.applyDraftOwnershipScope(
      supabaseServer
        .from("patient_report_sessions")
        .select(`
          *,
          laboratory_reports (
            *,
            laboratory_results (*),
            report_signatories (*)
          )
        `)
        .eq("id", id)
    ).maybeSingle();

    if (error) throw error;
    return data ? this.mapToAggregate(data) : null;
  }

  async findByAccessionNumber(accessionNumber: string): Promise<IPatientReportSession | null> {
    const { data, error } = await this.applyDraftOwnershipScope(
      supabaseServer
        .from("patient_report_sessions")
        .select(`
          *,
          laboratory_reports (
            *,
            laboratory_results (*),
            report_signatories (*)
          )
        `)
        .eq("accession_number", accessionNumber)
    ).maybeSingle();

    if (error) throw error;
    return data ? this.mapToAggregate(data) : null;
  }

  async findActiveCompletedSessions(): Promise<IPatientReportSession[]> {
    const recent = await this.getRecentSessions(100);
    return recent.filter((s) => s.status === "Completed");
  }

  async findReopenableSessionForCaller(id: string): Promise<IPatientReportSession | null> {
    const caller = this.requireCaller();
    const retentionTimestamp = new Date().toISOString();
    const { data, error } = await supabaseServer
      .from("patient_report_sessions")
      .select(`
        *,
        laboratory_reports (
          *,
          laboratory_results (*),
          report_signatories (*)
        )
      `)
      .eq("id", id)
      .eq("created_by_user_id", caller.userId)
      .or(`status.eq.Draft,and(status.eq.Completed,completed_at.not.is.null,or(expires_at.is.null,expires_at.gte.${retentionTimestamp}))`)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapToAggregate(data) : null;
  }

  async getRecentSessionsWithOwnership(
    limit = 50
  ): Promise<{ session: PatientReportSessionAggregate; ownedByCaller: boolean }[]> {
    const caller = this.requireCaller();
    const sessions = await this.getRecentSessions(limit);
    const { data, error } = await supabaseServer
      .from("patient_report_sessions")
      .select("id, created_by_user_id")
      .in("id", sessions.map((session) => session.id));

    if (error) throw error;
    if (!data) throw new Error("Supabase session ownership projection returned no data.");

    const ownerBySessionId = new Map<string, string>(
      (data as SessionOwnershipProjectionRow[]).map((row) => [row.id, row.created_by_user_id])
    );
    return sessions.map((session) => ({
      session,
      ownedByCaller: ownerBySessionId.get(session.id) === caller.userId,
    }));
  }

  async getRecentSessions(limit = 50): Promise<PatientReportSessionAggregate[]> {
    const retentionTimestamp = new Date().toISOString();
    const { data, error } = await this.applyDraftOwnershipScope(
      supabaseServer
        .from("patient_report_sessions")
        .select(`
          *,
          laboratory_reports (
            *,
            laboratory_results (*),
            report_signatories (*)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(limit)
    ).or(`status.eq.Draft,expires_at.is.null,expires_at.gte.${retentionTimestamp}`);

    if (error) throw error;
    if (!data) throw new Error("Supabase session history query returned no data.");
    return data.map((row) => this.mapToAggregate(row));
  }

  async saveDraft(session: IPatientReportSession): Promise<IPatientReportSession> {
    const caller = this.requireCaller();
    await this.assertExistingSessionOwnership(session.id);
    await this.assertSessionWithinRetention(session.id);

    const payload = {
      session: {
        id: session.id,
        demographics: session.demographics,
        created_by_user_id: caller.userId,
        created_at: session.createdAt || new Date().toISOString(),
      },
      reports: session.reports.map((report) => ({
          id: report.id,
          template_code: report.templateCode,
          template_title: report.templateTitle,
          renderer_family: report.rendererFamily,
          reagent_kit_info: report.reagentKitInfo || null,
          remarks: report.remarks || null,
          encoding_data: report.encodingData || null,
          results: report.results.map((res) => ({
            id: res.id,
            parameter_code: res.parameterCode,
            parameter_name: res.parameterName,
            result_value: res.resultValue || "",
            raw_result_value: res.rawResultValue ?? null,
            formatted_result_value: res.formattedResultValue ?? null,
            unit: res.unit || null,
            evaluation_outcome: res.evaluationOutcome,
            reference_rule_snapshot: res.referenceRuleSnapshot || null,
            computation_metadata: res.computationMetadata || null,
            display_order: res.displayOrder,
          })),
        })),
    };

    const { data, error } = await supabaseServer.rpc("save_draft_session", { payload });
    if (error) throw error;

    return this.withAssignedAccession(session, data as string);
  }

  async completeSession(session: IPatientReportSession): Promise<IPatientReportSession> {
    if (session instanceof PatientReportSessionAggregate && session.status !== "Completed") {
      session.completeSession();
    }

    const caller = this.requireCaller();
    await this.assertExistingSessionOwnership(session.id);
    await this.assertSessionWithinRetention(session.id);

    const payload = {
      session: {
        id: session.id,
        status: "Completed",
        demographics: session.demographics,
        created_by_user_id: caller.userId,
        created_at: session.createdAt,
        completed_at: session.completedAt,
        expires_at: session.expiresAt,
        completed_snapshot: session.completedSnapshot || null,
      },
      reports: session.reports.map((report) => ({
          id: report.id,
          template_code: report.templateCode,
          template_title: report.templateTitle,
          renderer_family: report.rendererFamily,
          reagent_kit_info: report.reagentKitInfo || null,
          remarks: report.remarks || null,
          encoding_data: report.encodingData || null,
          results: report.results.filter((res) => res.resultValue).map((res) => ({
              id: res.id,
              parameter_code: res.parameterCode,
              parameter_name: res.parameterName,
              result_value: res.resultValue,
              raw_result_value: res.rawResultValue ?? null,
              formatted_result_value: res.formattedResultValue ?? null,
              unit: res.unit || null,
              evaluation_outcome: res.evaluationOutcome,
              reference_rule_snapshot: res.referenceRuleSnapshot || null,
              computation_metadata: res.computationMetadata || null,
              display_order: res.displayOrder,
            })),
          signatories: report.signatories.map((sig) => ({
            personnel_id: sig.personnelId,
            role: sig.role,
            printed_full_name: sig.printedFullName,
            printed_credentials: sig.printedCredentials,
            printed_prc_license_number: sig.printedPrcLicenseNumber,
            signature_image_url: sig.signatureImageUrl || null,
            display_order: sig.displayOrder,
          })),
        })),
    };

    const { data, error } = await supabaseServer.rpc("complete_patient_report_session", { payload });
    if (error) throw error;

    await autoSuggestionLearningService.learnSuggestionsFromSessionDemographics(session.demographics);

    return this.withAssignedAccession(session, data as string);
  }

  async replaceSession(session: IPatientReportSession): Promise<IPatientReportSession> {
    this.requireCaller();
    await this.assertExistingSessionOwnership(session.id);
    await this.assertSessionWithinRetention(session.id);

    const payload = {
      session: {
        id: session.id,
        status: "Completed",
        demographics: session.demographics,
        completed_snapshot: session.completedSnapshot || null,
      },
      reports: session.reports.map((report) => ({
          id: report.id,
          template_code: report.templateCode,
          template_title: report.templateTitle,
          renderer_family: report.rendererFamily,
          reagent_kit_info: report.reagentKitInfo || null,
          remarks: report.remarks || null,
          encoding_data: report.encodingData || null,
          results: report.results.filter((res) => res.resultValue).map((res) => ({
              id: res.id,
              parameter_code: res.parameterCode,
              parameter_name: res.parameterName,
              result_value: res.resultValue,
              raw_result_value: res.rawResultValue ?? null,
              formatted_result_value: res.formattedResultValue ?? null,
              unit: res.unit || null,
              evaluation_outcome: res.evaluationOutcome,
              reference_rule_snapshot: res.referenceRuleSnapshot || null,
              computation_metadata: res.computationMetadata || null,
              display_order: res.displayOrder,
            })),
          signatories: report.signatories.map((sig) => ({
            personnel_id: sig.personnelId,
            role: sig.role,
            printed_full_name: sig.printedFullName,
            printed_credentials: sig.printedCredentials,
            printed_prc_license_number: sig.printedPrcLicenseNumber,
            signature_image_url: sig.signatureImageUrl || null,
            display_order: sig.displayOrder,
          })),
        })),
    };

    const { data, error } = await supabaseServer.rpc("replace_completed_session", { payload });
    if (error) throw error;

    return this.withAssignedAccession(session, data as string);
  }

  async purgeExpiredSessions(): Promise<number> {
    const now = new Date();
    const { data, error } = await supabaseServer
        .from("patient_report_sessions")
        .delete()
        .lt("expires_at", now.toISOString())
        .select("id");

    if (error) throw error;
    if (!data) throw new Error("Supabase expired-session purge returned no data.");
    return data.length;
  }

  private withAssignedAccession(
    session: IPatientReportSession,
    accessionNumber: string
  ): PatientReportSessionAggregate {
    return new PatientReportSessionAggregate({
      ...session,
      accessionNumber,
      reports: session.reports.map((report) =>
        report instanceof LaboratoryReportDomain
          ? report
          : new LaboratoryReportDomain(report)
      ),
    });
  }

  private mapToAggregate(raw: Record<string, unknown>): PatientReportSessionAggregate {
    const rawReports = (raw.laboratory_reports as Record<string, unknown>[]) || [];
    const reports = rawReports.map((r) => {
      const rawResults = (r.laboratory_results as Record<string, unknown>[]) || [];
      const rawSigs = (r.report_signatories as Record<string, unknown>[]) || [];

      return new LaboratoryReportDomain({
        id: String(r.id || ""),
        sessionId: String(r.session_id || ""),
        templateCode: String(r.template_code || ""),
        templateTitle: String(r.template_title || ""),
        rendererFamily: r.renderer_family as LaboratoryReportDomain["rendererFamily"],
        reagentKitInfo: (r.reagent_kit_info as LaboratoryReportDomain["reagentKitInfo"]) || null,
        remarks: (r.remarks as string) || null,
        encodingData: (r.encoding_data as LaboratoryReportDomain["encodingData"]) || undefined,
        results: rawResults.map((res) => ({
          id: String(res.id || ""),
          reportId: String(res.report_id || ""),
          parameterCode: String(res.parameter_code || ""),
          parameterName: String(res.parameter_name || ""),
          resultValue: String(res.result_value || ""),
          rawResultValue: res.raw_result_value == null ? null : String(res.raw_result_value),
          formattedResultValue: res.formatted_result_value == null ? null : String(res.formatted_result_value),
          unit: (res.unit as string) || null,
          evaluationOutcome: res.evaluation_outcome as LaboratoryReportDomain["results"][0]["evaluationOutcome"],
          referenceRuleSnapshot: (res.reference_rule_snapshot as LaboratoryReportDomain["results"][0]["referenceRuleSnapshot"]) || null,
          computationMetadata: (res.computation_metadata as Record<string, unknown>) || null,
          displayOrder: Number(res.display_order || 0),
          isSelected: true,
        })),
        signatories: rawSigs.map((s) => ({
          personnelId: String(s.personnel_id || ""),
          role: s.role as LaboratoryReportDomain["signatories"][0]["role"],
          printedFullName: String(s.printed_full_name || ""),
          printedCredentials: String(s.printed_credentials || ""),
          printedPrcLicenseNumber: String(s.printed_prc_license_number || ""),
          signatureImageUrl: (s.signature_image_url as string) || null,
          displayOrder: Number(s.display_order || 0),
        })),
      });
    });

    return new PatientReportSessionAggregate({
      id: String(raw.id || ""),
      accessionNumber: raw.accession_number == null ? null : String(raw.accession_number),
      status: raw.status as PatientReportSessionAggregate["status"],
      demographics: raw.demographics as PatientReportSessionAggregate["demographics"],
      reports,
      createdAt: String(raw.created_at || ""),
      completedAt: (raw.completed_at as string) || null,
      expiresAt: (raw.expires_at as string) || null,
      completedSnapshot: (raw.completed_snapshot as CompletedSessionSnapshot) || null,
    });
  }
}
