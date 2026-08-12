/**
 * TEMPORARY PRE-CUTOVER DEVELOPMENT ADAPTER.
 * Replaced in 6C by the server-only PostgreSQL repository. Its attempt state is NOT
 * production-durable: it is single-process and bypassable by restart or horizontal scaling.
 */
import path from "node:path";
import {
  AuthCredentialRecord,
  IAuthCredentialRepository,
} from "@/repositories/interfaces";
import { readJsonStore, updateJsonStoreAtomic } from "@/lib/atomic-json-store";

interface CredentialStoreState {
  accounts: AuthCredentialRecord[];
}

const EMPTY_STORE: CredentialStoreState = { accounts: [] };

export class FileAuthCredentialRepository implements IAuthCredentialRepository {
  constructor(
    private readonly filePath = path.join(process.cwd(), "data", "auth-store.local.json")
  ) {}

  private async readState(): Promise<CredentialStoreState> {
    return readJsonStore(this.filePath, EMPTY_STORE);
  }

  async findById(id: string): Promise<AuthCredentialRecord | null> {
    const record = (await this.readState()).accounts.find((account) => account.id === id);
    return record ? structuredClone(record) : null;
  }

  async findByUsername(username: string): Promise<AuthCredentialRecord | null> {
    const record = (await this.readState()).accounts.find((account) => account.username === username);
    return record ? structuredClone(record) : null;
  }

  async findAll(): Promise<AuthCredentialRecord[]> {
    return structuredClone((await this.readState()).accounts);
  }

  async create(record: AuthCredentialRecord): Promise<AuthCredentialRecord> {
    return updateJsonStoreAtomic(this.filePath, EMPTY_STORE, (state) => {
      if (state.accounts.some((account) => account.id === record.id || account.username === record.username)) {
        throw new Error("Authentication account already exists.");
      }
      state.accounts.push(structuredClone(record));
      return structuredClone(record);
    });
  }

  async update(
    id: string,
    updates: Partial<Omit<AuthCredentialRecord, "id" | "createdAt">>
  ): Promise<AuthCredentialRecord> {
    return updateJsonStoreAtomic(this.filePath, EMPTY_STORE, (state) => {
      const index = state.accounts.findIndex((account) => account.id === id);
      if (index === -1) throw new Error("Authentication account was not found.");
      if (
        updates.username &&
        state.accounts.some((account) => account.id !== id && account.username === updates.username)
      ) {
        throw new Error("Authentication account already exists.");
      }
      const updated = { ...state.accounts[index], ...structuredClone(updates) };
      state.accounts[index] = updated;
      return structuredClone(updated);
    });
  }

  async delete(id: string): Promise<void> {
    await updateJsonStoreAtomic(this.filePath, EMPTY_STORE, (state) => {
      const index = state.accounts.findIndex((account) => account.id === id);
      if (index === -1) throw new Error("Authentication account was not found.");
      state.accounts.splice(index, 1);
    });
  }
}
