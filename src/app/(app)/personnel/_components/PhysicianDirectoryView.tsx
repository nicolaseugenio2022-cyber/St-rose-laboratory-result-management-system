"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, Plus, Search, ShieldCheck, X } from "lucide-react";
import type {
  PhysicianAssignmentEntry,
  PhysicianDirectoryEntry,
} from "@/features/physicians/physician-directory-entry";
import {
  listPhysicianAssignmentsAction,
  listPhysiciansAction,
} from "@/features/server-boundary/physician-actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { SummaryBar } from "@/components/ui/SummaryBar";
import { PhysicianTable } from "./PhysicianTable";
import { PhysicianFormModal } from "./PhysicianFormModal";
import type { PhysicianFormValues, PhysicianSubmitResult } from "./PhysicianForm";
import {
  NO_EXAMINATION_ASSIGNMENTS,
  groupAssignmentsByPhysician,
} from "./physician-examinations";

export interface PhysicianDirectoryViewProps {
  canManage: boolean;
  physicians?: readonly PhysicianDirectoryEntry[];
  /**
   * Every (physician, examination) assignment row, flat, exactly as the read action returns it.
   * Folded per physician here rather than upstream, so this section owns one shape and refreshes
   * it the same way it refreshes the roster.
   */
  assignments?: readonly PhysicianAssignmentEntry[];
  onSubmit?: (
    values: PhysicianFormValues,
    editingPhysician: PhysicianDirectoryEntry | null,
  ) => Promise<PhysicianSubmitResult>;
  onToggleStatus?: (physician: PhysicianDirectoryEntry) => Promise<void>;
  isLoading?: boolean;
}

