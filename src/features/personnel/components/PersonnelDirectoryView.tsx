"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import type { PersonnelDirectoryEntry } from "@/features/personnel/personnel-directory-entry";
import {
  PersonnelFormValues,
  personnelRoleLabel,
} from "@/lib/validations/personnelValidation";
import { listPersonnelAction } from "@/features/server-boundary/personnel-actions";
import type { PersonnelActionResult } from "@/features/server-boundary/personnel-actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { PersonnelTable, formatPersonnelName } from "./PersonnelTable";
import { PersonnelFormModal } from "./PersonnelFormModal";

export interface PersonnelDirectoryViewProps {
  canManage: boolean;
  personnel?: readonly PersonnelDirectoryEntry[];
  onSubmit?: (values: PersonnelFormValues, editingPersonnel: PersonnelDirectoryEntry | null) => Promise<PersonnelActionResult>;
  onToggleStatus?: (person: PersonnelDirectoryEntry) => Promise<void>;
  isLoading?: boolean;
}

const ROLE_FILTER_OPTIONS = [
  { label: "All roles", value: "ALL" },
  { label: "Pathologist", value: "Pathologist" },
  { label: "Medical Technologist", value: "MedicalTechnologist" },
];

const STATUS_FILTER_OPTIONS = [
  { label: "All statuses", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * One figure in the summary strip.
 *
 * Deliberately plain: no card, no icon, no shadow, and no emphasis colour. These are four
 * neutral counts describing the shape of the roster, and dressing one of them differently
 * would assert a problem the directory has no way to substantiate.
 *
 * A description list rather than stacked divs, so each number is announced with the thing it
 * counts. `flex-col-reverse` puts the figure above its label visually while the reading order
 * stays label-then-value.
 */
function SummaryFigure({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-col-reverse px-3 py-2 sm:px-4">
      <dt className="mt-1 break-words text-[11px] font-medium uppercase tracking-wide text-brand-text-subtle">
        {label}
      </dt>
      <dd className="text-lg font-bold tabular-nums leading-none text-brand-text">{value}</dd>
    </div>
  );
}

export function PersonnelDirectoryView({
  canManage,
  personnel: initialPersonnel = [],
  onSubmit,
  onToggleStatus,
  isLoading = false,
}: PersonnelDirectoryViewProps) {
  const [personnel, setPersonnel] = useState<readonly PersonnelDirectoryEntry[]>(initialPersonnel);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<PersonnelDirectoryEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [busyPersonnelId, setBusyPersonnelId] = useState<string | null>(null);
  // The state above drives the UI; this ref is the guard the UI cannot be. State reaches the
  // handler only after a render, so two presses landing before that render both read `null`
  // and both write. The ref is current the instant the first press claims it.
  const busyPersonnelIdRef = useRef<string | null>(null);

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

  /**
   * Four counts, all derived from the roster already in hand - no extra request, and nothing
   * invented. Each answers a question an Admin can act on: how large the directory is, how much
   * of it is selectable for new reports, and how that splits between the two signing roles.
   *
   * A signature-image tally deliberately is not among them. The image is optional, so its
   * absence names no task, and a figure that drives no action is decoration on a page that
   * already has a table to read.
   */
  const summary = useMemo(
    () => ({
      total: personnel.length,
      active: personnel.filter((person) => person.isActive).length,
      pathologists: personnel.filter((person) => person.role === "Pathologist").length,
      medtechs: personnel.filter((person) => person.role === "MedicalTechnologist").length,
    }),
    [personnel],
  );

  const filteredPersonnel = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return personnel.filter((person) => {
      if (roleFilter !== "ALL" && person.role !== roleFilter) return false;
      if (statusFilter === "ACTIVE" && !person.isActive) return false;
      if (statusFilter === "INACTIVE" && person.isActive) return false;
      if (!query) return true;
      return (
        formatPersonnelName(person).toLowerCase().includes(query) ||
        person.credentials.toLowerCase().includes(query) ||
        person.prcLicenseNumber.toLowerCase().includes(query) ||
        personnelRoleLabel(person.role).toLowerCase().includes(query)
      );
    });
  }, [personnel, roleFilter, statusFilter, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || roleFilter !== "ALL" || statusFilter !== "ALL";

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
  }, []);

  const handleOpenCreate = () => {
    setNotice(null);
    setEditingPersonnel(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (person: PersonnelDirectoryEntry) => {
    setNotice(null);
    setEditingPersonnel(person);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingPersonnel(null);
    setIsModalOpen(false);
  };

  const handleSignatureChanged = useCallback(
    async (hasSignature: boolean) => {
      // The open modal reflects the new state immediately from the returned boolean; the
      // refresh below reconciles the directory. Neither path carries a signature reference.
      setEditingPersonnel((prev) => (prev ? { ...prev, hasSignature } : prev));
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

  const handleToggleStatus = async (person: PersonnelDirectoryEntry) => {
    if (!onToggleStatus) {
      setNotice("Personnel management is not connected yet.");
      return;
    }
    // Single-flight across the whole directory, not just this record: every row's controls
    // disable while a write is in flight, and this guard closes the window before that render
    // lands. A second toggle sent meanwhile would act on a list the pending refresh is about
    // to replace.
    if (busyPersonnelIdRef.current !== null) return;
    busyPersonnelIdRef.current = person.id;
    setBusyPersonnelId(person.id);
    try {
      await onToggleStatus(person);
      await refreshPersonnel();
    } catch (error) {
      setNotice(errorMessage(error, "Failed to update personnel status."));
    } finally {
      busyPersonnelIdRef.current = null;
      setBusyPersonnelId(null);
    }
  };

  const resultCount = filteredPersonnel.length;

  return (
    <div className="space-y-4">
      {/* ── Context line + neutral counts, one structural band ────────────────
          No in-body page title: the app shell already renders "Personnel
          Directory" as the page <h1>, and repeating it here gave the route two
          competing headings for the same thing. What is left is the sentence
          that says what the roster is for, and the counts that describe it. */}
      <section
        aria-label="Directory summary"
        className="overflow-hidden rounded-xl border border-brand-border bg-brand-structural"
      >
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="min-w-0 text-xs leading-relaxed text-brand-text-muted">
            {canManage
              ? "PRC-licensed Pathologists and Medical Technologists who sign laboratory reports."
              : "PRC-licensed Pathologists and Medical Technologists who sign laboratory reports. You have read-only access."}
          </p>
          {canManage && (
            <Button
              onClick={handleOpenCreate}
              size="sm"
              className="min-h-11 shrink-0 gap-1.5 self-start sm:min-h-8 sm:self-auto"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span>Add Personnel</span>
            </Button>
          )}
        </div>

        <dl className="grid grid-cols-2 divide-x divide-y divide-brand-border border-t border-brand-border sm:grid-cols-4 sm:divide-y-0">
          <SummaryFigure label="Total" value={summary.total} />
          <SummaryFigure label="Active" value={summary.active} />
          <SummaryFigure label="Pathologists" value={summary.pathologists} />
          <SummaryFigure label="Med. Technologists" value={summary.medtechs} />
        </dl>
      </section>

      {notice && (
        <Alert variant="destructive" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {refreshError && (
        <Alert variant="warning" onDismiss={() => setRefreshError(null)}>
          {refreshError}
        </Alert>
      )}

      {/* ── Search and filter toolbar ───────────────────────────────────────── */}
      <section
        aria-label="Search and filter personnel"
        className="rounded-xl border border-brand-border bg-brand-structural px-3 py-3"
      >
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end">
          {/* The label is written out here rather than passed to Input, because the search
              icon has to be positioned against the control alone - Input's own label would
              sit inside the same box and pull the icon off centre. The classes are the
              primitive's, so this label and the two Select labels stay identical. */}
          <div className="min-w-0 flex-1">
            <label
              htmlFor="personnel-search"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted"
            >
              Search
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-subtle"
              />
              <Input
                id="personnel-search"
                type="search"
                placeholder="Name, credentials, or PRC licence..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {/* Widths live on the wrappers: Select forwards className to the <select> itself,
              so a width passed as a prop would fight its own w-full container. */}
          <div className="grid grid-cols-2 gap-2.5 lg:flex lg:shrink-0">
            <div className="lg:w-44">
              <Select
                label="Role"
                options={ROLE_FILTER_OPTIONS}
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              />
            </div>
            <div className="lg:w-36">
              <Select
                label="Status"
                options={STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-brand-border pt-2.5">
          {/* Announced politely: a count that changes as the user types is useful to hear, but
              not urgent enough to interrupt them mid-keystroke. */}
          <p aria-live="polite" className="text-[11px] text-brand-text-muted">
            <span className="font-semibold tabular-nums text-brand-text">{resultCount}</span>
            {resultCount === 1 ? " record" : " records"}
            {hasActiveFilters && (
              <span className="text-brand-text-subtle"> of {summary.total}</span>
            )}
          </p>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="min-h-11 gap-1 sm:min-h-8"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="text-xs">Clear filters</span>
            </Button>
          )}
        </div>
      </section>

      {isLoading ? (
        <div aria-busy="true" aria-label="Loading personnel directory" className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <PersonnelTable
          personnel={filteredPersonnel}
          canManage={canManage}
          onEdit={handleOpenEdit}
          onToggleStatus={handleToggleStatus}
          busyPersonnelId={busyPersonnelId}
          isFiltered={hasActiveFilters}
          onClearFilters={handleClearFilters}
        />
      )}

      {canManage && (
        <PersonnelFormModal
          key={editingPersonnel?.id ?? "new"}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          initialData={editingPersonnel}
          onSubmit={handleSubmit}
          onSignatureChanged={handleSignatureChanged}
        />
      )}
    </div>
  );
}
