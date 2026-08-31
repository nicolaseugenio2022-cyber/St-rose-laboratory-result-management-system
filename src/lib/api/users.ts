import { CreateUserFormValues, UpdateUserFormValues, UpdateUserPayload } from "@/lib/validations/userValidation";
import type {
  AccountDirectory,
  AdminAccountEntry,
} from "@/features/users/account-directory-entry";

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

/**
 * Refetch the directory.
 *
 * Returns the role-tagged `AccountDirectory` the route now serves, not `User[]`. The previous
 * signature was the reason the projection on the server-rendered page did not hold: the page sent
 * five fields, then the first refresh or mutation replaced them with the unprojected ten this
 * helper fetched back. Typing it to the union means a caller must decide which access level it is
 * handling instead of silently widening back to the domain object.
 */
export async function fetchUsers(): Promise<AccountDirectory> {
  const response = await fetch("/api/users", { cache: "no-store" });
  return parseResponse<AccountDirectory>(response);
}

export async function fetchUserSummary(): Promise<UserSummary> {
  const response = await fetch("/api/users/summary", { cache: "no-store" });
  return parseResponse<UserSummary>(response);
}

export async function createUserApi(data: CreateUserFormValues): Promise<AdminAccountEntry> {
  const response = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    cache: "no-store",
  });
  return parseResponse<AdminAccountEntry>(response);
}

export async function updateUserApi(userId: string, data: UpdateUserPayload): Promise<AdminAccountEntry> {
  const response = await fetch(`/api/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    cache: "no-store",
  });
  return parseResponse<AdminAccountEntry>(response);
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
