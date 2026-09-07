import { NextRequest, NextResponse } from "next/server";
import "server-only";

import { resolveAuthenticatedRequest } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "groq/compound-mini";

const MAX_HISTORY_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 8000;
const RATE_LIMIT: { readonly max: number; readonly windowMs: number } = {
  max: 30,
  windowMs: 60_000,
};
const UPSTREAM_TIMEOUT_MS = 60_000;

/**
 * The assistant's standing instructions. The role is fixed here and never supplied by the
 * client, so a caller cannot impersonate a system prompt, and neither "system" nor "tool"
 * roles are accepted as incoming history.
 */
const SYSTEM_PROMPT = [
  "You are the St. Rose Diagnostic Laboratory support assistant for their laboratory result",
  "management system (report encoding, clinical validation, signing, printing and the 30-day",
  "completed-report history).",
  "Be concise, practical and specific to this system.",
  "You help staff use the software. You are not a medical professional: never interpret a",
  "patient's results, never offer clinical advice, and never claim to know a patient's details.",
  "Never ask for patient names, identifiers, results or any other clinical data. If clinical",
  "data appears in a message, decline to use it and remind the user to keep it out of chat.",
  "Write in plain, direct prose suitable for a chat bubble.",
  "Use short paragraphs and short bullet lists when listing items.",
  "Never use Markdown headings, tables, or code fences.",
  "Never surround text with double asterisks for bold.",
].join(" ");

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
};

function isIncomingMessage(value: unknown): value is IncomingMessage {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.role === "user" || record.role === "assistant") &&
    typeof record.content === "string" &&
    record.content.trim().length > 0 &&
    record.content.length <= MAX_MESSAGE_LENGTH
  );
}

/**
 * A soft, in-process guard against runaway calls so one user cannot burn the shared Groq
 * budget. This is NOT a security control: it is best-effort within a single server instance
 * and is reset whenever the process restarts. The real abuse ceiling is the authenticated
 * bearer required to reach the route at all.
 */
const chatRateBuckets = new Map<string, number[]>();

function assertRateAllowed(userId: string): void {
  const now = Date.now();
  const bucket = chatRateBuckets.get(userId) ?? [];
  const within = bucket.filter((at) => now - at < RATE_LIMIT.windowMs);
  if (within.length >= RATE_LIMIT.max) {
    chatRateBuckets.set(userId, within);
    throw new Error("RATE_LIMITED");
  }
  within.push(now);
  chatRateBuckets.set(userId, within);
}

/**
 * Forward the client's message history to Groq and re-encode the upstream SSE as a
 * source-to-client stream of newline-delimited JSON lines:
 *
 *   {"text":"..."}      incremental assistant token
 *   {"done":true}       upstream stream reached its end
 *   {"error":"..."}     upstream or transport failure mid-stream
 *
 * The response is never stored and never cached. The client holds nothing that could be
 * replayed against the Groq account beyond the history it supplied itself.
 */
export async function POST(request: NextRequest) {
  const resolved = await resolveAuthenticatedRequest();
  const session = resolved?.session ?? null;
  const profile = resolved?.user ?? null;

  if (!session) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 403 });
  }
  if (session.mustChangePassword || session.mustSetRecovery) {
    return NextResponse.json(
      { error: "First-login account setup must be completed." },
      { status: 403 }
    );
  }
  if (!profile || profile.status !== "Active") {
    return NextResponse.json({ error: "Authentication is required." }, { status: 403 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chat support is not configured by the administrator." },
      { status: 503 }
    );
  }

  let body: { messages?: unknown };
  try {
    body = (await request.json()) as { messages?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const incoming = body.messages;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ error: "Message history is required." }, { status: 400 });
  }
  const history = incoming
    .filter(isIncomingMessage)
    .slice(-MAX_HISTORY_MESSAGES);
  if (history.length === 0) {
    return NextResponse.json({ error: "Invalid message history." }, { status: 400 });
  }

  try {
    assertRateAllowed(profile.id);
  } catch {
    return NextResponse.json(
      { error: "Too many messages at once. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

  let upstream: Response;
  try {
    upstream = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
        stream: true,
        temperature: 0.3,
        max_completion_tokens: 768,
        user: profile.id,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    console.error("[api/chat] Upstream request failed:", err);
    return new Response(
      toNdjson({ error: "The assistant service could not be reached. Please try again." }),
      { headers: NDJSON_HEADERS }
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(
      `[api/chat] Groq rejected the request (${upstream.status}):`,
      detail.slice(0, 500)
    );
    return new Response(
      toNdjson({ error: "The assistant service could not be reached. Please try again." }),
      { headers: NDJSON_HEADERS }
    );
  }

  const upstreamBody = upstream.body;
  if (!upstreamBody) {
    return new Response(
      toNdjson({ error: "The assistant service returned an empty response." }),
      { headers: NDJSON_HEADERS }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstreamBody.getReader();

  const bodyStream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const chunk = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string | null } }>;
              };
              const delta = chunk.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                controller.enqueue(encoder.encode(toNdjson({ text: delta })));
              }
            } catch {
              // Non-JSON keep-alive line; skip.
            }
          }
        }
        controller.enqueue(encoder.encode(toNdjson({ done: true })));
      } catch (err: unknown) {
        console.error("[api/chat] Stream read failed:", err);
        try {
          controller.enqueue(
            encoder.encode(
              toNdjson({ error: "The assistant response was interrupted. Please try again." })
            )
          );
        } catch {
          // The client has already gone; nothing left to say.
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // Lock already gone.
        }
        try {
          controller.close();
        } catch {
          // Already cancelled by the client.
        }
      }
    },
    cancel() {
      try {
        reader.cancel();
      } catch {
        // The upstream reader is already closed.
      }
    },
  });

  return new Response(bodyStream, { headers: NDJSON_HEADERS });
}

const NDJSON_HEADERS: HeadersInit = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
};

function toNdjson(payload: Record<string, unknown>): string {
  return `${JSON.stringify(payload)}\n`;
}