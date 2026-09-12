"use server";

import "server-only";

import type { HydratedTemplateSpec } from "@/services/interfaces";
import type {
  IPersonnel,
  IPhysician,
  IPhysicianExaminationAssignment,
  IPatientReportSession,
} from "@/domain/models/interfaces";
import type { WorkspacePhysicianOption } from "@/features/physicians/physician-directory-entry";
import type { PatientReportSessionAggregate } from "@/domain/models/patient-report-session-aggregate";
import { resolveAuthenticatedRequest } from "@/lib/session";
import { SupabasePersonnelRepository } from "@/repositories/supabase-personnel-repository";
import { SupabasePhysicianRepository } from "@/repositories/supabase-physician-repository";
import {
  CompletedSessionNotDeletableError,
  DraftNotDeletableError,
  SessionUnavailableError,
  SupabasePatientReportSessionRepository,
} from "@/repositories/supabase-session-repository";
import { DomainInvariantError, ValidationError } from "@/lib/errors";
import {
  OperationalAccessDeniedError,
  operationalFailure,
  operationalSuccess,
  reportUnexpectedActionFailure,
  type OperationalActionResult,
} from "@/features/server-boundary/operational-action-result";
import { auditService } from "@/services/audit-service-instance";
import { reportRegistryService } from "@/services/report-registry-service";
import { serverAutoSuggestionLearningService } from "@/services/auto-suggestion-service-server";
import type { IAutoSuggestion } from "@/domain/models/interfaces";
import {
  parseAutoSuggestionQueryInput,
  parseEmptyActionInput,
  parseRecentSessionsInput,
  parseRegistryTemplateInput,
  parseSessionLoadInput,
  parseSessionMutationInput,
} from "@/features/server-boundary/action-inputs";
import {
  fromSessionTransport,
  PatientReportSessionListEntry,
  PatientReportSessionTransport,
  toSessionTransport,
} from "@/features/server-boundary/session-transport";
import { applyResolvedSignatories } from "@/features/server-boundary/signatory-resolution";

type OperationalCaller = {
  userId: string;
  role: "Admin" | "User";
  username: string;
};

/**
 * One row of the Dashboard / History session list.
 *
 * SHADCN-07C2 narrowed `session` from the complete `PatientReportSessionTransport` to the list
 * DTO. The entry shape itself is unchanged - a session and the server's own reopen decision - and
 * `canReopen` is still the only ownership fact that crosses, still derived server-side from
 * `created_by_user_id`, which the DTO cannot express.
 */
export type SessionHistoryEntryTransport = {
  session: PatientReportSessionListEntry;
  canReopen: boolean;
};

async function requireOperationalCaller(): Promise<OperationalCaller> {
  // SHADCN-07C1-R2: ONE resolution per invocation. React cache() gives reuse within a Server
  // Component render; it is not a dependable dedupe inside a Server Action, so the earlier
  // two-step session-then-profile pair could genuinely read the user row twice. Resolving once
  // removes the second read outright rather than relying on a memo, and guarantees the session and
  // the profile describe the same row. Every check, denial reason, audit field, thrown error and
  // returned value below is unchanged.
  const resolved = await resolveAuthenticatedRequest();
  const session = resolved?.session ?? null;
  if (!session) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "OperationalAccessDenied",
      actorRole: null,
      targetRole: null,
      details: { reasonCode: "unauthenticated" },
    });
    throw new OperationalAccessDeniedError("unauthenticated");
  }
  if (session.mustChangePassword || session.mustSetRecovery) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "OperationalAccessDenied",
      actorRole: null,
      targetRole: null,
      performedByUserId: session.userId,
      details: { reasonCode: "first_login_incomplete" },
    });
    throw new OperationalAccessDeniedError("first_login_incomplete");
  }

  const profile = resolved?.user ?? null;
  if (!profile || profile.status !== "Active") {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "OperationalAccessDenied",
      actorRole: profile?.role ?? null,
      targetRole: null,
      performedByUserId: session.userId,
      performedByUsername: profile?.username ?? null,
      details: { reasonCode: profile ? "account_inactive" : "unauthenticated" },
    });
    throw new OperationalAccessDeniedError(profile ? "account_inactive" : "unauthenticated");
  }
  if (profile.role !== "Admin" && profile.role !== "User") {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "OperationalAccessDenied",
      actorRole: profile.role,
      targetRole: null,
      performedByUserId: profile.id,
      performedByUsername: profile.username,
      details: { reasonCode: "role_not_authorized" },
    });
    throw new OperationalAccessDeniedError("role_not_authorized");
  }

  return { userId: profile.id, role: profile.role, username: profile.username };
}

