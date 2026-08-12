import "server-only";

// Application-owned authentication. Supabase Auth is NOT used; Supabase provides database and storage only.
import { supabaseServer } from "@/lib/supabase/server";
import type {
  AuthAttemptKind,
  AuthAttemptQuery,
  AuthAttemptRecord,
  ILoginAttemptRepository,
} from "@/repositories/interfaces";

const ATTEMPT_COLUMNS = `
  id,
  username,
  attempt_kind,
  succeeded,
  client_ip,
  attempted_at
`;

interface LoginAttemptRow {
  id: string;
  username: string;
  attempt_kind: AuthAttemptKind;
  succeeded: boolean;
  client_ip: string | null;
  attempted_at: string;
}

function mapLoginAttempt(row: LoginAttemptRow): AuthAttemptRecord {
  return {
    id: row.id,
    username: row.username,
    attemptKind: row.attempt_kind,
    succeeded: row.succeeded,
    clientIp: row.client_ip,
    attemptedAt: row.attempted_at,
  };
}

function toLoginAttemptRow(attempt: AuthAttemptRecord): LoginAttemptRow {
  return {
    id: attempt.id,
    username: attempt.username,
    attempt_kind: attempt.attemptKind,
    succeeded: attempt.succeeded,
    client_ip: attempt.clientIp,
    attempted_at: attempt.attemptedAt,
  };
}

export class SupabaseLoginAttemptRepository implements ILoginAttemptRepository {
  async record(attempt: AuthAttemptRecord): Promise<AuthAttemptRecord> {
    const { data, error } = await supabaseServer
      .from("auth_attempts")
      .insert(toLoginAttemptRow(attempt))
      .select(ATTEMPT_COLUMNS)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Supabase login-attempt insert returned no data.");
    return mapLoginAttempt(data as LoginAttemptRow);
  }

  async findAttempts(query: AuthAttemptQuery): Promise<AuthAttemptRecord[]> {
    let request = supabaseServer
      .from("auth_attempts")
      .select(ATTEMPT_COLUMNS)
      .eq("attempt_kind", query.attemptKind)
      .gte("attempted_at", query.since);

    if (query.username !== undefined) request = request.eq("username", query.username);
    if (query.clientIp !== undefined) request = request.eq("client_ip", query.clientIp);

    const { data, error } = await request.order("attempted_at", { ascending: false });

    if (error) throw error;
    if (!data) throw new Error("Supabase login-attempt query returned no data.");
    return data.map((row) => mapLoginAttempt(row as LoginAttemptRow));
  }
}
