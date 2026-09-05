import { NextRequest, NextResponse } from "next/server";
import "server-only";

import { resolveAuthenticatedRequest } from "@/lib/session";
import type { User } from "@/types/user";
import { supabaseServer } from "@/lib/supabase/server";
import { SYSTEM_CONSTANTS } from "@/lib/constants";
import { isValidSignatureObjectPath } from "@/lib/signature-storage";
import { auditService } from "@/services/audit-service-instance";
import { SupabasePersonnelRepository } from "@/repositories/supabase-personnel-repository";

export const dynamic = "force-dynamic";

/**
 * Three ways to name a signature object, for three different callers. None of them lets the
 * browser hold a storage object path.
 *
 * `?path=` is the historical address, kept for completed snapshots that already froze the stored
 * proxy URL. It still validates the supplied path against what personnel or `report_signatories`
 * actually reference, so it cannot be used to fish for arbitrary objects.
 *
 * `?personnelId=` is draft authoring. It resolves the person's CURRENT signature, because a draft
 * is authored against personnel as they are now. Mutable, so it is never cached.
 *
 * `?reportId=&personnelId=` resolves a completed report's own signatory row. Current personnel is
 * not consulted, but Replacement Mode deletes and recreates that row while retaining the report
 * id, so the address is mutable and must never be cached.
 *
 * The last two exist so the client can be handed an address built from identifiers it already
 * legitimately holds. The address names *who* and *which report*, never *where*.
 */
type DenialReason =
  | "unauthenticated"
  | "first_login_incomplete"
  | "account_inactive"
  | "role_not_authorized"
  | "malformed_path"
  | "path_not_referenced";

/**
 * SHADCN-07C1-R1: the resolved profile is PASSED IN, never looked up here.
 *
 * This helper used to resolve the caller itself, so every denial cost another user read on top of
 * the request's own resolution. It now mirrors `emitAssetDenial` below, which already took the
 * profile as a parameter. The emitted fields are unchanged - the caller hands over the same row
 * the authorization checks used, so actorRole and performedByUsername are exactly what they were.
 */
async function emitDenial(
  reason: DenialReason,
  session?: { userId: string } | null,
  profile?: Pick<User, "role" | "username"> | null
): Promise<void> {
  await auditService.emit({
    category: "SecurityDenial",
    eventType: "SignatureAssetAccessDenied",
    actorRole: profile?.role ?? null,
    targetRole: null,
    performedByUserId: session?.userId ?? null,
    performedByUsername: profile?.username ?? null,
    details: { reasonCode: reason },
  });
}

/**
 * Read the object path out of a stored proxy URL.
 *
 * Mirrors `extractObjectPathFromProxyUrl` in `personnel-signature-actions.ts` - the same parse of
 * the same stored string. The result is still run through `isValidSignatureObjectPath` below, so
 * a malformed or tampered stored value cannot reach storage.
 */
function objectPathFromStoredUrl(storedUrl: string): string | null {
  try {
    const url = new URL(storedUrl, "http://localhost");
    const path = url.searchParams.get("path");
    return path && path.startsWith("personnel/") ? path : null;
  } catch {
    return null;
  }
}

/**
 * How long a response may be reused - decided by WHAT the address names, not by whether the
 * record behind it is called "frozen".
 *
 * `objectAddress` (`?path=`) names one storage object directly. An object is never rewritten in
 * place, so the bytes behind that address cannot change and it keeps the five-minute window.
 *
 * `identifierAddress` (`?personnelId=`, and `?reportId=&personnelId=`) names a RECORD, and the
 * object a record points at can change under a stable address:
 *   - `personnelId` follows a person, whose signature is replaced or withdrawn at will;
 *   - `reportId + personnelId` follows a `report_signatories` row, and Replacement Mode DELETES
 *     and re-inserts those rows for the session's reports while the report ids survive. This mode
 *     was previously treated as immutable on the belief that the row is "written at completion and
 *     never rewritten" - which replacement disproves. A re-issued report could therefore serve the
 *     pre-replacement signature bytes for up to five minutes, and a cacheable 404 could outlive a
 *     signature that had since been added.
 * Neither may be cached.
 *
 * `private` in every case: a shared laboratory workstation must never leave a colleague's
 * signature in a shared proxy cache.
 */
