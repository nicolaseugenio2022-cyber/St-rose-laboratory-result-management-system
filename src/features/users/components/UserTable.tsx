import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Edit2,
  KeyRound,
  Power,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { UserRole, UserStatus } from "@/types/user";
import { cn } from "@/utils/cn";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RoleBadge } from "./RoleBadge";
import { UserStatusBadge } from "./UserStatusBadge";

/**
 * The exact account fields the user directory renders.
 *
 * This is the shape that crosses the server/client boundary. An account row carries more on the
 * server - token version, first-login flags, password timestamps - and none of it is needed to
 * draw this table, so none of it is serialised. Consumers typed against this cannot read the
 * omitted fields.
 */
export interface UserDirectoryEntry {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

/**
 * Why the directory carries a load state at all.
 *
 * "No rows" and "no answer" are different facts. Without this the table printed the same
 * "No staff accounts yet" for both, which asserts something about the system that a failed fetch
 * never established - and leaves the reader nothing to act on.
 */
export type DirectoryLoadState = "ready" | "loading" | "failed";

export interface UserTableProps {
  users: UserDirectoryEntry[];
  onEdit: (user: UserDirectoryEntry) => void;
  onResetPassword: (user: UserDirectoryEntry) => void;
  onToggleStatus: (user: UserDirectoryEntry) => void;
  onDelete: (user: UserDirectoryEntry) => void;
  currentUserId: string;
  /** Presentation only. Authorization belongs to the server; this only decides whether the
   *  Developer Accounts link is worth offering, since only a Developer can reach that module. */
  currentUserRole?: UserRole;
  activeAdminCount: number;
  deletingUserId?: string | null;
  /** The row whose Active/Inactive transition is in flight, if any. */
  statusUpdatingUserId?: string | null;
  /**
   * True while ANY account write is in flight anywhere in the directory - create, update, reset
   * password, status change or delete. Every row's controls are held until it clears, because
   * two writes racing each other leave the reader unable to tell which refresh produced the
   * table in front of them.
   *
   * This only disables. It never claims a row is busy: the pending spinner and the "Updating..."
   * line stay keyed to `deletingUserId` / `statusUpdatingUserId`, so the record actually being
   * mutated is the only one that says so.
   */
  isMutating?: boolean;
  isLoading?: boolean;
  /** Whether the directory itself resolved. Only "ready" may report an empty directory. */
  loadState?: DirectoryLoadState;
  onRetryLoad?: () => void;
  /** True when a search or role filter is narrowing the directory. */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

/**
 * Why a Developer row carries no ordinary controls.
 *
 * A Developer caller can see Developer accounts here, but every ordinary user-management
 * mutation rejects a Developer target on the server. Rendering Edit, Reset password,
 * Deactivate and Delete for those rows offered four actions that were all guaranteed to fail -
 * the interface was describing a capability the system does not have. The row is now honest
 * about where those accounts are actually managed.
 *
 * This changes presentation only. No role-visibility query and no server rule is touched.
 */
function DeveloperRowNotice({ isDeveloperCaller }: { isDeveloperCaller: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-brand-text-muted">
      <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-brand-text-subtle" />
      Managed in Developer Accounts
      {isDeveloperCaller && (
        <Link
          href="/developer/accounts"
          className="rounded font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          Open module
        </Link>
      )}
    </span>
  );
}

/**
 * The protection rules, resolved once per row so the table and the card list cannot disagree.
 *
 * Every one of these is enforced on the server. What is computed here is only the explanation,
 * and the reason strings exist so the constraint can be stated in visible text rather than
 * hidden in a `title` attribute a keyboard or touch operator never sees.
 */
function rowPolicy(
  user: UserDirectoryEntry,
  currentUserId: string,
  activeAdminCount: number,
  deletingUserId: string | null | undefined,
  statusUpdatingUserId: string | null | undefined,
  isLoading: boolean,
  isMutating: boolean
) {
  const isActive = user.status === "Active";
  const isCurrentUser = user.id === currentUserId;
  const isLastActiveAdmin = isActive && user.role === "Admin" && activeAdminCount === 1;
  const isStatusUpdating = statusUpdatingUserId === user.id;
  const isRowBusy = deletingUserId === user.id || isStatusUpdating;
  // Status changes are single-flight. A second click - on this row or on another - while a
  // transition is in flight re-sends it or races two refreshes against each other, and the
  // reader has no way to tell which answer won. Every toggle is held until the pending one
  // settles; the toolbar states why, in words, rather than leaving dead controls unexplained.
  const isStatusChangePending = statusUpdatingUserId != null;
  // Writes are single-flight across the whole directory, not per operation. A delete running
  // beside a status change sent two writes and two refreshes at once, so every action on every
  // row is held while any one of them is in flight - this row included.
  const actionsDisabled = isLoading || isMutating || isRowBusy;

  const blockedReason = isCurrentUser
    ? "This is your own account."
    : isLastActiveAdmin
      ? "This is the last Active Administrator."
      : null;

  return {
    isActive,
    isCurrentUser,
    isLastActiveAdmin,
    isRowBusy,
    isStatusUpdating,
    blockedReason,
    actionsDisabled,
    toggleDisabled:
      actionsDisabled ||
      isStatusChangePending ||
      (isActive && (isCurrentUser || isLastActiveAdmin)),
    deleteDisabled: actionsDisabled || isCurrentUser || isLastActiveAdmin,
  };
}

export function UserTable({
  users,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onDelete,
  currentUserId,
  currentUserRole,
  activeAdminCount,
  deletingUserId,
  statusUpdatingUserId,
  isMutating = false,
  isLoading = false,
  loadState = "ready",
  onRetryLoad,
  hasActiveFilters = false,
  onClearFilters,
}: UserTableProps) {
  const isDeveloperCaller = currentUserRole === "Developer";

  if (users.length === 0) {
    // A failed load is not an empty directory. "No staff accounts yet" after a failed fetch
    // asserts something no answer ever established, and leaves the reader nothing to do about
    // it. The recoverable case is the only one that carries an action.
    if (loadState === "failed") {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="Account directory unavailable"
          description="The staff account directory could not be loaded, so no accounts can be shown. This is a load failure, not an empty directory."
          headingLevel={3}
          className="rounded-lg border border-brand-danger-border bg-brand-card"
          action={
            onRetryLoad ? (
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
            ) : undefined
          }
        />
      );
    }

    if (loadState === "loading") {
      return (
        <EmptyState
          aria-busy
          icon={Users}
          title="Loading accounts"
          description="Fetching the staff account directory."
          headingLevel={3}
          className="rounded-lg border border-brand-card-border bg-brand-card"
        />
      );
    }

    // Two different situations, two different messages: an empty directory is a fact about the
    // system, an empty result is a fact about the filters - and only one of them is actionable.
    return (
      <EmptyState
        icon={Users}
        title={hasActiveFilters ? "No accounts match these filters" : "No staff accounts yet"}
        description={
          hasActiveFilters
            ? "No account matches the active username search or role filter."
            : "Staff login accounts will be listed here once they are created."
        }
        headingLevel={3}
        className="rounded-lg border border-brand-card-border bg-brand-card"
        action={
          hasActiveFilters && onClearFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-8"
              onClick={onClearFilters}
            >
              Clear search and filter
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      {/* Desktop directory. The card list below is the narrow presentation - the table is not
          squeezed onto a phone and does not rely on horizontal scrolling to stay usable.

          No wrapper card here: `Table` already draws the rounded, bordered, card-surfaced
          container. Nesting it inside a second bordered div drew two concentric borders a
          pixel apart. */}
      <div className="hidden md:block">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const policy = rowPolicy(
                user,
                currentUserId,
                activeAdminCount,
                deletingUserId,
                statusUpdatingUserId,
                isLoading,
                isMutating
              );
              const isDeveloperRow = user.role === "Developer";

              return (
                <TableRow
                  key={user.id}
                  aria-busy={policy.isRowBusy || undefined}
                  className={cn(
                    "even:bg-brand-structural hover:bg-brand-surface-hover",
                    policy.isRowBusy && "opacity-60"
                  )}
                >
                  <TableCell className="py-2 align-middle">
                    <span className="block break-all font-mono text-sm font-semibold text-brand-text">
                      @{user.username}
                    </span>
                    {policy.isCurrentUser && (
                      <span className="mt-0.5 block text-[11px] font-semibold text-brand-primary">
                        Current account
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 align-middle">
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell className="py-2 align-middle">
                    <UserStatusBadge status={user.status} />
                  </TableCell>
                  <TableCell className="py-2 align-middle text-xs text-brand-text-muted">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="py-2 text-right align-middle">
                    {isDeveloperRow ? (
                      <DeveloperRowNotice isDeveloperCaller={isDeveloperCaller} />
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(user)}
                            disabled={policy.actionsDisabled}
                            aria-label={`Edit ${user.username}`}
                          >
                            <Edit2 aria-hidden="true" className="h-4 w-4 text-brand-text-muted" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onResetPassword(user)}
                            disabled={policy.actionsDisabled}
                            aria-label={`Reset password for ${user.username}`}
                          >
                            <KeyRound aria-hidden="true" className="h-4 w-4 text-brand-text-muted" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onToggleStatus(user)}
                            disabled={policy.toggleDisabled}
                            isLoading={policy.isStatusUpdating}
                            aria-label={`${policy.isActive ? "Deactivate" : "Activate"} ${user.username}`}
                          >
                            {!policy.isStatusUpdating && (
                              <Power aria-hidden="true" className="h-3.5 w-3.5" />
                            )}
                            {policy.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => onDelete(user)}
                            disabled={policy.deleteDisabled}
                            aria-label={`Delete ${user.username}`}
                          >
                            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                        {/* Stated, not hidden in a title attribute. A disabled control with a
                            tooltip explains itself to a mouse and to nobody else. */}
                        {policy.isStatusUpdating && (
                          <span className="text-[11px] font-semibold text-brand-text-muted">
                            Updating account status...
                          </span>
                        )}
                        {policy.blockedReason && (
                          <span className="text-[11px] text-brand-text-muted">{policy.blockedReason}</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Narrow presentation of the same directory and the same handlers. Actions carry visible
          labels here rather than icon-only affordances with hover titles, and each is held to a
          44px minimum height - the compact desktop control size is not a touch target. */}
      <ul
        className="divide-y divide-brand-border-subtle overflow-hidden rounded-lg border border-brand-card-border bg-brand-card md:hidden"
        aria-label="Staff account directory"
      >
        {users.map((user) => {
          const policy = rowPolicy(
            user,
            currentUserId,
            activeAdminCount,
            deletingUserId,
            statusUpdatingUserId,
            isLoading,
            isMutating
          );
          const isDeveloperRow = user.role === "Developer";

          return (
            <li
              key={user.id}
              aria-busy={policy.isRowBusy || undefined}
              className={cn("space-y-2 px-3 py-3", policy.isRowBusy && "opacity-60")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all font-mono text-sm font-semibold text-brand-text">@{user.username}</p>
                  {policy.isCurrentUser && (
                    <p className="mt-0.5 text-[11px] font-semibold text-brand-primary">Current account</p>
                  )}
                </div>
                <UserStatusBadge status={user.status} />
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-brand-text-muted">
                <RoleBadge role={user.role} />
                <span>Created {formatDate(user.createdAt)}</span>
              </div>

              {isDeveloperRow ? (
                <DeveloperRowNotice isDeveloperCaller={isDeveloperCaller} />
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      onClick={() => onEdit(user)}
                      disabled={policy.actionsDisabled}
                      aria-label={`Edit ${user.username}`}
                    >
                      <Edit2 aria-hidden="true" className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      onClick={() => onResetPassword(user)}
                      disabled={policy.actionsDisabled}
                      aria-label={`Reset password for ${user.username}`}
                    >
                      <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
                      Reset password
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      onClick={() => onToggleStatus(user)}
                      disabled={policy.toggleDisabled}
                      isLoading={policy.isStatusUpdating}
                      aria-label={`${policy.isActive ? "Deactivate" : "Activate"} ${user.username}`}
                    >
                      {!policy.isStatusUpdating && (
                        <Power aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      {policy.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="min-h-11"
                      onClick={() => onDelete(user)}
                      disabled={policy.deleteDisabled}
                      aria-label={`Delete ${user.username}`}
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                  {policy.isStatusUpdating && (
                    <p className="text-[11px] font-semibold text-brand-text-muted">
                      Updating account status...
                    </p>
                  )}
                  {policy.blockedReason && (
                    <p className="text-[11px] text-brand-text-muted">{policy.blockedReason}</p>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
