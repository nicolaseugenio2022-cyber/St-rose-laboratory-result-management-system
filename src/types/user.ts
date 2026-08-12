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
  password?: string;
  role?: UserRole;
  status?: UserStatus;
}

export type UserProfile = User;
