"use client";

import React, { useMemo, useState } from "react";
import { Info, Plus, Search, UserCheck } from "lucide-react";
import type { IPersonnel } from "@/domain/models/interfaces";
import {
  PersonnelFormValues,
  personnelRoleLabel,
} from "@/lib/validations/personnelValidation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PersonnelTable, formatPersonnelName } from "./PersonnelTable";
import { PersonnelFormModal } from "./PersonnelFormModal";

const NOT_CONNECTED_MESSAGE =
  "Personnel records are not connected yet — saving and status changes arrive in a later slice.";

export interface PersonnelDirectoryViewProps {
  /** Admin may manage the directory; every other permitted role is read-only. */
  canManage: boolean;
  personnel?: readonly IPersonnel[];
  /** Renders the temporary preview-data notice. Dropped in P2. */
  isPreviewData?: boolean;
  onSubmit?: (values: PersonnelFormValues) => Promise<void>;
  onToggleStatus?: (person: IPersonnel) => Promise<void>;
  isLoading?: boolean;
}

const ROLE_FILTER_OPTIONS = [
  { label: "All Roles", value: "ALL" },
  { label: "Pathologist", value: "Pathologist" },
  { label: "Medical Technologist", value: "MedicalTechnologist" },
];

export function PersonnelDirectoryView({
  canManage,
  personnel = [],
  isPreviewData = false,
  onSubmit,
  onToggleStatus,
  isLoading = false,
}: PersonnelDirectoryViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<IPersonnel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  // No write boundary exists yet. Rather than fake a successful save, surface the
  // deferred state through the form's existing error channel.
  const handleSubmit = async (values: PersonnelFormValues) => {
    if (!onSubmit) {
      throw new Error(NOT_CONNECTED_MESSAGE);
    }
    await onSubmit(values);
    handleCloseModal();
  };

  const handleToggleStatus = async (person: IPersonnel) => {
    if (!onToggleStatus) {
      setNotice(NOT_CONNECTED_MESSAGE);
      return;
    }
    await onToggleStatus(person);
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

      {/* TEMPORARY — removed in P2 together with preview-fixture.ts */}
      {isPreviewData && (
        <div className="flex items-start gap-2.5 rounded-xl border border-brand-warning-border bg-brand-warning-bg p-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-warning" />
          <p className="text-xs font-medium leading-relaxed text-brand-warning">
            Preview data — not from the database. These sample records exist only to review the
            directory layout, and are replaced by the real personnel read in a later slice.
          </p>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2.5 rounded-xl border border-brand-info-border bg-brand-info-bg p-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-info" />
          <p className="text-xs font-medium leading-relaxed text-brand-info">{notice}</p>
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
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
