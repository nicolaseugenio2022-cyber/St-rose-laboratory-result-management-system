import "server-only";

// Application-owned authentication. Supabase Auth is NOT used; Supabase provides database and storage only.
import { supabaseServer } from "@/lib/supabase/server";
import type {
  AuthCredentialRecord,
  AuthRole,
  AuthStatus,
  ICredentialRepository,
} from "@/repositories/interfaces";

const CREDENTIAL_COLUMNS = `
  id,
  username,
  role,
  status,
  password_hash,
  security_question,
  security_answer_hash,
  must_change_password,
  must_set_recovery,
  token_version,
  password_updated_at,
  created_at,
  updated_at
`;

interface CredentialRow {
  id: string;
  username: string;
  role: AuthRole;
  status: AuthStatus;
  password_hash: string;
  security_question: string;
  security_answer_hash: string | null;
  must_change_password: boolean;
  must_set_recovery: boolean;
  token_version: number;
  password_updated_at: string;
  created_at: string;
  updated_at: string;
}

function mapCredential(row: CredentialRow): AuthCredentialRecord {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    status: row.status,
    passwordHash: row.password_hash,
    securityQuestion: row.security_question,
    securityAnswerHash: row.security_answer_hash,
    mustChangePassword: row.must_change_password,
    mustSetRecovery: row.must_set_recovery,
    tokenVersion: row.token_version,
    passwordUpdatedAt: row.password_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCredentialRow(record: AuthCredentialRecord): CredentialRow {
  return {
    id: record.id,
    username: record.username,
    role: record.role,
    status: record.status,
    password_hash: record.passwordHash,
    security_question: record.securityQuestion,
    security_answer_hash: record.securityAnswerHash,
    must_change_password: record.mustChangePassword,
    must_set_recovery: record.mustSetRecovery,
    token_version: record.tokenVersion,
    password_updated_at: record.passwordUpdatedAt,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function toCredentialUpdates(
  updates: Partial<Omit<AuthCredentialRecord, "id" | "createdAt">>
): Partial<Omit<CredentialRow, "id" | "created_at">> {
  const row: Partial<Omit<CredentialRow, "id" | "created_at">> = {};

  if (updates.username !== undefined) row.username = updates.username;
  if (updates.role !== undefined) row.role = updates.role;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.passwordHash !== undefined) row.password_hash = updates.passwordHash;
  if (updates.securityQuestion !== undefined) row.security_question = updates.securityQuestion;
  if (updates.securityAnswerHash !== undefined) {
    row.security_answer_hash = updates.securityAnswerHash;
  }
  if (updates.mustChangePassword !== undefined) {
    row.must_change_password = updates.mustChangePassword;
  }
  if (updates.mustSetRecovery !== undefined) row.must_set_recovery = updates.mustSetRecovery;
  if (updates.tokenVersion !== undefined) row.token_version = updates.tokenVersion;
  if (updates.passwordUpdatedAt !== undefined) {
    row.password_updated_at = updates.passwordUpdatedAt;
  }
  if (updates.updatedAt !== undefined) row.updated_at = updates.updatedAt;

  return row;
}

export class SupabaseCredentialRepository implements ICredentialRepository {
  async findById(id: string): Promise<AuthCredentialRecord | null> {
    const { data, error } = await supabaseServer
      .from("user_profiles")
      .select(CREDENTIAL_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapCredential(data as CredentialRow) : null;
  }

  async findByUsername(username: string): Promise<AuthCredentialRecord | null> {
    const { data, error } = await supabaseServer
      .from("user_profiles")
      .select(CREDENTIAL_COLUMNS)
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;
    return data ? mapCredential(data as CredentialRow) : null;
  }

  async findAll(): Promise<AuthCredentialRecord[]> {
    const { data, error } = await supabaseServer
      .from("user_profiles")
      .select(CREDENTIAL_COLUMNS);

    if (error) throw error;
    if (!data) throw new Error("Supabase credential query returned no data.");
    return data.map((row) => mapCredential(row as CredentialRow));
  }

  async create(record: AuthCredentialRecord): Promise<AuthCredentialRecord> {
    const { data, error } = await supabaseServer
      .from("user_profiles")
      .insert(toCredentialRow(record))
      .select(CREDENTIAL_COLUMNS)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Supabase credential insert returned no data.");
    return mapCredential(data as CredentialRow);
  }

  async update(
    id: string,
    updates: Partial<Omit<AuthCredentialRecord, "id" | "createdAt">>
  ): Promise<AuthCredentialRecord> {
    const row = toCredentialUpdates(updates);
    if (Object.keys(row).length === 0) {
      const current = await this.findById(id);
      if (!current) throw new Error("Authentication account was not found.");
      return current;
    }

    const { data, error } = await supabaseServer
      .from("user_profiles")
      .update(row)
      .eq("id", id)
      .select(CREDENTIAL_COLUMNS)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Supabase credential update returned no data.");
    return mapCredential(data as CredentialRow);
  }

  async delete(id: string): Promise<void> {
    const { data, error } = await supabaseServer
      .from("user_profiles")
      .delete()
      .eq("id", id)
      .select("id")
      .single();

    if (error) throw error;
    if (!data) throw new Error("Supabase credential delete returned no data.");
  }
}
