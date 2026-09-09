import type { RequestedByPolicySpec } from "@/domain/types/report-definition";

/**
 * What a Requested By control offers, derived from the managed physician directory.
 *
 * The directory is the authoritative roster, and the assignment set stored beside it - one row per
 * (physician, examination), at most one of them flagged as that examination's default - is what
 * decides which of those physicians an examination offers and which, if any, is initially
 * selected. Both live in the database. It replaces two earlier sources that were both wrong in the
 * same direction: `listAutoSuggestionsAction`, which learned physicians from what operators had
 * already typed and therefore offered nothing at all on a laboratory that had not yet completed a
 * session, and the per-definition physician declaration, which was harvested across the
 * definitions to paper over that gap. Adding, retiring, restricting or defaulting a doctor is now
 * an administrative act on the directory, not an edit to a report definition.
 *
 * The declarative resolver below survives as the FALLBACK path and nothing more: it is what the
 * control offers while the assignment set has not been read - a directory outage, or the first
 * paint before the read returns. Where an assignment is in hand it is the authority, and the
 * declaration is not consulted at all.
 *
 * Everything here is pure and I/O-free. The directory and the assignment both arrive as arguments
 * - read through the Workspace's server-action boundary - so this module can be reasoned about,
 * and asserted on, without a database.
 *
 * This is a suggestion source only. The control stays a free-text, optional combobox: the
 * operator may type a physician who is not in the directory, may leave the field blank, and
 * nothing here constrains, validates or rewrites what they enter.
 */

/** Trim, drop blanks, de-duplicate case-insensitively, preserve the caller's order. */
function normalizeRoster(names: readonly string[]): string[] {
  const roster: string[] = [];
  const seen = new Set<string>();

  for (const candidate of names) {
    const value = candidate?.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    roster.push(value);
  }

  return roster;
}

/**
 * The physicians this examination offers when no database assignment is available.
 *
 * The fallback path, kept for exactly that: until the assignment set has been read the control
 * still has to offer something, and offering the active directory narrowed by whatever the
 * definition declared is strictly better than offering nothing. It is not the authority. See
 * `resolveAssignedSuggestions`, which is what the control calls.
 *
 * `allowedPhysicians` absent means unrestricted: the whole active directory, in the order the
 * directory returned it. Present means this report offers exactly those names, in the order they
 * were declared, matched case-insensitively against the directory so a declaration that differs
 * only in casing still resolves. The directory's spelling wins on a match, because the directory
 * is the roster of record and a definition should not be able to re-spell a managed name.
 *
 * A declared name that is not in the active directory is not offered - it has been retired or was
 * never added - and the operator can still type it. The restriction is per report and never
 * touches the directory: FECALYSIS declaring the two Asperas doctors does not remove
 * Dr. Ma. Floricel Dedace-Lagrazon from the examinations that still draw on her.
 */
export function mergePhysicianSuggestions(
  directory: readonly string[],
  policy?: Pick<RequestedByPolicySpec, "allowedPhysicians"> | null,
): string[] {
  const roster = normalizeRoster(directory);
  const allowed = policy?.allowedPhysicians;
  if (!allowed) return roster;

  const byKey = new Map(roster.map((name) => [name.toLocaleLowerCase(), name]));
  const restricted: string[] = [];
  const seen = new Set<string>();

  for (const candidate of allowed) {
    const key = candidate?.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) continue;
    const match = byKey.get(key);
    if (!match) continue;
    seen.add(key);
    restricted.push(match);
  }

  return restricted;
}

/**
 * One rostered physician and the examinations they are assigned to.
 *
 * Declared structurally rather than imported, because this module must reach no server boundary -
 * `WorkspacePhysicianOption`, the shape the Workspace's physician action actually returns, is
 * assignable to it field for field. Narrow by construction: no row id, no audit timestamps, and no
 * `isActive`, because the action returns active physicians only and an inactive one is absent
 * rather than present-and-flagged. That absence is the whole mechanism by which a deactivated
 * doctor is never suggested and never applied as a default; nothing here evaluates activeness.
 */
export interface PhysicianExaminationOption {
  /** The full display name exactly as it prints on a report. */
  readonly fullName: string;
  /**
   * Every examination this physician may be suggested for.
   *
   * Empty means assigned to NOTHING, never "assigned to everything". A physician an Administrator
   * has not yet assigned, or has deliberately un-assigned from every examination, is offered for
   * none of them - which is the whole point of the un-assign control, and the same reading the
   * server DTO and the Personnel directory's "Unassigned" label already carry.
   */
  readonly assignedTemplateCodes: readonly string[];
  /** The subset of the above for which this physician is the pre-selected default. */
  readonly defaultTemplateCodes: readonly string[];
}

