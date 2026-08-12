import { FileAuthAttemptRepository } from "@/repositories/file-auth-attempt-repository";
import { FileAuthCredentialRepository } from "@/repositories/file-auth-credential-repository";
import { UserService } from "@/services/userService";

export const userService = new UserService(
  new FileAuthCredentialRepository(),
  new FileAuthAttemptRepository()
);
