import "server-only";

import { randomUUID } from "node:crypto";
import { supabaseServer } from "@/lib/supabase/server";
import { SYSTEM_CONSTANTS } from "@/lib/constants";

const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024;

export class SignatureValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureValidationError";
  }
}

export class SignatureStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureStorageError";
  }
}

function validatePngMagicBytes(buffer: Buffer): void {
  if (buffer.length < PNG_MAGIC_BYTES.length) {
    throw new SignatureValidationError("File is too small to be a valid PNG image.");
  }
  const header = buffer.subarray(0, PNG_MAGIC_BYTES.length);
  if (!header.equals(PNG_MAGIC_BYTES)) {
    throw new SignatureValidationError("File is not a valid PNG image. Only PNG format is accepted.");
  }
}

function validateMaxSize(buffer: Buffer): void {
  if (buffer.length > MAX_SIGNATURE_SIZE_BYTES) {
    throw new SignatureValidationError(
      `File exceeds the maximum allowed size of ${MAX_SIGNATURE_SIZE_BYTES} bytes (2 MB).`
    );
  }
}

export function generateSignatureObjectPath(personnelUuid: string): string {
  const objectUuid = randomUUID();
  return `personnel/${personnelUuid}/${objectUuid}.png`;
}

export async function uploadSignatureObject(
  objectPath: string,
  pngBuffer: Buffer
): Promise<void> {
  validatePngMagicBytes(pngBuffer);
  validateMaxSize(pngBuffer);

  const { error } = await supabaseServer.storage
    .from(SYSTEM_CONSTANTS.STORAGE_BUCKETS.PERSONNEL_SIGNATURES)
    .upload(objectPath, pngBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (error) {
    throw new SignatureStorageError(
      `Failed to upload signature object: ${error.message}`
    );
  }
}

export function buildSignatureProxyUrl(objectPath: string): string {
  return `/api/signatures/proxy?path=${encodeURIComponent(objectPath)}`;
}

export const SIGNATURE_OBJECT_PATH_PATTERN =
  /^personnel\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;

export function isValidSignatureObjectPath(path: string): boolean {
  return SIGNATURE_OBJECT_PATH_PATTERN.test(path);
}
