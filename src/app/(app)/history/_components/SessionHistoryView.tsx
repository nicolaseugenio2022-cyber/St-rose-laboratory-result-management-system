"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
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
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
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

// The table uses `table-fixed`, so these proportions - not the widest cell content - decide column
// widths. That is what keeps the row inside its container: under the default auto layout a
// nowrap actions cell expands to its intrinsic width and pushes the table into horizontal scroll.
// Percentages are index-aligned with the header row and sum to 100. Status, retention and
// examination date share one lifecycle column, which is what lets five columns fit the shell.
const COLUMN_WIDTH_CLASS = [
  "w-[19%]", // accession - monospace identifier, needs a stable minimum
  "w-[27%]", // patient   - highest scan priority, carries secondary metadata beneath
  "w-[14%]", // tests     - bounded by the three-chip + N cap
  "w-[18%]", // status    - badge, retention and examination date on one wrapping line
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

  // The urgency tints are the shared Badge's own danger and warning variants, named rather than
  // retyped. Retention is deliberately NOT a StatusBadge: lifecycle status (Draft / Completed) and
  // retention are separate facts, and a Draft returns null above so it never shows either a
  // retention chip or an expiry.
  if (daysRemaining <= 2) {
    return { label, icon: AlertTriangle, variant: "danger" as const, quiet: false };
  }

  if (daysRemaining <= 7) {
    return { label, icon: Clock, variant: "warning" as const, quiet: false };
  }

  // Outside the warning window the chip is text only: same box, no visible edge or fill.
  return { label, icon: null, variant: "neutral" as const, quiet: true };
}

/** Retention wording is the same string in both renderings; only the tint differs by urgency. */
function RetentionChip({ retention }: { retention: NonNullable<ReturnType<typeof getRetentionDetails>> }) {
  const RetentionIcon = retention.icon;
  return (
    // The shared Badge carries the shape, so a retention chip and a status badge are the same
    // object in the system. `quiet` keeps the outside-the-window chip text-only, as before.
    <Badge
      variant={retention.variant}
      size="md"
      className={cn("px-1.5", retention.quiet && "bg-transparent ring-transparent")}
    >
      {RetentionIcon && <RetentionIcon aria-hidden="true" />}
      {retention.label}
    </Badge>
  );
}

/** Capped template-code chips with the +N overflow indicator, shared by both renderings. */
function TestCodeChips({ reports }: { reports: PatientReportSessionAggregate["reports"] }) {
  const hiddenTestCount = reports.length - MAX_VISIBLE_TEST_CHIPS;

  return (
    <div className="flex flex-wrap gap-1">
      {reports.slice(0, MAX_VISIBLE_TEST_CHIPS).map((r) => (
        // The shared Badge's neutral/sm variant is exactly this chip's established tint and
        // metrics, so the code chips stop being a retyped copy of it.
        <Badge key={r.id} variant="neutral" size="sm">
          {r.templateCode}
        </Badge>
      ))}
      {hiddenTestCount > 0 && (
        <Badge
          variant="neutral"
          size="sm"
          className="bg-brand-structural-hover ring-brand-border-strong"
          title={reports.slice(MAX_VISIBLE_TEST_CHIPS).map((r) => r.templateCode).join(", ")}
        >
          <span aria-hidden="true">+{hiddenTestCount}</span>
          <span className="sr-only">
            {hiddenTestCount} more {hiddenTestCount === 1 ? "test" : "tests"} not shown
          </span>
        </Badge>
      )}
    </div>
  );
}

