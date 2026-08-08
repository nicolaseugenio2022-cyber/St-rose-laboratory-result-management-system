import { IPatientReportSessionRepository } from "./interfaces";
import { IPatientReportSession } from "../domain/models/interfaces";
import { PatientReportSessionAggregate } from "../domain/models/patient-report-session-aggregate";
import { LaboratoryReportDomain } from "../domain/models/laboratory-report-domain";
import { autoSuggestionLearningService } from "../services/auto-suggestion-service";
import { supabase } from "../lib/supabase/client";

export class SupabasePatientReportSessionRepository implements IPatientReportSessionRepository {
  private inMemoryStore: Map<string, IPatientReportSession> = new Map();

  async findById(id: string): Promise<IPatientReportSession | null> {
    try {
      const { data, error } = await supabase
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
        .single();

      if (error || !data) {
        return this.inMemoryStore.get(id) || null;
      }

      return this.mapToAggregate(data);
    } catch {
      return this.inMemoryStore.get(id) || null;
    }
  }

  async findByAccessionNumber(accessionNumber: string): Promise<IPatientReportSession | null> {
    try {
      const { data, error } = await supabase
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
        .single();

      if (error || !data) {
        for (const session of this.inMemoryStore.values()) {
          if (session.accessionNumber === accessionNumber) return session;
        }
        return null;
      }

      return this.mapToAggregate(data);
    } catch {
      for (const session of this.inMemoryStore.values()) {
        if (session.accessionNumber === accessionNumber) return session;
      }
      return null;
    }
  }

  async findActiveCompletedSessions(): Promise<IPatientReportSession[]> {
    const recent = await this.getRecentSessions(100);
    return recent.filter((s) => s.status === "Completed");
  }

  async getRecentSessions(limit = 50): Promise<PatientReportSessionAggregate[]> {
    try {
      const { data, error } = await supabase
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
        .limit(limit);

      if (error || !data || data.length === 0) {
        return Array.from(this.inMemoryStore.values()) as PatientReportSessionAggregate[];
      }

      return data.map((d) => this.mapToAggregate(d));
    } catch {
      return Array.from(this.inMemoryStore.values()) as PatientReportSessionAggregate[];
    }
  }

  async saveDraft(session: IPatientReportSession): Promise<IPatientReportSession> {
    this.inMemoryStore.set(session.id, session);

    try {
      await supabase.from("patient_report_sessions").upsert({
        id: session.id,
        accession_number: session.accessionNumber,
        status: "Draft",
        demographics: session.demographics,
        created_at: session.createdAt || new Date().toISOString(),
        expires_at: null,
      });

      for (const report of session.reports) {
        await supabase.from("laboratory_reports").upsert({
          id: report.id,
          session_id: session.id,
          template_code: report.templateCode,
          template_title: report.templateTitle,
          renderer_family: report.rendererFamily,
          reagent_kit_info: report.reagentKitInfo || null,
          remarks: report.remarks || null,
        });
      }
    } catch (err) {
      console.warn("Supabase saveDraft fallback to in-memory store:", err);
    }

    return session;
  }

  async completeSession(session: IPatientReportSession): Promise<IPatientReportSession> {
    if (session instanceof PatientReportSessionAggregate) {
      session.completeSession((code) => {
        if (code === "HIV_RESULT") return { requiredPathologistsCount: 1, requiredMedtechsCount: 2 };
        return { requiredPathologistsCount: 1, requiredMedtechsCount: 1 };
      });
    }

    this.inMemoryStore.set(session.id, session);

    try {
      await supabase.from("patient_report_sessions").upsert({
        id: session.id,
        accession_number: session.accessionNumber,
        status: "Completed",
        demographics: session.demographics,
        created_at: session.createdAt,
        completed_at: session.completedAt,
        expires_at: session.expiresAt,
      });

      for (const report of session.reports) {
        await supabase.from("laboratory_reports").upsert({
          id: report.id,
          session_id: session.id,
          template_code: report.templateCode,
          template_title: report.templateTitle,
          renderer_family: report.rendererFamily,
          reagent_kit_info: report.reagentKitInfo || null,
          remarks: report.remarks || null,
        });

        for (const res of report.results) {
          if (res.resultValue) {
            await supabase.from("laboratory_results").upsert({
              id: res.id,
              report_id: report.id,
              parameter_code: res.parameterCode,
              parameter_name: res.parameterName,
              result_value: res.resultValue,
              unit: res.unit || null,
              evaluation_outcome: res.evaluationOutcome,
              reference_rule_snapshot: res.referenceRuleSnapshot || null,
              display_order: res.displayOrder,
            });
          }
        }

        for (const sig of report.signatories) {
          await supabase.from("report_signatories").upsert({
            report_id: report.id,
            personnel_id: sig.personnelId,
            role: sig.role,
            printed_full_name: sig.printedFullName,
            printed_credentials: sig.printedCredentials,
            printed_prc_license_number: sig.printedPrcLicenseNumber,
            signature_image_url: sig.signatureImageUrl || null,
            display_order: sig.displayOrder,
          });
        }
      }

      await autoSuggestionLearningService.learnSuggestionsFromSessionDemographics(session.demographics);
    } catch (err) {
      console.warn("Supabase completeSession fallback to in-memory store:", err);
    }

    return session;
  }

  async replaceSession(session: IPatientReportSession): Promise<IPatientReportSession> {
    return this.completeSession(session);
  }

  async purgeExpiredSessions(): Promise<number> {
    const now = new Date();
    let purgedCount = 0;

    for (const [id, session] of this.inMemoryStore.entries()) {
      if (session.expiresAt && new Date(session.expiresAt) < now) {
        this.inMemoryStore.delete(id);
        purgedCount++;
      }
    }

    try {
      const { data } = await supabase
        .from("patient_report_sessions")
        .delete()
        .lt("expires_at", now.toISOString())
        .select("id");

      if (data) {
        purgedCount = Math.max(purgedCount, data.length);
      }
    } catch (err) {
      console.warn("Supabase purgeExpiredSessions fallback to in-memory store:", err);
    }

    return purgedCount;
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
        results: rawResults.map((res) => ({
          id: String(res.id || ""),
          reportId: String(res.report_id || ""),
          parameterCode: String(res.parameter_code || ""),
          parameterName: String(res.parameter_name || ""),
          resultValue: String(res.result_value || ""),
          unit: (res.unit as string) || null,
          evaluationOutcome: res.evaluation_outcome as LaboratoryReportDomain["results"][0]["evaluationOutcome"],
          referenceRuleSnapshot: (res.reference_rule_snapshot as LaboratoryReportDomain["results"][0]["referenceRuleSnapshot"]) || null,
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
      accessionNumber: String(raw.accession_number || ""),
      status: raw.status as PatientReportSessionAggregate["status"],
      demographics: raw.demographics as PatientReportSessionAggregate["demographics"],
      reports,
      createdAt: String(raw.created_at || ""),
      completedAt: (raw.completed_at as string) || null,
      expiresAt: (raw.expires_at as string) || null,
    });
  }
}
