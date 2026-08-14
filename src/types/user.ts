export type UserRole = "Admin" | "Developer" | "User";

export type UserStatus = "Active" | "Inactive";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  mustSetRecovery: boolean;
  tokenVersion: number;
  passwordUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
  securityQuestion: string;
  customSecurityQuestion?: string;
}

export interface UpdateUserInput {
  username?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface ResetUserPasswordInput {
  password: string;
}

export interface CreateDeveloperAccountInput {
  username: string;
  password: string;
  securityQuestion: string;
  customSecurityQuestion?: string;
}

export interface UpdateDeveloperUsernameInput {
  username: string;
}

export interface UpdateDeveloperSecurityQuestionInput {
  securityQuestion: string;
  customSecurityQuestion?: string;
}

export interface ResetDeveloperPasswordInput {
  password: string;
}

export type UserProfile = User;