/**
 * SHADCN-07B2-R2: the operational guard's DELIBERATE refusal, as a value the actions can return.
 *
 * Classification is now by TYPE, taken from what the guard actually decided. An earlier revision
 * inferred it from control flow - preload the session, then treat any throw from the guard as a
 * refusal - which was wrong in a way that mattered: a failed denial-audit write, a Supabase outage
 * inside the guard, and an ordinary programming fault all became "you are not authorized". Each of
 * those told the operator something false and buried a real defect behind a routine refusal.
 *
 * Only `OperationalAccessDeniedError` - which the guard raises at its four decision points, after
 * awaiting that branch's SecurityDenial audit - becomes `{ ok: false }`. Everything else, an
 * `auditService.emit` failure included, is unexpected: it gets the sanitized diagnostic and is
 * rethrown, so the error boundary still fires and the audit failure stays visible.
 *
 * There is no session preload. The guard resolves the request itself, exactly as it always has.
 */
type OperationalAuthorization =
  | { ok: true; caller: OperationalCaller }
  | { ok: false };

async function authorizeOperationalCaller(route: string): Promise<OperationalAuthorization> {
  try {
    return { ok: true, caller: await requireOperationalCaller() };
  } catch (error: unknown) {
    if (error instanceof OperationalAccessDeniedError) {
      return { ok: false };
    }
    reportUnexpectedActionFailure(route, "authorizeOperationalCaller", error);
  }
}

export async function listRecentSessionsAction(
  input: unknown
): Promise<SessionHistoryEntryTransport[]> {
  const caller = await requireOperationalCaller();
  const { limit, search } = parseRecentSessionsInput(input);
  const repository = new SupabasePatientReportSessionRepository(caller);
  const sessions = await repository.getRecentSessionsWithOwnership(limit, search);
  // No `toSessionTransport` here any more. The repository already returns the narrow list entry, so
  // there is no full aggregate to project down from - the heavy relations were never fetched. A
  // conversion at this point would only be able to re-widen what the query deliberately left out.
  return sessions.map((entry) => ({
    session: entry.session,
    canReopen: entry.ownedByCaller,
  }));
}

export async function deleteDraftSessionAction(
  input: unknown
): Promise<OperationalActionResult<null>> {
  const authorization = await authorizeOperationalCaller("/history");
  if (!authorization.ok) return operationalFailure("OPERATIONAL_ACCESS_DENIED");
  const caller = authorization.caller;
  const { sessionId } = parseSessionLoadInput(input);
  const repository = new SupabasePatientReportSessionRepository(caller);
  try {
    await repository.deleteDraftSession(sessionId);
  } catch (error: unknown) {
    // Classified by TYPE, never by message. The repository decides the four refusals and raises
    // one closed class for them; everything else - a PostgREST fault, a transport failure, a
    // programming error - is unexpected and is re-raised untouched after a sanitized log.
    if (error instanceof DraftNotDeletableError) {
      return operationalFailure("DRAFT_NOT_DELETABLE");
    }
    reportUnexpectedActionFailure("/history", "deleteDraftSession", error);
  }
  // Unchanged: the success audit is emitted only after the delete actually succeeded, and before
  // the caller is told it did.
  await auditService.emit({
    category: "SessionReport",
    eventType: "SessionDraftDeleted",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: sessionId,
    details: { sessionId, deletedAt: new Date().toISOString() },
  });
  return operationalSuccess(null);
}

