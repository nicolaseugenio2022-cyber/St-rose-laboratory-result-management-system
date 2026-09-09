"use server";

import "server-only";

import { z } from "zod";
import { requirePersonnelAdmin } from "@/lib/personnel-guard";
import { SupabasePersonnelRepository } from "@/repositories/supabase-personnel-repository";
import { auditService } from "@/services/audit-service-instance";
import {
  generateSignatureObjectPath,
  uploadSignatureObject,
  buildSignatureProxyUrl,
  SignatureValidationError,
  SignatureStorageError,
} from "@/lib/signature-storage";

const uploadPersonnelSignatureSchema = z
  .object({
    personnelId: z.string().uuid("Invalid personnel identifier."),
    fileBase64: z.string().min(1, "File data is required."),
    fileName: z.string().min(1, "File name is required."),
  })
  .strict();

export type UploadPersonnelSignatureInput = z.infer<
  typeof uploadPersonnelSignatureSchema
>;

export type SignatureActionResult =
  | { success: true; hasSignature: boolean }
  | { success: false; error: string };

export async function uploadPersonnelSignatureAction(
  input: unknown
): Promise<SignatureActionResult> {
  const caller = await requirePersonnelAdmin();
  const parsed = uploadPersonnelSignatureSchema.parse(input);

  const repository = new SupabasePersonnelRepository();
  const personnel = await repository.findById(parsed.personnelId);
  if (!personnel) {
    return { success: false, error: "Personnel record was not found." };
  }
  if (
    personnel.role !== "Pathologist" &&
    personnel.role !== "MedicalTechnologist"
  ) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "PersonnelDirectoryAccessDenied",
      actorRole: caller.role,
      targetRole: null,
      performedByUserId: caller.userId,
      performedByUsername: caller.username,
      targetReference: `${personnel.firstName} ${personnel.lastName}`,
      details: { reasonCode: "role_not_authorized", personnelRole: personnel.role },
    });
    return {
      success: false,
      error:
        "Signatures are only supported for Pathologists and Medical Technologists.",
    };
  }

  const pngBuffer = Buffer.from(parsed.fileBase64, "base64");

  let objectPath: string;
  try {
    objectPath = generateSignatureObjectPath(personnel.id);
    await uploadSignatureObject(objectPath, pngBuffer);
  } catch (error: unknown) {
    if (error instanceof SignatureValidationError) {
      return { success: false, error: error.message };
    }
    console.error("[personnel-signature] upload storage/validation failure:", error);
    return {
      success: false,
      error: "Failed to upload signature. Please try again.",
    };
  }

  const previousObjectPath = personnel.signatureImageUrl
    ? extractObjectPathFromProxyUrl(personnel.signatureImageUrl)
    : null;

  const proxyUrl = buildSignatureProxyUrl(objectPath);

  // Final role recheck immediately before the write to narrow TOCTOU window.
  // Without an explicit transaction this cannot eliminate the race, but it
  // prevents the most likely interleaving (Admin changes role between the
  // initial check and the update).
  const currentPersonnel = await repository.findById(parsed.personnelId);
  if (
    !currentPersonnel ||
    (currentPersonnel.role !== "Pathologist" &&
      currentPersonnel.role !== "MedicalTechnologist")
  ) {
    return {
      success: false,
      error:
        "Personnel role has changed. Signatures are only supported for Pathologists and Medical Technologists.",
    };
  }

  await repository.update(personnel.id, { signatureImageUrl: proxyUrl });

  const details: Record<string, unknown> = {
    personnelId: personnel.id,
    personnelRole: personnel.role,
    objectPath,
  };
  if (previousObjectPath) {
    details.previousObjectPath = previousObjectPath;
  }

  await auditService.emit({
    category: "PersonnelCredential",
    eventType: previousObjectPath
      ? "PersonnelSignatureReplaced"
      : "PersonnelSignatureUploaded",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: `${personnel.firstName} ${personnel.lastName}`,
    details,
  });

  // The proxy URL is persisted and remains the render-time source; it is deliberately not
  // returned. The client only needs to know that a signature now exists.
  return { success: true, hasSignature: true };
}

export async function removePersonnelSignatureAction(
  input: unknown
): Promise<SignatureActionResult> {
  const caller = await requirePersonnelAdmin();
  const parsed = z
    .object({
      personnelId: z.string().uuid("Invalid personnel identifier."),
    })
    .strict()
    .parse(input);

  const repository = new SupabasePersonnelRepository();
  const personnel = await repository.findById(parsed.personnelId);
  if (!personnel) {
    return { success: false, error: "Personnel record was not found." };
  }

  if (!personnel.signatureImageUrl) {
    return { success: false, error: "No signature image to remove." };
  }

  const previousObjectPath = extractObjectPathFromProxyUrl(
    personnel.signatureImageUrl
  );

  await repository.update(personnel.id, { signatureImageUrl: null });

  await auditService.emit({
    category: "PersonnelCredential",
    eventType: "PersonnelSignatureRemoved",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: `${personnel.firstName} ${personnel.lastName}`,
    details: {
      personnelId: personnel.id,
      personnelRole: personnel.role,
      previousObjectPath,
    },
  });

  return { success: true, hasSignature: false };
}

function extractObjectPathFromProxyUrl(proxyUrl: string): string | null {
  try {
    const url = new URL(proxyUrl, "http://localhost");
    const path = url.searchParams.get("path");
    return path && path.startsWith("personnel/") ? path : null;
  } catch {
    return null;
  }
}
