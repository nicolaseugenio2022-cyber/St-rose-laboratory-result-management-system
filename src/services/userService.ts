import { User, CreateUserInput, UpdateUserInput } from "@/types/user";

export class DuplicateUsernameError extends Error {
  constructor(public username: string) {
    super(`Username "${username}" is already in use by another account.`);
    this.name = "DuplicateUsernameError";
  }
}

export class UserNotFoundError extends Error {
  constructor(public userId: string) {
    super(`User with ID "${userId}" was not found.`);
    this.name = "UserNotFoundError";
  }
}

export interface IUserService {
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  createUser(input: CreateUserInput): Promise<User>;
  updateUser(id: string, input: UpdateUserInput): Promise<User>;
  toggleUserStatus(id: string): Promise<User>;
  subscribe(listener: () => void): () => void;
}

const initialUsers: User[] = [
  {
    id: "usr-001",
    username: "admin",
    role: "Admin",
    status: "Active",
    createdAt: "2026-01-15T08:30:00Z",
    updatedAt: "2026-01-15T08:30:00Z",
  },
  {
    id: "usr-002",
    username: "mbrody",
    role: "User",
    status: "Active",
    createdAt: "2026-02-01T09:15:00Z",
    updatedAt: "2026-02-01T09:15:00Z",
  },
  {
    id: "usr-003",
    username: "salmansoor",
    role: "User",
    status: "Active",
    createdAt: "2026-02-10T11:00:00Z",
    updatedAt: "2026-02-10T11:00:00Z",
  },
  {
    id: "usr-004",
    username: "jharker",
    role: "User",
    status: "Inactive",
    createdAt: "2026-02-12T14:45:00Z",
    updatedAt: "2026-02-20T16:20:00Z",
  },
];

class InMemoryUserService implements IUserService {
  private users: User[] = [...initialUsers];
  private listeners: Set<() => void> = new Set();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  public async getUsers(): Promise<User[]> {
    return [...this.users];
  }

  public async getUserById(id: string): Promise<User | null> {
    const user = this.users.find((u) => u.id === id);
    return user ? { ...user } : null;
  }

  public async createUser(input: CreateUserInput): Promise<User> {
    const normalizedUsername = input.username.trim().toLowerCase();

    // Duplicate username protection check (case-insensitive)
    const existingUser = this.users.find(
      (u) => u.username.toLowerCase() === normalizedUsername
    );

    if (existingUser) {
      throw new DuplicateUsernameError(normalizedUsername);
    }

    const now = new Date().toISOString();
    const newUser: User = {
      id: `usr-${Date.now().toString(36)}`,
      username: normalizedUsername,
      role: input.role,
      status: "Active",
      createdAt: now,
      updatedAt: now,
    };

    this.users.push(newUser);
    this.notify();
    return { ...newUser };
  }

  public async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new UserNotFoundError(id);
    }

    const currentUser = this.users[index];

    if (input.username) {
      const normalizedUsername = input.username.trim().toLowerCase();
      // Duplicate username protection check for editing
      const duplicateUser = this.users.find(
        (u) => u.id !== id && u.username.toLowerCase() === normalizedUsername
      );

      if (duplicateUser) {
        throw new DuplicateUsernameError(normalizedUsername);
      }
    }

    const updatedUser: User = {
      ...currentUser,
      ...(input.username !== undefined && { username: input.username.trim().toLowerCase() }),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.status !== undefined && { status: input.status }),
      updatedAt: new Date().toISOString(),
    };

    this.users[index] = updatedUser;
    this.notify();
    return { ...updatedUser };
  }

  public async toggleUserStatus(id: string): Promise<User> {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new UserNotFoundError(id);
    }

    const newStatus = user.status === "Active" ? "Inactive" : "Active";
    return this.updateUser(id, { status: newStatus });
  }
}

export const userService = new InMemoryUserService();