import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import type {
  IPhysician,
  IPhysicianExaminationAssignment,
} from "@/domain/models/interfaces";
import type {
  DirectoryDeletionActor,
  IPhysicianRepository,
  PhysicianConfigurationInput,
  PhysicianDeletionOutcome,
} from "@/repositories/interfaces";

const PHYSICIAN_COLUMNS = `
  id,
  full_name,
  is_active,
  created_at,
  updated_at
`;

/** Every word `delete_inactive_physician()` can answer. Anything else is not an answer. */
const PHYSICIAN_DELETION_OUTCOMES: ReadonlySet<string> = new Set<PhysicianDeletionOutcome>([
  "DELETED",
  "NOT_FOUND",
  "STILL_ACTIVE",
  "REFERENCED_BY_REPORTS",
  "HAS_ASSIGNMENTS",
]);

/**
 * The assignment projection. `id` is deliberately absent: the row is addressed by its natural key
 * (physician_id, template_code), which the table already constrains as unique, so nothing in this
 * repository or above it ever needs the surrogate.
 */
const ASSIGNMENT_COLUMNS = `
  physician_id,
  template_code,
  is_default,
  created_at,
  updated_at
`;

const ASSIGNMENT_TABLE = "physician_examination_assignments";

interface PhysicianRow {
  id: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PhysicianAssignmentRow {
  physician_id: string;
  template_code: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

type PhysicianCreate = Omit<IPhysician, "id" | "createdAt" | "updatedAt">;
type PhysicianInsertRow = Omit<PhysicianRow, "id" | "created_at" | "updated_at">;
type PhysicianUpdateRow = Partial<Omit<PhysicianRow, "id" | "created_at">>;

function mapPhysician(row: PhysicianRow): IPhysician {
  return {
    id: row.id,
    fullName: row.full_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssignment(row: PhysicianAssignmentRow): IPhysicianExaminationAssignment {
  return {
    physicianId: row.physician_id,
    templateCode: row.template_code,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPhysicianInsertRow(physician: PhysicianCreate): PhysicianInsertRow {
  return {
    full_name: physician.fullName,
    is_active: physician.isActive,
  };
}

function toPhysicianUpdateRow(updates: Partial<IPhysician>): PhysicianUpdateRow {
  const row: PhysicianUpdateRow = {};

  if (updates.fullName !== undefined) row.full_name = updates.fullName;
  if (updates.isActive !== undefined) row.is_active = updates.isActive;
  if (updates.updatedAt !== undefined) row.updated_at = updates.updatedAt;

  return row;
}

export class SupabasePhysicianRepository implements IPhysicianRepository {
  async findById(id: string): Promise<IPhysician | null> {
    const { data, error } = await supabaseServer
      .from("physicians")
      .select(PHYSICIAN_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapPhysician(data as PhysicianRow) : null;
  }

  async findAllActive(): Promise<IPhysician[]> {
    const { data, error } = await supabaseServer
      .from("physicians")
      .select(PHYSICIAN_COLUMNS)
      .eq("is_active", true);

    if (error) throw error;
    if (!data) throw new Error("Supabase active-physician query returned no data.");
    return data.map((row) => mapPhysician(row as PhysicianRow));
  }

  async findAll(): Promise<IPhysician[]> {
    const { data, error } = await supabaseServer
      .from("physicians")
      .select(PHYSICIAN_COLUMNS);

    if (error) throw error;
    if (!data) throw new Error("Supabase physician query returned no data.");
    return data.map((row) => mapPhysician(row as PhysicianRow));
  }

  async create(physician: PhysicianCreate): Promise<IPhysician> {
    const { data, error } = await supabaseServer
      .from("physicians")
      .insert(toPhysicianInsertRow(physician))
      .select(PHYSICIAN_COLUMNS)
      .single();

    // Thrown, never swallowed: the caller reads error.code === "23505" to distinguish a duplicate
    // name from a genuine failure, and cannot do that if this layer flattens it.
    if (error) throw error;
    if (!data) throw new Error("Supabase physician insert returned no data.");
    return mapPhysician(data as PhysicianRow);
  }

  async update(id: string, updates: Partial<IPhysician>): Promise<IPhysician> {
    const row = toPhysicianUpdateRow(updates);
    if (Object.keys(row).length === 0) {
      const current = await this.findById(id);
      if (!current) throw new Error("Physician record was not found.");
      return current;
    }

    const { data, error } = await supabaseServer
      .from("physicians")
      .update(row)
      .eq("id", id)
      .select(PHYSICIAN_COLUMNS)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Supabase physician update returned no data.");
    return mapPhysician(data as PhysicianRow);
  }

  async toggleActiveStatus(id: string, isActive: boolean): Promise<IPhysician> {
    const { data, error } = await supabaseServer
      .from("physicians")
      .update({ is_active: isActive })
      .eq("id", id)
      .select(PHYSICIAN_COLUMNS)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Supabase physician status update returned no data.");
    return mapPhysician(data as PhysicianRow);
  }

  async findAllAssignments(): Promise<IPhysicianExaminationAssignment[]> {
    const { data, error } = await supabaseServer
      .from(ASSIGNMENT_TABLE)
      .select(ASSIGNMENT_COLUMNS);

    if (error) throw error;
    if (!data) throw new Error("Supabase physician assignment query returned no data.");
    return data.map((row) => mapAssignment(row as PhysicianAssignmentRow));
  }

  async findAssignmentsByTemplate(
    templateCode: string
  ): Promise<IPhysicianExaminationAssignment[]> {
    const { data, error } = await supabaseServer
      .from(ASSIGNMENT_TABLE)
      .select(ASSIGNMENT_COLUMNS)
      .eq("template_code", templateCode);

    if (error) throw error;
    if (!data) throw new Error("Supabase physician assignment query returned no data.");
    return data.map((row) => mapAssignment(row as PhysicianAssignmentRow));
  }

  async findAssignmentsByPhysician(
    physicianId: string
  ): Promise<IPhysicianExaminationAssignment[]> {
    const { data, error } = await supabaseServer
      .from(ASSIGNMENT_TABLE)
      .select(ASSIGNMENT_COLUMNS)
      .eq("physician_id", physicianId);

    if (error) throw error;
    if (!data) throw new Error("Supabase physician assignment query returned no data.");
    return data.map((row) => mapAssignment(row as PhysicianAssignmentRow));
  }

  /**
   * Save one physician's record AND its complete assignment set as ONE transaction.
   *
   * ONE CALL, DELIBERATELY. Everything this operation has to do - create or update the physician,
   * discard that physician's previous pairs, move the default off whoever held it on the
   * templates being taken over, write the replacement set, and produce the identifier - happens
   * inside `save_physician_configuration`, so it commits as a unit or leaves the directory
   * untouched. The previous shape issued those as independent PostgREST statements, and a failure
   * between any two of them could leave a physician created but unassigned, an assignment set
   * half replaced, or another physician's examination stripped of its default while the operator
   * was told the save had failed. None of those states violates a constraint, so no constraint
   * could have caught them; only a transaction can.
   *
   * The identifier comes back from the function rather than being resolved by a follow-up lookup:
   * a created physician has no id until the transaction that creates it, and finding it again by
   * name afterwards is a second round trip that can see a different row than the one just
   * written.
   *
   * Errors are thrown, never swallowed. The action above reads `error.code` - the PostgreSQL
   * SQLSTATE the function raised - to tell a typed refusal apart from a genuine failure, and
   * cannot do that if this layer flattens it.
   */
  async savePhysicianConfiguration(configuration: PhysicianConfigurationInput): Promise<string> {
    const payload = {
      id: configuration.id,
      full_name: configuration.fullName,
      is_active: configuration.isActive,
      template_codes: [...configuration.templateCodes],
      default_template_codes: [...configuration.defaultTemplateCodes],
    };

    const { data, error } = await supabaseServer.rpc("save_physician_configuration", { payload });

    if (error) throw error;
    if (typeof data !== "string") {
      throw new Error("Supabase physician configuration save returned no identifier.");
    }
    return data;
  }

  /**
   * Permanently delete ONE inactive physician, and audit it, as ONE transaction.
   *
   * Everything happens inside `delete_inactive_physician()`: the row is locked, its inactivity,
   * its assignments and every report reference are re-decided, the row is deleted, and the deletion
   * audit is written before the transaction commits. This repository issues no delete of its own,
   * and assignments are never cascaded: they are refused, and the Administrator clears them first.
   *
   * Errors are thrown, never swallowed or read as a refusal: an outage or a failed audit write
   * rolled the whole transaction back, and the caller must not report it as either a deletion or a
   * refusal. An answer outside the closed set is thrown for the same reason.
   */
  async deleteInactive(
    id: string,
    actor: DirectoryDeletionActor
  ): Promise<PhysicianDeletionOutcome> {
    const { data, error } = await supabaseServer.rpc("delete_inactive_physician", {
      p_physician_id: id,
      p_actor_user_id: actor.userId,
      p_actor_username: actor.username,
      p_actor_role: actor.role,
    });

    if (error) throw error;
    if (typeof data !== "string" || !PHYSICIAN_DELETION_OUTCOMES.has(data)) {
      throw new Error("Supabase physician deletion returned an unrecognised outcome.");
    }
    return data as PhysicianDeletionOutcome;
  }
}
