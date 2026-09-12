import "server-only";

import { IPatientReportSessionRepository } from "./interfaces";
import { IPatientReportSession } from "../domain/models/interfaces";
import { PatientReportSessionAggregate } from "../domain/models/patient-report-session-aggregate";
import { LaboratoryReportDomain } from "../domain/models/laboratory-report-domain";
import { serverAutoSuggestionLearningService } from "../services/auto-suggestion-service-server";
import { supabaseServer } from "../lib/supabase/server";
import type { CompletedSessionSnapshot } from "@/domain/completion/completed-snapshot";
import type { PatientDemographics } from "@/domain/types";
import type { PatientReportSessionListEntry } from "@/features/server-boundary/session-transport";

/**
 * Why a draft deletion was refused, as a CLOSED set (SHADCN-07B2).
 *
 * The four refusals below were previously four `new Error(...)` calls with four different
 * sentences, which left the only way to tell them apart - or to tell any of them apart from a
 * Supabase transport fault - a comparison against the message text. Message matching is exactly
 * what the caller must not do: it is brittle, it silently reclassifies when wording changes, and
 * it cannot distinguish an expected refusal from an infrastructure failure that happens to carry
 * a similar string.
 *
 * The reason travels for SERVER-SIDE diagnosis only. The action deliberately collapses all four
 * into one operator-facing sentence, because "no such draft", "not your draft" and "already
 * completed" must not be distinguishable from the browser - see OPERATIONAL_ACTION_MESSAGE.
 */
export type DraftDeletionRefusalReason =
  | "not_found"
  | "not_owned"
  | "not_draft"
  | "delete_affected_wrong_row_count";