/** Sized to the resolved geometry of both renderings: the md+ table and the narrow card list. */
function HistoryTableSkeleton() {
  return (
    <SkeletonRegion isLoading label="Loading session history">
      <div className="hidden overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low md:block">
        <table className="w-full table-fixed border-collapse text-left text-xs">
          <caption className="sr-only">Loading patient report session history</caption>
          <thead className="border-b border-brand-border bg-brand-structural">
            <tr>
              {Array.from({ length: TABLE_COLUMN_COUNT }).map((_, columnIndex) => (
                <th key={columnIndex} scope="col" className={`px-3 py-2 ${COLUMN_WIDTH_CLASS[columnIndex]}`}>
                  <Skeleton className="h-3 w-20 max-w-full" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border-subtle">
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: TABLE_COLUMN_COUNT }).map((__, columnIndex) => (
                  <td key={columnIndex} className="px-3 py-2 align-middle">
                    <Skeleton className="h-4 w-full" />
                    {/* The patient cell carries a second metadata line from lg up. */}
                    {columnIndex === 1 && <Skeleton className="mt-1 hidden h-3 w-2/3 lg:block" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, cardIndex) => (
          <div
            key={cardIndex}
            className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low"
          >
            <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-1.5 border-t border-brand-border-subtle px-3.5 py-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48 max-w-full" />
            </div>
            <div className="flex gap-2 border-t border-brand-border bg-brand-structural px-3.5 py-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        ))}
      </div>
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
    <div className="space-y-4">
      {/* Toolbar. Structural: search, scope and sort are controls ABOUT the records, so they
          recede behind the records themselves rather than presenting as another content panel. */}
      <div className="rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
        {/* One control row: search, scope, sort. It stacks at narrow widths rather than
            wrapping into an ambiguous grid. */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex min-w-0 flex-1 items-end gap-2 lg:max-w-md">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label
                htmlFor="history-search"
                className="block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted"
              >
                Search sessions
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-subtle"
                  aria-hidden="true"
                />
                <Input
                  id="history-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Accession prefix, patient name, or physician"
                  className="pl-9"
                />
              </div>
            </div>
            {hasActiveSearch && (
              <Button
                type="button"
                variant="outline"
                size="md"
                className="h-11 shrink-0 sm:h-9"
                onClick={() => setSearchQuery("")}
                aria-label="Clear session history search"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear search
              </Button>
            )}
          </div>
          {/* Scope. A group of real buttons with aria-pressed rather than a select: three
              options that are always worth seeing, and the counts belong beside them. */}
          <div className="shrink-0 space-y-1.5">
            <span
              id="history-scope-label"
              className="block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted"
            >
              Show
            </span>
            <div
              role="group"
              aria-labelledby="history-scope-label"
              // Height comes from the options below rather than a fixed mobile height: `h-11`
              // made the GROUP 44px, and the 2px inset then left each actual button 39px. The
              // group still sets the compact `sm:h-9` desktop height.
              className="inline-flex items-stretch rounded-md border border-brand-border bg-brand-structural p-0.5 text-xs sm:h-9"
            >
              {([
                ["ALL", `All (${entries.length})`],
                ["Completed", "Completed"],
                ["Draft", "Drafts"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  aria-pressed={statusFilter === value}
                  // `min-h-11` is the touch target itself, not the band around it; from `sm` up
                  // the group's own height governs again and the control stays compact.
                  className={`inline-flex min-h-11 items-center rounded px-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring sm:min-h-0 ${
                    statusFilter === value
                      ? "bg-brand-surface font-semibold text-brand-navy shadow-low"
                      : "text-brand-text-muted hover:text-brand-navy"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* The canonical sort control, and the only one: the table headers do not sort, so
              there is exactly one sorting interaction per viewport. */}
          <div className="w-full shrink-0 lg:w-56">
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
        </div>
        <div className="mt-2.5 flex flex-col gap-0.5 border-t border-brand-border pt-2 text-[11px] text-brand-text-muted sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <p aria-live="polite">
            {hasActiveAccessionSearch
              ? `Showing ${filteredEntries.length} of ${entries.length} accession matches returned`
              : `Showing ${filteredEntries.length} of ${entries.length} loaded sessions`}
          </p>
          <p className="sm:text-right">
            Name and physician searches cover the newest 50 loaded sessions; accession prefixes
            search retained history.
          </p>
        </div>
      </div>

      {deleteError && (
        <Alert variant="destructive" onDismiss={() => setDeleteError(null)}>
          {deleteError}
        </Alert>
      )}

      {/* Records. Each state supplies its own surface: the loading skeleton and the record table
          are white working panels, the empty states are structural, and a load failure is the
          shared destructive Alert. Nothing wraps them, so no panel ever sits inside another. */}
      {loading || serverSearchPending ? (
        <HistoryTableSkeleton />
      ) : loadError ? (
        <Alert variant="destructive">
          Session history could not be loaded: {loadError}
        </Alert>
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
          {/* md and up: the record table. The shared wrapper owns the border, the radius and any
              horizontal scroll, so a wide row scrolls inside the panel and never the page. */}
          <Table striped className="table-fixed" wrapperClassName="hidden shadow-low md:block">
            <caption className="sr-only">Patient report session history</caption>
            <TableHeader>
              {/* Plain headers. The Sort by select is canonical and carries every key, so the
                  headers simply label. The lifecycle header is named for what it holds. */}
              <tr>
                <TableHead className={`whitespace-normal ${COLUMN_WIDTH_CLASS[0]}`}>ACCESSION NO</TableHead>
                <TableHead className={`whitespace-normal ${COLUMN_WIDTH_CLASS[1]}`}>PATIENT</TableHead>
                <TableHead className={`whitespace-normal ${COLUMN_WIDTH_CLASS[2]}`}>TESTS</TableHead>
                <TableHead className={`whitespace-normal ${COLUMN_WIDTH_CLASS[3]}`}>STATUS / RETENTION</TableHead>
                <TableHead className={`whitespace-normal ${COLUMN_WIDTH_CLASS[4]}`}>ACTIONS</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {filteredEntries.map(({ session: sess, canReopen }) => {
                const retention = getRetentionDetails(sess);

                return (
                  <TableRow key={sess.id}>
                    <TableCell className="break-all font-mono font-semibold tabular-nums text-brand-navy xl:whitespace-nowrap xl:break-normal">
                      {sess.accessionNumber}
                    </TableCell>
                    <TableCell>
                      <div className="break-words font-semibold uppercase text-brand-text">
                        {sess.demographics.fullName || "Unnamed Patient"}
                      </div>
                      {/* Secondary identity metadata: lowest scan priority, so it is the first thing
                          dropped as width tightens. Both values remain available in Preview. */}
                      <div className="mt-0.5 hidden text-[11px] text-brand-text-muted lg:flex lg:items-baseline lg:gap-1.5">
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
                    </TableCell>
                    <TableCell>
                      <TestCodeChips reports={sess.reports} />
                    </TableCell>
                    <TableCell>
                      {/* Status, retention and examination date on one wrapping line. Every value
                          is unchanged - the retention wording is the same string. */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <StatusBadge status={sess.status} size="sm" />
                        {retention ? (
                          <RetentionChip retention={retention} />
                        ) : (
                          <span className="text-[11px] text-brand-text-muted">Not yet retained</span>
                        )}
                        <span className="font-mono text-[11px] tabular-nums text-brand-text-muted">
                          {sess.demographics.examinationDate || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <HistorySessionActions
                        entry={{ session: sess, canReopen }}
                        variant="table"
                        isDeleting={isDeletingId === sess.id}
                        onPreview={setPreviewSession}
                        onReopen={(target) => router.push(`/workspace?sessionId=${encodeURIComponent(target.id)}`)}
                        onDeleteDraft={setPendingDeleteEntry}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Below md: the SAME filteredEntries and the SAME handlers as record cards.
              Presentation is duplicated; data and action semantics are not. Rendered inside this
              branch so loading, error and empty states replace it rather than stacking above it. */}
          <ul className="space-y-3 md:hidden" aria-label="Patient report session history">
            {filteredEntries.map(({ session: sess, canReopen }) => {
              const retention = getRetentionDetails(sess);

              return (
                <li
                  key={sess.id}
                  className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low"
                >
                  <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold uppercase leading-tight text-brand-text">
                        {sess.demographics.fullName || "Unnamed Patient"}
                      </p>
                      <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-brand-navy">
                        {sess.accessionNumber}
                      </p>
                    </div>
                    <StatusBadge status={sess.status} size="sm" />
                  </div>

                  <div className="space-y-1.5 border-t border-brand-border-subtle px-3.5 py-2">
                    <TestCodeChips reports={sess.reports} />

                    {retention && <RetentionChip retention={retention} />}

                    <p className="text-[11px] text-brand-text-muted">
                      <span className="whitespace-nowrap tabular-nums">
                        {sess.demographics.age} {sess.demographics.ageUnit} / {sess.demographics.sex}
                      </span>
                      {sess.demographics.requestingPhysician && <> · {sess.demographics.requestingPhysician}</>}
                      <span className="whitespace-nowrap tabular-nums"> · {sess.demographics.examinationDate || "—"}</span>
                    </p>
                  </div>

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

      {/* Report Preview Modal */}
      <Modal
        isOpen={previewSession !== null}
        onClose={() => setPreviewSession(null)}
        title={`Session Preview — ${previewSession?.accessionNumber ?? ""}`}
        closeLabel="Close session preview"
        // `sm:max-w-5xl` as well as the base: Modal caps itself at `sm:max-w-lg`, and a bare
        // `max-w-5xl` is a different variant, so it never displaced that cap and the preview
        // stayed 512px from `sm` up - narrow enough to squeeze the report toolbar. Modal keeps
        // its own viewport-inset width below `sm`, so the phone width is unchanged.
        className="max-h-[90vh] max-w-5xl overflow-hidden sm:max-w-5xl"
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
