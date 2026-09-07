"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Filter,
  Key,
  AlertCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { formatRoleLabel } from "@/config/roles";
import type { UserRole } from "@/domain/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { readAuditPageAction } from "@/features/server-boundary/audit-actions";
import type {
  AuditCategory,
  AuditCategoryFilter,
  AuditEventTransport,
  AuditPageTransport,
  AuditReadCriteria,
} from "@/services/audit-read-service";

type AuditFilters = {
  category: AuditCategoryFilter;
  eventType: string;
  from: string;
  to: string;
  search: string;
};

export interface AuditLogViewProps {
  initialPage: AuditPageTransport;
  initialCriteria: AuditReadCriteria;
}

const CATEGORY_OPTIONS: ReadonlyArray<{
  label: string;
  value: AuditCategoryFilter;
}> = [
  { label: "All Events", value: "ALL" },
  { label: "AuthAccount", value: "AuthAccount" },
  { label: "PersonnelCredential", value: "PersonnelCredential" },
  { label: "SessionReport", value: "SessionReport" },
  { label: "SecurityDenial", value: "SecurityDenial" },
];

/**
 * Trailing debounce for the two free-text filters, in milliseconds.
 *
 * Typing previously issued one request per keystroke - 23 for "RecoveryLookupAttempted" - and every
 * intermediate request was guaranteed useless, because Event type is matched exactly and a prefix of
 * an identifier matches nothing. Only the REQUEST is delayed; the visible input state always updates
 * immediately. 300ms clears ordinary mid-word hesitation (inter-keystroke gaps run ~150-250ms, and
 * pauses while recalling an identifier routinely exceed 250ms) while keeping the settle time well
 * under the ~500ms threshold where a control starts to feel laggy. Structured controls - Category,
 * From/To, chip removal, Clear all, pagination - stay immediate: each of those changes is a
 * deliberate, complete value, not a partial one.
 */
const FILTER_DEBOUNCE_MS = 300;

/**
 * How often the view re-reads the current page on its own, in milliseconds.
 *
 * The audit log is append-only and read by someone watching events arrive, so the list should be
 * current without being asked. 30s is slow enough that an operator reading a page is not fighting
 * the screen, and fast enough that "is it live?" never becomes a question - which is the doubt a
 * manual Refresh button creates rather than answers.
 *
 * A sync re-reads the CURRENT criteria and offset and never resets either, so it cannot move the
 * operator's place in the list. See the tick's guards for the four situations it stands down in.
 */
const AUTO_SYNC_INTERVAL_MS = 30_000;

/** The filter state that means "nothing is being filtered". Used by Clear all and by the
 *  active-filter derivation, so the two can never disagree about what "empty" means. */
const EMPTY_FILTERS: AuditFilters = {
  category: "ALL",
  eventType: "",
  from: "",
  to: "",
  search: "",
};

/**
 * The filters currently narrowing the result set, in display order.
 *
 * `verb` states how the repository actually applies that field, because the five filters do NOT
 * share one contract: Event type is equality against the RAW stored identifier, Search is a
 * wildcard match over the username and target reference, and From/To are range bounds. Describing a
 * range bound as "contains" would name a different operation, so each entry carries its own verb.
 * `mono` marks the one value an operator must type character-for-character.
 */
type ActiveFilter = {
  key: keyof AuditFilters;
  label: string;
  value: string;
  verb: string;
  mono: boolean;
};

function activeFilters(filters: AuditFilters): ReadonlyArray<ActiveFilter> {
  const active: ActiveFilter[] = [];
  if (filters.category !== "ALL") {
    const option = CATEGORY_OPTIONS.find((candidate) => candidate.value === filters.category);
    // Chosen from a fixed list, so this describes the operator's selection. It is not typed, and it
    // is not always plain equality - AuthAccount also matches the legacy "Authentication" category.
    active.push({
      key: "category",
      label: "Category",
      value: option ? option.label : filters.category,
      verb: "is",
      mono: false,
    });
  }
  if (filters.eventType.trim()) {
    active.push({
      key: "eventType",
      label: "Event type",
      value: filters.eventType.trim(),
      verb: "is exactly",
      mono: true,
    });
  }
  if (filters.from) {
    active.push({ key: "from", label: "From", value: filters.from, verb: "on or after", mono: false });
  }
  if (filters.to) {
    active.push({ key: "to", label: "To", value: filters.to, verb: "on or before", mono: false });
  }
  if (filters.search.trim()) {
    active.push({
      key: "search",
      label: "Search",
      value: filters.search.trim(),
      verb: "contains",
      mono: false,
    });
  }
  return active;
}

