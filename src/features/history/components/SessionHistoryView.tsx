"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  Clock,
  History,
  ListFilter,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { PatientReportSessionAggregate } from "@/domain/models/patient-report-session-aggregate";
import {
  deleteDraftSessionAction as deleteDraftSession,
  listRecentSessionsAction,
} from "@/features/server-boundary/server-actions";
import { fromSessionTransport } from "@/features/server-boundary/session-transport";
import type { SessionHistoryEntryTransport } from "@/features/server-boundary/server-actions";
import { formatDateISO } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { HistorySessionActions } from "./HistorySessionActions";

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

const TABLE_COLUMN_COUNT = 5;

// Status, retention and examination date answer one question - where is this session in its
// lifecycle - so they share a single column instead of three. That removes two columns and their
// horizontal padding, which is what lets the remaining five fit the shell without scrolling.
// No column is hidden any more; width is managed by proportion instead of visibility.
const COLUMN_HIDDEN_CLASS = ["", "", "", "", ""];

// The table uses `table-fixed`, so these proportions - not the widest cell content - decide column
// widths. That is what keeps the row inside its container: under the default auto layout a
// nowrap actions cell expands to its intrinsic width and pushes the table into horizontal scroll.
// Percentages are index-aligned with the header row and sum to 100 for the seven-column state;
// when Date is hidden the browser redistributes its share across the rest.
const COLUMN_WIDTH_CLASS = [
  "w-[19%]", // accession - monospace identifier, needs a stable minimum
  "w-[27%]", // patient   - highest scan priority, carries secondary metadata beneath
  "w-[14%]", // tests     - bounded by the three-chip + N cap
  "w-[18%]", // status    - badge, retention and examination date stacked
  "w-[22%]", // actions   - three controls, labelled at xl and icon-only below it
];

// Below md the table becomes a card list, which has no column headers to sort from. This select
// restores the same four sort keys and both directions through the existing sort state - it adds
// no sorting logic of its own. Values are `key:direction`.
const CARD_SORT_OPTIONS = [
  { label: "Date — newest first", value: "date:descending" },
  { label: "Date — oldest first", value: "date:ascending" },
  { label: "Accession — ascending", value: "accession:ascending" },
  { label: "Accession — descending", value: "accession:descending" },
  { label: "Patient — A to Z", value: "patient:ascending" },
  { label: "Patient — Z to A", value: "patient:descending" },
  { label: "Retention — expiring first", value: "retention:ascending" },
  { label: "Retention — latest first", value: "retention:descending" },
];

