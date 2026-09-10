"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, Plus, Search, ShieldCheck, X } from "lucide-react";
import type {
  PhysicianAssignmentEntry,
  PhysicianDirectoryEntry,
} from "@/features/physicians/physician-directory-entry";
import {
  RECORD_DELETION_FAILURE_MESSAGE,
  RECORD_DELETION_REFUSAL_MESSAGES,
  RECORD_DELETION_UNAUDITED_NOTICE,
} from "@/features/personnel/record-deletion";
import {
  listPhysicianAssignmentsAction,
  listPhysiciansAction,
} from "@/features/server-boundary/physician-actions";
import type { PhysicianDeleteActionResult } from "@/features/server-boundary/physician-actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { SummaryBar } from "@/components/ui/SummaryBar";
import type { RowError, RowWrite } from "./PersonnelTable";
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
  onDelete?: (physician: PhysicianDirectoryEntry) => Promise<PhysicianDeleteActionResult>;
  isLoading?: boolean;
}

/**
 * A filter label, beside its control at every width, so each filter row is one control tall
 * while every field keeps a visible, associated label. On a phone the fields still stack, and the
 * fixed label width keeps their controls aligned in one column.
 */
const FILTER_LABEL_CLASS =
  "w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted sm:w-auto";

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
 * through the read action after every successful write, a single-flight guard around every row
 * write, and the same read-only banner for a caller who may look but not write. Deactivation is the
 * ordinary withdrawal - an inactive physician stays visible and can be restored - and permanent
 * deletion is offered only for an inactive physician, behind a confirmation the server re-decides.
 */
