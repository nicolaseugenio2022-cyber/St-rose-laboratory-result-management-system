import "server-only";

// Application-owned authentication. Supabase Auth is NOT used; Supabase provides database and storage only.
import { supabaseServer } from "@/lib/supabase/server";
import type {
  ILockoutRepository,
  LockoutRecord,
  OpenLockoutInput,
} from "@/repositories/interfaces";

const LOCKOUT_COLUMNS = `
  id,
  username,
  locked_at,
  expires_at,
  released_at,
  failure_count
`;

interface LockoutRow {
  id: string;
  username: string;
  locked_at: string;
  expires_at: string;
  released_at: string | null;
  failure_count: number;
}

function mapLockout(row: LockoutRow): LockoutRecord {
  return {
    id: row.id,
    username: row.username,
    lockedAt: row.locked_at,
    expiresAt: row.expires_at,
    releasedAt: row.released_at,
    failureCount: row.failure_count,
  };
}

function toLockoutRow(input: OpenLockoutInput): LockoutRow {
  return {
    id: input.id,
    username: input.username,
    locked_at: input.lockedAt,
    expires_at: input.expiresAt,
    released_at: null,
    failure_count: input.failureCount,
  };
}

export class SupabaseLockoutRepository implements ILockoutRepository {
  async openLockout(input: OpenLockoutInput): Promise<LockoutRecord | null> {
    const { data, error } = await supabaseServer
      .from("account_lockouts")
      .insert(toLockoutRow(input))
      .select(LOCKOUT_COLUMNS)
      .single();

    if (error?.code === "23505") return null;
    if (error) throw error;
    if (!data) throw new Error("Supabase lockout insert returned no data.");
    return mapLockout(data as LockoutRow);
  }

  async releaseExpiredLockout(username: string, now: string): Promise<LockoutRecord | null> {
    const { data, error } = await supabaseServer
      .from("account_lockouts")
      .update({ released_at: now })
      .eq("username", username)
      .is("released_at", null)
      .lte("expires_at", now)
      .select(LOCKOUT_COLUMNS)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapLockout(data as LockoutRow);
  }
}