type SignatureCachePolicy = "objectAddress" | "identifierAddress";

const CACHE_CONTROL: Record<SignatureCachePolicy, string> = {
  objectAddress: "private, max-age=300",
  identifierAddress: "private, no-store",
};

/**
 * Both identifier modes address `uuid` columns. An identifier that is not a UUID reaches Postgres
 * as a cast error, which threw out of the handler as a framework 500 - no `no-store`, no denial
 * event, and distinguishable from the uniform 404 every other miss returns. Rejecting the shape
 * before any database call keeps that promise and keeps the audit trail complete.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A JSON response carrying an explicit cache directive.
 *
 * `cachePolicy` is optional because the object-addressed mode deliberately keeps the header-less
 * error responses it has always returned - changing those would alter frozen behaviour. Both
 * identifier-addressed modes pass it on EVERY outcome: an address that names a record must not
 * leave a cached 404 behind either, or a signature added a moment later keeps reading as absent.
 */
function signatureJson(
  body: Record<string, unknown>,
  status: number,
  cachePolicy?: SignatureCachePolicy
): NextResponse {
  return NextResponse.json(
    body,
    cachePolicy
      ? { status, headers: { "Cache-Control": CACHE_CONTROL[cachePolicy] } }
      : { status }
  );
}

/** What a storage read can produce, so each mode can audit and shape its own response. */
type SignatureObjectResult =
  | { ok: true; bytes: ArrayBuffer }
  | { ok: false; reason: "missing" | "error" };

/**
 * Read the object.
 *
 * Returns a result rather than a response so the caller decides the cache directive and whether
 * the miss is auditable - the two things that differ between an immutable and a mutable address.
 */
async function loadSignatureObject(objectPath: string): Promise<SignatureObjectResult> {
  try {
    const { data, error } = await supabaseServer.storage
      .from(SYSTEM_CONSTANTS.STORAGE_BUCKETS.PERSONNEL_SIGNATURES)
      .download(objectPath);

    if (error || !data) return { ok: false, reason: "missing" };
    return { ok: true, bytes: await data.arrayBuffer() };
  } catch (err: unknown) {
    console.error("[signatures/proxy] Storage download failed:", err);
    return { ok: false, reason: "error" };
  }
}

/**
 * Stream the object, or shape the failure.
 *
 * Shared by every mode so the download and the content type cannot drift apart.
 */
async function streamSignatureObject(
  objectPath: string,
  cachePolicy: SignatureCachePolicy
): Promise<NextResponse> {
  const result = await loadSignatureObject(objectPath);
  // The object-addressed mode keeps its historical header-less error responses; both
  // identifier-addressed modes stamp no-store on every outcome.
  const errorCache = cachePolicy === "identifierAddress" ? cachePolicy : undefined;

  if (!result.ok) {
    return result.reason === "missing"
      ? signatureJson({ error: "Signature asset not found." }, 404, errorCache)
      : signatureJson({ error: "Failed to retrieve signature asset." }, 500, errorCache);
  }

  return new NextResponse(result.bytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": CACHE_CONTROL[cachePolicy],
    },
  });
}

/**
 * Denial for a caller already resolved to an Active profile.
 *
 * Same category, event type, actor derivation and `details` shape the route already emitted
 * inline in three places - collected so a fourth call site cannot drift from the other three.
 * Actor identity comes from the persisted profile, never from request input.
 */
