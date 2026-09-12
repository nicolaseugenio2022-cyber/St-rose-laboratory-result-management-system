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
// The same wording the report prints. The list row carries the stored age and unit rather than a
// date of birth - the list projection is deliberately narrow - but the unit is now recorded
// correctly at entry, so "8 months" reads identically here and on the sheet.
import { formatPatientAge } from "@/domain/patient-age";
import {
  deleteCompletedSessionAction as deleteCompletedSession,
  deleteDraftSessionAction as deleteDraftSession,
  getVisibleSessionDetailAction,
  listRecentSessionsAction,
} from "@/features/server-boundary/server-actions";
import { fromSessionTransport } from "@/features/server-boundary/session-transport";
import type { PatientReportSessionListEntry } from "@/features/server-boundary/session-transport";
import type { SessionHistoryEntryTransport } from "@/features/server-boundary/server-actions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { SYSTEM_CONSTANTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
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
  session: PatientReportSessionListEntry;
  canReopen: boolean;
};

/**
 * A Preview the operator has asked for, before its session has arrived (SHADCN-07C2).
 *
 * The list row no longer carries a report body, so opening Preview starts a load. The accession is
 * kept alongside the id purely so the modal can title itself from the row that was clicked rather
 * than waiting for the response to name it.
 */
type PreviewRequest = {
  sessionId: string;
  accessionNumber: string | null;
};

type SortKey = "accession" | "patient" | "date" | "retention";
type SortDirection = "ascending" | "descending";

const TABLE_COLUMN_COUNT = 4;