/**
 * What the database says about ONE examination: who it offers, and where it starts.
 *
 * Null, rather than an empty instance, is how "the assignment set has not been read" is said - an
 * examination every physician has been unassigned from genuinely offers nobody, and that answer
 * must not be confused with not having asked.
 */
export interface WorkspacePhysicianAssignment {
  /** Every physician assigned to this examination, in the order the server returned them. */
  readonly suggestions: readonly string[];
  /** The one assignment flagged as this examination's default, or null when it has none. */
  readonly initialRequestedBy: string | null;
}

/**
 * Resolve the roster the Workspace read into the two answers one examination needs.
 *
 * The roster travels per physician - each carrying the examinations it is assigned to and the
 * subset it defaults for - so the whole directory crosses the boundary once and every examination
 * in the session is answered from it without a second round trip.
 *
 * The default is only ever taken from a physician who already passed the assignment filter, which
 * is what makes "a default physician is always an assigned physician" hold on this side too. The
 * database holds the same invariant structurally, through a partial unique index over the default
 * flag; agreeing with it here costs one condition and removes the possibility of the control
 * pre-selecting a name it does not offer.
 */
export function resolveExaminationPhysicianAssignment(
  options: readonly PhysicianExaminationOption[] | null | undefined,
  templateCode: string,
): WorkspacePhysicianAssignment | null {
  if (!options) return null;

  const suggestions: string[] = [];
  let initialRequestedBy: string | null = null;

  for (const option of options) {
    // Membership, with no empty-set escape hatch. Treating an empty list as "suggest everywhere"
    // silently defeated the Administrator's restriction: un-assigning a physician from every
    // examination - the natural way to stop offering a doctor without deactivating them - put
    // them back on all seventeen, Fecalysis included.
    if (!option.assignedTemplateCodes.includes(templateCode)) continue;
    suggestions.push(option.fullName);
    if (initialRequestedBy === null && option.defaultTemplateCodes.includes(templateCode)) {
      initialRequestedBy = option.fullName;
    }
  }

  return { suggestions: normalizeRoster(suggestions), initialRequestedBy };
}

/**
 * The physicians an examination offers: its assignment set when one has been read, the
 * declarative fallback otherwise.
 *
 * An assignment with an EMPTY suggestion list is a real answer, not a missing one - an examination
 * every physician has been unassigned from offers nobody - so the fallback is chosen on the
 * absence of the assignment itself, never on the emptiness of its list. The field is free text
 * throughout: offering nobody still leaves the operator able to type any physician at all.
 */
export function resolveAssignedSuggestions(
  assignment: WorkspacePhysicianAssignment | null | undefined,
  directory: readonly string[],
  policy?: Pick<RequestedByPolicySpec, "allowedPhysicians"> | null,
): string[] {
  if (!assignment) return mergePhysicianSuggestions(directory, policy);
  return normalizeRoster(assignment.suggestions);
}

/**
 * The value a NEWLY MATERIALIZED report starts its Requested By at. Empty string means blank.
 *
 * Blank is the answer whenever the examination has no configured default, and blank is also the
 * answer when the configured name is not among the assignments actually offered - a default whose
 * physician has since been deactivated or unassigned reaches this function as a name with no
 * matching suggestion, and a retired doctor must never be applied. Matching is case-insensitive
 * and the assignment's spelling wins, for the same reason the roster's does: what prints on the
 * report is the managed name, not a re-spelling of it.
 *
 * Applying it is the caller's job and happens in exactly one place - report materialization. This
 * function has no way to reach an existing draft, which is what keeps a default from being
 * reapplied over a value the operator typed or deliberately cleared.
 */
export function resolveAssignedInitialRequestedBy(
  assignment: WorkspacePhysicianAssignment | null | undefined,
): string {
  if (!assignment) return "";
  const configured = assignment.initialRequestedBy?.trim();
  if (!configured) return "";

  const key = configured.toLocaleLowerCase();
  const offered = normalizeRoster(assignment.suggestions);
  return offered.find((name) => name.toLocaleLowerCase() === key) ?? "";
}