async function emitAssetDenial(
  profile: { id: string; role: string; username: string },
  reason: DenialReason
): Promise<void> {
  await auditService.emit({
    category: "SecurityDenial",
    eventType: "SignatureAssetAccessDenied",
    actorRole: profile.role as never,
    targetRole: null,
    performedByUserId: profile.id,
    performedByUsername: profile.username,
    details: { reasonCode: reason },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const personnelId = searchParams.get("personnelId");
  const reportId = searchParams.get("reportId");

  // Exactly one addressing mode per request.
  //   path                    - a completed snapshot's own frozen URL (historical, unchanged)
  //   personnelId             - draft authoring; resolves the CURRENT signature
  //   reportId + personnelId  - a completed report's FROZEN signatory row
  const mode =
    path && !personnelId && !reportId
      ? "path"
      : personnelId && reportId && !path
        ? "frozen"
        : personnelId && !reportId && !path
          ? "current"
          : null;

  // Bound once here: narrowing `mode` says nothing about the params it was derived from.
  const frozenReportId = reportId ?? "";
  const subjectPersonnelId = personnelId ?? "";

  if (!mode) {
    // Refused rather than resolved by precedence: accepting a mixture would let a caller pair a
    // legitimate identifier with an arbitrary path and leave which one won to argument order.
    return NextResponse.json(
      { error: "Provide exactly one of path, personnelId, or reportId with personnelId." },
      { status: 400 }
    );
  }

  // ── Authorization: identical for both modes, and unchanged from the original route ─────────
  // SHADCN-07C1-R1: ONE resolution per request. React cache() is a per-render memo and is not a
  // dependable dedupe inside a Route Handler, so the earlier two-step session-then-profile pair
  // could genuinely read the user row twice. Resolving once removes the second read outright
  // instead of relying on a memo, and guarantees session and profile describe the same row.
  const resolved = await resolveAuthenticatedRequest();
  const session = resolved?.session ?? null;
  const profile = resolved?.user ?? null;
  if (!session) {
    await emitDenial("unauthenticated");
    return NextResponse.json({ error: "Authentication is required." }, { status: 403 });
  }

  if (session.mustChangePassword || session.mustSetRecovery) {
    await emitDenial("first_login_incomplete", session, profile);
    return NextResponse.json(
      { error: "First-login account setup must be completed." },
      { status: 403 }
    );
  }

  if (!profile || profile.status !== "Active") {
    await emitDenial(profile ? "account_inactive" : "unauthenticated", session, profile);
    return NextResponse.json({ error: "Authentication is required." }, { status: 403 });
  }

  if (profile.role !== "Admin" && profile.role !== "User") {
    await emitDenial("role_not_authorized", session, profile);
    return NextResponse.json(
      { error: "This role is not authorized to access signature assets." },
      { status: 403 }
    );
  }

  // ── Mode: reportId + personnelId. A completed report's own signatory row ──────────────────
  // Resolved from `report_signatories`, so current personnel is never consulted and changing a
  // Pathologist's signature today cannot alter what an already-issued report renders. The row is
  // NOT immutable, though: Replacement Mode deletes and re-inserts it while the report id
  // survives, so this address is never cached.
  if (mode === "frozen") {
    // Shape first, before any database call - see UUID_PATTERN.
    if (!UUID_PATTERN.test(frozenReportId) || !UUID_PATTERN.test(subjectPersonnelId)) {
      await emitAssetDenial(profile, "path_not_referenced");
      return signatureJson({ error: "Signature asset not found." }, 404, "identifierAddress");
    }

    const { data: frozenRow, error: frozenError } = await supabaseServer
      .from("report_signatories")
      .select("signature_image_url")
      .eq("report_id", frozenReportId)
      .eq("personnel_id", subjectPersonnelId)
      .limit(1)
      .maybeSingle();

    if (frozenError) {
      console.error("[signatures/proxy] frozen signatory query failed:", frozenError);
      return signatureJson(
        { error: "Failed to verify signature reference." },
        500,
        "identifierAddress"
      );
    }

    const frozenUrl = (frozenRow?.signature_image_url as string | null) || null;
    if (!frozenUrl) {
      // Uniform with every other miss, and audited for the same reason.
      await emitAssetDenial(profile, "path_not_referenced");
      return signatureJson({ error: "Signature asset not found." }, 404, "identifierAddress");
    }

    const frozenPath = objectPathFromStoredUrl(frozenUrl);
    if (!frozenPath || !isValidSignatureObjectPath(frozenPath)) {
      await emitAssetDenial(profile, "malformed_path");
      return signatureJson({ error: "Invalid signature path." }, 403, "identifierAddress");
    }

    return streamSignatureObject(frozenPath, "identifierAddress");
  }

  // ── Mode: personnelId. Draft authoring; the path is never supplied by the caller ───────────
  if (mode === "current") {
    // Shape first, before any repository call - see UUID_PATTERN. A malformed id is answered by
    // the same audited, uncacheable 404 as an unknown one, so the two are indistinguishable.
    if (!UUID_PATTERN.test(subjectPersonnelId)) {
      await emitAssetDenial(profile, "path_not_referenced");
      return signatureJson({ error: "Signature asset not found." }, 404, "identifierAddress");
    }

    const personnelRepo = new SupabasePersonnelRepository();
    const person = await personnelRepo.findById(subjectPersonnelId);

    // One response for every miss - unknown id, wrong role, inactive, no signature on file. A
    // distinct message per case would turn this endpoint into an oracle for which personnel
    // exist and which hold a signature.
    if (
      !person ||
      person.role !== "Pathologist" ||
      !person.isActive ||
      !person.signatureImageUrl
    ) {
      // One audited denial covering every miss - unknown id, wrong role, inactive, no signature
      // on file. The event is emitted BEFORE the response so an enumeration sweep leaves a trail,
      // and `path_not_referenced` is reused rather than a new reason code invented: the request
      // named an asset the caller is not entitled to receive, which is what that code already
      // means. The response stays uniform so the endpoint is not an oracle for which personnel
      // exist or which hold a signature.
      await emitAssetDenial(profile, "path_not_referenced");
      return signatureJson({ error: "Signature asset not found." }, 404, "identifierAddress");
    }

    const resolvedPath = objectPathFromStoredUrl(person.signatureImageUrl);
    if (!resolvedPath || !isValidSignatureObjectPath(resolvedPath)) {
      await emitAssetDenial(profile, "malformed_path");
      return signatureJson({ error: "Invalid signature path." }, 403, "identifierAddress");
    }

    // The record is valid and its reference well-formed, so a missing object is a real integrity
    // gap rather than a bad request - and it is indistinguishable, from outside, from an
    // unauthorised probe. It is audited under the existing `path_not_referenced` reason before
    // the same uniform 404 every other miss returns. No personnel, signature, storage or provider
    // detail crosses the boundary.
    const objectResult = await loadSignatureObject(resolvedPath);
    if (!objectResult.ok) {
      if (objectResult.reason === "missing") {
        await emitAssetDenial(profile, "path_not_referenced");
        return signatureJson({ error: "Signature asset not found." }, 404, "identifierAddress");
      }
      return signatureJson({ error: "Failed to retrieve signature asset." }, 500, "identifierAddress");
    }

    // The response body is image bytes. The resolved path and the stored URL stay on this side.
    // `mutable`: this address names a person, and their signature can be replaced at any time.
    return new NextResponse(objectResult.bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": CACHE_CONTROL.identifierAddress,
      },
    });
  }

  // ── Mode B: path. Completed snapshots; behaviour preserved exactly ─────────────────────────
  const requestedPath = path as string;

  if (!isValidSignatureObjectPath(requestedPath)) {
    await emitAssetDenial(profile, "malformed_path");
    return NextResponse.json({ error: "Invalid signature path." }, { status: 403 });
  }

  const proxyUrl = `/api/signatures/proxy?path=${encodeURIComponent(requestedPath)}`;

  const personnelRepo = new SupabasePersonnelRepository();
  const allPersonnel = await personnelRepo.findAll();
  const referencedByPersonnel = allPersonnel.some(
    (p) => p.signatureImageUrl === proxyUrl
  );

  let referencedByReport: boolean | null = null;
  if (!referencedByPersonnel) {
    try {
      const { data: signatoryMatch, error: signatoryError } = await supabaseServer
        .from("report_signatories")
        .select("signature_image_url")
        .eq("signature_image_url", proxyUrl)
        .limit(1);
      if (signatoryError) {
        console.error("[signatures/proxy] report_signatories query failed:", signatoryError);
        return NextResponse.json(
          { error: "Failed to verify signature reference." },
          { status: 500 }
        );
      }
      referencedByReport = !!signatoryMatch && signatoryMatch.length > 0;
    } catch (err: unknown) {
      console.error("[signatures/proxy] Unexpected report_signatories error:", err);
      return NextResponse.json(
        { error: "Failed to verify signature reference." },
        { status: 500 }
      );
    }
  }

  if (!referencedByPersonnel && !referencedByReport) {
    await emitAssetDenial(profile, "path_not_referenced");
    return NextResponse.json({ error: "Signature asset not found." }, { status: 404 });
  }

  // `immutable`: a path names one object that can never be replaced in place.
  return streamSignatureObject(requestedPath, "objectAddress");
}