export async function saveDraftAction(
  input: unknown
): Promise<OperationalActionResult<PatientReportSessionTransport>> {
  const authorization = await authorizeOperationalCaller("/workspace");
  if (!authorization.ok) return operationalFailure("OPERATIONAL_ACCESS_DENIED");
  const caller = authorization.caller;
  const transport = parseSessionMutationInput(input);
  if (transport.status !== "Draft") {
    return operationalFailure("DRAFT_SAVE_LIFECYCLE_INVALID");
  }

  const repository = new SupabasePatientReportSessionRepository(caller);
  try {
    const saved = await repository.saveDraft(fromSessionTransport(transport));
    return operationalSuccess(toSessionTransport(saved));
  } catch (error: unknown) {
    // An existing row owned by someone else, or one past its retention window. A MISSING row is
    // not a refusal - the repository permits it so a genuinely new Draft can still be created.
    if (error instanceof SessionUnavailableError) {
      return operationalFailure("SESSION_UNAVAILABLE");
    }
    reportUnexpectedActionFailure("/workspace", "saveDraft", error);
  }
}

export async function completeSessionAction(
  input: unknown
): Promise<OperationalActionResult<PatientReportSessionTransport>> {
  const authorization = await authorizeOperationalCaller("/workspace");
  if (!authorization.ok) return operationalFailure("OPERATIONAL_ACCESS_DENIED");
  const caller = authorization.caller;
  const transport = parseSessionMutationInput(input);
  if (transport.status !== "Draft") {
    return operationalFailure("COMPLETION_LIFECYCLE_INVALID");
  }

  const repository = new SupabasePatientReportSessionRepository(caller);
  // The transported signatories carry whatever signatureImageUrl the browser sent. Resolve it
  // from authoritative personnel BEFORE completion runs validateAndCompose: the frozen
  // snapshot and the RPC payload both read this same live aggregate, so resolving here is what
  // makes them incapable of disagreeing. Resolving later would correct only the relational rows.
  const draft = fromSessionTransport(transport);
  try {
    await applyResolvedSignatories(draft.reports, new SupabasePersonnelRepository());
  } catch (error: unknown) {
    // A recognised domain validation failure is expected and sayable. Its own message and its
    // fieldErrors are discarded - only the code selects one of our fixed sentences.
    if (error instanceof ValidationError) {
      return operationalFailure("SIGNATORY_VALIDATION_FAILED");
    }
    reportUnexpectedActionFailure("/workspace", "resolveSignatories", error);
  }

  let completed: IPatientReportSession;
  try {
    completed = await repository.completeSession(draft);
  } catch (error: unknown) {
    if (error instanceof SessionUnavailableError) {
      return operationalFailure("SESSION_UNAVAILABLE");
    }
    if (error instanceof ValidationError) {
      return operationalFailure("REPORT_VALIDATION_FAILED");
    }
    reportUnexpectedActionFailure("/workspace", "sessionCompletion", error);
  }

  const reportCount = completed.reports.length;
  const templateCodes = completed.reports.map((report) => report.templateCode);
  await auditService.emit({
    category: "SessionReport",
    eventType: "SessionCompleted",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: completed.accessionNumber,
    details: { reportCount, templateCodes },
  });

  return operationalSuccess(toSessionTransport(completed));
}

