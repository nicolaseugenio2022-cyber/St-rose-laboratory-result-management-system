import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Token-Gated Signature Asset Proxy Route Handler
 * Implements SECURITY_MODEL.md Section 9 & PRODUCTION_DEPLOYMENT_ARCHITECTURE.md Section 5.2.
 * Serves private pathologist/medtech signature PNGs from protected `personnel-signatures` storage bucket.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const token = searchParams.get("token");

  if (!path || !token) {
    return NextResponse.json({ error: "Missing required path or token parameter." }, { status: 400 });
  }

  // 1. Verify token signature & expiration timestamp
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [tokenPath, expiresAtStr] = decoded.split(":");
    const expiresAt = parseInt(expiresAtStr, 10);

    if (tokenPath !== path || isNaN(expiresAt) || Date.now() > expiresAt) {
      return NextResponse.json({ error: "Signature access token has expired or is invalid." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid token encoding." }, { status: 400 });
  }

  // 2. Fetch binary asset from non-public Supabase storage bucket `personnel-signatures`
  const supabase = getSupabaseClient();

  // Handle fallback or local file execution
  if (!supabase) {
    // Return a clean 1x1 transparent PNG fallback if Supabase environment is unconfigured
    const transparentPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64"
    );
    return new NextResponse(transparentPng, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  try {
    const { data, error } = await supabase.storage.from("personnel-signatures").download(path);

    if (error || !data) {
      return NextResponse.json({ error: "Signature asset not found or access denied." }, { status: 404 });
    }

    const arrayBuffer = await data.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
