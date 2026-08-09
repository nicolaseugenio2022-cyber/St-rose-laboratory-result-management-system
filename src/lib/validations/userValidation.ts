import { z } from "zod";

export const userRoleSchema = z.enum(["Admin", "Developer", "User"]);

export const userStatusSchema = z.enum(["Active", "Inactive"]);

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username cannot exceed 30 characters")
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "Username can only contain letters, numbers, underscores, hyphens, and periods"
  )
  .toLowerCase()
  .trim();

export const createUserSchema = z.object({
  username: usernameSchema,
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password cannot exceed 100 characters"),
  role: userRoleSchema,
});

export const updateUserSchema = z.object({
  username: usernameSchema,
  password: z
    .string()
    .min(6, "New password must be at least 6 characters")
    .max(100, "Password cannot exceed 100 characters")
    .optional()
    .or(z.literal("")),
  role: userRoleSchema,
  status: userStatusSchema,
});

export const updateUserPayloadSchema = updateUserSchema.partial();

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
export type UpdateUserPayload = z.infer<typeof updateUserPayloadSchema>;
