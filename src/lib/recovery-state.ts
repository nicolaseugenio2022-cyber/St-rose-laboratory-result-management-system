import "server-only";

import { cookies } from "next/headers";

const RECOVERY_COOKIE_NAME = "recovery_state";
const RECOVERY_STATE_TTL_MS = 10 * 60 * 1000;

export type RecoveryStage = "answer" | "reset";

export type RecoveryStatePayload = {
  purpose: "recovery";
  userId: string;
  stage: RecoveryStage;
  tokenVersionAtIssue: number;
  issuedAt: string;
  expiresAt: string;
};

export type RecoveryStateIssue = Pick<
  RecoveryStatePayload,
  "userId" | "stage" | "tokenVersionAtIssue"
>;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required before the application can start.");
  }
  return secret;
}

async function getCryptoKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): ArrayBuffer | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes.buffer;
}

function isRecoveryStatePayload(value: unknown): value is RecoveryStatePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<RecoveryStatePayload>;
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    "expiresAt",
    "issuedAt",
    "purpose",
    "stage",
    "tokenVersionAtIssue",
    "userId",
  ];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) return false;

  return (
    payload.purpose === "recovery" &&
    typeof payload.userId === "string" &&
    payload.userId.length > 0 &&
    (payload.stage === "answer" || payload.stage === "reset") &&
    Number.isInteger(payload.tokenVersionAtIssue) &&
    typeof payload.issuedAt === "string" &&
    typeof payload.expiresAt === "string"
  );
}

function hasValidLifetime(payload: RecoveryStatePayload): boolean {
  const issuedAt = new Date(payload.issuedAt).getTime();
  const expiresAt = new Date(payload.expiresAt).getTime();
  const now = Date.now();
  return (
    Number.isFinite(issuedAt) &&
    Number.isFinite(expiresAt) &&
    issuedAt <= now &&
    expiresAt > now &&
    expiresAt - issuedAt === RECOVERY_STATE_TTL_MS
  );
}

async function signPayload(encodedPayload: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getCryptoKey(),
    new TextEncoder().encode(encodedPayload)
  );
  return `${encodedPayload}.${bufferToHex(signature)}`;
}

export async function issueRecoveryState(issue: RecoveryStateIssue): Promise<void> {
  const issuedAt = Date.now();
  const payload: RecoveryStatePayload = {
    purpose: "recovery",
    userId: issue.userId,
    stage: issue.stage,
    tokenVersionAtIssue: issue.tokenVersionAtIssue,
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(issuedAt + RECOVERY_STATE_TTL_MS).toISOString(),
  };
  const encodedPayload = btoa(encodeURIComponent(JSON.stringify(payload)));
  const token = await signPayload(encodedPayload);
  const cookieStore = await cookies();
  cookieStore.set(RECOVERY_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function readRecoveryState(): Promise<RecoveryStatePayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(RECOVERY_COOKIE_NAME)?.value;
  if (!token) return null;
  getSessionSecret();

  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encodedPayload, signatureHex] = parts;
    const signature = hexToBuffer(signatureHex);
    if (!encodedPayload || !signature) return null;

    const validSignature = await crypto.subtle.verify(
      "HMAC",
      await getCryptoKey(),
      signature,
      new TextEncoder().encode(encodedPayload)
    );
    if (!validSignature) return null;

    const payload = JSON.parse(decodeURIComponent(atob(encodedPayload))) as unknown;
    if (!isRecoveryStatePayload(payload) || !hasValidLifetime(payload)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function clearRecoveryState(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({ name: RECOVERY_COOKIE_NAME, path: "/" });
}