// The table uses `table-fixed`, so these proportions - not the widest cell content - decide column
// widths. That is what keeps the row inside its container: under the default auto layout a
// nowrap actions cell expands to its intrinsic width and pushes the table into horizontal scroll.
// Percentages are index-aligned with the header row and sum to 100.
//
// Budgeted against the TIGHTEST shell width, which occurs at `lg`: the sidebar becomes static and
// claims 256px in one step, leaving roughly 710px of table. Two columns previously could not fit
// their own contents there, and because the frame is `overflow-hidden` and `table-fixed w-full`
// never exceeds 100%, the scroll container never engages - so an overlong cell was silently
// clipped by the Badge's own `overflow-hidden` rather than scrolled to:
//
//   - retention at 18% gave 107px of content against "Expires in NN days" plus its urgency icon,
//     which measures ~129px. The chip is `whitespace-nowrap` and cannot shrink, so the retention
//     wording - the one fact with a deadline attached - was the thing being cut off.
//   - tests at 14% gave 78px against the longest real template code, BLOOD_TYPING, at ~82px.
//
// Folding the accession into the patient cell is what pays for both. It is a single token that is
// never sorted from a header (the Sort by select is canonical), so a column of its own bought
// nothing that a dedicated line inside the identity block does not - and it now has room to sit
// on ONE line at every width instead of `break-all` splitting an accession number in two.
// Re-budgeted when the Administrator removal became a third action in the same cell. Actions takes
// the 6 points it needs from patient and tests so three LABELLED controls fit its content box at a
// 1440 desktop, and lifecycle is left exactly where it was because 22% is what its own longest
// wording was measured against above.
const COLUMN_WIDTH_CLASS = [
  "w-[30%]", // patient   - name, then accession and examination date, then identity metadata
  "w-[18%]", // tests     - 128px at the tightest shell: still clears the longest template code
  "w-[22%]", // lifecycle - 132px of content: clears the longest retention wording plus its icon
  "w-[30%]", // actions   - three controls, labelled at every width; the group wraps when needed
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
// into a +N indicator. Display only - the row carries every report's code, and
// Preview loads the complete session separately when it is opened.
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

function getRetentionDetails(session: PatientReportSessionListEntry) {
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
  // Danger is drawn exactly where the wording already reads as urgent on its own - "Expires
  // today" and "Expires tomorrow" - rather than at an arbitrary day count. Warning is then the
  // shared expiring-soon threshold, and everything beyond it is simply retained. All three tiers
  // stay reachable inside a seven-day window; the previous seven-day warning boundary covered the
  // whole window, which made every retained record amber and left the quiet tier unreachable.
  if (daysRemaining <= 1) {
    return { label, icon: AlertTriangle, variant: "danger" as const, quiet: false };
  }

  if (daysRemaining <= SYSTEM_CONSTANTS.RETENTION.EXPIRING_SOON_DAYS) {
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
      // `whitespace-normal` overrides the Rhea badge's own `whitespace-nowrap`. The chip is sized
      // to fit its longest wording at the tightest shell width, so this never fires in practice -
      // but the badge is also `overflow-hidden`, so if it ever did come up short the failure mode
      // without this is a SILENTLY CLIPPED retention deadline, with no ellipsis to hint at it.
      // Wrapping is the safe failure for a fact with a date attached.
      className={cn("whitespace-normal px-1.5", retention.quiet && "bg-transparent ring-transparent")}
    >
      {RetentionIcon && <RetentionIcon aria-hidden="true" />}
      {retention.label}
    </Badge>
  );
}

/**
 * The lifecycle cell's retention line, for both renderings.
 *
 * Lifecycle status and retention are separate facts about a session, and retention is only a fact
 * about a COMPLETED one - a draft is not retained, it is unfinished. `getRetentionDetails` already
 * returns null for a draft, but returning null is not by itself enough: the caller still has to
 * decide what to render in its place, and rendering the "Not yet retained" line there stated
 * retention information about a session the rule does not apply to.
 *
 * Gating on the status here means that line is reachable only by a completed session that has no
 * expiry recorded yet, and a draft states its lifecycle alone. Both renderings call this, so the
 * table and the card cannot drift apart on it - which they already had: the table showed the
 * placeholder and the card showed nothing.
 */
function SessionRetentionLine({
  session,
  retention,
}: {
  session: PatientReportSessionListEntry;
  retention: ReturnType<typeof getRetentionDetails>;
}) {
  if (session.status !== "Completed") return null;

  return retention ? (
    <RetentionChip retention={retention} />
  ) : (
    // `block` rather than the default inline: the card renders this inside a `space-y` stack,
    // where a vertical margin on an inline box is simply dropped and the line would sit tight
    // against the chips above it.
    <span className="block text-[11px] text-brand-text-muted">Not yet retained</span>
  );
}

/** Capped template-code chips with the +N overflow indicator, shared by both renderings. */
function TestCodeChips({ reports }: { reports: PatientReportSessionListEntry["reports"] }) {
  const hiddenTestCount = reports.length - MAX_VISIBLE_TEST_CHIPS;

  return (
    <div className="flex flex-wrap gap-1">
      {reports.slice(0, MAX_VISIBLE_TEST_CHIPS).map((r) => (
        // The shared Badge's neutral/sm variant is exactly this chip's established tint and
        // metrics, so the code chips stop being a retyped copy of it. `whitespace-normal` for the
        // same reason the retention chip carries it: the badge is `overflow-hidden`, so a code
        // wider than the column is clipped rather than scrolled to, and a half-shown template
        // code misnames the test that was run.
        <Badge key={r.id} variant="neutral" size="sm" className="whitespace-normal break-words">
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
                    {/* Column 0 is the patient identity block: the name, then the accession and
                        examination date line, then a third metadata line from lg up. */}
                    {columnIndex === 0 && (
                      <>
                        <Skeleton className="mt-1 h-3 w-3/4" />
                        <Skeleton className="mt-1 hidden h-3 w-2/3 lg:block" />
                      </>
                    )}
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
 *  every client refetch alike, so ownership-derived reopen rights always map the same way.
 *
 *  SHADCN-07C2: no aggregate is rebuilt here any more. The entry arrives as the narrow list DTO
 *  and is taken as it is - rehydrating fifty sessions into `PatientReportSessionAggregate`
 *  instances was only ever possible because the server had shipped every result and signatory row
 *  to make it possible. */
function toHistoryEntry(entry: SessionHistoryEntryTransport): SessionHistoryEntry {
  return {
    session: entry.session,
    canReopen: entry.canReopen,
  };
}

export function SessionHistoryView({
  initialEntries,
  canDeleteCompleted = false,
}: {
  /** Server-fetched first page. When present, the first client fetch is skipped: the rows arrive
   *  with the HTML instead of after hydrate + a server-action round trip. Search, manual reload
   *  and every later refetch behave exactly as before. */
  initialEntries?: SessionHistoryEntryTransport[];
  /**
   * Whether this viewer may permanently delete a COMPLETED session - true only for an
   * Administrator, resolved on the server from the authenticated account.
   *
   * Default FALSE so the capability is never assumed: a caller that omits it offers no removal.
   * Presentation only. `deleteCompletedSessionAction` re-resolves the caller and refuses a
   * non-Administrator itself, so this prop decides what is SHOWN and never what is ALLOWED.
   */
  canDeleteCompleted?: boolean;
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
  // Preview is now a request plus its outcome, not a row the list already held. `previewSession`
  // is still the complete session the renderer needs - it just arrives from its own authorized
  // load instead of riding along with every other row.
  const [previewRequest, setPreviewRequest] = useState<PreviewRequest | null>(null);
  const [previewSession, setPreviewSession] = useState<PatientReportSessionAggregate | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(initialEntries === undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<SessionHistoryEntry | null>(null);
  // A SECOND pending slot, not a reused one. The two deletions confirm different things about
  // different lifecycle states, and one shared slot would let the completed dialog open holding a
  // draft - the one mistake a permanent deletion must not be able to make.
  const [pendingCompletedDeleteEntry, setPendingCompletedDeleteEntry] =
    useState<SessionHistoryEntry | null>(null);
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
      } catch {
        if (superseded) return;
        // listRecentSessionsAction still throws (out of scope for SHADCN-07B2); the fixed
        // fallback is now the only wording it can produce.
        setLoadError("Session history could not be loaded.");
      } finally {
        if (!superseded) setLoading(false);
      }
    };

    void loadHistory();
    return () => {
      superseded = true;
    };
  }, [debouncedAccessionSearch, reloadToken]);

  // Load the requested session's complete record, discarding a response the operator has already
  // closed or superseded by opening a different row. Authorization, draft ownership and the
  // retention window are all the server's decision - this only shows the sentence it returned.
  const previewSessionId = previewRequest?.sessionId;
  useEffect(() => {
    if (!previewSessionId) return;

    let superseded = false;
    setPreviewSession(null);
    setPreviewError(null);

    getVisibleSessionDetailAction({ sessionId: previewSessionId })
      .then((result) => {
        if (superseded) return;
        if (!result.success) {
          setPreviewError(result.error);
          return;
        }
        setPreviewSession(fromSessionTransport(result.data));
      })
      .catch(() => {
        if (superseded) return;
        // Unexpected rejection only, and never the thrown text: Next.js has already replaced a
        // Server Action's own wording with a redaction string before it crosses the wire.
        setPreviewError("This session could not be opened for preview.");
      });

    return () => {
      superseded = true;
    };
  }, [previewSessionId]);

  const handleClosePreview = () => {
    setPreviewRequest(null);
    setPreviewSession(null);
    setPreviewError(null);
  };

  const handlePreview = (session: PatientReportSessionListEntry) => {
    setPreviewRequest({ sessionId: session.id, accessionNumber: session.accessionNumber });
  };

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

  /**
   * Permanently delete one COMPLETED session.
   *
   * The same shape as the draft deletion: single-flight on `isDeletingId`, the dialog closed
   * before the outcome is read, the list re-read ONLY on success so a refusal cannot make a row
   * disappear, and never the thrown message - an unexpected rejection gets this fixed sentence.
   */
  const handleConfirmDeleteCompleted = async () => {
    const entry = pendingCompletedDeleteEntry;
    if (!entry) return;
    if (isDeletingId) return;

    const { session } = entry;
    setIsDeletingId(session.id);
    setDeleteError(null);
    try {
      const deleted = await deleteCompletedSession({ sessionId: session.id });
      setPendingCompletedDeleteEntry(null);
      if (!deleted.success) {
        // An expected refusal: an unauthorized caller, or a session already gone. Nothing was
        // deleted, so the list is deliberately NOT refreshed.
        setDeleteError(deleted.error);
        return;
      }
      setReloadToken((current) => current + 1);
    } catch {
      setPendingCompletedDeleteEntry(null);
      setDeleteError("The completed session could not be deleted.");
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleConfirmDeleteDraft = async () => {
    const entry = pendingDeleteEntry;
    if (!entry) return;
    if (isDeletingId) return;

    const { session } = entry;
    setIsDeletingId(session.id);
    setDeleteError(null);
    try {
      const deleted = await deleteDraftSession({ sessionId: session.id });
      setPendingDeleteEntry(null);
      if (!deleted.success) {
        // Expected refusal - missing, not owned, or no longer a draft. All three share one
        // sentence by design, so this never becomes an existence oracle. The list is NOT
        // refreshed: nothing was deleted.
        setDeleteError(deleted.error);
        return;
      }
      setReloadToken((current) => current + 1);
    } catch {
      // Unexpected rejection only; never the thrown message.
      setPendingDeleteEntry(null);
      setDeleteError("The draft could not be deleted.");
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
        // `loadError` is already a complete sentence - the fixed fallback set above is the only
        // wording it can hold - so prefixing it here read it back to the operator twice.
        <Alert variant="destructive">{loadError}</Alert>
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
            headingLevel={2}
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
            headingLevel={2}
          />
        ) : (
          <EmptyState
            icon={History}
            title="No session history yet"
            description="Patient report sessions will appear here after they are created."
            headingLevel={2}
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
                  headers simply label. Written in sentence case: TableHead already applies
                  `uppercase`, so typing the caps as well left the real casing unavailable to a
                  screen reader and to anyone copying the column name out. The rendering is
                  identical. */}
              <tr>
                <TableHead className={`whitespace-normal ${COLUMN_WIDTH_CLASS[0]}`}>Patient</TableHead>
                <TableHead className={`whitespace-normal ${COLUMN_WIDTH_CLASS[1]}`}>Tests</TableHead>
                <TableHead className={`whitespace-normal ${COLUMN_WIDTH_CLASS[2]}`}>Lifecycle</TableHead>
                <TableHead className={`whitespace-normal ${COLUMN_WIDTH_CLASS[3]}`}>Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {filteredEntries.map(({ session: sess, canReopen }) => {
                const retention = getRetentionDetails(sess);

                return (
                  <TableRow key={sess.id}>
                    <TableCell>
                      {/* The identity block, in scan order: who, then which record, then who
                          ordered it. `truncate` with a title rather than `break-words` - a
                          wrapped name changes the row height and breaks the horizontal scan
                          line that makes a long table readable. */}
                      <div
                        className="truncate font-semibold uppercase text-brand-text"
                        title={sess.demographics.fullName || "Unnamed Patient"}
                      >
                        {sess.demographics.fullName || "Unnamed Patient"}
                      </div>
                      {/* The record's two hard identifiers, on one line and visible at EVERY
                          width. The accession keeps its navy monospace treatment, so it still
                          reads as the identifier it is and still forms a vertical scan line -
                          it simply no longer needs a column to do it, and it no longer breaks
                          across two lines below xl. */}
                      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]">
                        <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-brand-navy">
                          {sess.accessionNumber}
                        </span>
                        <span className="whitespace-nowrap font-mono tabular-nums text-brand-text-muted">
                          {sess.demographics.examinationDate || "—"}
                        </span>
                      </div>
                      {/* Secondary identity metadata: lowest scan priority, so it is the first thing
                          dropped as width tightens. Both values remain available in Preview. */}
                      <div className="mt-0.5 hidden text-[11px] text-brand-text-muted lg:flex lg:items-baseline lg:gap-1.5">
                        <span className="whitespace-nowrap tabular-nums">
                          {formatPatientAge(sess.demographics.age, sess.demographics.ageUnit)} / {sess.demographics.sex}
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
                      {/* Lifecycle first, retention beneath it. Stacking states them as the two
                          separate facts they are rather than running them together on one line,
                          and a draft renders the badge alone. Every value is unchanged - the
                          retention wording is the same string. */}
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={sess.status} size="sm" />
                        <SessionRetentionLine session={sess} retention={retention} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <HistorySessionActions
                        entry={{ session: sess, canReopen }}
                        variant="table"
                        isDeleting={isDeletingId === sess.id}
                        onPreview={handlePreview}
                        onReopen={(target) => router.push(`/workspace?sessionId=${encodeURIComponent(target.id)}`)}
                        onDeleteDraft={setPendingDeleteEntry}
                        canDeleteCompleted={canDeleteCompleted}
                        onDeleteCompleted={setPendingCompletedDeleteEntry}
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
          {/* The same floating-launcher clearance the Workspace surfaces subtract. The chat
              launcher is fixed at every width and reserves no space of its own, so without this
              the last card's actions sat underneath it. */}
          <ul
            className="space-y-3 pb-[var(--floating-dock-clearance)] md:hidden"
            aria-label="Patient report session history"
          >
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

                    {/* The same rule the table applies, through the same component: a completed
                        session states its retention, a draft states none. */}
                    <SessionRetentionLine session={sess} retention={retention} />

                    <p className="text-[11px] text-brand-text-muted">
                      <span className="whitespace-nowrap tabular-nums">
                        {formatPatientAge(sess.demographics.age, sess.demographics.ageUnit)} / {sess.demographics.sex}
                      </span>
                      {sess.demographics.requestingPhysician && <> · {sess.demographics.requestingPhysician}</>}
                      <span className="whitespace-nowrap tabular-nums"> · {sess.demographics.examinationDate || "—"}</span>
                    </p>
                  </div>

                  <HistorySessionActions
                    entry={{ session: sess, canReopen }}
                    variant="card"
                    isDeleting={isDeletingId === sess.id}
                    onPreview={handlePreview}
                    onReopen={(target) => router.push(`/workspace?sessionId=${encodeURIComponent(target.id)}`)}
                    onDeleteDraft={setPendingDeleteEntry}
                    canDeleteCompleted={canDeleteCompleted}
                    onDeleteCompleted={setPendingCompletedDeleteEntry}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Report Preview Modal. The modal opens on the REQUEST, so the operator gets the same
          immediate response to the click as before; what follows is the load. The title comes
          from the row that was clicked, so it never blanks while the session is in flight. */}
      <Modal
        isOpen={previewRequest !== null}
        onClose={handleClosePreview}
        title={`Session Preview — ${previewRequest?.accessionNumber ?? ""}`}
        closeLabel="Close session preview"
        // `sm:max-w-5xl` as well as the base: Modal caps itself at `sm:max-w-lg`, and a bare
        // `max-w-5xl` is a different variant, so it never displaced that cap and the preview
        // stayed 512px from `sm` up - narrow enough to squeeze the report toolbar. Modal keeps
        // its own viewport-inset width below `sm`, so the phone width is unchanged.
        className="max-h-[90vh] max-w-5xl overflow-hidden sm:max-w-5xl"
      >
        {previewRequest && (
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto pr-1">
            {previewError ? (
              // An honest failure, in the surface History already uses for one. The sentence is
              // the server's own refusal wording, or the fixed client sentence for an
              // unexpected rejection - never a caught value's text.
              <Alert variant="destructive">{previewError}</Alert>
            ) : previewSession ? (
              <SharedRenderingEngine session={previewSession} targetOutput="ScreenPreview" />
            ) : (
              // Deliberately the same skeleton the rendering chunk's own loading state uses, so
              // fetching the session and loading the renderer read as one wait rather than two.
              <SkeletonRegion isLoading label="Loading session preview">
                <Skeleton className="mx-auto h-[70vh] min-h-96 w-full max-w-[210mm]" />
              </SkeletonRegion>
            )}
          </div>
        )}
      </Modal>

      {/* Permanent removal of an issued clinical record, so the dialog names the record it will
          destroy - accession and patient - and says exactly what goes with it. */}
      <ConfirmDialog
        isOpen={pendingCompletedDeleteEntry !== null}
        onCancel={() => setPendingCompletedDeleteEntry(null)}
        onConfirm={() => void handleConfirmDeleteCompleted()}
        title="Delete this completed session?"
        description={`Permanently delete completed session ${pendingCompletedDeleteEntry?.session.accessionNumber ?? ""} for ${pendingCompletedDeleteEntry?.session.demographics.fullName || "Unnamed Patient"}. The session and its report data are removed for good and cannot be recovered.`}
        confirmLabel="Delete session"
        pendingLabel="Deleting..."
        variant="destructive"
        isPending={isDeletingId === pendingCompletedDeleteEntry?.session.id}
      />

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
