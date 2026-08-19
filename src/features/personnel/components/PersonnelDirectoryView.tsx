"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Info, Plus, Search, UserCheck } from "lucide-react";
import type { IPersonnel } from "@/domain/models/interfaces";
import {
  PersonnelFormValues,
  personnelRoleLabel,
} from "@/lib/validations/personnelValidation";
import { listPersonnelAction } from "@/features/server-boundary/personnel-actions";
import type { PersonnelActionResult } from "@/features/server-boundary/personnel-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PersonnelTable, formatPersonnelName } from "./PersonnelTable";
import { PersonnelFormModal } from "./PersonnelFormModal";

export interface PersonnelDirectoryViewProps {
  canManage: boolean;
  personnel?: readonly IPersonnel[];
  onSubmit?: (values: PersonnelFormValues, editingPersonnel: IPersonnel | null) => Promise<PersonnelActionResult>;
  onToggleStatus?: (person: IPersonnel) => Promise<void>;
  isLoading?: boolean;
}

const ROLE_FILTER_OPTIONS = [
  { label: "All Roles", value: "ALL" },
  { label: "Pathologist", value: "Pathologist" },
  { label: "Medical Technologist", value: "MedicalTechnologist" },
];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function PersonnelDirectoryView({
  canManage,
  personnel: initialPersonnel = [],
  onSubmit,
  onToggleStatus,
  isLoading = false,
}: PersonnelDirectoryViewProps) {
  const [personnel, setPersonnel] = useState<readonly IPersonnel[]>(initialPersonnel);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<IPersonnel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refreshPersonnel = useCallback(async () => {
    try {
      const result = await listPersonnelAction();
      setPersonnel(result);
      setRefreshError(null);
    } catch {
      setRefreshError("Could not refresh the personnel directory. Showing previous data.");
    }
  }, []);

  useEffect(() => {
    setPersonnel(initialPersonnel);
  }, [initialPersonnel]);

  const filteredPersonnel = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return personnel.filter((person) => {
      const matchesRole = roleFilter === "ALL" || person.role === roleFilter;
      if (!matchesRole) return false;
      if (!query) return true;
      return (
        formatPersonnelName(person).toLowerCase().includes(query) ||
        person.credentials.toLowerCase().includes(query) ||
        person.prcLicenseNumber.toLowerCase().includes(query) ||
        personnelRoleLabel(person.role).toLowerCase().includes(query)
      );
    });
  }, [personnel, roleFilter, searchQuery]);

  const handleOpenCreate = () => {
    setNotice(null);
    setEditingPersonnel(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (person: IPersonnel) => {
    setNotice(null);
    setEditingPersonnel(person);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingPersonnel(null);
    setIsModalOpen(false);
  };

  const handleSignatureChanged = useCallback(
    async (newUrl: string | null) => {
      setEditingPersonnel((prev) =>
        prev ? { ...prev, signatureImageUrl: newUrl } : prev,
      );
      await refreshPersonnel();
    },
    [refreshPersonnel],
  );

  const handleSubmit = async (values: PersonnelFormValues): Promise<PersonnelActionResult> => {
    if (!onSubmit) {
      throw new Error("Personnel management is not connected yet.");
    }
    const result = await onSubmit(values, editingPersonnel);
    if (!result.success) {
      return result;
    }
    handleCloseModal();
    await refreshPersonnel();
    return result;
  };

  const handleToggleStatus = async (person: IPersonnel) => {
    if (!onToggleStatus) {
      setNotice("Personnel management is not connected yet.");
      return;
    }
    try {
      await onToggleStatus(person);
      await refreshPersonnel();
    } catch (error) {
      setNotice(errorMessage(error, "Failed to update personnel status."));
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-brand-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <UserCheck className="h-5 w-5 text-brand-primary" />
            <h2 className="text-2xl font-bold tracking-tight text-brand-text">
              Personnel Directory
            </h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-brand-text-muted/90">
            {canManage
              ? "Maintain PRC-licensed Pathologists and Medical Technologists who sign laboratory reports."
              : "PRC-licensed Pathologists and Medical Technologists who sign laboratory reports. Read-only."}
          </p>
        </div>
        {canManage && (
          <Button onClick={handleOpenCreate} size="md" className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            <span>Add Personnel</span>
          </Button>
        )}
      </div>

      {notice && (
        <div className="flex items-start gap-2.5 rounded-xl border border-brand-info-border bg-brand-info-bg p-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-info" />
          <p className="text-xs font-medium leading-relaxed text-brand-info">{notice}</p>
        </div>
      )}

      {refreshError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
          {refreshError}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface p-4 shadow-xs sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-brand-text-subtle" />
          <Input
            placeholder="Search by name, credentials, or PRC license..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            options={ROLE_FILTER_OPTIONS}
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          />
        </div>
      </div>

      <PersonnelTable
        personnel={filteredPersonnel}
        canManage={canManage}
        onEdit={handleOpenEdit}
        onToggleStatus={handleToggleStatus}
      />

      {canManage && (
        <PersonnelFormModal
          key={editingPersonnel?.id ?? "new"}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          initialData={editingPersonnel}
          onSubmit={handleSubmit}
          onSignatureChanged={handleSignatureChanged}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