export function PhysicianDirectoryView({
  canManage,
  physicians: initialPhysicians = [],
  assignments: initialAssignments = [],
  onSubmit,
  onToggleStatus,
  onDelete,
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
  const [busyAction, setBusyAction] = useState<RowWrite | null>(null);
  // The dialog's subject outlives its open flag, so the closing dialog never flashes empty.
  const [deleteTarget, setDeleteTarget] = useState<PhysicianDirectoryEntry | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [rowError, setRowError] = useState<RowError | null>(null);
  // A warning, not a success, when the deletion committed but its audit record did not.
  const [deletionNotice, setDeletionNotice] = useState<{
    message: string;
    tone: "success" | "warning";
  } | null>(null);
  const deletionNoticeRef = useRef<HTMLDivElement>(null);

  // After a completed deletion the control that opened the dialog has gone with its row, so the
  // dialog cannot hand focus back to it. The confirmation takes focus instead - but only when focus
  // has actually been lost, never taken from wherever the operator has already moved it.
  useEffect(() => {
    if (!deletionNotice || isDeleteDialogOpen) return;
    const timer = window.setTimeout(() => {
      const active = document.activeElement;
      if (!active || active === document.body) deletionNoticeRef.current?.focus();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [deletionNotice, isDeleteDialogOpen]);

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
    setRowError(null);
    setEditingPhysician(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (physician: PhysicianDirectoryEntry) => {
    // An earlier refusal - typically a remaining assignment - may be exactly what this edit
    // resolves, so it does not outlive it.
    setNotice(null);
    setRowError(null);
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
    setBusyAction("toggle");
    setRowError(null);
    try {
      await onToggleStatus(physician);
      await refreshPhysicians();
    } catch (error) {
      setNotice(errorMessage(error, "Failed to update physician status."));
    } finally {
      busyPhysicianIdRef.current = null;
      setBusyPhysicianId(null);
      setBusyAction(null);
    }
  };

  const handleRequestDelete = (physician: PhysicianDirectoryEntry) => {
    // Nothing opens over a write in flight: every row's controls are disabled, and this closes the
    // window before that render lands.
    if (busyPhysicianIdRef.current !== null) return;
    setNotice(null);
    setRowError(null);
    setDeletionNotice(null);
    setDeleteTarget(physician);
    setIsDeleteDialogOpen(true);
  };

  const handleCancelDelete = () => {
    // A confirmed deletion cannot be cancelled into an unknown state; the dialog locks itself too.
    if (busyPhysicianIdRef.current !== null) return;
    setIsDeleteDialogOpen(false);
  };

  const handleConfirmDelete = async () => {
    const physician = deleteTarget;
    if (!physician) return;
    if (!onDelete) {
      setIsDeleteDialogOpen(false);
      setNotice("Physician management is not connected yet.");
      return;
    }
    // Single-flight, through the same guard as the toggle: a second press - a double click, a held
    // Enter - arrives while the first is in flight and is dropped before any request is sent.
    if (busyPhysicianIdRef.current !== null) return;
    busyPhysicianIdRef.current = physician.id;
    setBusyPhysicianId(physician.id);
    setBusyAction("delete");
    try {
      const result = await onDelete(physician);
      if (result.success) {
        setDeletionNotice(
          result.auditRecorded
            ? { message: `${physician.fullName} was permanently deleted.`, tone: "success" }
            : {
                message: `${physician.fullName} ${RECORD_DELETION_UNAUDITED_NOTICE}`,
                tone: "warning",
              }
        );
      } else if (result.error === "NOT_FOUND") {
        // The row is about to disappear on refresh, so the message cannot live on it.
        setNotice(RECORD_DELETION_REFUSAL_MESSAGES.NOT_FOUND);
      } else {
        setRowError({ id: physician.id, message: RECORD_DELETION_REFUSAL_MESSAGES[result.error] });
      }
      // Re-read either way: a success removes the row, and a refusal may be reporting state that
      // changed underneath this screen.
      await refreshPhysicians();
    } catch {
      // The request failed without an answer, so whether the delete committed is unknown. Said at
      // page level - the row may be gone - and the directory is re-read so the list shows which.
      setNotice(RECORD_DELETION_FAILURE_MESSAGE);
      await refreshPhysicians();
    } finally {
      busyPhysicianIdRef.current = null;
      setBusyPhysicianId(null);
      setBusyAction(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const deleteTargetAssignmentCount = deleteTarget
    ? (assignmentsByPhysicianId[deleteTarget.id]?.assignedCodes.length ?? 0)
    : 0;

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

      {deletionNotice && (
        <div
          ref={deletionNoticeRef}
          tabIndex={-1}
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
        >
          <Alert variant={deletionNotice.tone} onDismiss={() => setDeletionNotice(null)}>
            {deletionNotice.message}
          </Alert>
        </div>
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
        className="space-y-2 rounded-lg border border-brand-border bg-brand-structural px-3 py-2"
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

        {/* The controls and their count are one group, so the count sits directly under the
            fields it describes. Both labels are written out rather than passed to Input or
            Select: the search icon has to be positioned against the control alone, and the two
            labels share one class so they stay identical. */}
        <div className="space-y-1.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:flex-1">
              <label htmlFor="physician-search" className={FILTER_LABEL_CLASS}>
                Search
              </label>
              <div className="relative min-w-0 flex-1">
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
            <div className="flex min-w-0 items-center gap-2 sm:w-60">
              <label htmlFor="physician-status-filter" className={FILTER_LABEL_CLASS}>
                Status
              </label>
              <div className="min-w-0 flex-1">
                <Select
                  id="physician-status-filter"
                  options={STATUS_FILTER_OPTIONS}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                />
              </div>
            </div>
          </div>

          <p aria-live="polite" className="text-[11px] text-brand-text-muted">
            Showing <span className="font-semibold tabular-nums text-brand-text">{resultCount}</span>{" "}
            of <span className="font-semibold tabular-nums text-brand-text">{summary.total}</span>{" "}
            {summary.total === 1 ? "record" : "records"}
          </p>
        </div>
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
          onDelete={handleRequestDelete}
          busyPhysicianId={busyPhysicianId}
          busyAction={busyAction}
          rowError={rowError}
          isFiltered={hasActiveFilters}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* The shared destructive confirmation: focus lands on Cancel, Escape and the close control
          dismiss, focus returns to the Delete control that opened it, and while the request is in
          flight both actions lock and the dialog cannot be dismissed. The name is shown verbatim,
          exactly as it prints on a report, so the operator confirms against the physician. */}
      {canManage && (
        <ConfirmDialog
          isOpen={isDeleteDialogOpen}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
          title="Delete this physician permanently?"
          description="The physician is removed from the directory for good. This cannot be undone."
          confirmLabel="Delete permanently"
          pendingLabel="Deleting…"
          variant="destructive"
          isPending={busyAction === "delete"}
        >
          {deleteTarget && (
            <div className="space-y-2.5">
              <div className="rounded-md border border-brand-border bg-brand-structural px-3 py-2">
                <p className="break-words text-[13px] font-semibold text-brand-text">
                  {deleteTarget.fullName}
                </p>
                <p className="mt-0.5 text-[11px] text-brand-text-muted">
                  Requesting physician ·{" "}
                  {deleteTargetAssignmentCount === 0
                    ? "No examination assignments"
                    : `Assigned to ${deleteTargetAssignmentCount} ${deleteTargetAssignmentCount === 1 ? "examination" : "examinations"}`}
                </p>
              </div>
              <p className="text-xs leading-relaxed text-brand-text-muted">
                Only a physician with no examination assignments, whom no laboratory report names,
                can be deleted. Completed reports and the audit history are never changed.
              </p>
            </div>
          )}
        </ConfirmDialog>
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
