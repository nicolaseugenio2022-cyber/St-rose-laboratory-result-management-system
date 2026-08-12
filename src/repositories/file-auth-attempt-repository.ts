/**
 * TEMPORARY PRE-CUTOVER DEVELOPMENT ADAPTER.
 * Replaced in 6C by the server-only PostgreSQL repository. Its attempt state is NOT
 * production-durable: it is single-process and bypassable by restart or horizontal scaling.
 */
import path from "node:path";
import {
  AuthAttemptQuery,
  AuthAttemptRecord,
  IAuthAttemptRepository,
} from "@/repositories/interfaces";
import { readJsonStore, updateJsonStoreAtomic } from "@/lib/atomic-json-store";

interface AttemptStoreState {
  attempts: AuthAttemptRecord[];
}

const EMPTY_STORE: AttemptStoreState = { attempts: [] };

export class FileAuthAttemptRepository implements IAuthAttemptRepository {
  constructor(
    private readonly filePath = path.join(process.cwd(), "data", "auth-attempts.local.json")
  ) {}

  async record(attempt: AuthAttemptRecord): Promise<AuthAttemptRecord> {
    return updateJsonStoreAtomic(this.filePath, EMPTY_STORE, (state) => {
      state.attempts.push(structuredClone(attempt));
      return structuredClone(attempt);
    });
  }

  async findAttempts(query: AuthAttemptQuery): Promise<AuthAttemptRecord[]> {
    const since = new Date(query.since).getTime();
    const state = await readJsonStore(this.filePath, EMPTY_STORE);
    return structuredClone(
      state.attempts
        .filter((attempt) => {
          if (attempt.attemptKind !== query.attemptKind) return false;
          if (new Date(attempt.attemptedAt).getTime() < since) return false;
          if (query.username !== undefined && attempt.username !== query.username) return false;
          if (query.clientIp !== undefined && attempt.clientIp !== query.clientIp) return false;
          return true;
        })
        .sort((left, right) => right.attemptedAt.localeCompare(left.attemptedAt))
    );
  }
}
