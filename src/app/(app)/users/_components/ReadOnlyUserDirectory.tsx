"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  MinusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { DeveloperDirectoryEntry } from "@/features/users/account-directory-entry";
import type { UserStatus } from "@/types/user";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SummaryBar } from "@/components/ui/SummaryBar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { ROLE_LABEL, RoleBadge } from "./RoleBadge";

/**
 * The Developer view of the ordinary-account directory.
 *
 * A separate component rather than the management table in a disabled state, deliberately. A
 * disabled control still tells the reader an operation exists and still needs its own reasoning
 * about when it re-enables; this component has no edit, reset, activate, deactivate or delete
 * path to disable, because none is written. That is also why it takes
 * `DeveloperDirectoryEntry[]` - a shape with no `id` - so there is nothing here that *could*
 * address a record for mutation even if a control were added by mistake.
 *
 * The presentation is not the security boundary. Every ordinary-account write is refused server
 * side by `authorizeOrdinaryAccountWrite`; this component exists so the interface tells the truth
 * about what the role can do, not so that it enforces it.
 */
export interface ReadOnlyUserDirectoryProps {
  entries: DeveloperDirectoryEntry[];
  /** Surfaced when a load fails. The wording is chosen by the caller from what is on screen. */
  loadError?: string | null;
  /** True when no directory has ever loaded, so there is nothing behind the error. */
  directoryUnavailable?: boolean;
  /** True while the first load is still in flight. */
  isLoading?: boolean;
  onRetryLoad?: () => void;
  onDismissLoadError?: () => void;
}

/**
 * The same role words the badges print. A Developer reader does see Developer accounts here, so
 * unlike the Admin filter this one offers all three.
 */
const ROLE_FILTER_OPTIONS = [
  { label: "All roles", value: "ALL" },
  { label: ROLE_LABEL.Admin, value: "Admin" },
  { label: ROLE_LABEL.User, value: "User" },
  { label: ROLE_LABEL.Developer, value: "Developer" },
];

/** Account lifecycle, in the two words the row badge prints. Narrows rows already on screen. */
const STATUS_FILTER_OPTIONS = [
  { label: "All statuses", value: "ALL" },
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
];

/**
 * Status as a word plus a shape, matching the managed directory exactly.
 *
 * The two views of the same accounts must not describe a lifecycle state two different ways -
 * a Developer reading this table and an Administrator reading the managed one are looking at
 * the same records.
 */
function AccountStatus({ status }: { status: UserStatus }) {
  const isActive = status === "Active";
  const Icon = isActive ? CheckCircle2 : MinusCircle;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon
        aria-hidden="true"
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          isActive ? "text-brand-success" : "text-brand-text-subtle"
        )}
      />
      <StatusBadge status={status} size="sm" />
    </span>
  );
}

