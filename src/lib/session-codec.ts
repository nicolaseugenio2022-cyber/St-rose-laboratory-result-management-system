export type SessionPayload = {
  userId: string;
  tokenVersion: number;
  mustChangePassword: boolean;
  mustSetRecovery: boolean;
  rememberMe: boolean;
  expiresAt: string;
};

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

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<SessionPayload>;
  return (
    typeof payload.userId === "string" &&
    Number.isInteger(payload.tokenVersion) &&
    typeof payload.mustChangePassword === "boolean" &&
    typeof payload.mustSetRecovery === "boolean" &&
    typeof payload.rememberMe === "boolean" &&
    typeof payload.expiresAt === "string"
  );
}

export async function encryptSessionToken(payload: SessionPayload): Promise<string> {
  const encodedPayload = btoa(encodeURIComponent(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getCryptoKey(),
    new TextEncoder().encode(encodedPayload)
  );
  return `${encodedPayload}.${bufferToHex(signature)}`;
}

export async function decryptSessionToken(token: string | undefined = ""): Promise<SessionPayload | null> {
  getSessionSecret();
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encodedPayload, signatureHex] = parts;
    const signature = hexToBuffer(signatureHex);
    if (!encodedPayload || !signature) return null;

    const valid = await crypto.subtle.verify(
      "HMAC",
      await getCryptoKey(),
      signature,
      new TextEncoder().encode(encodedPayload)
    );
    if (!valid) return null;

    const payload = JSON.parse(decodeURIComponent(atob(encodedPayload))) as unknown;
    if (!isSessionPayload(payload)) return null;
    if (new Date(payload.expiresAt).getTime() < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