export async function replaceSessionAction(
  input: unknown
): Promise<OperationalActionResult<PatientReportSessionTransport>> {
  const authorization = await authorizeOperationalCaller("/workspace");
  if (!authorization.ok) return operationalFailure("OPERATIONAL_ACCESS_DENIED");
  const caller = authorization.caller;
  const transport = parseSessionMutationInput(input);
  if (transport.status !== "Completed") {
    // The denial audit is still AWAITED before the refusal leaves this function. Only the exit
    // form changed - a returned typed refusal instead of a throw - never the ordering.
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "SessionReplacementDenied",
      actorRole: caller.role,
      targetRole: null,
      performedByUserId: caller.userId,
      performedByUsername: caller.username,
      details: { reasonCode: "session_not_completed" },
    });
    return operationalFailure("REPLACEMENT_LIFECYCLE_INVALID");
  }

  const repository = new SupabasePatientReportSessionRepository(caller);
  // recompleteSession() composes the replacement snapshot inline, so resolution must precede it
  // for the same reason as completion above.
  const candidate = fromSessionTransport(transport);
  try {
    await applyResolvedSignatories(candidate.reports, new SupabasePersonnelRepository());
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return operationalFailure("SIGNATORY_VALIDATION_FAILED");
    }
    reportUnexpectedActionFailure("/workspace", "resolveSignatories", error);
  }

  // recompleteSession() is the REAL replacement validation site. It runs SYNCHRONOUSLY, here, and
  // raises DomainInvariantError for the replacement lifecycle and retention rules and - through
  // ReportCompletionService.validateAndCompose - ValidationError for report content. Classifying
  // around repository.replaceSession() instead, as the previous revision did, was inert: by the
  // time that call runs, either error has already escaped the action. Neither error's message,
  // fields, stack or cause is read; the TYPE alone selects the code.
  let replacement: PatientReportSessionAggregate;
  try {
    replacement = candidate.recompleteSession();
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return operationalFailure("REPORT_VALIDATION_FAILED");
    }
    if (error instanceof DomainInvariantError) {
      return operationalFailure("REPLACEMENT_LIFECYCLE_INVALID");
    }
    reportUnexpectedActionFailure("/workspace", "recompleteSession", error);
  }

  let replaced: IPatientReportSession;
  try {
    replaced = await repository.replaceSession(replacement);
  } catch (error: unknown) {
    if (error instanceof SessionUnavailableError) {
      return operationalFailure("SESSION_UNAVAILABLE");
    }
    reportUnexpectedActionFailure("/workspace", "sessionReplacement", error);
  }

  const reportCount = replaced.reports.length;
  const templateCodes = replaced.reports.map((report) => report.templateCode);
  await auditService.emit({
    category: "SessionReport",
    eventType: "SessionReplaced",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: replaced.accessionNumber,
    details: { reportCount, templateCodes },
  });

  return operationalSuccess(toSessionTransport(replaced));
}

export async function getReopenableSessionAction(
  input: unknown
): Promise<OperationalActionResult<PatientReportSessionTransport>> {
  const authorization = await authorizeOperationalCaller("/workspace");
  if (!authorization.ok) return operationalFailure("OPERATIONAL_ACCESS_DENIED");
  const caller = authorization.caller;
  const { sessionId } = parseSessionLoadInput(input);
  const repository = new SupabasePatientReportSessionRepository(caller);
  let session: IPatientReportSession | null;
  try {
    session = await repository.findReopenableSessionForCaller(sessionId);
  } catch (error: unknown) {
    reportUnexpectedActionFailure("/workspace", "findReopenableSession", error);
  }
  if (!session) {
    // Ownership, status and retention all arrive here as the same `null`, because the repository
    // folds them into one ownership-scoped query. The refusal keeps that property: the audit
    // records the reason server-side, the operator is told only that it is unavailable.
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "SessionReopenDenied",
      actorRole: caller.role,
      targetRole: null,
      performedByUserId: caller.userId,
      performedByUsername: caller.username,
      details: { reasonCode: "session_not_replaceable" },
    });
    return operationalFailure("SESSION_NOT_REOPENABLE");
  }

  return operationalSuccess(toSessionTransport(session));
}

export async function listActivePersonnelAction(): Promise<IPersonnel[]> {
  await requireOperationalCaller();
  const repository = new SupabasePersonnelRepository();
  return repository.findAllActive();
}

/**
 * Project one active physician and the assignment rows onto the Workspace's own shape.
 *
 * Field by field, never a spread. A spread would carry the row `id` and the `createdAt` /
 * `updatedAt` administration timestamps straight across, and would keep carrying whatever column
 * is added to `IPhysician` next - which is precisely the failure this projection exists to stop.
 */