function toDateTimeLocalValue(value?: string): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string | undefined {
  if (!value) return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function buildCriteria(
  filters: AuditFilters,
  limit: number,
  offset: number
): AuditReadCriteria {
  const criteria: AuditReadCriteria = {
    category: filters.category,
    limit,
    offset,
  };
  const eventType = filters.eventType.trim();
  const search = filters.search.trim();
  const from = toIsoDateTime(filters.from);
  const to = toIsoDateTime(filters.to);

  if (eventType) criteria.eventType = eventType;
  if (from) criteria.from = from;
  if (to) criteria.to = to;
  if (search) criteria.search = search;

  return criteria;
}

function formatOccurredAt(value: string): string {
  const date = new Date(value);
  // AUDIT_TIMESTAMP_FORMAT is the shared pinned formatter declared with the other two below.
  return Number.isNaN(date.getTime()) ? value : AUDIT_TIMESTAMP_FORMAT.format(date);
}

// Labels for the detail keys the server currently emits. This is a presentation map only: it
// renames nothing and invents no values. A key that is absent here still renders - see
// humanizeIdentifier - so a future event type degrades to a readable label instead of vanishing.
const DETAIL_LABELS: Record<string, string> = {
  reasonCode: "Reason code",
  clientIp: "Client IP",
  failureCount: "Failure count",
  lockoutExpiresAt: "Lockout expires at",
  objectPath: "Object path",
  previousObjectPath: "Previous object path",
  purgedCount: "Purged count",
  reportCount: "Report count",
  sessionId: "Session ID",
  templateCodes: "Template codes",
  outcome: "Outcome",
  method: "Method",
  targetUserId: "Target user ID",
  bootstrap: "Bootstrap",
  personnelId: "Personnel ID",
  personnelRole: "Personnel role",
  status: "Status",
  previousStatus: "Previous status",
  isActive: "Active",
  previousRole: "Previous role",
  changedFields: "Changed fields",
  deletedAt: "Deleted at",
  executionTimestamp: "Executed at",
  retentionWindowDays: "Retention window (days)",
  selfService: "Self-service",
  attemptCount: "Attempts",
  ipAttemptCount: "Attempts from this IP",
  usernameAttemptCount: "Attempts for this username",
  tokenVersion: "Token version",
  previousTokenVersion: "Previous token version",
  newTokenVersion: "New token version",
};

/**
 * Outcome tone is presentation only. The label always carries the meaning, so the column stays
 * fully readable without colour; the tint is a secondary cue, never the message.
 */
type OutcomeTone = "negative" | "caution" | "positive" | "neutral";

/**
 * Every outcome value the server actually records today, by tone.
 *
 * No current outcome is toned "positive". eligible / verified / completed describe progression
 * through an UNAUTHENTICATED account-recovery flow - they record how far an attempt reached, not
 * that it was legitimate. Colouring them green would make a successful hostile recovery the
 * greenest sequence in the table, on rows whose actor column is blank. Emphasis is therefore
 * reserved for outcomes the record itself reports as refusal, failure or throttling. The "positive"
 * tone stays in the palette for a future outcome that genuinely reports a safe state; nothing may
 * be toned by event-type NAME.
 */
const OUTCOME_TONES: Record<string, OutcomeTone> = {
  unknown_username: "negative",
  inactive_account: "negative",
  invalid_password: "negative",
  not_eligible: "negative",
  not_verified: "negative",
  throttled: "caution",
  eligible: "neutral",
  verified: "neutral",
  completed: "neutral",
};

/**
 * Toned outcomes render through the shared Badge so the audit table carries the same chip
 * vocabulary as every other module: negative = danger, caution = warning, positive = success.
 * "neutral" never reaches this map - it renders as quiet text (see OutcomeBadge).
 */
const OUTCOME_TONE_VARIANT: Record<
  Exclude<OutcomeTone, "neutral">,
  "danger" | "warning" | "success"
> = {
  negative: "danger",
  caution: "warning",
  positive: "success",
};

/**
 * Report only what the record contains - never infer an outcome from the event name.
 *   1. an explicit details.outcome -> that recorded value, humanized
 *   2. category "SecurityDenial"   -> "Denied", which the category itself records
 *   3. anything else               -> "Recorded", a neutral statement that claims nothing
 * An outcome value added later still renders, humanized, instead of vanishing or being
 * misclassified as a success or a failure.
 */
function resolveOutcome(event: {
  category: AuditCategory;
  details: Record<string, unknown> | null;
}): { label: string; tone: OutcomeTone } {
  const recorded = event.details?.outcome;
  if (typeof recorded === "string" && recorded.trim() !== "") {
    return {
      label: humanizeIdentifier(recorded),
      tone: Object.prototype.hasOwnProperty.call(OUTCOME_TONES, recorded)
        ? OUTCOME_TONES[recorded]
        : "neutral",
    };
  }
  if (event.category === "SecurityDenial") {
    return { label: "Denied", tone: "negative" };
  }
  return { label: "Recorded", tone: "neutral" };
}

function OutcomeBadge({
  event,
}: {
  event: { category: AuditCategory; details: Record<string, unknown> | null };
}) {
  const { label, tone } = resolveOutcome(event);
  if (tone === "neutral") {
    // Quiet by design: the row records something, but the record makes no claim about it.
    return <span className="whitespace-nowrap text-[11px] text-brand-text-muted">{label}</span>;
  }
  return (
    <Badge variant={OUTCOME_TONE_VARIANT[tone]} size="sm" className="shrink-0">
      {label}
    </Badge>
  );
}

/**
 * Column widths for the audit table.
 *
 * The table is `table-fixed`, so these proportions - not the widest cell content - decide column
 * widths. That is what keeps the row inside its container: under auto layout a nowrap cell expands
 * to its intrinsic width and pushes the table into horizontal scroll. Sized against the tightest
 * shell budget, which occurs exactly at `lg`: the sidebar becomes static and claims 256px in one
 * step, leaving roughly 704px of content width at a 1024px viewport.
 *
 * Outcome is the binding constraint - it is sized so the longest recorded value ("Unknown
 * username") never truncates, because a clipped outcome would misreport what was recorded.
 *
 * These are arbitrary-value classes. A passing build does NOT prove Tailwind emitted them - when
 * layout correctness depends on arbitrary width or spacing classes, check the built CSS for the
 * generated rules rather than trusting the build exit code.
 */
const AUDIT_COLUMN_WIDTH = [
  "w-[14%]", // timestamp - stacked date over time below 2xl
  "w-[26%]", // event     - highest scan priority, label may wrap to two lines
  "w-[19%]", // outcome   - never truncates
  "w-[12%]", // performed by
  "w-[19%]", // target reference
  "w-[10%]", // details   - icon-only below 2xl
];

// Fixed en-US parts rather than the browser default locale: the column has a budgeted width, and a
// locale-dependent format makes that width vary per client. The instant itself is untouched, and
// the full local timestamp stays available through `title` and the details panel.
/**
 * Native date-picker indicator for the two Audit date fields.
 *
 * The indicator normally sits at the END of the input's inline flow, so its position depends on the
 * width of the datetime text before it. An `<input>` clips its inner editor, and `rounded-lg` cuts
 * whatever reaches the right edge - which is why the glyph appeared sliced, and why adding right
 * padding made it worse rather than better: a narrower content box pushes the in-flow indicator
 * FURTHER into the clip boundary.
 *
 * Taking it out of flow removes that coupling entirely. The input becomes the containing block and
 * the indicator is pinned to a fixed inset from the right border and centred vertically, so its
 * position no longer depends on the text at all. `pr-7` then reserves the lane it occupies so the
 * value can never run underneath it. The narrowest real case is a 1280px viewport: ~182px per
 * field, leaving ~140px of text room against roughly 115px of `dd/mm/yyyy --:-- --`.
 *
 * The control itself is untouched - still the native picker, still keyboard-operable, still the same
 * parsing and value semantics. Scoped to these two fields, not the shared Input primitive.
 */
const DATE_INPUT_CLASS =
  "relative pr-7 " +
  "[&::-webkit-calendar-picker-indicator]:absolute " +
  "[&::-webkit-calendar-picker-indicator]:right-2.5 " +
  "[&::-webkit-calendar-picker-indicator]:top-1/2 " +
  "[&::-webkit-calendar-picker-indicator]:-translate-y-1/2 " +
  "[&::-webkit-calendar-picker-indicator]:m-0 " +
  "[&::-webkit-calendar-picker-indicator]:p-0 " +
  "[&::-webkit-calendar-picker-indicator]:h-4 " +
  "[&::-webkit-calendar-picker-indicator]:w-4 " +
  "[&::-webkit-calendar-picker-indicator]:cursor-pointer " +
  "[&::-webkit-calendar-picker-indicator]:opacity-60 " +
  "hover:[&::-webkit-calendar-picker-indicator]:opacity-100 " +
  "[&:focus::-webkit-calendar-picker-indicator]:opacity-100";

const AUDIT_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const AUDIT_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});
/**
 * The full instant, for the places that state a timestamp rather than scan one: the row's
 * `title`, the "View details" accessible name, and the Occurred row in the detail dialog.
 *
 * Pinned to the same explicit locale as the two formatters above, for the same reason they
 * are. A bare `toLocaleString()` resolves against the host's default, and the server's default
 * is not the browser's - it rendered `04/09/2026, 12:14:57 pm` into these attributes while the
 * client produced `9/4/2026, 12:14:57 PM`, which React reported as a hydration mismatch and
 * then left un-patched. Same instant, same visible wording as the client already showed; only
 * the locale is now stated rather than inherited.
 */
