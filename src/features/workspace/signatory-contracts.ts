import type { PersonnelRole } from "@/domain/types";

/**
 * The client-safe Workspace contracts for personnel and signatory selection.
 *
 * AGENTS.md §7: **"Never expose `signatureImageUrl` to a client schema. Derive a boolean
 * server-side."** The Workspace previously received full `IPersonnel` records from
 * `listActivePersonnelAction` and composed full `SignatorySnapshot` objects in the browser,
 * so the proxy URL crossed the boundary twice - once inbound on every Workspace load, and
 * once outbound in every draft the client submitted.
 *
 * Neither type below carries `signatureImageUrl` or `signatureAsset`. Selection is identity
 * plus the printed facts the operator approved; the authoritative signature reference is
 * resolved server-side by `signatory-resolution.ts` (UX-10M6S2) immediately before completion
 * and replacement, from `personnelId`.
 */

/** What the Workspace needs to display and choose a signatory. Nothing more. */
export interface WorkspacePersonnelEntry {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial?: string | null;
  credentials: string;
  prcLicenseNumber: string;
  role: PersonnelRole;
  isActive: boolean;
  /** Server-derived. Lets the Workspace indicate signature availability without the reference. */
  hasSignature: boolean;
}

/**
 * One operator selection, as submitted.
 *
 * This is the inbound shape only. It deliberately cannot express a signature reference, which
 * is what makes a forged or stale client value unrepresentable rather than merely rejected.
 */
export interface WorkspaceSignatorySelection {
  personnelId: string;
  role: PersonnelRole;
  printedFullName: string;
  printedCredentials: string;
  printedPrcLicenseNumber: string;
  displayOrder: number;
}

/**
 * The render-only signature channel for draft authoring.
 *
 * A map from personnel id to an **opaque authenticated endpoint address**, derived in the browser
 * from `WorkspacePersonnelEntry.id` alone. It is deliberately NOT part of any server response.
 *
 * The earlier design had the server send this map, with each value being the personnel record's
 * stored `signatureImageUrl` - which is `/api/signatures/proxy?path=<storage object path>`. That
 * shipped the storage path to the browser, which is exactly the value this whole boundary exists
 * to keep server-side. Withholding `signatureImageUrl` from the DTO while sending the same string
 * under another name conceded the boundary and only renamed the leak.
 *
 * Now the client composes `/api/signatures/proxy?personnelId=<id>` from an id it already
 * legitimately holds. The address names *who*, never *where*; the route resolves the object path
 * server-side and returns bytes. Forging an entry buys nothing - the route re-authorizes every
 * request and only serves an active signature-eligible signatory - a Pathologist or a Medical
 * Technologist - who actually has a signature on file.
 *
 * Draft path only. Completed reports render from their own frozen `completedSnapshot`, which this
 * map never touches, so history keeps the signature current at its own completion.
 */
export type WorkspaceSignatureAssetMap = Readonly<Record<string, string>>;

/** What the Workspace server render and its client fallback both fetch. */
export interface WorkspacePersonnelDirectory {
  personnel: WorkspacePersonnelEntry[];
}
