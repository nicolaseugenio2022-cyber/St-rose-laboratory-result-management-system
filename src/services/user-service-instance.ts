import "server-only";

import { SupabaseCredentialRepository } from "@/repositories/supabase-credential-repository";
import { SupabaseLoginAttemptRepository } from "@/repositories/supabase-login-attempt-repository";
import { UserService } from "@/services/userService";

export const userService = new UserService(
  new SupabaseCredentialRepository(),
  new SupabaseLoginAttemptRepository()
);
