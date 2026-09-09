/**
 * The only physician shape permitted to cross into client code.
 *
 * Declared outside the server-only action module so both sides of the boundary can name it, and
 * deliberately carrying no index signature - a structural type with no escape hatch is what makes
 * "contains nothing else" checkable rather than merely intended.
 *
 * It is field-for-field identical to `IPhysician` today because a physician record holds no
 * server-only value. That is not an invitation to pass `IPhysician` across the boundary instead:
 * the separate type is what guarantees a field added to the domain record later - an internal
 * note, an audit reference, a contact detail - does not silently become client-visible on the
 * next `.map()`. Project onto it field by field, never by spreading the domain record.
 */
export interface PhysicianDirectoryEntry {
  id: string;
  /** The full display name exactly as it prints on a report. */
  fullName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * One (physician, examination) assignment, as the ADMINISTRATION screen sees it.
 *
 * Separate from the domain record for the same reason as `PhysicianDirectoryEntry`: the row's
 * `createdAt` / `updatedAt` bookkeeping has no caller in the browser, so it does not cross. The
 * physician identifier does cross here - and only here - because the administration screen already
 * addresses physicians by `PhysicianDirectoryEntry.id` and has to key the assignment back to a row
 * it is editing. The Workspace projection below deliberately carries no identifier at all.
 */
export interface PhysicianAssignmentEntry {
  physicianId: string;
  /** The examination this physician is assigned to, e.g. "FECALYSIS". */
  templateCode: string;
  /** True for at most one physician per template - the database enforces the "at most one". */
  isDefault: boolean;
}

/**
 * The ONLY physician shape the Workspace is permitted to receive.
 *
 * The Workspace encodes reports; it addresses no physician by identity, audits nothing about a
 * physician row and renders no directory bookkeeping. So this projection deliberately withholds
 * `id`, `createdAt`, `updatedAt` and `isActive`: the id because a request that can name a row is a
 * request that can be aimed at one, the timestamps because they describe the directory's
 * administration rather than the report, and `isActive` because it is not a fact the Workspace has
 * to evaluate - the action returns active physicians only, so an inactive one is absent rather than
 * present-and-flagged.
 *
 * What it keeps is exactly what the "Requested By" control has to answer for the examination being
 * encoded: which names to suggest (`assignedTemplateCodes` contains the template code) and which
 * one, if any, is pre-selected (`defaultTemplateCodes` contains it). Both are template-code lists
 * per physician rather than a physician list per template, so the whole roster travels in one
 * shape and the control resolves its own examination from it without a second round trip.
 *
 * No index signature: "contains nothing else" has to be checkable, not merely intended.
 */
export interface WorkspacePhysicianOption {
  /** The full display name exactly as it prints on a report. The only identity that crosses. */
  fullName: string;
  /**
   * Every examination this physician may be suggested for.
   *
   * Empty means assigned to NONE, not assigned to all. A newly created physician starts with no
   * assignments and is offered for nothing until an Administrator says otherwise - the same
   * decision the migration makes when it names its seventeen seeded codes explicitly rather than
   * harvesting the registry, so an eighteenth examination is never silently handed to the roster.
   */
  assignedTemplateCodes: readonly string[];
  /** The subset of the above for which this physician is the pre-selected default. */
  defaultTemplateCodes: readonly string[];
}
