import { z } from "zod";

export const PHYSICIAN_STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
] as const;

/** The name prints verbatim on a report, so it is trimmed and length-bounded, never reformatted. */
const physicianFullNameSchema = z
  .string()
  .trim()
  .min(1, "Physician name is required")
  .max(150, "Physician name cannot exceed 150 characters");

export const createPhysicianSchema = z
  .object({
    fullName: physicianFullNameSchema,
    isActive: z.boolean(),
  })
  .strict();

export const updatePhysicianSchema = z
  .object({
    id: z.string().uuid("Invalid physician identifier."),
    fullName: physicianFullNameSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const physicianStatusSchema = z
  .object({
    id: z.string().uuid("Invalid physician identifier."),
    isActive: z.boolean(),
  })
  .strict();

export type CreatePhysicianValues = z.infer<typeof createPhysicianSchema>;
export type UpdatePhysicianValues = z.infer<typeof updatePhysicianSchema>;
export type PhysicianStatusValues = z.infer<typeof physicianStatusSchema>;

/**
 * A `report_templates.template_code`, shaped only.
 *
 * Shape is all this layer can prove. Whether the code names a template that actually EXISTS is a
 * registry question, and it is answered server-side in the assignment action - never here, because
 * this module is imported by client components and pulling the report-definition registry in would
 * ship all seventeen definitions to the browser to validate a string.
 */
const templateCodeSchema = z
  .string()
  .trim()
  .min(1, "Examination code is required")
  .max(64, "Examination code cannot exceed 64 characters")
  .regex(/^[A-Z0-9_]+$/, "Invalid examination code.");

/**
 * The complete assignment set for ONE physician, replacing whatever that physician had before.
 *
 * `.strict()`, like every schema above it, so an unexpected client key is rejected rather than
 * carried. The two cross-field rules are stated here because they are pure - they need no database
 * read - and stating them in the schema means no caller can reach the repository having skipped
 * them:
 *
 *   1. A default must also be assigned. A physician who is the default for an examination they are
 *      not assigned to is a contradiction the UI could produce by unchecking the wrong box, and it
 *      would put a row in the table that the suggestion query can never offer.
 *   2. Neither list repeats. The database refuses a duplicate pair with a unique violation; being
 *      refused by a validator with a readable message is better than being refused by SQLSTATE.
 */
export const physicianAssignmentsSchema = z
  .object({
    id: z.string().uuid("Invalid physician identifier."),
    templateCodes: z.array(templateCodeSchema).max(64),
    defaultTemplateCodes: z.array(templateCodeSchema).max(64),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.templateCodes).size !== value.templateCodes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["templateCodes"],
        message: "An examination cannot be assigned twice.",
      });
    }
    if (new Set(value.defaultTemplateCodes).size !== value.defaultTemplateCodes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultTemplateCodes"],
        message: "An examination cannot be defaulted twice.",
      });
    }
    const assigned = new Set(value.templateCodes);
    for (const code of value.defaultTemplateCodes) {
      if (!assigned.has(code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["defaultTemplateCodes"],
          message: "A default examination must also be an assigned examination.",
        });
      }
    }
  });

export type PhysicianAssignmentsValues = z.infer<typeof physicianAssignmentsSchema>;

/**
 * ONE physician form save: the record and its complete examination-assignment set together.
 *
 * This is the shape the atomic save takes, and it is why it is a schema of its own rather than a
 * merge of the two above. `physicianAssignmentsSchema` keys on an id that a physician being
 * CREATED does not have yet - the identifier is produced by the transaction itself - so `id` is
 * nullable here and its absence is what distinguishes a create from an update. Nothing else
 * differs: the name rule, the code shape, the two cross-field rules and `.strict()` are the same
 * ones the separate schemas carry, and the database re-decides every one of them again inside
 * `save_physician_configuration`.
 */
export const physicianConfigurationSchema = z
  .object({
    id: z.string().uuid("Invalid physician identifier.").nullable(),
    fullName: physicianFullNameSchema,
    isActive: z.boolean(),
    templateCodes: z.array(templateCodeSchema).max(64),
    defaultTemplateCodes: z.array(templateCodeSchema).max(64),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.templateCodes).size !== value.templateCodes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["templateCodes"],
        message: "An examination cannot be assigned twice.",
      });
    }
    if (new Set(value.defaultTemplateCodes).size !== value.defaultTemplateCodes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultTemplateCodes"],
        message: "An examination cannot be defaulted twice.",
      });
    }
    const assigned = new Set(value.templateCodes);
    for (const code of value.defaultTemplateCodes) {
      if (!assigned.has(code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["defaultTemplateCodes"],
          message: "A default examination must also be an assigned examination.",
        });
      }
    }
  });

export type PhysicianConfigurationValues = z.infer<typeof physicianConfigurationSchema>;