const STATUS_FILTER_OPTIONS = [
  { label: "All statuses", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Placeholder for the record list while the directory is being fetched. */
function PhysicianListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-card">
      <div className="flex items-center gap-6 border-b border-brand-border bg-brand-structural px-3 py-2.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="hidden h-3 w-16 lg:block" />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="divide-y divide-brand-border-subtle">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-6 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-52 max-w-full" />
            </div>
            <Skeleton className="hidden h-4 w-16 lg:block" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The managed physician directory, rendered as the second section of the Personnel route.
 *
 * Structurally identical to `PersonnelDirectoryView` on purpose: rows held in state, re-fetched
 * through the read action after every successful write, a single-flight guard around the toggle,
 * and the same read-only banner for a caller who may look but not write. Deactivation is the only
 * removal, so an inactive physician stays visible in the list and can be restored.
 */
export function PhysicianDirectoryView({
  canManage,
  physicians: initialPhysicians = [],
  assignments: initialAssignments = [],
  onSubmit,
  onToggleStatus,
  isLoading = false,
}: PhysicianDirectoryViewProps) {
  const [physicians, setPhysicians] =
    useState<readonly PhysicianDirectoryEntry[]>(initialPhysicians);
  const [assignments, setAssignments] =
    useState<readonly PhysicianAssignmentEntry[]>(initialAssignments);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPhysician, setEditingPhysician] = useState<PhysicianDirectoryEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [busyPhysicianId, setBusyPhysicianId] = useState<string | null>(null);
  // The state above drives the UI; this ref is the guard the UI cannot be. State reaches the
  // handler only after a render, so two presses landing before that render both read `null`
  // and both write. The ref is current the instant the first press claims it.
  const busyPhysicianIdRef = useRef<string | null>(null);

  // The roster and its assignments are re-read together, because one write can change either or
  // both, and a half-refreshed screen would show a name against assignments that are no longer
  // its own. `allSettled` rather than `all`, so a failed assignment read still leaves the roster
  // refreshed instead of taking it down too.
  const refreshPhysicians = useCallback(async () => {
    const [rosterResult, assignmentResult] = await Promise.allSettled([
      listPhysiciansAction(),
      listPhysicianAssignmentsAction(),
    ]);
    if (rosterResult.status === "fulfilled") setPhysicians(rosterResult.value);
    if (assignmentResult.status === "fulfilled") setAssignments(assignmentResult.value);
    if (rosterResult.status === "rejected" || assignmentResult.status === "rejected") {
      setRefreshError("Could not refresh the physician directory. Showing previous data.");
      return;
    }
    setRefreshError(null);
  }, []);

  useEffect(() => {
    setPhysicians(initialPhysicians);
  }, [initialPhysicians]);

  useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments]);

  const assignmentsByPhysicianId = useMemo(
    () => groupAssignmentsByPhysician(assignments),
    [assignments],
  );

  const summary = useMemo(
    () => ({
      total: physicians.length,
      active: physicians.filter((physician) => physician.isActive).length,
      inactive: physicians.filter((physician) => !physician.isActive).length,
      // Counted from the roster rather than from the assignment rows, because a physician with
      // no rows at all is exactly the one this figure is about.
      unassigned: physicians.filter(
        (physician) => (assignmentsByPhysicianId[physician.id]?.assignedCodes.length ?? 0) === 0,
      ).length,
    }),
    [physicians, assignmentsByPhysicianId],
  );

  const filteredPhysicians = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return physicians.filter((physician) => {
      if (statusFilter === "ACTIVE" && !physician.isActive) return false;
      if (statusFilter === "INACTIVE" && physician.isActive) return false;
      if (!query) return true;
      return physician.fullName.toLowerCase().includes(query);
    });
  }, [physicians, statusFilter, searchQuery]);

  const hasActiveFilters = searchQuery.trim() !== "" || statusFilter !== "ALL";
  const activeFilterCount =
    (searchQuery.trim() !== "" ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("ALL");
  }, []);

  const handleOpenCreate = () => {
    setNotice(null);
    setEditingPhysician(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (physician: PhysicianDirectoryEntry) => {
    setNotice(null);
    setEditingPhysician(physician);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingPhysician(null);
    setIsModalOpen(false);
  };

  const handleSubmit = async (values: PhysicianFormValues): Promise<PhysicianSubmitResult> => {
    if (!onSubmit) {
      throw new Error("Physician management is not connected yet.");
    }
    const result = await onSubmit(values, editingPhysician);
    if (!result.success) {
      // A refused save now writes NOTHING - the record and its assignment set are one
      // transaction, so a refusal leaves the directory exactly as it was. The directory is still
      // re-read, because the refusal may be reporting state that changed underneath this screen
      // (a name taken, a record deactivated elsewhere), and the list should show that rather than
      // what it was rendered with. The form stays open holding the typed message.
      await refreshPhysicians();
      return result;
    }
    handleCloseModal();
    await refreshPhysicians();
    return result;
  };

  const handleToggleStatus = async (physician: PhysicianDirectoryEntry) => {
    if (!onToggleStatus) {
      setNotice("Physician management is not connected yet.");
      return;
    }
    // Single-flight across the whole directory, not just this record: every row's controls
    // disable while a write is in flight, and this guard closes the window before that render
    // lands.
    if (busyPhysicianIdRef.current !== null) return;
    busyPhysicianIdRef.current = physician.id;
    setBusyPhysicianId(physician.id);
    try {
      await onToggleStatus(physician);
      await refreshPhysicians();
    } catch (error) {
      setNotice(errorMessage(error, "Failed to update physician status."));
    } finally {
      busyPhysicianIdRef.current = null;
      setBusyPhysicianId(null);
    }
  };

  const resultCount = filteredPhysicians.length;

  return (
    <div className="space-y-4">
      {/* Read-only callers get the boundary stated once, plainly, where the Add control would
          otherwise be - the absence of a control reads as a missing feature unless something
          says it is deliberate. */}
      {!canManage && (
        <div className="flex items-start gap-2.5 rounded-md border border-brand-info-border bg-brand-info-bg px-3 py-2.5">
          <ShieldCheck aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-brand-info" />
          <p className="text-xs leading-relaxed text-brand-info">
            <span className="font-semibold">Read-only directory access.</span> Physician records
            are maintained by Administrators.
          </p>
        </div>
      )}

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

      {/* Gated on `!isLoading`, which is the only one of the load facts that means "an answer
          arrived": zero figures during an in-flight load would read as a genuinely empty
          directory. A successful empty response still shows its zeros. */}
      {!isLoading && (
        <SummaryBar
          label="Physician directory summary"
          figures={[
            { label: "Physicians", value: summary.total },
            { label: "Active", value: summary.active, tone: "success" },
            { label: "Inactive", value: summary.inactive, tone: "muted" },
            {
              label: "Unassigned",
              value: summary.unassigned,
              tone: summary.unassigned > 0 ? "warning" : "muted",
            },
          ]}
          note="Requesting physicians selectable on laboratory reports."
        />
      )}

      {/* ── Search and filter toolbar ───────────────────────────────────────── */}
      <section
        aria-label="Search and filter physicians"
        className="space-y-2.5 rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Filter aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-brand-text-subtle" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted">
              Directory filters
            </span>
            {activeFilterCount > 0 && (
              <span className="text-[11px] text-brand-text-muted">{activeFilterCount} active</span>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="min-h-11 sm:min-h-8"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            )}
            {canManage && (
              <Button onClick={handleOpenCreate} size="sm" className="min-h-11 sm:min-h-8">
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add physician
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* The label is written out here rather than passed to Input, because the search icon
              has to be positioned against the control alone. The classes are the primitive's. */}
          <div className="min-w-0 lg:col-span-2">
            <label
              htmlFor="physician-search"
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
                id="physician-search"
                type="search"
                placeholder="Physician name"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select
            id="physician-status-filter"
            label="Status"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          />
        </div>

        <p aria-live="polite" className="text-[11px] text-brand-text-muted">
          Showing <span className="font-semibold tabular-nums text-brand-text">{resultCount}</span>{" "}
          of <span className="font-semibold tabular-nums text-brand-text">{summary.total}</span>{" "}
          {summary.total === 1 ? "record" : "records"}
        </p>
      </section>

      {isLoading ? (
        <div aria-busy="true" aria-label="Loading physician directory">
          <PhysicianListSkeleton />
        </div>
      ) : (
        <PhysicianTable
          physicians={filteredPhysicians}
          canManage={canManage}
          assignmentsByPhysicianId={assignmentsByPhysicianId}
          onEdit={handleOpenEdit}
          onToggleStatus={handleToggleStatus}
          busyPhysicianId={busyPhysicianId}
          isFiltered={hasActiveFilters}
          onClearFilters={handleClearFilters}
        />
      )}

      {canManage && (
        <PhysicianFormModal
          key={editingPhysician?.id ?? "new"}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          initialData={editingPhysician}
          initialAssignments={
            editingPhysician
              ? (assignmentsByPhysicianId[editingPhysician.id] ?? NO_EXAMINATION_ASSIGNMENTS)
              : NO_EXAMINATION_ASSIGNMENTS
          }
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
