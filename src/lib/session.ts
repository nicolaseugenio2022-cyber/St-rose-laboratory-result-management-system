import { cookies } from "next/headers";

const secretKeyStr = process.env.SESSION_SECRET || "default_secret_key_for_development_only_1234567890";

async function getCryptoKey() {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKeyStr),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string) {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

export type SessionPayload = {
  userId: string;
  expiresAt: string;
};

export async function encrypt(payload: SessionPayload): Promise<string> {
  const key = await getCryptoKey();
  const payloadStr = JSON.stringify(payload);
  
  // Use built-in btoa for base64 encoding the payload
  const encodedPayload = btoa(encodeURIComponent(payloadStr));
  
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload)
  );
  
  const signatureHex = bufferToHex(signatureBuffer);
  return `${encodedPayload}.${signatureHex}`;
}

export async function decrypt(token: string | undefined = ""): Promise<SessionPayload | null> {
  if (!token) return null;
  
  try {
    const [encodedPayload, signatureHex] = token.split(".");
    if (!encodedPayload || !signatureHex) return null;
    
    const key = await getCryptoKey();
    const signatureBuffer = hexToBuffer(signatureHex);
    
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      new TextEncoder().encode(encodedPayload)
    );
    
    if (!isValid) return null;
    
    const payloadStr = decodeURIComponent(atob(encodedPayload));
    const payload = JSON.parse(payloadStr) as SessionPayload;
    
    if (new Date(payload.expiresAt).getTime() < Date.now()) {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}

export async function createSession(userId: string, rememberMe: boolean = false) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const sessionToken = await encrypt({ 
    userId, 
    expiresAt: expiresAt.toISOString() 
  });

  const cookieStore = await cookies();
  const cookieOptions: any = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
  
  if (rememberMe) {
    cookieOptions.expires = expiresAt;
  }
  
  cookieStore.set("session_token", sessionToken, cookieOptions);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session_token");
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session_token")?.value;
  return await decrypt(session);
}
