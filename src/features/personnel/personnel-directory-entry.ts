import type { PersonnelRole } from "@/domain/types";

/**
 * The only personnel shape permitted to cross into client code.
 *
 * `IPersonnel` carries `signatureImageUrl`, and AGENTS.md §7 forbids that value reaching a
 * client-facing contract: **"Never expose `signatureImageUrl` to a client schema. Derive a
 * boolean server-side."** Passing the full record and letting the client reduce it to
 * `!!signatureImageUrl` satisfied the interface but not the rule - the URL was still serialized
 * into the RSC payload and every Server Action response on the way there.
 *
 * `hasSignature` is that server-derived boolean. It is the whole of what the directory and the
 * signature control ever needed: nothing in the Personnel client renders the URL as an image,
 * so no client consumer loses a capability by never receiving it.
 *
 * This type is deliberately declared outside the server-only action module so both sides can
 * name it, and it deliberately carries no index signature - a structural type with no escape
 * hatch is what makes "contains no URL" checkable rather than merely intended.
 */
export interface PersonnelDirectoryEntry {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial?: string | null;
  credentials: string;
  prcLicenseNumber: string;
  role: PersonnelRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Server-derived from the stored signature reference. Never the reference itself. */
  hasSignature: boolean;
}
