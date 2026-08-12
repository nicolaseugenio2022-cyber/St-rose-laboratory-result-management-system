import { z } from "zod";
import {
  CUSTOM_SECURITY_QUESTION,
  SECURITY_QUESTION_OPTIONS,
} from "@/config/security-questions";
import { canonicalizeUsername, isValidCanonicalUsername } from "@/lib/username";

export const userRoleSchema = z.enum(["Admin", "Developer", "User"]);

export const userStatusSchema = z.enum(["Active", "Inactive"]);

export const usernameSchema = z
  .string()
  .transform(canonicalizeUsername)
  .refine(isValidCanonicalUsername, {
    message:
      "Username must be 3-50 characters, use lowercase letters, numbers, periods, underscores, or hyphens, begin and end with a letter or number, and contain no consecutive separators",
  });

export const securityQuestionSchema = z.enum(SECURITY_QUESTION_OPTIONS);

export const createUserSchema = z
  .object({
    username: usernameSchema,
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password cannot exceed 100 characters"),
    role: userRoleSchema,
    securityQuestion: securityQuestionSchema,
    customSecurityQuestion: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.securityQuestion === CUSTOM_SECURITY_QUESTION &&
      !value.customSecurityQuestion?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["customSecurityQuestion"],
        message: "A custom security question is required",
      });
    }
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
