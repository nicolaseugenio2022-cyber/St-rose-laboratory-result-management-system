"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  Clock,
  Edit3,
  Eye,
  History,
  ListFilter,
  Search,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import { PatientReportSessionAggregate } from "@/domain/models/patient-report-session-aggregate";
import {
  deleteDraftSessionAction as deleteDraftSession,
  listRecentSessionsAction,
} from "@/features/server-boundary/server-actions";
import { fromSessionTransport } from "@/features/server-boundary/session-transport";
import { formatDateISO } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";

const SharedRenderingEngine = dynamic(
  () =>
    import("@/rendering/SharedRenderingEngine").then(
      (renderingModule) => renderingModule.SharedRenderingEngine
    ),
  {
    loading: () => (
      <SkeletonRegion isLoading label="Loading report preview">
        <Skeleton className="mx-auto h-[70vh] min-h-96 w-full max-w-[210mm]" />
      </SkeletonRegion>
    ),
  }
);

type SessionHistoryEntry = {
  session: PatientReportSessionAggregate;
  canReopen: boolean;
};

type SortKey = "accession" | "patient" | "date" | "retention";
type SortDirection = "ascending" | "descending";

const TABLE_COLUMN_COUNT = 9;

function matchesSearchTerm(value: unknown, normalizedQuery: string) {
  return typeof value === "string" && value.toLowerCase().includes(normalizedQuery);
}

function compareOptionalStrings(
  leftValue: string | null | undefined,
  rightValue: string | null | undefined,
  direction: SortDirection
) {
  const left = typeof leftValue === "string" && leftValue.length > 0 ? leftValue : null;
  const right = typeof rightValue === "string" && rightValue.length > 0 ? rightValue : null;

  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  const comparison = left.localeCompare(right);
  return direction === "ascending" ? comparison : -comparison;
}

function localCalendarDayNumber(value: Date) {
  const localMidnight = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  return Date.UTC(
    localMidnight.getFullYear(),
    localMidnight.getMonth(),
    localMidnight.getDate()
  );
}

function getRetentionDetails(session: PatientReportSessionAggregate) {
  if (session.status === "Draft" || !session.expiresAt) return null;

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const calendarDaysRemaining = Math.round(
    (localCalendarDayNumber(new Date(session.expiresAt)) - localCalendarDayNumber(new Date())) /
      millisecondsPerDay
  );
  const daysRemaining = Math.max(0, calendarDaysRemaining);
  const label =
    daysRemaining === 0
      ? "Expires today"
      : daysRemaining === 1
        ? "Expires tomorrow"
        : `Expires in ${daysRemaining} days`;

  if (daysRemaining <= 2) {
    return {
      label,
      icon: AlertTriangle,
      className: "border-brand-danger-border bg-brand-danger-bg text-brand-danger",
    };
  }

  if (daysRemaining <= 7) {
    return {
      label,
      icon: Clock,
      className: "border-brand-warning-border bg-brand-warning-bg text-brand-warning",
    };
  }

  return { label, icon: null, className: "text-brand-text-muted" };
}

