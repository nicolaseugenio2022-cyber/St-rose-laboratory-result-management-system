import fs from "fs";
import path from "path";
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
  deleteUser(id: string, currentUserId?: string): Promise<void>;
  subscribe(listener: () => void): () => void;
  authenticate(username: string, password?: string): Promise<User>;
}

const initialUsers: User[] = [
  {
    id: "usr-001",
    username: "admin",
    role: "Admin",
    password: "password",
    status: "Active",
    createdAt: "2026-01-15T08:30:00Z",
    updatedAt: "2026-01-15T08:30:00Z",
  },
  {
    id: "usr-002",
    username: "mbrody",
    role: "User",
    password: "password",
    status: "Active",
    createdAt: "2026-02-01T09:15:00Z",
    updatedAt: "2026-02-01T09:15:00Z",
  },
  {
    id: "usr-003",
    username: "salmansoor",
    role: "User",
    password: "password",
    status: "Active",
    createdAt: "2026-02-10T11:00:00Z",
    updatedAt: "2026-02-10T11:00:00Z",
  },
  {
    id: "usr-004",
    username: "jharker",
    role: "User",
    password: "password",
    status: "Inactive",
    createdAt: "2026-02-12T14:45:00Z",
    updatedAt: "2026-02-20T16:20:00Z",
  },
  {
    id: "usr-005",
    username: "developer",
    role: "Developer",
    password: "password",
    status: "Active",
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-01T10:00:00Z",
  },
];

class InMemoryUserService implements IUserService {
  private users: User[] = [...initialUsers];
  private listeners: Set<() => void> = new Set();
  public readonly instanceId: string;

  constructor() {
    this.instanceId = `inst-${Math.random().toString(36).slice(2, 9)}`;
    // Log to help debugging runtime instance behavior
    try {
      // eslint-disable-next-line no-console
      console.info(`[userService] initialized ${this.instanceId} with ${this.users.length} seeded users`);
    } catch {}
    // Attempt to load persisted users so multiple server instances share state
    this.loadFromDiskIfExists();
  }

  private static getDataFilePath() {
    return path.join(process.cwd(), "data", "users.json");
  }

  private loadFromDiskIfExists() {
    try {
      const file = InMemoryUserService.getDataFilePath();
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, "utf8");
        const parsed = JSON.parse(raw) as User[];
        if (Array.isArray(parsed)) {
          this.users = parsed;
        }
      } else {
        // ensure directory exists and write initial seed
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(this.users, null, 2), "utf8");
      }
    } catch (err) {
      // ignore disk errors for prototype
    }
  }

  private persistToDisk() {
    try {
      const file = InMemoryUserService.getDataFilePath();
      fs.writeFileSync(file, JSON.stringify(this.users, null, 2), "utf8");
    } catch (err) {
      // ignore disk errors for prototype
    }
  }

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
    // Ensure fresh read from disk in case other instances updated it
    this.loadFromDiskIfExists();
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
      password: input.password,
      status: "Active",
      createdAt: now,
      updatedAt: now,
    };

    this.users.push(newUser);
    this.notify();
    this.persistToDisk();
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
      ...(input.password && { password: input.password }),
      ...(input.status !== undefined && { status: input.status }),
      updatedAt: new Date().toISOString(),
    };

    this.users[index] = updatedUser;
    this.notify();
    this.persistToDisk();
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

  public async deleteUser(id: string, currentUserId?: string): Promise<void> {
    if (currentUserId && id === currentUserId) {
      throw new Error("Cannot delete currently authenticated account.");
    }

    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new UserNotFoundError(id);
    }

    this.users.splice(index, 1);
    this.notify();
    this.persistToDisk();
  }

  public async authenticate(username: string, password?: string): Promise<User> {
    const normalizedUsername = username.trim().toLowerCase();
    const user = this.users.find((u) => u.username.toLowerCase() === normalizedUsername);

    if (!user) {
      throw new Error("Invalid username or password");
    }

    // Prototype constraint: hardcoded password for any existing user
    if (!password || password !== user.password) {
      throw new Error("Invalid username or password");
    }

    if (user.status !== "Active") {
      throw new Error("User account is inactive");
    }

    return { ...user };
  }
}

export const userService = new InMemoryUserService();