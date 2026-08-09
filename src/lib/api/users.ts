import { CreateUserFormValues, UpdateUserFormValues, UpdateUserPayload } from "@/lib/validations/userValidation";
import { User } from "@/types/user";

export interface UserSummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.error || response.statusText || "An unexpected error occurred.";
    throw new Error(message);
  }

  return body as T;
}

export async function fetchUsers(): Promise<Omit<User, "password">[]> {
  const response = await fetch("/api/users", { cache: "no-store" });
  return parseResponse<Omit<User, "password">[]>(response);
}

export async function fetchUserSummary(): Promise<UserSummary> {
  const response = await fetch("/api/users/summary", { cache: "no-store" });
  return parseResponse<UserSummary>(response);
}

export async function createUserApi(data: CreateUserFormValues): Promise<Omit<User, "password">> {
  const response = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    cache: "no-store",
  });
  return parseResponse<Omit<User, "password">>(response);
}

export async function updateUserApi(userId: string, data: UpdateUserPayload): Promise<Omit<User, "password">> {
  const response = await fetch(`/api/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    cache: "no-store",
  });
  return parseResponse<Omit<User, "password">>(response);
}

export async function deleteUserApi(userId: string): Promise<void> {
  const response = await fetch(`/api/users/${userId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.error || response.statusText || "Failed to delete user.";
    throw new Error(message);
  }
}