const AUDIT_TIMESTAMP_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * The last-synced stamp, carrying a date only when it needs one.
 *
 * A time alone cannot say which day it belongs to, and this stamp can outlive the day it was
 * taken: a failed background sync pauses the timer until the operator acts, and a hidden tab
 * syncs nothing at all. Either one can carry "updated 11:52 PM" across midnight, where it reads
 * as eight minutes old instead of nine hours - and in the hidden-tab case the label still says
 * "Auto-syncing", which makes the claim worse rather than merely vague.
 *
 * Dating it unconditionally would answer that by putting a full timestamp into an 11px ambient
 * status that is read at a glance, so the date appears only on the reading where the time alone
 * would be ambiguous. The exact instant is always available on the element itself.
 */
function formatLastSyncedAt(value: Date, now: Date): string {
  const sameDay =
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate();

  return sameDay
    ? AUDIT_TIME_FORMAT.format(value)
    : `${AUDIT_DATE_FORMAT.format(value)}, ${AUDIT_TIME_FORMAT.format(value)}`;
}

function formatOccurredAtParts(value: string): { date: string; time: string; full: string } {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: value, time: "", full: value };
  return {
    date: AUDIT_DATE_FORMAT.format(parsed),
    time: AUDIT_TIME_FORMAT.format(parsed),
    full: AUDIT_TIMESTAMP_FORMAT.format(parsed),
  };
}

/** Turn a camelCase or PascalCase identifier into a readable phrase without altering its meaning. */
function humanizeIdentifier(value: string): string {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** Render a stored value for reading. Structured values keep their JSON form rather than being
 *  summarised, so nothing is silently dropped from the operator's view. */
function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    return value
      .map((item) => (item !== null && typeof item === "object" ? JSON.stringify(item) : String(item)))
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (value === "") return "Empty";
  return String(value);
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3.5 py-1.5">
      <dt className="shrink-0 text-[11px] text-brand-text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-xs font-medium text-brand-text">{children}</dd>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted">
        {title}
      </h3>
      <dl className="divide-y divide-brand-border rounded-lg border border-brand-border bg-brand-structural">
        {children}
      </dl>
    </section>
  );
}

/**
 * Sized to the resolved geometry of BOTH record branches: the fixed-width table at md and up,
 * the compact record cards below it. Swapping in real rows therefore moves nothing.
 */