// A session may carry any number of reports, so an uncapped chip list lets one row
// widen the whole table. Three covers the common routine panel; the rest collapse
// into a +N indicator. Display only - sess.reports stays complete for Preview.
const MAX_VISIBLE_TEST_CHIPS = 3;

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
      <table className="w-full table-fixed border-collapse text-left text-xs">
        <caption className="sr-only">Loading patient report session history</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {Array.from({ length: TABLE_COLUMN_COUNT }).map((_, columnIndex) => (
              <th key={columnIndex} className={`px-2.5 py-3 ${COLUMN_WIDTH_CLASS[columnIndex]} ${COLUMN_HIDDEN_CLASS[columnIndex]}`}>
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: TABLE_COLUMN_COUNT }).map((__, columnIndex) => (
                <td key={columnIndex} className={`px-2.5 py-3 ${COLUMN_HIDDEN_CLASS[columnIndex]}`}>
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

/** The one place a transport entry becomes view state. Used by the server-rendered seed and by
 *  every client refetch alike, so ownership-derived reopen rights always map the same way. */
function toHistoryEntry(entry: SessionHistoryEntryTransport): SessionHistoryEntry {
  return {
    session: fromSessionTransport(entry.session),
    canReopen: entry.canReopen,
  };
}

export function SessionHistoryView({
  initialEntries,
}: {
  /** Server-fetched first page. When present, the first client fetch is skipped: the rows arrive
   *  with the HTML instead of after hydrate + a server-action round trip. Search, manual reload
   *  and every later refetch behave exactly as before. */
  initialEntries?: SessionHistoryEntryTransport[];
} = {}) {
  const router = useRouter();
  const [entries, setEntries] = useState<SessionHistoryEntry[]>(
    () => (initialEntries ?? []).map(toHistoryEntry)
  );
  const initialSeedConsumed = useRef(initialEntries === undefined);
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
  const [loading, setLoading] = useState<boolean>(initialEntries === undefined);
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

    // The server already rendered the first page; consuming the seed here instead of fetching
    // again would otherwise duplicate that load. Only the very first run is skipped - a search,
    // or a reload after a mutation, always fetches fresh.
    if (!initialSeedConsumed.current) {
      initialSeedConsumed.current = true;
      return;
    }

    const loadHistory = async () => {
      setLoading(true);
      try {
        const data = await listRecentSessionsAction(
          debouncedAccessionSearch
            ? { limit: 50, search: debouncedAccessionSearch }
            : { limit: 50 }
        );
        if (superseded) return;
        setEntries(data.map(toHistoryEntry));
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-1 items-end gap-2 sm:max-w-md">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label htmlFor="history-search" className="block text-xs font-semibold text-brand-text">
                Search sessions
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="history-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Accession prefix, patient name, or physician"
                  className="h-10 w-full rounded-lg border border-slate-300 pl-10 pr-4 text-xs focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            </div>
            {hasActiveSearch && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0"
                onClick={() => setSearchQuery("")}
                aria-label="Clear session history search"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear search
              </Button>
            )}
          </div>
          {/* The canonical sort control. Accession, Patient and Status sort from their headers too,
              but Date has no header of its own now, so this stays visible at every width. */}
          <div className="w-full shrink-0 sm:max-w-xs">
            <Select
              label="Sort by"
              options={CARD_SORT_OPTIONS}
              value={`${sort.key}:${sort.direction}`}
              onChange={(event) => {
                const [key, direction] = event.target.value.split(":");
                setSort({ key: key as SortKey, direction: direction as SortDirection });
              }}
            />
          </div>
          <div className="flex h-10 shrink-0 items-center gap-2 text-xs font-medium text-slate-500">
            <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <span>Today: {formatDateISO()}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 border-t border-slate-100 pt-3 text-xs text-brand-text-muted sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
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
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full table-fixed border-collapse text-left text-xs">
              <caption className="sr-only">Patient report session history</caption>
              <thead>
                <tr className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200 text-[10px]">
                  <th className={`py-3 px-2.5 ${COLUMN_WIDTH_CLASS[0]}`} aria-sort={ariaSort("accession")}>
                    <button type="button" onClick={() => updateSort("accession")} aria-label="Sort by accession number" className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring">
                      ACCESSION NO <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className={`py-3 px-2.5 ${COLUMN_WIDTH_CLASS[1]}`} aria-sort={ariaSort("patient")}>
                    <button type="button" onClick={() => updateSort("patient")} aria-label="Sort by patient name" className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring">
                      PATIENT <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className={`py-3 px-2.5 ${COLUMN_WIDTH_CLASS[2]}`}>TESTS</th>
                  <th className={`py-3 px-2.5 ${COLUMN_WIDTH_CLASS[3]}`} aria-sort={ariaSort("retention")}>
                    <button type="button" onClick={() => updateSort("retention")} aria-label="Sort by retention expiry" className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring">
                      STATUS <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                  <th className={`py-3 px-2.5 ${COLUMN_WIDTH_CLASS[4]}`}>ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map(({ session: sess, canReopen }) => {
                  const retention = getRetentionDetails(sess);
                  const RetentionIcon = retention?.icon;

                  return (
                    <tr key={sess.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-2.5 font-mono font-bold text-blue-900 tabular-nums break-all xl:whitespace-nowrap xl:break-normal">{sess.accessionNumber}</td>
                      <td className="py-3 px-2.5">
                        <div className="font-bold text-slate-900 uppercase break-words">{sess.demographics.fullName || "Unnamed Patient"}</div>
                        {/* Secondary identity metadata: lowest scan priority, so it is the first thing
                            dropped as width tightens. Both values remain available in Preview. */}
                        <div className="hidden lg:flex lg:items-baseline lg:gap-1.5 mt-0.5 text-[11px] text-slate-500">
                          <span className="whitespace-nowrap tabular-nums">
                            {sess.demographics.age} {sess.demographics.ageUnit} / {sess.demographics.sex}
                          </span>
                          {sess.demographics.requestingPhysician && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span
                                className="block max-w-[150px] truncate"
                                title={sess.demographics.requestingPhysician}
                              >
                                {sess.demographics.requestingPhysician}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2.5">
                        <div className="flex flex-wrap gap-1">
                          {sess.reports.slice(0, MAX_VISIBLE_TEST_CHIPS).map((r) => (
                            <span key={r.id} className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200">{r.templateCode}</span>
                          ))}
                          {sess.reports.length > MAX_VISIBLE_TEST_CHIPS && (
                            <span
                              className="px-2 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-700 rounded border border-slate-300 whitespace-nowrap"
                              title={sess.reports.slice(MAX_VISIBLE_TEST_CHIPS).map((r) => r.templateCode).join(", ")}
                            >
                              <span aria-hidden="true">+{sess.reports.length - MAX_VISIBLE_TEST_CHIPS}</span>
                              <span className="sr-only">
                                {sess.reports.length - MAX_VISIBLE_TEST_CHIPS} more{" "}
                                {sess.reports.length - MAX_VISIBLE_TEST_CHIPS === 1 ? "test" : "tests"} not shown
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2.5">
                        <StatusBadge status={sess.status} size="sm" />
                        {retention ? (
                          <span className={`mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${retention.className}`}>
                            {RetentionIcon && <RetentionIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                            {retention.label}
                          </span>
                        ) : (
                          <span className="mt-1 block text-[11px] text-slate-500">Not yet retained</span>
                        )}
                        <div className="mt-1 font-mono text-[11px] tabular-nums text-slate-500">
                          {sess.demographics.examinationDate || "—"}
                        </div>
                      </td>
                      <td className="py-3 px-2.5">
                        <HistorySessionActions
                          entry={{ session: sess, canReopen }}
                          variant="table"
                          isDeleting={isDeletingId === sess.id}
                          onPreview={setPreviewSession}
                          onReopen={(target) => router.push(`/workspace?sessionId=${encodeURIComponent(target.id)}`)}
                          onDeleteDraft={setPendingDeleteEntry}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Narrow-width presentation of the SAME filteredEntries and the SAME handlers.
              Presentation is duplicated; data and action semantics are not. Rendered inside this
              branch so loading, error and empty states replace it rather than stacking above it. */}
          <ul className="divide-y divide-slate-100 md:hidden" aria-label="Patient report session history">
            {filteredEntries.map(({ session: sess, canReopen }) => {
              const retention = getRetentionDetails(sess);
              const RetentionIcon = retention?.icon;
              const hiddenTestCount = sess.reports.length - MAX_VISIBLE_TEST_CHIPS;

              return (
                <li key={sess.id} className="space-y-2 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold uppercase text-slate-900">{sess.demographics.fullName || "Unnamed Patient"}</p>
                      <p className="mt-0.5 font-mono font-bold tabular-nums text-blue-900">{sess.accessionNumber}</p>
                    </div>
                    <StatusBadge status={sess.status} size="sm" />
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {sess.reports.slice(0, MAX_VISIBLE_TEST_CHIPS).map((r) => (
                      <span key={r.id} className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200">{r.templateCode}</span>
                    ))}
                    {hiddenTestCount > 0 && (
                      <span
                        className="px-2 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-700 rounded border border-slate-300 whitespace-nowrap"
                        title={sess.reports.slice(MAX_VISIBLE_TEST_CHIPS).map((r) => r.templateCode).join(", ")}
                      >
                        <span aria-hidden="true">+{hiddenTestCount}</span>
                        <span className="sr-only">
                          {hiddenTestCount} more {hiddenTestCount === 1 ? "test" : "tests"} not shown
                        </span>
                      </span>
                    )}
                  </div>

                  {retention && (
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${retention.className}`}>
                      {RetentionIcon && <RetentionIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                      {retention.label}
                    </span>
                  )}

                  <p className="text-[11px] text-slate-500">
                    <span className="whitespace-nowrap tabular-nums">
                      {sess.demographics.age} {sess.demographics.ageUnit} / {sess.demographics.sex}
                    </span>
                    {sess.demographics.requestingPhysician && <> · {sess.demographics.requestingPhysician}</>}
                    <span className="whitespace-nowrap tabular-nums"> · {sess.demographics.examinationDate || "—"}</span>
                  </p>

                  <HistorySessionActions
                    entry={{ session: sess, canReopen }}
                    variant="card"
                    isDeleting={isDeletingId === sess.id}
                    onPreview={setPreviewSession}
                    onReopen={(target) => router.push(`/workspace?sessionId=${encodeURIComponent(target.id)}`)}
                    onDeleteDraft={setPendingDeleteEntry}
                  />
                </li>
              );
            })}
          </ul>
          </>
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
