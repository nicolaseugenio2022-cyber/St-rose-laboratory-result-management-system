import { z } from "zod";

export const personnelRoleSchema = z.enum(["Pathologist", "MedicalTechnologist"]);

export const PERSONNEL_ROLE_OPTIONS = [
  { label: "Pathologist", value: "Pathologist" },
  { label: "Medical Technologist", value: "MedicalTechnologist" },
] as const;

export const PERSONNEL_STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
] as const;

export function personnelRoleLabel(role: z.infer<typeof personnelRoleSchema>): string {
  return role === "Pathologist" ? "Pathologist" : "Medical Technologist";
}

export const personnelFormSchema = z.object({
  role: personnelRoleSchema,
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(100, "First name cannot exceed 100 characters"),
  middleInitial: z
    .string()
    .trim()
    .max(5, "Middle initial cannot exceed 5 characters")
    .optional(),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(100, "Last name cannot exceed 100 characters"),
  credentials: z
    .string()
    .trim()
    .min(1, "Credentials are required")
    .max(100, "Credentials cannot exceed 100 characters"),
  prcLicenseNumber: z
    .string()
    .trim()
    .min(1, "PRC license number is required")
    .max(50, "PRC license number cannot exceed 50 characters"),
  status: z.enum(["Active", "Inactive"]),
});

export type PersonnelFormValues = z.infer<typeof personnelFormSchema>;

export const createPersonnelSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(100, "First name cannot exceed 100 characters"),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(100, "Last name cannot exceed 100 characters"),
    middleInitial: z
      .string()
      .trim()
      .max(5, "Middle initial cannot exceed 5 characters")
      .optional()
      .nullable(),
    credentials: z
      .string()
      .trim()
      .min(1, "Credentials are required")
      .max(100, "Credentials cannot exceed 100 characters"),
    prcLicenseNumber: z
      .string()
      .trim()
      .min(1, "PRC license number is required")
      .max(50, "PRC license number cannot exceed 50 characters"),
    role: personnelRoleSchema,
    isActive: z.boolean(),
  })
  .strict();

export const updatePersonnelSchema = z
  .object({
    id: z.string().uuid("Invalid personnel identifier."),
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(100, "First name cannot exceed 100 characters")
      .optional(),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(100, "Last name cannot exceed 100 characters")
      .optional(),
    middleInitial: z
      .string()
      .trim()
      .max(5, "Middle initial cannot exceed 5 characters")
      .optional()
      .nullable(),
    credentials: z
      .string()
      .trim()
      .min(1, "Credentials are required")
      .max(100, "Credentials cannot exceed 100 characters")
      .optional(),
    prcLicenseNumber: z
      .string()
      .trim()
      .min(1, "PRC license number is required")
      .max(50, "PRC license number cannot exceed 50 characters")
      .optional(),
    role: personnelRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const personnelStatusSchema = z
  .object({
    id: z.string().uuid("Invalid personnel identifier."),
    isActive: z.boolean(),
  })
  .strict();

export const uploadPersonnelSignatureSchema = z
  .object({
    personnelId: z.string().uuid("Invalid personnel identifier."),
    fileBase64: z.string().min(1, "File data is required."),
    fileName: z.string().min(1, "File name is required."),
  })
  .strict();

export const removePersonnelSignatureSchema = z
  .object({
    personnelId: z.string().uuid("Invalid personnel identifier."),
  })
  .strict();

export const emptyPersonnelActionSchema = z.object({}).strict();

export type CreatePersonnelValues = z.infer<typeof createPersonnelSchema>;
export type UpdatePersonnelValues = z.infer<typeof updatePersonnelSchema>;
export type PersonnelStatusValues = z.infer<typeof personnelStatusSchema>;