export function ReadOnlyUserDirectory({
  entries,
  loadError,
  directoryUnavailable = false,
  isLoading = false,
  onRetryLoad,
  onDismissLoadError,
}: ReadOnlyUserDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (roleFilter !== "ALL" && entry.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && entry.status !== statusFilter) return false;
      if (!query) return true;
      return entry.username.toLowerCase().includes(query);
    });
  }, [entries, roleFilter, statusFilter, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || roleFilter !== "ALL" || statusFilter !== "ALL";
  const activeFilterCount =
    (searchQuery.trim() !== "" ? 1 : 0) +
    (roleFilter !== "ALL" ? 1 : 0) +
    (statusFilter !== "ALL" ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
  };

  // Counted from the three fields this projection carries and nothing else. There is no created
  // date and no identifier here, so there is no figure derived from one.
  const activeCount = entries.filter((entry) => entry.status === "Active").length;

  return (
    <div className="space-y-4 pb-6">
      {loadError && (
        <Alert
          variant={directoryUnavailable ? "destructive" : "warning"}
          title={
            directoryUnavailable
              ? "Account directory could not be loaded"
              : "Showing previously loaded accounts"
          }
          // Not dismissible when nothing loaded: dismissing it would leave an unexplained blank
          // screen behind it.
          onDismiss={directoryUnavailable ? undefined : onDismissLoadError}
        >
          <p>{loadError}</p>
          {!directoryUnavailable && onRetryLoad && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 min-h-11 sm:min-h-8"
              onClick={onRetryLoad}
              isLoading={isLoading}
            >
              {!isLoading && <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}
              Retry
            </Button>
          )}
        </Alert>
      )}

      {/* States the access level once, plainly, where the management controls would otherwise be.
          Without it the absence of an Add button reads as a missing feature rather than a
          deliberate boundary. Drawn with the shared Alert's tokens but without its live-region
          role: this is a standing fact about the page, not a message that arrived. */}
      <div className="flex items-start gap-2.5 rounded-md border border-brand-info-border bg-brand-info-bg px-3 py-2.5">
        <ShieldCheck aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-brand-info" />
        <p className="text-xs leading-relaxed text-brand-info">
          <span className="font-semibold">Read-only directory access.</span> Account management is
          restricted to Administrators. Developer accounts are managed separately in Developer
          Accounts.
        </p>
      </div>

      {/* Same rule as the managed directory: publish counts only once an answer has arrived.
          `isLoading` here is the caller's "first load still in flight" fact, so this suppresses
          the window in which a transient server-side read failure would otherwise have shown
          zeros as though the directory were empty. A successful empty directory still shows its
          zeros. */}
      {!directoryUnavailable && !isLoading && (
        <SummaryBar
          label="Account directory summary"
          figures={[
            { label: "Accounts", value: entries.length },
            { label: "Active", value: activeCount, tone: "success" },
            {
              label: "Inactive",
              value: entries.length - activeCount,
              tone: entries.length - activeCount > 0 ? "warning" : "muted",
            },
          ]}
        />
      )}

      {/* One structural toolbar: search, the two filters, Clear, and the result count. */}
      <div className="space-y-2.5 rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
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
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-8"
              onClick={clearFilters}
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative min-w-0 lg:col-span-2">
            <Input
              id="readonly-directory-search"
              label="Search accounts"
              type="search"
              placeholder="Username"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
            />
            {/* Centred on the 44px field below sm and on the 36px field above it. */}
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3.5 left-3 h-4 w-4 text-brand-text-subtle sm:bottom-2.5"
            />
          </div>
          <Select
            id="readonly-directory-role"
            label="Role"
            options={ROLE_FILTER_OPTIONS}
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          />
          <Select
            id="readonly-directory-status"
            label="Status"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          />
        </div>

        <p className="text-[11px] text-brand-text-muted" aria-live="polite">
          {directoryUnavailable ? (
            "Account totals are unavailable until the directory loads."
          ) : (
            <>
              Showing <span className="font-semibold text-brand-text">{filtered.length}</span> of{" "}
              <span className="font-semibold text-brand-text">{entries.length}</span> accounts
            </>
          )}
        </p>
      </div>

      <div aria-busy={isLoading || undefined}>
        {directoryUnavailable ? (
          // A failed load is not an empty directory, and it is the only one of these states the
          // reader can act on. A working surface with a danger-tinted icon disc, because there is
          // nothing behind it to read.
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-brand-danger-border bg-brand-card px-6 py-7 text-center shadow-low">
            <span className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full border border-brand-danger-border bg-brand-danger-bg">
              <AlertTriangle aria-hidden="true" className="h-4 w-4 text-brand-danger" />
            </span>
            <h3 className="text-[13px] font-semibold text-brand-navy">Account directory unavailable</h3>
            <p className="max-w-sm text-xs leading-relaxed text-brand-text-muted">
              The account directory could not be loaded, so no accounts can be shown. This is a
              load failure, not an empty directory.
            </p>
            {onRetryLoad && (
              <div className="mt-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 sm:min-h-8"
                  onClick={onRetryLoad}
                >
                  <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                  Retry loading accounts
                </Button>
              </div>
            )}
          </div>
        ) : isLoading && entries.length === 0 ? (
          <EmptyState
            icon={Users}
            headingLevel={3}
            title="Loading accounts"
            description="Fetching the account directory."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={hasActiveFilters ? Search : Users}
            headingLevel={3}
            title={hasActiveFilters ? "No accounts match these filters" : "No accounts to display"}
            description={
              hasActiveFilters
                ? "No account matches the current search, role or status selection."
                : "The account directory returned no records."
            }
            action={
              hasActiveFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 sm:min-h-8"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Desktop and tablet: the table. Hidden rather than horizontally scrolled below lg,
                where the record list below carries the same three facts without pushing the page
                sideways. `Table` is the white panel - it draws its own border and radius. */}
            <div className="hidden lg:block">
              <Table striped wrapperClassName="shadow-low">
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => (
                    // Keyed by username: it is unique across accounts and it is the only stable
                    // identifier this projection carries, which is the point of the projection.
                    <TableRow key={entry.username}>
                      <TableCell className="break-all font-mono font-semibold text-brand-text">
                        {entry.username}
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={entry.role} />
                      </TableCell>
                      <TableCell>
                        <AccountStatus status={entry.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Narrow widths: one record per account, carrying exactly the three fields the row
                carries and nothing more. There is no id, no lifecycle metadata and no action
                here because `DeveloperDirectoryEntry` carries none - the read-only boundary is
                the same at every width. */}
            <ul className="space-y-2 lg:hidden" aria-label="Account directory">
              {filtered.map((entry) => (
                <li
                  key={entry.username}
                  className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low"
                >
                  {/* The username wraps rather than truncates: it is the only identifier on the
                      record, so a clipped one leaves the reader unable to tell two accounts
                      apart. */}
                  <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                    <p className="min-w-0 break-all font-mono text-[13px] font-semibold text-brand-text">
                      {entry.username}
                    </p>
                    <span className="shrink-0">
                      <AccountStatus status={entry.status} />
                    </span>
                  </div>
                  <dl className="flex items-center gap-2 border-t border-brand-border bg-brand-structural px-3.5 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
                      Role
                    </dt>
                    <dd>
                      <RoleBadge role={entry.role} />
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
