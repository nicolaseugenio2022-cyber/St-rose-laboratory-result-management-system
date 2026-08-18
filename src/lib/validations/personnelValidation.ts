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