function toWorkspacePhysicianOption(
  physician: IPhysician,
  assignments: readonly IPhysicianExaminationAssignment[]
): WorkspacePhysicianOption {
  const mine = assignments.filter((assignment) => assignment.physicianId === physician.id);
  return {
    fullName: physician.fullName,
    assignedTemplateCodes: mine.map((assignment) => assignment.templateCode),
    defaultTemplateCodes: mine
      .filter((assignment) => assignment.isDefault)
      .map((assignment) => assignment.templateCode),
  };
}

/**
 * The managed physician directory, for the operator encoding a report.
 *
 * It lives here, beside `listActivePersonnelAction`, for one reason: `requireOperationalCaller` is
 * module-private, and it is the only guard in the repository that admits an ordinary laboratory
 * User. The physician ADMINISTRATION actions are guarded by `requirePersonnelAdmin` /
 * `requirePersonnelReader`, which are Admin and Developer only - correct for managing the
 * directory, and wrong for reading it while encoding, where they would silently hand every
 * operator an empty roster.
 *
 * `findAllActive` rather than `findAll`: a deactivated physician is filtered out in SQL, so they
 * stop being offered for new work while every report that already names them is untouched.
 *
 * IT RETURNS THE NARROW PROJECTION, NOT `IPhysician[]`, AND THAT IS THE ACTUAL BOUNDARY. Narrowing
 * the record in a Workspace wrapper afterwards did not close anything: every exported function in
 * this module is separately registered in the production server-action manifest and is therefore
 * reachable from client code on its own, wrapper or no wrapper. Whatever THIS function returns is
 * what a browser can obtain. So the row `id`, `createdAt` and `updatedAt` stop here - they are
 * never serialized in the first place, rather than being dropped one caller later.
 */
export async function listActivePhysiciansAction(): Promise<WorkspacePhysicianOption[]> {
  await requireOperationalCaller();
  const repository = new SupabasePhysicianRepository();
  const [physicians, assignments] = await Promise.all([
    repository.findAllActive(),
    repository.findAllAssignments(),
  ]);
  return physicians.map((physician) => toWorkspacePhysicianOption(physician, assignments));
}

/**
 * Suggestion lookups for the workspace.
 *
 * These used to run in the browser against the anon Supabase client, which put the whole
 * supabase-js graph - GoTrue auth and the realtime transport this application never uses - into
 * the workspace bundle, and which `auto_suggestions` row level security denied anyway. Reading
 * them here keeps the query on the bounded server client, derives the caller from the verified
 * session rather than from anything the page sends, and leaves no Supabase credential in the
 * browser. This action only reads: learning still happens once, after the completion RPC.
 */
export async function listAutoSuggestionsAction(input: unknown): Promise<IAutoSuggestion[]> {
  await requireOperationalCaller();
  const { category } = parseAutoSuggestionQueryInput(input);
  return serverAutoSuggestionLearningService.getSuggestionsByCategory(category);
}

export async function listRegistryTemplatesAction(
  input: unknown
): Promise<HydratedTemplateSpec[]> {
  await requireOperationalCaller();
  parseEmptyActionInput(input);
  return reportRegistryService.warmCache();
}

export async function getRegistryTemplateAction(
  input: unknown
): Promise<HydratedTemplateSpec | null> {
  await requireOperationalCaller();
  const { templateCode } = parseRegistryTemplateInput(input);
  return reportRegistryService.getTemplateByCode(templateCode);
}

/**
 * Load ONE complete session, on demand, for History Preview (SHADCN-07C2).
 *
 * The list no longer ships report bodies, so Preview fetches the session it is about to render -
 * one session, when an operator asks for it, instead of fifty on every page load. What comes back
 * is the existing `PatientReportSessionTransport`, unchanged, so Preview, Print, PDF and the frozen
 * completed snapshot all still receive exactly the complete data they received before; only the
 * moment of the fetch moved.
 *
 * Visibility is the LIST's, not the Workspace's. `findVisibleSessionForCaller` applies the same two
 * predicates the recent-session query applies - Completed-or-own-Draft, then the retention window -
 * so this action can return a session if and only if that session could have been listed. It is
 * deliberately not gated on `canReopen`: a Completed session the caller does not own is visible in
 * History and previewable there today, while remaining un-replaceable, and those are two different
 * decisions made by two different repository methods.
 *
 * A session that is absent, another user's Draft, or past retention all arrive here as the same
 * `null` and leave as the same sentence, so the refusal is not an existence oracle.
 */