export class DraftNotDeletableError extends Error {
  constructor(public readonly reason: DraftDeletionRefusalReason) {
    super("Draft session is not deletable.");
    this.name = "DraftNotDeletableError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Why an ADMINISTRATOR's deletion of a COMPLETED session was refused, as a CLOSED set.
 *
 * Separate from `DraftDeletionRefusalReason` on purpose: the two operations have different
 * authorization, different ownership rules and different lifecycle requirements, and one shared
 * class would let a caller classify one as the other. The reason travels for SERVER-SIDE diagnosis
 * only - the action collapses both into one operator-facing sentence, so "no such session" and
 * "not completed" are indistinguishable from the browser.
 *
 * TWO REASONS, NOT THREE. `delete_affected_wrong_row_count` is gone because the condition it named
 * can no longer reach this layer: the row is locked and re-decided inside `delete_completed_session`,
 * so a row count other than one is an unmodelled database state that ABORTS the transaction rather
 * than refusing it. A refusal word that cannot be produced is a lie about the reachable states.
 */
export type CompletedSessionDeletionRefusalReason = "not_found" | "not_completed";

export class CompletedSessionNotDeletableError extends Error {
  constructor(public readonly reason: CompletedSessionDeletionRefusalReason) {
    super("Completed session is not deletable.");
    this.name = "CompletedSessionNotDeletableError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Why an existing session was refused for a write, as a CLOSED set (SHADCN-07B2).
 *
 * These were two plain `new Error(...)` calls, so the only way to tell an ownership refusal from a
 * retention refusal - or either from a Supabase transport fault - was to compare message text.
 * Message matching is what the caller must not do: it is brittle, it silently reclassifies when
 * wording changes, and it cannot separate an expected refusal from an outage.
 *
 * The reason travels for SERVER-SIDE diagnosis only. The actions collapse both into one
 * operator-facing sentence, because "not your session" and "past its retention window" must not be
 * distinguishable from the browser.
 */
export type SessionUnavailableReason = "not_owned" | "retention_expired";

export class SessionUnavailableError extends Error {
  constructor(public readonly reason: SessionUnavailableReason) {
    super("Session is not available for this operation.");
    this.name = "SessionUnavailableError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type SessionRepositoryCaller = {
  userId: string;
  role: "Admin" | "User";
  /**
   * Carried so the deletion transaction audits the RESOLVED caller. It is read from the session
   * cookie at the server boundary and injected here; no request payload can reach this field.
   */
  username: string;
};

type SessionOwnershipRow = {
  created_by_user_id: string;
};

type SessionRetentionRow = {
  status: string;
  expires_at: string | null;
};

export class SupabasePatientReportSessionRepository implements IPatientReportSessionRepository {
  /**
   * The complete session tree. Every consumer that has to RENDER a report - Preview, Print, PDF,
   * the Workspace, a completed snapshot - needs it, and none of them reads more than one session
   * at a time.
   */
  private static readonly SESSION_AGGREGATE_PROJECTION = `
          *,
          laboratory_reports (
            *,
            laboratory_results (*),
            report_signatories (*)
          )
        `;

  /**
   * The list projection (SHADCN-07C2). Named columns only - never `*`.
   *
   * A Dashboard or History row draws a patient, an accession, a lifecycle badge, a retention chip
   * and up to three template-code chips. Nothing on that row is derived from a result value, a
   * signatory, or a frozen snapshot, so none of those is retrieved: `laboratory_results` and
   * `report_signatories` are not embedded at all, and `completed_snapshot` is not selected.
   *
   * What changes is the WEIGHT of a row, never which rows come back. The predicates, the ordering
   * and the limit are still the aggregate read's own, so this returns exactly the sessions it
   * always returned - the parent row count is unchanged. What it stops carrying is everything
   * hanging off each one: the two child tables are no longer joined, so their rows are not
   * retrieved at all, and on the session row itself `completed_snapshot` and every other column
   * the previous `*` swept up are simply never selected.
   *
   * `created_by_user_id` IS selected, and deliberately: `getRecentSessionsWithOwnership` derives
   * `ownedByCaller` from it, in this process, and it is dropped before the entry is built. It never
   * reaches `mapToListEntry`'s output and therefore never crosses the server boundary.
   *
   * `demographics` is one JSONB column and is selected whole - PostgREST cannot return part of it
   * without re-typing every value as text. `mapToListEntry` projects the six fields a list row
   * renders and discards the rest, so the wider column is read by the server and is never
   * transported.
   */
  private static readonly SESSION_LIST_PROJECTION = `
          id,
          accession_number,
          status,
          demographics,
          created_by_user_id,
          created_at,
          completed_at,
          expires_at,
          laboratory_reports (
            id,
            template_code
          )
        `;

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

  /**
   * The one recent-session read. Both recent-session callers share it so the retention-scoped
   * query runs once per request: `getRecentSessions` maps the rows to aggregates, and
   * `getRecentSessionsWithOwnership` additionally reads `created_by_user_id` off the same rows.
   *
   * Ownership used to cost a second round trip, because `mapToAggregate` deliberately drops the
   * owner column and the aggregate must not carry it. Reading it here - before mapping - removes
   * that trip without widening the domain model or the query.
   *
   * SHADCN-07C2: the PROJECTION is now the caller's, because the two callers need different
   * amounts of the session and the list caller needs very little of it. What is emphatically NOT
   * the caller's is the visibility scope - the draft-ownership `or`, the retention `or`, the
   * ordering and the limit all still live here, once, so a narrower projection cannot become a
   * wider query. A caller supplies which COLUMNS it may read; it never supplies which ROWS.
   */
  private async fetchRecentSessionRows(
    limit: number,
    search: string | undefined,
    projection: string
  ): Promise<Record<string, unknown>[]> {
    const retentionTimestamp = new Date().toISOString();
    const query = this.applyDraftOwnershipScope(
      supabaseServer
        .from("patient_report_sessions")
        .select(projection)
        .order("created_at", { ascending: false })
        .limit(limit)
    ).or(`status.eq.Draft,expires_at.is.null,expires_at.gte.${retentionTimestamp}`);
    const { data, error } = await (search
      ? query.like("accession_number", `${search}%`)
      : query);

    if (error) throw error;
    if (!data) throw new Error("Supabase session history query returned no data.");
    // Through `unknown` because the projection is now the caller's: supabase-js can only infer a
    // row type from a literal select string, and a parameter is not one. The declared return type
    // is unchanged and is what it always effectively was - an untyped row the two mappers read
    // named columns off. Nothing about the query's scope or the mapped output depends on this.
    return data as unknown as Record<string, unknown>[];
  }

  private async assertExistingSessionOwnership(id: string): Promise<void> {
    const caller = this.requireCaller();
    const { data, error } = await supabaseServer
      .from("patient_report_sessions")
      .select("created_by_user_id")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    // A MISSING row stays permitted: a genuinely new Draft has no persisted row yet, and refusing
    // here would make it impossible to create one. Only a row that exists and belongs to someone
    // else is a refusal.
    if (data && (data as SessionOwnershipRow).created_by_user_id !== caller.userId) {
      throw new SessionUnavailableError("not_owned");
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
        throw new SessionUnavailableError("retention_expired");
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

  /**
   * One complete session, under EXACTLY the visibility the recent-session list applies
   * (SHADCN-07C2).
   *
   * This is the on-demand half of list minimization: History rows no longer carry a report body, so
   * Preview asks for one session by id when the operator opens it. The predicates below are the
   * same two the list query uses, in the same order - `applyDraftOwnershipScope` (a Completed
   * session, or the caller's OWN Draft) and then the retention window - so a session is previewable
   * if and only if it was listable. Nothing is widened: another user's Draft stays invisible with
   * no Admin override, and a Completed session past its retention window stays gone.
   *
   * It is deliberately NOT `findReopenableSessionForCaller`. That method answers a different and
   * stricter question - may THIS caller replace this session - by additionally requiring creator
   * ownership. Previewing a visible Completed session the caller does not own is existing,
   * intended behaviour, and folding the two together would silently withdraw it.
   */
  async findVisibleSessionForCaller(id: string): Promise<IPatientReportSession | null> {
    const retentionTimestamp = new Date().toISOString();
    const { data, error } = await this.applyDraftOwnershipScope(
      supabaseServer
        .from("patient_report_sessions")
        .select(SupabasePatientReportSessionRepository.SESSION_AGGREGATE_PROJECTION)
        .eq("id", id)
    )
      .or(`status.eq.Draft,expires_at.is.null,expires_at.gte.${retentionTimestamp}`)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapToAggregate(data as Record<string, unknown>) : null;
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
    limit = 50,
    search?: string
  ): Promise<{ session: PatientReportSessionListEntry; ownedByCaller: boolean }[]> {
    const caller = this.requireCaller();
    const rows = await this.fetchRecentSessionRows(
      limit,
      search,
      SupabasePatientReportSessionRepository.SESSION_LIST_PROJECTION
    );
    const sessions = rows.map((row) => this.mapToListEntry(row));
    const ownerBySessionId = new Map<string, string>(
      rows.map((row) => [String(row.id), String(row.created_by_user_id)])
    );
    return sessions.map((session) => ({
      session,
      ownedByCaller: ownerBySessionId.get(session.id) === caller.userId,
    }));
  }

  async getRecentSessions(limit = 50, search?: string): Promise<PatientReportSessionAggregate[]> {
    const rows = await this.fetchRecentSessionRows(
      limit,
      search,
      SupabasePatientReportSessionRepository.SESSION_AGGREGATE_PROJECTION
    );
    return rows.map((row) => this.mapToAggregate(row));
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

    await serverAutoSuggestionLearningService.learnSuggestionsFromSessionDemographics(session.demographics);

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

  async deleteDraftSession(id: string): Promise<void> {
    const caller = this.requireCaller();
    const { data, error } = await supabaseServer
      .from("patient_report_sessions")
      .select("id, status, created_by_user_id")
      .eq("id", id)
      .maybeSingle();

    // A transport/PostgREST fault still throws raw and stays UNEXPECTED. Only the four decided
    // refusals below become the typed class, so the caller can classify by type without reading
    // any message, and without mistaking an outage for a refusal.
    if (error) throw error;
    if (!data) throw new DraftNotDeletableError("not_found");

    const storedSession = data as {
      id: string;
      status: string;
      created_by_user_id: string;
    };
    if (storedSession.created_by_user_id !== caller.userId) {
      throw new DraftNotDeletableError("not_owned");
    }
    if (storedSession.status === "Draft") {
      const { data: deletedRows, error: deleteError } = await supabaseServer
        .from("patient_report_sessions")
        .delete()
        .eq("id", id)
        .eq("status", "Draft")
        .eq("created_by_user_id", caller.userId)
        .select("id");

      if (deleteError) throw deleteError;
      if (!deletedRows || deletedRows.length !== 1) {
        throw new DraftNotDeletableError("delete_affected_wrong_row_count");
      }
      return;
    }

    throw new DraftNotDeletableError("not_draft");
  }

  /**
   * Permanently delete ONE completed session, with its own report tree, AND write the audit record
   * of that deletion - in ONE database transaction.
   *
   * ONE TRANSACTION, NOT TWO REQUESTS. This used to be a SELECT, then a DELETE that committed on
   * its own, then a separate audit INSERT issued by the server action. A fault on that last write
   * destroyed a clinical record and left nothing saying who destroyed it. PostgREST gives every
   * request its own implicit transaction and exposes no multi-statement one, so the only place the
   * two writes can be made atomic is inside the database. `delete_completed_session` holds both:
   * either the session and its audit row both land, or neither does.
   *
   * THE AUDIT IS NO LONGER THIS LAYER'S, and it is not the action's either. The RPC owns it, which
   * is why this method returns nothing to build one from.
   *
   * THE TREE GOES WITH IT. `laboratory_reports.session_id`, `laboratory_results.report_id` and
   * `report_signatories.report_id` are all `ON DELETE CASCADE`, so one DELETE inside the function
   * removes the reports, their results and their signatories. The frozen snapshot is a column on
   * the session row. Every other foreign key on those tables points OUTWARD to a shared record -
   * `user_profiles`, `report_templates`, `physicians`, `personnel_identities` - and is RESTRICT or
   * NO ACTION, so nothing shared can be reached.
   *
   * THE ACTOR IS THE RESOLVED CALLER, never a request field. It is taken from the caller injected
   * at construction, which the server boundary resolved from the session cookie, so the identity
   * that is admitted and the identity that is audited are the same value.
   *
   * AUTHORIZATION IS NOT HERE. The Administrator check is the server action's, at the boundary
   * where the caller identity is resolved. The function re-decides it as defence in depth and
   * refuses a non-Administrator payload outright, but it is not the boundary.
   *
   * THE RACE IS SAFE. The function locks the row FOR UPDATE, re-reads its status and predicates the
   * DELETE on `status = 'Completed'`, so a second concurrent call finds no row and answers
   * NOT_FOUND: it writes nothing, audits nothing, and is reported as a typed refusal rather than a
   * success that did not happen.
   */
  async deleteCompletedSession(id: string): Promise<void> {
    const caller = this.requireCaller();
    const { data, error } = await supabaseServer.rpc("delete_completed_session", {
      p_session_id: id,
      p_actor_user_id: caller.userId,
      p_actor_username: caller.username,
      p_actor_role: caller.role,
    });

    // A transport/PostgREST fault, and any exception the function raises, still throw raw and stay
    // UNEXPECTED. Only the two decided refusal words below become the typed class.
    if (error) throw error;
    if (data === "NOT_FOUND") throw new CompletedSessionNotDeletableError("not_found");
    if (data === "NOT_COMPLETED") throw new CompletedSessionNotDeletableError("not_completed");
    if (data !== "DELETED") {
      throw new Error("Supabase completed-session deletion returned an unrecognised outcome.");
    }
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

  /**
   * Build one LIST ENTRY from a narrow row (SHADCN-07C2).
   *
   * Field by field, never a spread, for the same reason `toClientSignatory` is written that way: a
   * spread would carry `created_by_user_id` straight into the entry, and would carry whatever
   * column the list projection is widened by next. Written like this, adding a column to the
   * projection cannot by itself add a field to the transport.
   *
   * `demographics` is narrowed here too. The column arrives whole because PostgREST cannot slice
   * JSONB without re-typing it, so the six fields a list row renders are copied out and the rest -
   * address, patient status, referrer, company - is dropped in this process. No list consumer
   * reads them and none of them reaches the browser.
   */
  private mapToListEntry(raw: Record<string, unknown>): PatientReportSessionListEntry {
    const rawReports = (raw.laboratory_reports as Record<string, unknown>[]) || [];
    // `demographics` is JSONB NOT NULL, which still admits the JSON scalar `null`: the completion
    // RPCs copy `payload -> 'session' -> 'demographics'` straight through, and SQL NOT NULL does
    // not reject `'null'::jsonb`. Six field reads follow immediately - unlike mapToAggregate, which
    // passes the value on untouched - so an unguarded cast would throw here and fail the entire
    // list for one malformed row.
    const demographics = (raw.demographics ?? {}) as PatientDemographics;

    return {
      id: String(raw.id || ""),
      accessionNumber: raw.accession_number == null ? null : String(raw.accession_number),
      status: raw.status as PatientReportSessionListEntry["status"],
      demographics: {
        fullName: demographics.fullName,
        age: demographics.age,
        ageUnit: demographics.ageUnit,
        sex: demographics.sex,
        requestingPhysician: demographics.requestingPhysician,
        examinationDate: demographics.examinationDate,
      },
      reports: rawReports.map((report) => ({
        id: String(report.id || ""),
        templateCode: String(report.template_code || ""),
      })),
      createdAt: String(raw.created_at || ""),
      completedAt: (raw.completed_at as string) || null,
      expiresAt: (raw.expires_at as string) || null,
    };
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
