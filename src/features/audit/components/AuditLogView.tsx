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
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
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
            <Key className="h-3 w-3" /> Auth / Account
          </span>
        );
      case "PersonnelCredential":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-purple-50 text-purple-800 border border-purple-200">
            <UserCheck className="h-3 w-3" /> Personnel
          </span>
        );
      case "SessionReport":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            <FileText className="h-3 w-3" /> Session / Report
          </span>
        );
      case "SecurityDenial":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="h-3 w-3 text-rose-600" /> Security Denial
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Security Audit Log Viewer</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Inspect append-only security logs for administrative actions, personnel updates, session events, and access denials per SECURITY_MODEL.md.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPage(filters, offset)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          Refresh Logs
        </button>
      </div>

      {/* Audit Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
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
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700"
          >
            {error}
          </div>
        )}

        {page.events.length === 0 && !loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <ShieldCheck className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-3 text-xs text-slate-400">No audit logs match the active filters.</p>
          </div>
        ) : (
          <div className={`relative transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Event type</TableHead>
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
                    <TableCell>{getCategoryBadge(event.category)}</TableCell>
                    <TableCell className="font-mono text-[11px] font-bold text-slate-900">
                      {event.eventType}
                    </TableCell>
                    <TableCell className="font-medium text-slate-700">
                      <div>{event.performedByUsername ?? "—"}</div>
                      {event.performedByUserId && (
                        <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {event.performedByUserId}
                        </div>
                      )}
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
                      >
                        Inspect JSON
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center" aria-live="polite">
                <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-xs">
                  Loading audit logs...
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
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

      {/* JSON Details Inspector Modal */}
      <Modal
        isOpen={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent ? `${selectedEvent.eventType} — Event Inspection` : "Event Inspection"}
        description="Server-redacted audit event details"
        className="max-w-2xl"
      >
        <pre className="max-h-[65vh] overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-emerald-400">
          {JSON.stringify(selectedEvent?.details ?? null, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
