import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";

export const SCRYPT_PARAMETERS = {
  N: 32768,
  r: 8,
  p: 1,
  keylen: 32,
  saltLength: 16,
  maxmem: 64 * 1024 * 1024,
} as const;

export function normalizeSecurityAnswer(input: string): string {
  return input.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

async function deriveKey(input: string, salt: Buffer, parameters = SCRYPT_PARAMETERS): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(input, salt, parameters.keylen, {
      N: parameters.N,
      r: parameters.r,
      p: parameters.p,
      maxmem: parameters.maxmem,
    }, (error, derived) => {
      if (error) reject(error);
      else resolve(Buffer.from(derived));
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  return hashScryptValue(password);
}

export async function hashSecurityAnswer(answer: string): Promise<string> {
  return hashScryptValue(normalizeSecurityAnswer(answer));
}

async function hashScryptValue(value: string): Promise<string> {
  const salt = randomBytes(SCRYPT_PARAMETERS.saltLength);
  const hash = await deriveKey(value, salt);
  return [
    "scrypt",
    SCRYPT_PARAMETERS.N,
    SCRYPT_PARAMETERS.r,
    SCRYPT_PARAMETERS.p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  return verifyScryptValue(password, encodedHash);
}

export async function verifySecurityAnswer(answer: string, encodedHash: string): Promise<boolean> {
  return verifyScryptValue(normalizeSecurityAnswer(answer), encodedHash);
}

async function verifyScryptValue(value: string, encodedHash: string): Promise<boolean> {
  try {
    const parts = encodedHash.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;

    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (
      N !== SCRYPT_PARAMETERS.N ||
      r !== SCRYPT_PARAMETERS.r ||
      p !== SCRYPT_PARAMETERS.p
    ) {
      return false;
    }

    const salt = Buffer.from(parts[4], "base64");
    const storedHash = Buffer.from(parts[5], "base64");
    if (
      salt.length !== SCRYPT_PARAMETERS.saltLength ||
      storedHash.length !== SCRYPT_PARAMETERS.keylen ||
      parts[4] !== salt.toString("base64") ||
      parts[5] !== storedHash.toString("base64")
    ) {
      return false;
    }

    const candidateHash = await deriveKey(value, salt);
    return candidateHash.length === storedHash.length && timingSafeEqual(candidateHash, storedHash);
  } catch {
    return false;
  }
}
