import "server-only";

import { z } from "zod";
import { assertNoOwnershipFields } from "@/features/server-boundary/action-inputs";
import type { AuditReadCriteria } from "@/services/audit-read-service";

const auditReadInputSchema = z
  .object({
    category: z.enum([
      "ALL",
      "AuthAccount",
      "PersonnelCredential",
      "SessionReport",
      "SecurityDenial",
    ]),
    eventType: z.string().trim().min(1).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    search: z.string().trim().optional(),
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().min(0),
  })
  .strict();

export function parseAuditReadInput(input: unknown): AuditReadCriteria {
  assertNoOwnershipFields(input);
  return auditReadInputSchema.parse(input);
}
