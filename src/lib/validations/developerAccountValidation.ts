import { z } from "zod";
import { CUSTOM_SECURITY_QUESTION } from "@/config/security-questions";
import {
  securityQuestionSchema,
  usernameSchema,
} from "@/lib/validations/userValidation";

const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(100, "Password cannot exceed 100 characters");

function requireCustomSecurityQuestion(
  value: { securityQuestion: string; customSecurityQuestion?: string },
  context: z.RefinementCtx
): void {
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
}

export const emptyDeveloperAccountActionSchema = z.object({}).strict();

export const createDeveloperAccountSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    securityQuestion: securityQuestionSchema,
    customSecurityQuestion: z.string().optional(),
  })
  .strict()
  .superRefine(requireCustomSecurityQuestion);

export const updateDeveloperUsernameSchema = z
  .object({
    id: z.string().min(1),
    username: usernameSchema,
  })
  .strict();

export const updateDeveloperSecurityQuestionSchema = z
  .object({
    id: z.string().min(1),
    securityQuestion: securityQuestionSchema,
    customSecurityQuestion: z.string().optional(),
  })
  .strict()
  .superRefine(requireCustomSecurityQuestion);

export const resetDeveloperPasswordSchema = z
  .object({
    id: z.string().min(1),
    password: passwordSchema,
  })
  .strict();

export const developerAccountIdSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();
