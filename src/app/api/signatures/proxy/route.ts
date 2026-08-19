import { NextRequest, NextResponse } from "next/server";
import "server-only";

import { getSession } from "@/lib/session";
import { userService } from "@/services/user-service-instance";
import { supabaseServer } from "@/lib/supabase/server";
import { SYSTEM_CONSTANTS } from "@/lib/constants";
import { isValidSignatureObjectPath } from "@/lib/signature-storage";
import { auditService } from "@/services/audit-service-instance";
import { SupabasePersonnelRepository } from "@/repositories/supabase-personnel-repository";

export const dynamic = "force-dynamic";

type DenialReason =
  | "unauthenticated"
  | "first_login_incomplete"
  | "account_inactive"
  | "role_not_authorized"
  | "malformed_path"
  | "path_not_referenced";

async function emitDenial(reason: DenialReason, session?: { userId: string } | null): Promise<void> {
  const profile = session ? await userService.getUserById(session.userId) : null;
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing required path parameter." }, { status: 400 });
  }

  const session = await getSession();
  if (!session) {
    await emitDenial("unauthenticated");
    return NextResponse.json({ error: "Authentication is required." }, { status: 403 });
  }

  if (session.mustChangePassword || session.mustSetRecovery) {
    await emitDenial("first_login_incomplete", session);
    return NextResponse.json(
      { error: "First-login account setup must be completed." },
      { status: 403 }
    );
  }

  const profile = await userService.getUserById(session.userId);
  if (!profile || profile.status !== "Active") {
    await emitDenial(profile ? "account_inactive" : "unauthenticated", session);
    return NextResponse.json({ error: "Authentication is required." }, { status: 403 });
  }

  if (profile.role !== "Admin" && profile.role !== "User") {
    await emitDenial("role_not_authorized", session);
    return NextResponse.json(
      { error: "This role is not authorized to access signature assets." },
      { status: 403 }
    );
  }

  if (!isValidSignatureObjectPath(path)) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "SignatureAssetAccessDenied",
      actorRole: profile.role,
      targetRole: null,
      performedByUserId: profile.id,
      performedByUsername: profile.username,
      details: { reasonCode: "malformed_path" },
    });
    return NextResponse.json({ error: "Invalid signature path." }, { status: 403 });
  }

  const proxyUrl = `/api/signatures/proxy?path=${encodeURIComponent(path)}`;

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
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "SignatureAssetAccessDenied",
      actorRole: profile.role,
      targetRole: null,
      performedByUserId: profile.id,
      performedByUsername: profile.username,
      details: { reasonCode: "path_not_referenced" },
    });
    return NextResponse.json({ error: "Signature asset not found." }, { status: 404 });
  }

  try {
    const { data, error } = await supabaseServer.storage
      .from(SYSTEM_CONSTANTS.STORAGE_BUCKETS.PERSONNEL_SIGNATURES)
      .download(path);

    if (error || !data) {
      return NextResponse.json({ error: "Signature asset not found." }, { status: 404 });
    }

    const arrayBuffer = await data.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err: unknown) {
    console.error("[signatures/proxy] Storage download failed:", err);
    return NextResponse.json({ error: "Failed to retrieve signature asset." }, { status: 500 });
  }
}
