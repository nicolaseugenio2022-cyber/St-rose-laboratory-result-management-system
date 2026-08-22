"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Key,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Alert } from "@/components/ui/Alert";
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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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

const OUTCOME_TONE_CLASS: Record<OutcomeTone, string> = {
  negative: "border-rose-200 bg-rose-50 text-rose-800",
  caution: "border-amber-200 bg-amber-50 text-amber-900",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
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
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-bold ${OUTCOME_TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
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
    <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 py-1.5">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-xs text-slate-900">{children}</dd>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h3>
      <dl className="divide-y divide-slate-100">{children}</dl>
    </section>
  );
}

function AuditTableSkeleton() {
  return (
    <SkeletonRegion isLoading label="Loading audit events" className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {Array.from({ length: 6 }).map((_, columnIndex) => (
              <th key={columnIndex} className="px-4 py-3">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: 6 }).map((__, columnIndex) => (
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
  const requestSequence = useRef(0);
  const limit = initialCriteria.limit;

  const loadPage = useCallback(
    async (nextFilters: AuditFilters, nextOffset: number) => {
      const requestId = ++requestSequence.current;
      setLoading(true);
      setError(null);

      try {
        const nextPage = await readAuditPageAction(
          buildCriteria(nextFilters, limit, nextOffset)
        );

        if (requestId === requestSequence.current) {
          setPage(nextPage);
          setOffset(nextOffset);
          setSelectedEvent(null);
        }
      } catch {
        if (requestId === requestSequence.current) {
          setError("Unable to load audit logs. Please try again.");
        }
      } finally {
        if (requestId === requestSequence.current) {
          setLoading(false);
        }
      }
    },
    [limit]
  );

  const changeFilter = <K extends keyof AuditFilters,>(key: K, value: AuditFilters[K]) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    void loadPage(nextFilters, 0);
  };

  const firstVisible = page.total === 0 ? 0 : offset + 1;
  const lastVisible = page.total === 0 ? 0 : Math.min(offset + page.events.length, page.total);
  const hasPrevious = offset > 0;
  const hasNext = offset + limit < page.total;

  const getCategoryBadge = (category: AuditCategory) => {
    switch (category) {
      case "AuthAccount":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-800 border border-blue-200">
            <Key className="h-3 w-3" aria-hidden="true" /> Auth / Account
          </span>
        );
      case "PersonnelCredential":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-purple-50 text-purple-800 border border-purple-200">
            <UserCheck className="h-3 w-3" aria-hidden="true" /> Personnel
          </span>
        );
      case "SessionReport":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            <FileText className="h-3 w-3" aria-hidden="true" /> Session / Report
          </span>
        );
      case "SecurityDenial":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="h-3 w-3 text-rose-600" aria-hidden="true" /> Security Denial
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Security Audit Log Viewer</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Inspect append-only security logs for administrative actions, personnel updates, session events, and access denials per SECURITY_MODEL.md.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPage(filters, offset)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          Refresh Logs
        </button>
      </div>

      {/* Audit Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Filter className="h-4 w-4 text-slate-400" />
          <span>Audit filters</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Select
            label="Category"
            options={[...CATEGORY_OPTIONS]}
            value={filters.category}
            onChange={(event) =>
              changeFilter("category", event.target.value as AuditCategoryFilter)
            }
          />
          <Input
            label="Event type"
            placeholder="Filter by event type"
            value={filters.eventType}
            onChange={(event) => changeFilter("eventType", event.target.value)}
          />
          <Input
            label="From"
            type="datetime-local"
            value={filters.from}
            onChange={(event) => changeFilter("from", event.target.value)}
          />
          <Input
            label="To"
            type="datetime-local"
            value={filters.to}
            onChange={(event) => changeFilter("to", event.target.value)}
          />
          <div className="relative">
            <Search className="absolute left-3.5 top-[2.15rem] h-4 w-4 text-brand-text-subtle pointer-events-none" />
            <Input
              label="Performed by or target"
              placeholder="Search audit records"
              value={filters.search}
              onChange={(event) => changeFilter("search", event.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="space-y-3" aria-busy={loading}>
        {error && <Alert variant="destructive">{error}</Alert>}

        {page.events.length === 0 ? loading ? (
          <AuditTableSkeleton />
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="No audit events match these filters"
            description="No recorded event matches the active filter selection. Adjust or clear the filters to widen the search."
            headingLevel={3}
          />
        ) : (
          <div className={`relative transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Performed by</TableHead>
                  <TableHead>Target reference</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap font-mono text-[11px] text-slate-500">
                      {formatOccurredAt(event.occurredAt)}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <div className="font-semibold text-slate-900">
                        {humanizeIdentifier(event.eventType)}
                      </div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2">
                        {getCategoryBadge(event.category)}
                        <span
                          className="truncate font-mono text-[10px] text-slate-500"
                          title={event.eventType}
                        >
                          {event.eventType}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <OutcomeBadge event={event} />
                    </TableCell>
                    <TableCell className="font-medium text-slate-700">
                      {event.performedByUsername ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-slate-600">
                      {event.targetReference ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedEvent(event)}
                        aria-label={`View details for ${event.eventType} at ${formatOccurredAt(event.occurredAt)}`}
                      >
                        View details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center" aria-live="polite">
                <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                  Loading audit logs...
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500" aria-live="polite">
            Showing <span className="font-semibold text-slate-700">{firstVisible}–{lastVisible}</span> of{" "}
            <span className="font-semibold text-slate-700">{page.total}</span> events
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPrevious || loading}
              onClick={() => void loadPage(filters, Math.max(0, offset - limit))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNext || loading}
              onClick={() => void loadPage(filters, offset + limit)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
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
          <div
            tabIndex={0}
            className="max-h-[65vh] space-y-3 overflow-y-auto pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
          >
            <DetailSection title="Event">
              <DetailRow label="Event">
                <span className="font-semibold">{humanizeIdentifier(selectedEvent.eventType)}</span>
                <span className="ml-2 font-mono text-[11px] text-slate-500">{selectedEvent.eventType}</span>
              </DetailRow>
              <DetailRow label="Category">{getCategoryBadge(selectedEvent.category)}</DetailRow>
              <DetailRow label="Outcome">
                <OutcomeBadge event={selectedEvent} />
              </DetailRow>
              <DetailRow label="Occurred">{formatOccurredAt(selectedEvent.occurredAt)}</DetailRow>
            </DetailSection>

            <DetailSection title="Performed by">
              <DetailRow label="User">{selectedEvent.performedByUsername ?? "Not recorded"}</DetailRow>
              <DetailRow label="Role">{selectedEvent.actorRole ?? "Not recorded"}</DetailRow>
              <DetailRow label="User ID">
                <span className="font-mono text-[11px] text-slate-500">
                  {selectedEvent.performedByUserId ?? "Not recorded"}
                </span>
              </DetailRow>
            </DetailSection>

            <DetailSection title="Target">
              <DetailRow label="Reference">
                <span className="font-mono text-[11px]">{selectedEvent.targetReference ?? "Not recorded"}</span>
              </DetailRow>
              <DetailRow label="Role">{selectedEvent.targetRole ?? "Not recorded"}</DetailRow>
            </DetailSection>

            <DetailSection title="Recorded detail">
              {selectedEvent.details && Object.keys(selectedEvent.details).length > 0 ? (
                Object.entries(selectedEvent.details).map(([key, value]) => (
                  <DetailRow key={key} label={Object.prototype.hasOwnProperty.call(DETAIL_LABELS, key) ? DETAIL_LABELS[key] : humanizeIdentifier(key)}>
                    {formatDetailValue(value)}
                  </DetailRow>
                ))
              ) : (
                <p className="py-1.5 text-xs text-slate-500">
                  This event carries no additional detail beyond the fields above.
                </p>
              )}
            </DetailSection>

            <details className="border-t border-slate-200 pt-3">
              <summary
                tabIndex={0}
                className="cursor-pointer rounded text-[11px] font-bold uppercase tracking-wider text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
              >
                Raw detail payload
              </summary>
              <pre
                tabIndex={0}
                className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
              >
                {JSON.stringify(selectedEvent.details ?? null, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </Modal>
    </div>
  );
}