function AuditTableSkeleton() {
  return (
    <SkeletonRegion isLoading label="Loading audit events">
      <Table className="table-fixed" wrapperClassName="hidden rounded-none border-0 md:block">
        <TableHeader>
          <tr>
            {AUDIT_COLUMN_WIDTH.map((width, columnIndex) => (
              <TableHead key={columnIndex} className={`px-2.5 ${width}`}>
                <Skeleton className="h-3 w-20 max-w-full" />
              </TableHead>
            ))}
          </tr>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {AUDIT_COLUMN_WIDTH.map((_, columnIndex) => (
                <TableCell key={columnIndex} className="px-2.5">
                  {columnIndex === 1 ? (
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                  ) : (
                    <Skeleton className={columnIndex === 5 ? "ml-auto h-8 w-8" : "h-3.5 w-full"} />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="space-y-3 bg-brand-structural p-3 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low"
          >
            <div className="space-y-2 px-3.5 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="flex justify-end border-t border-brand-border bg-brand-structural px-3.5 py-2">
              <Skeleton className="h-11 w-28" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function AuditLogView({ initialPage, initialCriteria }: AuditLogViewProps) {
  const [page, setPage] = useState<AuditPageTransport>(initialPage);
  const [filters, setFilters] = useState<AuditFilters>({
    category: initialCriteria.category,
    eventType: initialCriteria.eventType ?? "",
    from: toDateTimeLocalValue(initialCriteria.from),
    to: toDateTimeLocalValue(initialCriteria.to),
    search: initialCriteria.search ?? "",
  });
  const [offset, setOffset] = useState(initialCriteria.offset);
  const [selectedEvent, setSelectedEvent] = useState<AuditEventTransport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True when the rows on screen came from an earlier successful load and the most recent
  // same-criteria attempt failed. Only ever set for a refresh or a page step - a criteria change
  // clears the rows outright, because rows fetched under other criteria are not stale, they are
  // wrong.
  const [showingStaleRows, setShowingStaleRows] = useState(false);
  const requestSequence = useRef(0);
  const pendingLoad = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When the list last successfully came back. Starts null and is set by the first completed
  // read rather than at render time: the initial page is server-rendered, and stamping a clock
  // value during that render is exactly the kind of server/client difference React reports as a
  // hydration mismatch.
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  // True once a background sync has failed. Automatic syncing then stops until a user-initiated
  // load succeeds, so a persistent fault cannot turn a left-open tab into an indefinite source of
  // requests - and, on the refusal paths, of audit rows.
  const [syncPaused, setSyncPaused] = useState(false);
  // A background request does not set `loading`, so the tick cannot use that to see one of its own
  // still in flight. Without this a slow sync would be joined by the next tick's.
  const backgroundSyncInFlight = useRef(false);
  /**
   * What the records region announces, and the only thing it announces.
   *
   * Held as its own string rather than derived from `page`, because deriving it is what made the
   * region speak on its own: a background sync sets `page`, new audit rows arrive continuously, so
   * the total changed and the polite region read the range out with nobody having asked for it.
   * Gating on `loading` did not help - a background sync deliberately does not set that either.
   *
   * Only a user-initiated load writes here, so the region is silent unless the operator did
   * something. The same range stays permanently visible in the pagination footer, which is plain
   * text and not a live region, so nothing is lost from the page - only from the announcements.
   */
  const [announcement, setAnnouncement] = useState("");

  const cancelPendingLoad = useCallback(() => {
    if (pendingLoad.current !== null) {
      clearTimeout(pendingLoad.current);
      pendingLoad.current = null;
    }
  }, []);

  // A timer must not survive unmount: it would call setState on an unmounted component and issue a
  // request nobody can see.
  useEffect(() => cancelPendingLoad, [cancelPendingLoad]);
  const limit = initialCriteria.limit;

  /**
   * Open a new request generation and put the view into the state that generation implies.
   *
   * Bumping the sequence HERE is the publication guard: every earlier request tests
   * `requestId === requestSequence.current` before it writes, so anything already in flight is
   * silently retired the moment this runs and can no longer publish into the view.
   *
   * `criteriaChanged` additionally drops what belonged to the previous criteria. The filter
   * controls have already repainted with the new criteria; leaving the previous criteria's rows
   * underneath them states something false - and if the request then fails, that false pairing is
   * what the reader is left looking at. Clearing first means the screen can show a loading state,
   * results, or an error, but never records that do not match the filters displayed above them.
   * `showingStaleRows` is reset rather than set for the same reason: rows fetched under other
   * criteria are not stale, they are wrong, so they are never offered under a staleness label.
   *
   * Both entry points use this: `loadPage`, when a request starts immediately, and `changeFilter`,
   * at the instant a debounced free-text criterion becomes visible. That is what lets the request
   * stay debounced while the invalidation does not.
   */
  /**
   * `silent` is what keeps a background sync from wearing the foreground's clothes.
   *
   * `loading` drives the visible chip, `aria-busy`, the disabled states AND the records region's
   * one announcing status. Letting a 30s timer set it meant that status flipped
   * "Showing X to Y of N events" -> "Loading audit events" -> back on every tick, so a screen
   * nobody was touching announced itself twice a minute, forever. That is the exact noise the
   * header status was written NOT to make, and it is worse than the Refresh button it replaced,
   * which only ever spoke when it was clicked.
   *
   * A silent request still bumps the sequence, so its publication guard and every ordering
   * property are unchanged - it just does not repaint the page as busy.
   */
  const beginRequest = useCallback(
    (nextOffset: number, criteriaChanged: boolean, silent = false) => {
      const requestId = ++requestSequence.current;
      if (!silent) {
        setLoading(true);
        setError(null);
        setShowingStaleRows(false);
        setAnnouncement("Loading audit events");
      }

      if (criteriaChanged) {
        setPage({ events: [], total: 0 });
        setOffset(nextOffset);
      }

      return requestId;
    },
    []
  );

  const loadPage = useCallback(
    async (
      nextFilters: AuditFilters,
      nextOffset: number,
      options: { criteriaChanged?: boolean; background?: boolean } = {}
    ) => {
      // Choke point: any load that actually starts invalidates whatever was still scheduled.
      // Without this, an immediate control clicked during the debounce window would be followed
      // 300ms later by the stale snapshot - older criteria applying after newer input.
      cancelPendingLoad();
      const isBackground = options.background === true;
      if (isBackground) backgroundSyncInFlight.current = true;
      const requestId = beginRequest(nextOffset, options.criteriaChanged === true, isBackground);

      try {
        const nextPage = await readAuditPageAction(
          buildCriteria(nextFilters, limit, nextOffset)
        );

        if (requestId === requestSequence.current) {
          setPage(nextPage);
          setOffset(nextOffset);
          // A background sync must never close a record the operator is reading.
          //
          // The tick's `hasOpenDetail` stand-down is not sufficient on its own: it prevents a sync
          // from STARTING while a dialog is open, but a sync already in flight when the dialog is
          // opened still resolves here, and clearing the selection at that point closes the record
          // out from under them - the precise failure the stand-down exists to prevent, reached
          // through the one path it cannot see.
          //
          // A user-initiated load still clears the selection exactly as before: there the operator
          // asked for different rows, so a detail panel belonging to the previous result set is
          // stale and should go.
          if (!isBackground) setSelectedEvent(null);
          setLastSyncedAt(new Date());
          // A read that came back supersedes any earlier failure, however it was started, so a
          // recovered sync clears the paused state and the stale-rows label rather than leaving
          // the page describing a problem that has passed.
          setSyncPaused(false);
          setError(null);
          setShowingStaleRows(false);
          if (!isBackground) {
            // Announced only because the operator asked for this load. Derived from the response
            // rather than from render state so it describes the page that just arrived.
            const first = nextPage.total === 0 ? 0 : nextOffset + 1;
            const last =
              nextPage.total === 0
                ? 0
                : Math.min(nextOffset + nextPage.events.length, nextPage.total);
            setAnnouncement(`Showing ${first} to ${last} of ${nextPage.total} events`);
          }
        }
      } catch {
        if (requestId === requestSequence.current) {
          if (isBackground) {
            // Stand down instead of retrying every 30s forever.
            //
            // A failing request is not free and is not silent on the server: readAuditPageAction
            // re-authorizes on every call and WRITES an AuditAccessDenied row when it refuses. An
            // account deactivated or token-rotated behind an open tab would therefore have this
            // timer appending two refusal rows a minute, indefinitely, to an append-only log that
            // cannot be pruned - a UI timer manufacturing what an audit reader is trained to read
            // as an intrusion signature.
            //
            // One failed attempt, then stop. No error banner either: nobody asked for this
            // request, so it must not interrupt with one. The status line says the sync is
            // paused, and any user-initiated load resumes it on success - or surfaces the real
            // error, with its Retry, in the surface built for it.
            setSyncPaused(true);
          } else {
            setError("Unable to load audit logs. Please try again.");
            // Rows survive only when they still answer the criteria on screen, and then they are
            // labelled rather than passed off as current.
            setShowingStaleRows(!options.criteriaChanged);
            // Cleared, not replaced: the destructive Alert that renders for this failure is itself
            // role="alert", so announcing the same failure here would say it twice - and leaving
            // "Loading audit events" standing would state something that is no longer true.
            setAnnouncement("");
          }
        }
      } finally {
        if (isBackground) backgroundSyncInFlight.current = false;
        if (requestId === requestSequence.current && !isBackground) {
          setLoading(false);
        }
      }
    },
    [limit, cancelPendingLoad, beginRequest]
  );

  // No mount-time stamp. An earlier revision stamped `lastSyncedAt` on hydration, which dates the
  // list to when the BROWSER woke up rather than to when the server read the rows - and on a slow
  // device those are far apart, so the page would have reported server-rendered rows as freshly
  // updated. Overstating the freshness of an audit list is exactly the wrong way to be wrong.
  // The value stays null until a load actually completes; until then the status says
  // "Auto-syncing" with no time attached, which claims nothing it cannot support.

  /**
   * Inputs the auto-sync tick reads, held in a ref rather than closed over.
   *
   * The interval is created once and keeps a steady cadence. If it depended on `filters` and
   * `offset` directly, every keystroke and every page step would tear down the timer and start a
   * fresh 30s, so an operator who kept working would never actually reach a sync - the feature
   * would appear to work and silently never fire.
   */
  const syncInputs = useRef({
    filters,
    offset,
    loading,
    hasOpenDetail: selectedEvent !== null,
    syncPaused,
  });
  useEffect(() => {
    syncInputs.current = {
      filters,
      offset,
      loading,
      hasOpenDetail: selectedEvent !== null,
      syncPaused,
    };
  });

  // Auto-sync. Replaces the manual Refresh control: the list keeps itself current instead of
  // asking to be told to.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const {
        filters: currentFilters,
        offset: currentOffset,
        loading: isLoading,
        hasOpenDetail,
        syncPaused: isPaused,
      } = syncInputs.current;

      // Six stand-downs, each one a case where syncing would take something away from the
      // operator rather than give them something:
      //  - the tab is not visible: nobody is reading, so this would be a request for no one;
      //  - a previous background sync failed: one attempt, then stop, until a user-initiated load
      //    succeeds. This is what bounds the feature - without it a fault behind an open tab
      //    retries forever, and on the refusal paths each retry writes an audit row;
      //  - a detail dialog is open: no point spending a request whose result cannot be shown
      //    while a record is being read. This guard alone does NOT keep the dialog open - it
      //    cannot see a sync that is already in flight - which is why `loadPage` additionally
      //    refuses to clear the selection for a background load;
      //  - a foreground request is in flight: the sequence guard would retire one of them anyway;
      //  - one of OUR OWN syncs is in flight: a background request deliberately does not set
      //    `loading`, so it is invisible to the check above and needs its own;
      //  - a debounced filter change is still pending: that newer criteria must land first, and
      //    `loadPage` would otherwise cancel it and apply the older ones.
      if (document.visibilityState !== "visible") return;
      if (isPaused) return;
      if (isLoading || hasOpenDetail) return;
      if (backgroundSyncInFlight.current || pendingLoad.current !== null) return;

      // No `criteriaChanged`, so the rows on screen are kept and updated in place rather than
      // cleared - a background refresh must never blank the table the operator is reading.
      // `background` additionally keeps an open detail record from being closed by a sync that
      // was already in flight when it was opened.
      void loadPage(currentFilters, currentOffset, { background: true });
    }, AUTO_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadPage]);

  const changeFilter = <K extends keyof AuditFilters,>(key: K, value: AuditFilters[K]) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);

    // Free-text fields debounce the REQUEST - never the visible state, which updated above, and
    // never the invalidation. The criteria on screen have already changed, so the rows below them
    // are already wrong: `beginRequest` retires the in-flight request and clears them now, while
    // the network call still waits out FILTER_DEBOUNCE_MS. Deferring the invalidation as well
    // would leave new criteria sitting above old rows for the whole window, and would leave an
    // older in-flight response free to publish into it. Each keystroke reschedules with its own
    // snapshot, so the timer that finally fires always carries the last text typed. The debounced
    // loadPage still runs its own criteria-changed invalidation, so nothing depends on this one
    // having happened. Structured controls load immediately; loadPage cancels any pending timer,
    // so an immediate load can never be overtaken by a stale scheduled one.
    if (key === "eventType" || key === "search") {
      cancelPendingLoad();
      beginRequest(0, true);
      pendingLoad.current = setTimeout(() => {
        pendingLoad.current = null;
        void loadPage(nextFilters, 0, { criteriaChanged: true });
      }, FILTER_DEBOUNCE_MS);
      return;
    }
    void loadPage(nextFilters, 0, { criteriaChanged: true });
  };

  // Removing a chip is a click on a complete, deliberate value - not typing - so it stays
  // immediate even for the two free-text fields whose typing is debounced. It therefore builds the
  // next state itself instead of routing through changeFilter's debounce branch.
  const clearFilter = (key: keyof AuditFilters) => {
    const nextFilters = { ...filters, [key]: EMPTY_FILTERS[key] };
    setFilters(nextFilters);
    void loadPage(nextFilters, 0, { criteriaChanged: true });
  };

  const clearAllFilters = () => {
    setFilters(EMPTY_FILTERS);
    void loadPage(EMPTY_FILTERS, 0, { criteriaChanged: true });
  };

  const active = activeFilters(filters);
  const eventTypeFilterActive = Boolean(filters.eventType.trim());

  const firstVisible = page.total === 0 ? 0 : offset + 1;
  const lastVisible = page.total === 0 ? 0 : Math.min(offset + page.events.length, page.total);
  const hasPrevious = offset > 0;
  const hasNext = offset + limit < page.total;

  const getCategoryBadge = (category: AuditCategory) => {
    switch (category) {
      case "AuthAccount":
        return (
          <Badge variant="neutral" size="sm" className="shrink-0 gap-1">
            <Key className="h-3 w-3" aria-hidden="true" /> Auth / Account
          </Badge>
        );
      case "PersonnelCredential":
        return (
          <Badge variant="neutral" size="sm" className="shrink-0 gap-1">
            <UserCheck className="h-3 w-3" aria-hidden="true" /> Personnel
          </Badge>
        );
      case "SessionReport":
        return (
          <Badge variant="neutral" size="sm" className="shrink-0 gap-1">
            <FileText className="h-3 w-3" aria-hidden="true" /> Session / Report
          </Badge>
        );
      case "SecurityDenial":
        return (
          <Badge variant="warning" size="sm" className="shrink-0 gap-1">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Security Denial
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Structural: filtering is the control surface for the records, so it recedes behind
          them. Refresh lives here with the other controls rather than in a page-introduction
          block of its own. */}
      <div className="space-y-2.5 rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Filter className="h-3.5 w-3.5 shrink-0 text-brand-text-subtle" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted">
              Audit filters
            </span>
            {active.length > 0 && (
              <span className="text-[11px] text-brand-text-muted">{active.length} active</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {active.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                disabled={loading}
                className="min-h-11 sm:min-h-8"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear all filters
              </Button>
            )}
            {/* What the Refresh button used to occupy, doing the job Refresh only implied: the
                list keeps itself current, so this states that rather than asking for a click.
                Not a live region - the single status inside the records region already announces
                each load, and narrating a background sync every 30s would be noise. */}
            <p className="flex items-center gap-1.5 text-[11px] text-brand-text-muted">
              <RefreshCw
                aria-hidden="true"
                className={`h-3.5 w-3.5 shrink-0 ${loading ? "motion-safe:animate-spin" : ""}`}
              />
              {loading ? (
                "Syncing"
              ) : (
                <>
                  {/* Says which of the two states it is actually in. A paused sync that still
                      claimed to be "Auto-syncing" would be the one genuinely misleading thing
                      this line could do - the rows would quietly age while the page insisted
                      they were current. Any filter change, page step or Retry resumes it. */}
                  <span>{syncPaused ? "Auto-sync paused" : "Auto-syncing"}</span>
                  {lastSyncedAt && (
                    <>
                      <span aria-hidden="true">·</span>
                      {/* A <time> rather than a span: the machine-readable instant and the full
                          local timestamp both travel with the element, so the exact moment is
                          recoverable even on the reading where the visible text is just a time. */}
                      <time
                        dateTime={lastSyncedAt.toISOString()}
                        title={AUDIT_TIMESTAMP_FORMAT.format(lastSyncedAt)}
                        className="whitespace-nowrap tabular-nums"
                      >
                        updated {formatLastSyncedAt(lastSyncedAt, new Date())}
                      </time>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        {active.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Active filters">
            {active.map((entry) => (
              <li key={entry.key} className="min-w-0">
                <button
                  type="button"
                  onClick={() => clearFilter(entry.key)}
                  disabled={loading}
                  aria-label={`Remove filter: ${entry.label} ${entry.verb} ${entry.value}`}
                  className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md border border-brand-border bg-brand-surface py-1 pl-2.5 pr-2 text-[11px] text-brand-text-muted transition-colors hover:border-brand-border-strong hover:bg-brand-surface-hover hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-50 sm:min-h-7"
                >
                  <span className="font-semibold">
                    {entry.label} {entry.verb}
                  </span>
                  <span
                    className={entry.mono ? "truncate font-mono text-brand-text" : "truncate text-brand-text"}
                    title={entry.value}
                  >
                    {entry.value}
                  </span>
                  <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Select
            label="Category"
            options={[...CATEGORY_OPTIONS]}
            value={filters.category}
            onChange={(event) =>
              changeFilter("category", event.target.value as AuditCategoryFilter)
            }
          />
          <div className="w-full">
            <Input
              label="Event type"
              placeholder="RecoveryLookupAttempted"
              value={filters.eventType}
              aria-describedby="audit-event-type-hint"
              onChange={(event) => changeFilter("eventType", event.target.value)}
            />
            <p id="audit-event-type-hint" className="mt-1.5 text-[11px] leading-snug text-brand-text-muted">
              Matched <span className="font-semibold">exactly</span> on the raw identifier, not the
              readable label.
            </p>
          </div>
          <Input
            label="From"
            type="datetime-local"
            className={DATE_INPUT_CLASS}
            value={filters.from}
            onChange={(event) => changeFilter("from", event.target.value)}
          />
          <Input
            label="To"
            type="datetime-local"
            className={DATE_INPUT_CLASS}
            value={filters.to}
            onChange={(event) => changeFilter("to", event.target.value)}
          />
          <div className="w-full">
            {/* The icon is anchored to the BOTTOM of the field, not the top of the label, so its
                position follows the shared Input's own height (44px on touch, 36px from sm) and
                never depends on the label's line-height. */}
            <div className="relative">
              <Input
                label="Performed by or target"
                placeholder="Search audit records"
                value={filters.search}
                aria-describedby="audit-search-hint"
                onChange={(event) => changeFilter("search", event.target.value)}
                className="pl-9"
              />
              <Search
                className="pointer-events-none absolute bottom-3.5 left-3 h-4 w-4 text-brand-text-subtle sm:bottom-2.5"
                aria-hidden="true"
              />
            </div>
            <p id="audit-search-hint" className="mt-1.5 text-[11px] leading-snug text-brand-text-muted">
              Matches any part of a username or target reference.
            </p>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="space-y-3" aria-busy={loading}>
        {/*
          The records region's ONE announcing element, in the shape SkeletonRegion established:
          an sr-only status inside the aria-busy container.

          There were two live regions here before - this state and the pagination count below -
          and a load changes both at once, so every filter keystroke, page step and refresh
          queued two announcements for one event. The reader heard the range read out over the
          loading state, or the reverse, depending on which repainted first. One region states
          whichever is true now: the load while it is running, the resulting range once it is
          not. The visible chip and the visible count are left as plain text, so nothing is said
          twice.
        */}
        <span role="status" aria-live="polite" className="sr-only">
          {announcement}
        </span>
        {error && (
          <Alert variant="destructive">
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 min-h-11 sm:min-h-8"
              onClick={() => void loadPage(filters, offset)}
              disabled={loading}
            >
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
              Retry
            </Button>
          </Alert>
        )}

        {/* Rows that outlived a failed refresh say so. Without this they read as current. */}
        {showingStaleRows && page.events.length > 0 && (
          <Alert variant="warning">
            Showing previously loaded events. The most recent refresh did not complete, so this
            list may be out of date.
          </Alert>
        )}

        {/* One bordered surface holds the records AND the pagination footer. Pagination stays
            OUTSIDE the populated/empty branch so it keeps reporting a truthful range and its
            disabled state in every state, exactly as before. */}
        <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low">
        {page.events.length === 0 ? loading ? (
          <AuditTableSkeleton />
        ) : error ? (
          // A load that failed is not a search that matched nothing. Saying "no events match"
          // here would blame the filters for a transport failure and hide the retry.
          <EmptyState
            icon={AlertCircle}
            headingLevel={2}
            className="rounded-none border-0"
            title="Audit events could not be loaded"
            description="The request did not complete, so no events are shown. This is a load failure, not an empty result."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 sm:min-h-8"
                onClick={() => void loadPage(filters, offset)}
                disabled={loading}
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                Retry
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ShieldCheck}
            className="rounded-none border-0"
            title={
              active.length === 0
                ? "No audit events recorded"
                : "No audit events match these filters"
            }
            description={
              active.length === 0
                ? "No audit events have been recorded yet. Events appear here as they are written to the audit log."
                : eventTypeFilterActive
                  ? "No recorded event matches the active filter selection. Event type is matched exactly, so a readable label such as \u201cRecovery lookup attempted\u201d finds nothing - the raw identifier RecoveryLookupAttempted is required."
                  : "No recorded event matches the active filter selection. Remove a filter above to widen the search."
            }
            headingLevel={2}
            action={
              active.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  disabled={loading}
                  className="min-h-11 sm:min-h-8"
                >
                  <X className="h-3.5 w-3.5 text-brand-text-muted" aria-hidden="true" />
                  Clear all filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className={`relative transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}>
            {/* Literal table elements, deliberately: verify-audit-presentation pins this region by
                its source shape (the wrapper marker, table-fixed, the AUDIT_COLUMN_WIDTH allocation
                and the literal <td> cells), so the shared Table primitive's classes are applied
                here by hand rather than through its components. The records surface around it
                already supplies the border and radius. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full table-fixed border-collapse text-left text-xs [&_tbody>tr:nth-child(even):not(:hover)]:bg-[#F8FAFC]">
                <caption className="sr-only">Audit event log</caption>
                <thead className="border-b border-brand-border bg-brand-structural text-[11px] font-semibold uppercase tracking-wide text-brand-navy">
                  <tr>
                    <th scope="col" className={`whitespace-nowrap px-2.5 py-2 ${AUDIT_COLUMN_WIDTH[0]}`}>Timestamp</th>
                    <th scope="col" className={`whitespace-nowrap px-2.5 py-2 ${AUDIT_COLUMN_WIDTH[1]}`}>Event</th>
                    <th scope="col" className={`whitespace-nowrap px-2.5 py-2 ${AUDIT_COLUMN_WIDTH[2]}`}>Outcome</th>
                    <th scope="col" className={`whitespace-nowrap px-2.5 py-2 ${AUDIT_COLUMN_WIDTH[3]}`}>Performed by</th>
                    <th scope="col" className={`whitespace-nowrap px-2.5 py-2 ${AUDIT_COLUMN_WIDTH[4]}`}>Target reference</th>
                    <th scope="col" className={`whitespace-nowrap px-2.5 py-2 text-right ${AUDIT_COLUMN_WIDTH[5]}`}>Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border-subtle bg-brand-card">
                  {page.events.map((event) => {
                    const occurred = formatOccurredAtParts(event.occurredAt);
                    return (
                      <tr key={event.id} className="transition-colors hover:bg-brand-surface-hover">
                        <td className="px-2.5 py-2 align-middle">
                          <span
                            className="block whitespace-nowrap font-mono text-[11px] tabular-nums text-brand-text-muted"
                            title={occurred.full}
                          >
                            <span className="block 2xl:inline">{occurred.date}</span>
                            <span className="hidden 2xl:inline"> · </span>
                            <span className="block 2xl:inline">{occurred.time}</span>
                          </span>
                        </td>
                        <td className="px-2.5 py-2 align-middle">
                          <div className="font-semibold text-brand-text">
                            {humanizeIdentifier(event.eventType)}
                          </div>
                          {/* Category joins the raw identifier on the second line rather than
                              taking a column of its own: the allocation is complete at six
                              columns and a seventh would have to be taken from Outcome, which is
                              sized so a recorded value never truncates. Category was previously
                              visible only on the narrow card list and in the details panel, so a
                              reader working at a desk - where audit review actually happens - had
                              to open a dialog per row to learn which category a row belonged to.
                              It costs no extra row height: the line already existed. */}
                          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                            {getCategoryBadge(event.category)}
                            <span
                              className="min-w-0 truncate font-mono text-[10px] text-brand-text-muted"
                              title={event.eventType}
                            >
                              {event.eventType}
                            </span>
                          </div>
                        </td>
                        <td className="px-2.5 py-2 align-middle">
                          <OutcomeBadge event={event} />
                        </td>
                        <td className="px-2.5 py-2 align-middle font-medium text-brand-text-muted">
                          <span className="block truncate" title={event.performedByUsername ?? undefined}>
                            {event.performedByUsername ?? "—"}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 align-middle">
                          <span
                            className="block truncate font-mono text-[11px] text-brand-text-muted"
                            title={event.targetReference ?? undefined}
                          >
                            {event.targetReference ?? "—"}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 text-right align-middle">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 min-w-[2rem] px-2 2xl:px-3"
                            onClick={() => setSelectedEvent(event)}
                            aria-label={`View details for ${event.eventType} at ${occurred.full}`}
                          >
                            <span className="hidden 2xl:inline">View details</span>
                            <Eye className="h-4 w-4 2xl:hidden" aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul
              // Compact record cards on a structural ground: the tint is what lets a white
              // card sit inside the white records surface without reading as a card in a card.
              className="space-y-3 bg-brand-structural p-3 md:hidden"
              aria-label="Audit event log"
            >
              {page.events.map((event) => {
                const occurred = formatOccurredAtParts(event.occurredAt);
                return (
                  <li
                    key={event.id}
                    className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low"
                  >
                    <div className="space-y-2 px-3.5 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-[13px] font-semibold leading-snug text-brand-text">
                          {humanizeIdentifier(event.eventType)}
                        </p>
                        <OutcomeBadge event={event} />
                      </div>

                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {getCategoryBadge(event.category)}
                        <span className="min-w-0 truncate font-mono text-[10px] text-brand-text-muted">
                          {event.eventType}
                        </span>
                      </div>

                      <p className="font-mono text-[11px] tabular-nums text-brand-text-muted">
                        {occurred.date} · {occurred.time}
                      </p>

                      {/* Both values truncate, and on a phone there is no hover to recover them
                          from - so the full value is carried on the element itself. The desktop
                          table already does this on every truncating cell; the card was the one
                          place a clipped username or accession had no route back. */}
                      <div className="min-w-0 space-y-0.5 text-[11px] text-brand-text-muted">
                        <p className="truncate" title={event.performedByUsername ?? undefined}>
                          <span className="font-semibold">By</span>{" "}
                          <span className="text-brand-text">
                            {event.performedByUsername ?? "Not recorded"}
                          </span>
                        </p>
                        <p className="truncate" title={event.targetReference ?? undefined}>
                          <span className="font-semibold">Target</span>{" "}
                          <span className="font-mono text-brand-text">
                            {event.targetReference ?? "Not recorded"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-brand-border bg-brand-structural px-3.5 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedEvent(event)}
                        aria-label={`View details for ${event.eventType} at ${occurred.full}`}
                        className="min-h-11"
                      >
                        View details
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {loading && (
              // Visual only: the sr-only status at the top of the records region is what
              // announces this state, and announcing it here as well said it twice.
              <div
                className="pointer-events-none absolute inset-0 flex items-start justify-center pt-6"
                aria-hidden="true"
              >
                {/* Pinned near the top of the rows rather than centred on them: on a full page
                    of events the centre of the region is off screen, so the one element telling
                    the reader why the table went quiet was the one element they could not see. */}
                <span className="rounded-md border border-brand-border bg-brand-surface px-3 py-1.5 text-[11px] font-semibold text-brand-text-muted shadow-low">
                  Loading audit logs...
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-brand-border bg-brand-structural px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Not a live region: the single status at the top of this region already reports
              this range, and marking it live too announced the same fact a second time. */}
          <p className="text-[11px] text-brand-text-muted">
            Showing{" "}
            <span className="font-semibold tabular-nums text-brand-text">
              {firstVisible}–{lastVisible}
            </span>{" "}
            of <span className="font-semibold tabular-nums text-brand-text">{page.total}</span> events
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPrevious || loading}
              onClick={() => void loadPage(filters, Math.max(0, offset - limit))}
              className="min-h-11 sm:min-h-8"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNext || loading}
              onClick={() => void loadPage(filters, offset + limit)}
              className="min-h-11 sm:min-h-8"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
        </div>
      </div>

      {/* Audit event detail panel */}
      <Modal
        isOpen={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent ? humanizeIdentifier(selectedEvent.eventType) : "Event details"}
        description="Server-redacted audit event details"
        className="max-w-2xl"
      >
        {selectedEvent && (
          // One scroll container, not two. Modal's own body is already `min-h-0 flex-1
          // overflow-y-auto`, so the `max-h-[65vh] overflow-y-auto` that used to be here nested a
          // second scroller inside it: two scrollbars on desktop, nested touch-scrolling on a
          // phone, and a cap that disagreed with the shell's - the shell measures in `dvh`, which
          // tracks the mobile URL bar as it collapses, while `65vh` does not. Dropping it also
          // removes a tab stop that landed before the dialog's first real control.
          <div className="space-y-4">
            <DetailSection title="Event">
              <DetailRow label="Event">
                <span className="font-semibold">{humanizeIdentifier(selectedEvent.eventType)}</span>
                <span className="ml-2 font-mono text-[11px] font-normal text-brand-text-muted">
                  {selectedEvent.eventType}
                </span>
              </DetailRow>
              <DetailRow label="Category">{getCategoryBadge(selectedEvent.category)}</DetailRow>
              <DetailRow label="Outcome">
                <OutcomeBadge event={selectedEvent} />
              </DetailRow>
              <DetailRow label="Occurred">
                <span className="font-mono tabular-nums">{formatOccurredAt(selectedEvent.occurredAt)}</span>
              </DetailRow>
            </DetailSection>

            <DetailSection title="Performed by">
              <DetailRow label="User">{selectedEvent.performedByUsername ?? "Not recorded"}</DetailRow>
              {/* Through the shared helper, so an audit record prints the same role words as
                  the rest of the system rather than the raw stored value. */}
              <DetailRow label="Role">
                {selectedEvent.actorRole
                  ? formatRoleLabel(selectedEvent.actorRole as UserRole)
                  : "Not recorded"}
              </DetailRow>
              <DetailRow label="User ID">
                <span className="font-mono text-[11px] font-normal text-brand-text-muted">
                  {selectedEvent.performedByUserId ?? "Not recorded"}
                </span>
              </DetailRow>
            </DetailSection>

            <DetailSection title="Target">
              <DetailRow label="Reference">
                <span className="font-mono text-[11px]">{selectedEvent.targetReference ?? "Not recorded"}</span>
              </DetailRow>
              <DetailRow label="Role">
                {selectedEvent.targetRole
                  ? formatRoleLabel(selectedEvent.targetRole as UserRole)
                  : "Not recorded"}
              </DetailRow>
            </DetailSection>

            <DetailSection title="Recorded detail">
              {selectedEvent.details && Object.keys(selectedEvent.details).length > 0 ? (
                Object.entries(selectedEvent.details).map(([key, value]) => (
                  <DetailRow key={key} label={Object.prototype.hasOwnProperty.call(DETAIL_LABELS, key) ? DETAIL_LABELS[key] : humanizeIdentifier(key)}>
                    {formatDetailValue(value)}
                  </DetailRow>
                ))
              ) : (
                <div className="px-3.5 py-2 text-[11px] text-brand-text-muted">
                  This event carries no additional detail beyond the fields above.
                </div>
              )}
            </DetailSection>

            {/* The raw JSON payload disclosure was removed here on QA'd product direction.
                The "Recorded detail" section above is now the single presentation of what the
                event carries, and it remains a complete one: it iterates every entry the server
                sent, unfiltered, and falls back to a humanized label for any key DETAIL_LABELS
                does not name - so no recorded field is withheld by dropping this. */}
          </div>
        )}
      </Modal>
    </div>
  );
}
