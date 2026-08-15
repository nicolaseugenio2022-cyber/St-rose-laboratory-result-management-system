import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import type { IPersonnel } from "@/domain/models/interfaces";
import type { IPersonnelRepository } from "@/repositories/interfaces";

const PERSONNEL_COLUMNS = `
  id,
  first_name,
  last_name,
  middle_initial,
  credentials,
  prc_license_number,
  role,
  signature_image_url,
  is_active,
  created_at,
  updated_at
`;

interface PersonnelRow {
  id: string;
  first_name: string;
  last_name: string;
  middle_initial: string | null;
  credentials: string;
  prc_license_number: string;
  role: IPersonnel["role"];
  signature_image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type PersonnelCreate = Omit<IPersonnel, "id" | "createdAt" | "updatedAt">;
type PersonnelInsertRow = Omit<PersonnelRow, "id" | "created_at" | "updated_at">;
type PersonnelUpdateRow = Partial<Omit<PersonnelRow, "id" | "created_at">>;

function mapPersonnel(row: PersonnelRow): IPersonnel {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    middleInitial: row.middle_initial,
    credentials: row.credentials,
    prcLicenseNumber: row.prc_license_number,
    role: row.role,
    signatureImageUrl: row.signature_image_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPersonnelInsertRow(personnel: PersonnelCreate): PersonnelInsertRow {
  return {
    first_name: personnel.firstName,
    last_name: personnel.lastName,
    middle_initial: personnel.middleInitial ?? null,
    credentials: personnel.credentials,
    prc_license_number: personnel.prcLicenseNumber,
    role: personnel.role,
    signature_image_url: personnel.signatureImageUrl ?? null,
    is_active: personnel.isActive,
  };
}

function toPersonnelUpdateRow(updates: Partial<IPersonnel>): PersonnelUpdateRow {
  const row: PersonnelUpdateRow = {};

  if (updates.firstName !== undefined) row.first_name = updates.firstName;
  if (updates.lastName !== undefined) row.last_name = updates.lastName;
  if (updates.middleInitial !== undefined) row.middle_initial = updates.middleInitial;
  if (updates.credentials !== undefined) row.credentials = updates.credentials;
  if (updates.prcLicenseNumber !== undefined) {
    row.prc_license_number = updates.prcLicenseNumber;
  }
  if (updates.role !== undefined) row.role = updates.role;
  if (updates.signatureImageUrl !== undefined) {
    row.signature_image_url = updates.signatureImageUrl;
  }
  if (updates.isActive !== undefined) row.is_active = updates.isActive;
  if (updates.updatedAt !== undefined) row.updated_at = updates.updatedAt;

  return row;
}

export class SupabasePersonnelRepository implements IPersonnelRepository {
  async findById(id: string): Promise<IPersonnel | null> {
    const { data, error } = await supabaseServer
      .from("personnel")
      .select(PERSONNEL_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapPersonnel(data as PersonnelRow) : null;
  }

  async findAllActive(): Promise<IPersonnel[]> {
    const { data, error } = await supabaseServer
      .from("personnel")
      .select(PERSONNEL_COLUMNS)
      .eq("is_active", true);

    if (error) throw error;
    if (!data) throw new Error("Supabase active-personnel query returned no data.");
    return data.map((row) => mapPersonnel(row as PersonnelRow));
  }

  async findAll(): Promise<IPersonnel[]> {
    const { data, error } = await supabaseServer
      .from("personnel")
      .select(PERSONNEL_COLUMNS);

    if (error) throw error;
    if (!data) throw new Error("Supabase personnel query returned no data.");
    return data.map((row) => mapPersonnel(row as PersonnelRow));
  }

  async create(personnel: PersonnelCreate): Promise<IPersonnel> {
    const { data, error } = await supabaseServer
      .from("personnel")
      .insert(toPersonnelInsertRow(personnel))
      .select(PERSONNEL_COLUMNS)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Supabase personnel insert returned no data.");
    return mapPersonnel(data as PersonnelRow);
  }

  async update(id: string, updates: Partial<IPersonnel>): Promise<IPersonnel> {
    const row = toPersonnelUpdateRow(updates);
    if (Object.keys(row).length === 0) {
      const current = await this.findById(id);
      if (!current) throw new Error("Personnel record was not found.");
      return current;
    }

    const { data, error } = await supabaseServer
      .from("personnel")
      .update(row)
      .eq("id", id)
      .select(PERSONNEL_COLUMNS)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Supabase personnel update returned no data.");
    return mapPersonnel(data as PersonnelRow);
  }

  async toggleActiveStatus(id: string, isActive: boolean): Promise<IPersonnel> {
    const { data, error } = await supabaseServer
      .from("personnel")
      .update({ is_active: isActive })
      .eq("id", id)
      .select(PERSONNEL_COLUMNS)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Supabase personnel status update returned no data.");
    return mapPersonnel(data as PersonnelRow);
  }
}
