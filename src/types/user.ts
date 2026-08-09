export type UserRole = "Admin" | "Developer" | "User";

export type UserStatus = "Active" | "Inactive";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  password: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  username?: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
}

export type UserProfile = Omit<User, "password">;
