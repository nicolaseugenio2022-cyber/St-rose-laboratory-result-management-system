import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Info,
  KeyRound,
  Loader2,
  MinusCircle,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { UserRole, UserStatus } from "@/types/user";
import { cn } from "@/lib/utils";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RoleBadge } from "./RoleBadge";

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
  /** True when a search, role or status filter is narrowing the directory. */
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
 * Status as a word plus a shape, never a colour on its own.
 *
 * The badge carries the term and the icon repeats it, so a reader who cannot separate the palette
 * still reads the state. Same construction the Developer Accounts directory uses, so the two
 * administrative screens state account lifecycle identically.
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

/** Visible on both layouts, never a tooltip. Keyboard and touch operators read it too. */
function RestrictionNote({ id, restriction }: { id: string; restriction: string }) {
  return (
    <p
      id={id}
      className="flex items-start gap-1.5 text-[11px] leading-snug text-brand-text-muted"
    >
      <Info aria-hidden="true" className="mt-px h-3 w-3 shrink-0 text-brand-text-subtle" />
      <span>{restriction}</span>
    </p>
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
  // True only when an account protection blocks DEACTIVATION specifically. Distinct from
  // `toggleDisabled`, which also covers transient single-flight holds that carry no protection
  // sentence. An inactive current user stays reactivatable, so the restriction (delete-only)
  // does not describe its Reactivate action.
  const toggleRestricted = isActive && (isCurrentUser || isLastActiveAdmin);
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

  // Stated as a full sentence naming both consequences, matching the Developer Accounts wording,
  // so the same protection reads the same way whichever administrative directory shows it.
  const restriction = isCurrentUser
    ? isActive
      ? "This is the account you are signed in with. It cannot be deactivated or deleted."
      : "This is the account you are signed in with. It cannot be deleted."
    : isLastActiveAdmin
      ? "This is the last Active Administrator. It cannot be deactivated or deleted."
      : null;

  return {
    isActive,
    isCurrentUser,
    isLastActiveAdmin,
    isRowBusy,
    isStatusUpdating,
    restriction,
    toggleRestricted,
    actionsDisabled,
    toggleDisabled:
      actionsDisabled ||
      isStatusChangePending ||
      (isActive && (isCurrentUser || isLastActiveAdmin)),
    deleteDisabled: actionsDisabled || isCurrentUser || isLastActiveAdmin,
  };
}

type RowPolicy = ReturnType<typeof rowPolicy>;

/**
 * The four operations, ranked rather than lined up as four equal icons.
 *
 * Every control carries its own word at both widths. The desktop row previously reduced Edit and
 * Reset password to bare pictograms with no visible name and no tooltip, which asked a sighted
 * operator to recognise a pencil and a key while the phone layout - the same two operations -
 * spelled them out. Naming them costs one line of row width and removes the guess.
 *
 * Rank: Edit is the routine operation and keeps a full outline control; the credential reset sits
 * inside the bordered "Credentials" group, matching Developer Accounts; the lifecycle and
 * destructive operations are quiet tinted text actions, so the row has one obvious action rather
 * than four competing ones. Delete still routes through the confirmation dialog.
 *
 * `restrictionId` is the id of the sentence explaining why a control is unavailable. It is passed
 * to `aria-describedby` on exactly the controls the restriction governs - Delete always; the
 * status toggle only when the restriction also blocks deactivation. So a screen-reader operator
 * who lands on a disabled Deactivate hears the reason instead of silence, while an enabled
 * Reactivate is not announced as restricted.
 */
function RowActions({
  user,
  policy,
  layout,
  restrictionId,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onDelete,
}: {
  user: UserDirectoryEntry;
  policy: RowPolicy;
  layout: "row" | "record";
  restrictionId?: string;
  onEdit: (user: UserDirectoryEntry) => void;
  onResetPassword: (user: UserDirectoryEntry) => void;
  onToggleStatus: (user: UserDirectoryEntry) => void;
  onDelete: (user: UserDirectoryEntry) => void;
}) {
  const name = user.username;
  const isRecord = layout === "record";
  // sm buttons are h-8. The record layout renders only below `lg`, so it keeps the 44px touch
  // target unconditionally - an `sm:` reset would shrink it on tablets, where it is still the
  // layout in use. The desktop row is `lg`-only and keeps the denser height.
  const touch = isRecord ? "min-h-11" : "min-h-11 sm:min-h-8";
  const toggleVerb = policy.isActive ? "Deactivate" : "Activate";

  return (
    <div className={isRecord ? "space-y-2" : "flex flex-col items-end gap-1.5"}>
      <div
        role="group"
        aria-label={`Actions for ${name}`}
        className={cn(
          "flex flex-wrap items-center gap-1.5",
          !isRecord && "justify-end"
        )}
      >
        <Button
          variant="outline"
          size="sm"
          className={touch}
          onClick={() => onEdit(user)}
          disabled={policy.actionsDisabled}
          aria-label={`Edit the account ${name}`}
        >
          <Edit2 aria-hidden="true" className="h-3.5 w-3.5" />
          Edit
        </Button>

        {/* No bordered "Credentials" sub-group around this one control. Developer Accounts draws
            that group because it genuinely holds two credential operations; here there is only
            the password reset, and a labelled box around a single button is chrome that groups
            nothing. The enclosing "Actions for ..." group already states the relationship. */}
        <Button
          variant="ghost"
          size="sm"
          className={touch}
          onClick={() => onResetPassword(user)}
          disabled={policy.actionsDisabled}
          aria-label={`Reset the password for ${name}`}
        >
          <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
          Reset password
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            touch,
            policy.isActive
              ? "text-brand-warning hover:bg-brand-warning-bg hover:text-brand-warning"
              : "text-brand-success hover:bg-brand-success-bg hover:text-brand-success"
          )}
          onClick={() => onToggleStatus(user)}
          disabled={policy.toggleDisabled}
          isLoading={policy.isStatusUpdating}
          aria-label={`${toggleVerb} ${name}`}
          aria-describedby={policy.toggleRestricted ? restrictionId : undefined}
        >
          {!policy.isStatusUpdating && <Power aria-hidden="true" className="h-3.5 w-3.5" />}
          {toggleVerb}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn(touch, "text-brand-danger hover:bg-brand-danger-bg hover:text-brand-danger")}
          onClick={() => onDelete(user)}
          disabled={policy.deleteDisabled}
          aria-label={`Delete ${name}`}
          aria-describedby={policy.restriction ? restrictionId : undefined}
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      {/* Keyed to this record alone. Every other row is disabled while a mutation runs, but only
          the record actually being written says so - the toolbar's live region carries the
          announcement, so this indicator is presentational. */}
      {policy.isStatusUpdating && (
        <p
          aria-hidden="true"
          className="flex items-center gap-1.5 text-[11px] leading-snug text-brand-text-muted"
        >
          <Loader2 className="h-3 w-3 shrink-0 motion-safe:animate-spin text-brand-text-subtle" />
          <span>Updating account status...</span>
        </p>
      )}

      {policy.restriction && restrictionId && (
        <RestrictionNote id={restrictionId} restriction={policy.restriction} />
      )}
    </div>
  );
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
        // A working surface with a danger-tinted icon disc: the error is a panel of its own,
        // not a quiet structural region, because there is nothing behind it to read.
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-brand-danger-border bg-brand-card px-6 py-7 text-center shadow-low">
          <span className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full border border-brand-danger-border bg-brand-danger-bg">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-brand-danger" />
          </span>
          <h3 className="text-[13px] font-semibold text-brand-navy">Account directory unavailable</h3>
          <p className="max-w-sm text-xs leading-relaxed text-brand-text-muted">
            The staff account directory could not be loaded, so no accounts can be shown. This is
            a load failure, not an empty directory.
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
        />
      );
    }

    // Two different situations, two different messages: an empty directory is a fact about the
    // system, an empty result is a fact about the filters - and only one of them is actionable.
    return (
      <EmptyState
        icon={hasActiveFilters ? Search : Users}
        title={hasActiveFilters ? "No accounts match these filters" : "No staff accounts yet"}
        description={
          hasActiveFilters
            ? "No account matches the active username search, role or status selection."
            : "Staff login accounts will be listed here once they are created."
        }
        headingLevel={3}
        action={
          hasActiveFilters && onClearFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-8"
              onClick={onClearFilters}
            >
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      {/* Desktop directory. The card list below is the narrow presentation - the table is not
          squeezed onto a phone and does not rely on horizontal scrolling to stay usable. The
          switch is at `lg`, the width the other two administrative directories use, so a four
          action row is never compressed into a tablet column.

          No wrapper card here: `Table` already draws the rounded, bordered, card-surfaced
          container - it is the white panel, and it carries the working-surface shadow. Nesting
          it inside a second bordered div drew two concentric borders a pixel apart. */}
      <div className="hidden lg:block">
        <Table striped wrapperClassName="shadow-low" className="min-w-[860px]">
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
              const restrictionId = `user-row-${user.id}-restriction`;

              return (
                <TableRow
                  key={user.id}
                  aria-busy={policy.isRowBusy || undefined}
                  className={cn(policy.isRowBusy && "opacity-60")}
                >
                  <TableCell>
                    <span className="block break-all font-mono text-xs font-semibold text-brand-text">
                      @{user.username}
                    </span>
                    {policy.isCurrentUser && (
                      <span className="mt-0.5 block text-[11px] font-semibold text-brand-primary">
                        Current account
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    <AccountStatus status={user.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono tabular-nums text-brand-text-muted">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isDeveloperRow ? (
                      <DeveloperRowNotice isDeveloperCaller={isDeveloperCaller} />
                    ) : (
                      <RowActions
                        user={user}
                        policy={policy}
                        layout="row"
                        restrictionId={restrictionId}
                        onEdit={onEdit}
                        onResetPassword={onResetPassword}
                        onToggleStatus={onToggleStatus}
                        onDelete={onDelete}
                      />
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
          44px minimum height - the compact desktop control size is not a touch target.

          One white record per account: a compact header row, the meta line, and the actions in
          a structural footer band. */}
      <ul className="space-y-2 lg:hidden" aria-label="Staff account directory">
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
          const restrictionId = `user-card-${user.id}-restriction`;

          return (
            <li
              key={user.id}
              aria-busy={policy.isRowBusy || undefined}
              className={cn(
                "overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low",
                policy.isRowBusy && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="break-all font-mono text-[13px] font-semibold text-brand-text">@{user.username}</p>
                  {policy.isCurrentUser && (
                    <p className="mt-0.5 text-[11px] font-semibold text-brand-primary">Current account</p>
                  )}
                </div>
                <span className="shrink-0">
                  <AccountStatus status={user.status} />
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3.5 pb-2.5 text-[11px] text-brand-text-muted">
                <RoleBadge role={user.role} />
                <span>
                  Created <span className="font-mono tabular-nums">{formatDate(user.createdAt)}</span>
                </span>
              </div>

              <div className="border-t border-brand-border bg-brand-structural px-3.5 py-2.5">
                {isDeveloperRow ? (
                  <DeveloperRowNotice isDeveloperCaller={isDeveloperCaller} />
                ) : (
                  <RowActions
                    user={user}
                    policy={policy}
                    layout="record"
                    restrictionId={restrictionId}
                    onEdit={onEdit}
                    onResetPassword={onResetPassword}
                    onToggleStatus={onToggleStatus}
                    onDelete={onDelete}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