function HistoryTableSkeleton() {
  return (
    <SkeletonRegion isLoading label="Loading session history" className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-left text-xs">
        <caption className="sr-only">Loading patient report session history</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {Array.from({ length: TABLE_COLUMN_COUNT }).map((_, columnIndex) => (
              <th key={columnIndex} className="px-4 py-3">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: TABLE_COLUMN_COUNT }).map((__, columnIndex) => (
                <td key={columnIndex} className="px-4 py-3">
                  <Skeleton className="h-4 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </SkeletonRegion>
  );
}

export function SessionHistoryView() {
  const router = useRouter();
  const [entries, setEntries] = useState<SessionHistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const trimmedSearchQuery = searchQuery.trim();
  // Route to the server accession search only for input actually shaped like an accession
  // prefix (SR-YYYYMMDD-XXXX). The server's validation allowlist is deliberately broader —
  // it decides what is SAFE to send, not what IS an accession — so reusing it here would
  // misclassify ordinary names such as "nicolas" and strand patient/physician matching.
  const accessionSearch =
    trimmedSearchQuery.length > 0 && /^SR-?[0-9-]*$/i.test(trimmedSearchQuery)
      ? trimmedSearchQuery
      : undefined;
  const [debouncedAccessionSearch, setDebouncedAccessionSearch] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Draft" | "Completed">("ALL");
  const [previewSession, setPreviewSession] = useState<PatientReportSessionAggregate | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<SessionHistoryEntry | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "date",
    direction: "descending",
  });

  useEffect(() => {
    const debounceId = window.setTimeout(() => {
      setDebouncedAccessionSearch(accessionSearch);
    }, 300);

    return () => window.clearTimeout(debounceId);
  }, [accessionSearch]);

  // Load session history, discarding any response superseded by a newer debounced search.
  useEffect(() => {
    let superseded = false;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const data = await listRecentSessionsAction(
          debouncedAccessionSearch
            ? { limit: 50, search: debouncedAccessionSearch }
            : { limit: 50 }
        );
        if (superseded) return;
        setEntries(
          data.map((entry) => ({
            session: fromSessionTransport(entry.session),
            canReopen: entry.canReopen,
          }))
        );
        setLoadError(null);
      } catch (error: unknown) {
        if (superseded) return;
        setLoadError(
          error instanceof Error ? error.message : "Session history could not be loaded."
        );
      } finally {
        if (!superseded) setLoading(false);
      }
    };

    void loadHistory();
    return () => {
      superseded = true;
    };
  }, [debouncedAccessionSearch, reloadToken]);

  const hasActiveSearch = trimmedSearchQuery.length > 0;
  const hasActiveAccessionSearch = accessionSearch !== undefined;
  const serverSearchPending = accessionSearch !== debouncedAccessionSearch;

  // Filter and sort the complete entries so reopen eligibility always travels with its session.
  const filteredEntries = useMemo(() => {
    const filtered = entries.filter(({ session: s }) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        matchesSearchTerm(s.accessionNumber, q) ||
        matchesSearchTerm(s.demographics.fullName, q) ||
        matchesSearchTerm(s.demographics.requestingPhysician, q);

      const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return [...filtered].sort((left, right) => {
      const leftSession = left.session;
      const rightSession = right.session;
      let comparison = 0;

      if (sort.key === "accession") {
        comparison = (leftSession.accessionNumber ?? "").localeCompare(
          rightSession.accessionNumber ?? ""
        );
      } else if (sort.key === "patient") {
        return compareOptionalStrings(
          leftSession.demographics.fullName,
          rightSession.demographics.fullName,
          sort.direction
        );
      } else if (sort.key === "date") {
        return compareOptionalStrings(
          leftSession.demographics.examinationDate,
          rightSession.demographics.examinationDate,
          sort.direction
        );
      } else {
        const leftExpiry = leftSession.expiresAt
          ? localCalendarDayNumber(new Date(leftSession.expiresAt))
          : Number.POSITIVE_INFINITY;
        const rightExpiry = rightSession.expiresAt
          ? localCalendarDayNumber(new Date(rightSession.expiresAt))
          : Number.POSITIVE_INFINITY;
        comparison = leftExpiry - rightExpiry;
      }

      return sort.direction === "ascending" ? comparison : -comparison;
    });
  }, [entries, searchQuery, sort, statusFilter]);

  const updateSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "ascending" ? "descending" : "ascending",
    }));
  };

  const ariaSort = (key: SortKey): SortDirection | "none" =>
    sort.key === key ? sort.direction : "none";

  const handleConfirmDeleteDraft = async () => {
    const entry = pendingDeleteEntry;
    if (!entry) return;
    if (isDeletingId) return;

    const { session } = entry;
    setIsDeletingId(session.id);
    setDeleteError(null);
    try {
      await deleteDraftSession({ sessionId: session.id });
      setPendingDeleteEntry(null);
      setReloadToken((current) => current + 1);
    } catch (error: unknown) {
      setPendingDeleteEntry(null);
      setDeleteError(
        error instanceof Error ? error.message : "The draft could not be deleted."
      );
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-brand-primary">
              <History className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Patient Report Session History</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Search, preview, print, and manage patient laboratory report sessions within the 30-day retention window.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1 rounded-md transition-colors ${
              statusFilter === "ALL" ? "bg-white text-brand-primary shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("Completed")}
            className={`px-3 py-1 rounded-md transition-colors ${
              statusFilter === "Completed" ? "bg-white text-emerald-700 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Completed
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("Draft")}
            className={`px-3 py-1 rounded-md transition-colors ${
              statusFilter === "Draft" ? "bg-white text-amber-700 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Drafts
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accession prefix, patient name, or physician..."
                aria-label="Search session history by accession prefix, patient name, or physician"
                className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-xs focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
            {hasActiveSearch && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                aria-label="Clear session history search"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear search
              </Button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-500">
            <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <span>Today: {formatDateISO()}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-xs text-brand-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite">
            {hasActiveAccessionSearch
              ? `Showing ${filteredEntries.length} of ${entries.length} accession matches returned`
              : `Showing ${filteredEntries.length} of ${entries.length} loaded sessions`}
          </p>
          {hasActiveAccessionSearch ? (
            <p>Accession numbers are matched by prefix across retained sessions you can access; up to 50 matches are returned.</p>
          ) : (
            <p>Up to the newest 50 sessions are currently loaded. Patient-name and physician matching covers only these loaded sessions; valid accession prefixes search retained history server-side.</p>
          )}
        </div>
      </div>

      {deleteError && (
        <Alert variant="destructive" onDismiss={() => setDeleteError(null)}>
          {deleteError}
        </Alert>
      )}

      {/* Session Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading || serverSearchPending ? (
          <HistoryTableSkeleton />
        ) : loadError ? (
          <div className="p-6">
            <Alert variant="destructive">
              Session history could not be loaded: {loadError}
            </Alert>
          </div>
        ) : filteredEntries.length === 0 ? (
          hasActiveSearch ? (
            <EmptyState
              icon={SearchX}
              title={hasActiveAccessionSearch ? "No matching accession number" : "No matches in loaded sessions"}
              description={
                hasActiveAccessionSearch
                  ? statusFilter === "ALL"
                    ? "No session visible within the retention window matches this accession prefix."
                    : `No visible ${statusFilter.toLowerCase()} session within the retention window matches this accession prefix.`
                  : "This search matched nothing among the newest 50 loaded sessions. Patient-name and physician searches do not search older sessions."
              }
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              }
              headingLevel={3}
            />
          ) : statusFilter !== "ALL" ? (
            <EmptyState
              icon={ListFilter}
              title="No sessions with this status"
              description={`No ${statusFilter.toLowerCase()} sessions are present in the sessions currently loaded.`}
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => setStatusFilter("ALL")}>
                  Show all
                </Button>
              }
              headingLevel={3}
            />
          ) : (
            <EmptyState
              icon={History}
              title="No session history yet"
              description="Patient report sessions will appear here after they are created."
              headingLevel={3}
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-xs">
              <caption className="sr-only">Patient report session history</caption>
              <thead>
                <tr className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200 text-[10px]">
                  <th className="py-3 px-4" aria-sort={ariaSort("accession")}>
                    <button type="button" onClick={() => updateSort("accession")} aria-label="Sort by accession number" className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring">
                      ACCESSION NO <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3 px-4" aria-sort={ariaSort("patient")}>
                    <button type="button" onClick={() => updateSort("patient")} aria-label="Sort by patient name" className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring">
                      PATIENT NAME <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3 px-4">AGE / SEX</th>
                  <th className="py-3 px-4">TESTS</th>
                  <th className="py-3 px-4">PHYSICIAN</th>
                  <th className="py-3 px-4" aria-sort={ariaSort("date")}>
                    <button type="button" onClick={() => updateSort("date")} aria-label="Sort by examination date" className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring">
                      DATE <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3 px-4" aria-sort={ariaSort("retention")}>
                    <button type="button" onClick={() => updateSort("retention")} aria-label="Sort by retention expiry" className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring">
                      RETENTION <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map(({ session: sess, canReopen }) => {
                  const isCompleted = sess.status === "Completed";
                  const retention = getRetentionDetails(sess);
                  const RetentionIcon = retention?.icon;

                  return (
                    <tr key={sess.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-900 whitespace-nowrap tabular-nums">{sess.accessionNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 uppercase">{sess.demographics.fullName || "Unnamed Patient"}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap tabular-nums">{sess.demographics.age} {sess.demographics.ageUnit} / {sess.demographics.sex}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {sess.reports.map((r) => (
                            <span key={r.id} className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200">{r.templateCode}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {/* truncate needs a block-level box; max-width on a td is advisory under auto table layout. */}
                        <span
                          className="block max-w-[150px] truncate"
                          title={sess.demographics.requestingPhysician || undefined}
                        >
                          {sess.demographics.requestingPhysician || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap tabular-nums">{sess.demographics.examinationDate || "—"}</td>
                      <td className="py-3 px-4">
                        {retention ? (
                          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${retention.className}`}>
                            {RetentionIcon && <RetentionIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                            {retention.label}
                          </span>
                        ) : (
                          <span aria-label="No retention expiry for a draft">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={sess.status} size="sm" /></td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button type="button" onClick={() => setPreviewSession(sess)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors">
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          Preview
                        </button>
                        {canReopen && (
                          <button type="button" onClick={() => router.push(`/workspace?sessionId=${encodeURIComponent(sess.id)}`)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-blue-200 bg-blue-50 text-brand-primary hover:bg-blue-100 transition-colors">
                            <Edit3 className="h-3.5 w-3.5" />
                            {isCompleted ? "Replace" : "Edit"}
                          </button>
                        )}
                        {/* canReopen carries plain server-decided ownership despite its reopen-oriented name. */}
                        {!isCompleted && canReopen && (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteEntry({ session: sess, canReopen })}
                            disabled={isDeletingId === sess.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                            Delete draft
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Preview Modal */}
      <Modal
        isOpen={previewSession !== null}
        onClose={() => setPreviewSession(null)}
        title={`Session Preview — ${previewSession?.accessionNumber ?? ""}`}
        closeLabel="Close session preview"
        className="max-h-[90vh] max-w-5xl overflow-hidden"
      >
        {previewSession && (
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto pr-1">
            <SharedRenderingEngine session={previewSession} targetOutput="ScreenPreview" />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={pendingDeleteEntry !== null}
        onCancel={() => setPendingDeleteEntry(null)}
        onConfirm={() => void handleConfirmDeleteDraft()}
        title="Delete this draft?"
        description={`Permanently delete the draft for ${pendingDeleteEntry?.session.demographics.fullName || "Unnamed Patient"} (${pendingDeleteEntry?.session.accessionNumber ?? ""}). Any unfinished encoding in this session will be removed and cannot be recovered.`}
        confirmLabel="Delete draft"
        pendingLabel="Deleting..."
        variant="destructive"
        isPending={isDeletingId === pendingDeleteEntry?.session.id}
      />
    </div>
  );
}