export async function getVisibleSessionDetailAction(
  input: unknown
): Promise<OperationalActionResult<PatientReportSessionTransport>> {
  const authorization = await authorizeOperationalCaller("/history");
  if (!authorization.ok) return operationalFailure("OPERATIONAL_ACCESS_DENIED");
  const caller = authorization.caller;
  const { sessionId } = parseSessionLoadInput(input);
  const repository = new SupabasePatientReportSessionRepository(caller);
  let session: IPatientReportSession | null;
  try {
    session = await repository.findVisibleSessionForCaller(sessionId);
  } catch (error: unknown) {
    reportUnexpectedActionFailure("/history", "findVisibleSession", error);
  }
  if (!session) {
    return operationalFailure("SESSION_UNAVAILABLE");
  }

  return operationalSuccess(toSessionTransport(session));
}

/**
 * Permanently delete one COMPLETED session. ADMINISTRATORS ONLY.
 *
 * TWO SEPARATE GATES, in this order. The operational guard first, which authenticates the caller
 * and already refuses a Developer outright (`requireOperationalCaller` admits only Admin and User,
 * and audits the refusal itself). Then the Administrator check, which is what refuses a laboratory
 * User - a caller the operational guard legitimately admits for every other History operation.
 *
 * THE UI IS NOT THE BOUNDARY. History hides the control for a non-Administrator, and that is
 * presentation only: a direct call from any non-Administrator is refused HERE, server-side, with
 * the caller role resolved from the session rather than taken from the request.
 *
 * THE REFUSAL IS NOT AN ORACLE. A non-Administrator receives the same sentence as any other
 * authorization refusal, and the three deletion refusals collapse into one sentence, so no caller
 * can learn whether a given accession exists by asking to delete it.
 */
export async function deleteCompletedSessionAction(
  input: unknown
): Promise<OperationalActionResult<null>> {
  const authorization = await authorizeOperationalCaller("/history");
  if (!authorization.ok) return operationalFailure("OPERATIONAL_ACCESS_DENIED");
  const caller = authorization.caller;
  if (caller.role !== "Admin") {
    // The denial audit is AWAITED before the refusal leaves this function, the same ordering the
    // replacement guard uses: a refusal that was not recorded is a refusal nobody can review.
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "CompletedSessionDeletionDenied",
      actorRole: caller.role,
      targetRole: null,
      performedByUserId: caller.userId,
      performedByUsername: caller.username,
      details: { reasonCode: "role_not_authorized" },
    });
    return operationalFailure("OPERATIONAL_ACCESS_DENIED");
  }
  const { sessionId } = parseSessionLoadInput(input);
  const repository = new SupabasePatientReportSessionRepository(caller);
  try {
    await repository.deleteCompletedSession(sessionId);
  } catch (error: unknown) {
    // Classified by TYPE, never by message, exactly as the draft deletion is.
    if (error instanceof CompletedSessionNotDeletableError) {
      return operationalFailure("COMPLETED_SESSION_NOT_DELETABLE");
    }
    reportUnexpectedActionFailure("/history", "deleteCompletedSession", error);
  }
  // NO SUCCESS AUDIT HERE, AND THAT IS THE POINT. It used to be emitted from this line, after the
  // delete had already committed on its own, so a fault on the audit write destroyed the session
  // and left no record of who destroyed it. `delete_completed_session` now writes the
  // SessionCompletedDeleted row inside the same transaction as the delete, so reaching this point
  // means both landed and no fault can separate them. Re-adding an emit here would write a second
  // event for one deletion.
  return operationalSuccess(null);
}
