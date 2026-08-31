"use client";

import React from "react";
import {
  CheckCircle2,
  Edit2,
  Info,
  KeyRound,
  Loader2,
  MinusCircle,
  Power,
  Search,
  ShieldCheck,
  ShieldQuestion,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import type { DeveloperAccountEntry } from "@/features/users/account-directory-entry";

interface DeveloperAccountTableProps {
  accounts: DeveloperAccountEntry[];
  currentUserId: string;
  activeDeveloperCount: number;
  busyAccountId: string | null;
  /**
   * True while *any* write is in flight on this screen - a row operation, or a modal submission
   * (create, username, security question, password reset). All six share one mutation slot, so
   * every row is locked while one runs; only the busy row shows the pending indicator, and a
   * create - which has no record yet - locks the rows without marking any of them.
   */
  isAnyMutationPending: boolean;
  /** True while a username search is narrowing the directory, so "nothing here" is phrased honestly. */
  isFiltered?: boolean;
  onClearFilters?: () => void;
  onEditUsername: (account: DeveloperAccountEntry) => void;
  onUpdateSecurityQuestion: (account: DeveloperAccountEntry) => void;
  onResetPassword: (account: DeveloperAccountEntry) => void;
  onToggleStatus: (account: DeveloperAccountEntry) => void;
  onDelete: (account: DeveloperAccountEntry) => void;
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
 * The two account protections, resolved once per record so the desktop row and the narrow
 * record cannot disagree about what is permitted.
 *
 * Both rules are enforced on the server behind `requireDeveloper()`; nothing here is the
 * boundary. What is computed is the *explanation*, because a disabled control that only
 * explains itself through a `title` attribute explains itself to a mouse and to nobody else.
 */
function rowPolicy(
  account: DeveloperAccountEntry,
  currentUserId: string,
  activeDeveloperCount: number,
  busyAccountId: string | null,
  isAnyMutationPending: boolean
) {
  const isActive = account.status === "Active";
  const isCurrentUser = account.id === currentUserId;
  const isLastActiveDeveloper = isActive && activeDeveloperCount === 1;
  const isBusy = busyAccountId === account.id;

  // Writes are single-flight across the whole screen, modal submissions included: while one
  // runs, every row is locked, not just the one being written. A row that stayed live could
  // launch a second mutation over the first - and so could a row action opening a modal.
  const actionsDisabled = isBusy || isAnyMutationPending;

  // The account protections themselves are unchanged - the pending condition is OR'd in front of
  // them, so nothing that was forbidden before becomes permitted now.
  const toggleDisabled = actionsDisabled || (isActive && (isCurrentUser || isLastActiveDeveloper));
  const deleteDisabled = actionsDisabled || isCurrentUser || isLastActiveDeveloper;

  const restriction = isCurrentUser
    ? isActive
      ? "This is the account you are signed in with. It cannot be deactivated or deleted."
      : "This is the account you are signed in with. It cannot be deleted."
    : isLastActiveDeveloper
      ? "This is the last Active Developer account. It cannot be deactivated or deleted."
      : null;

  return {
    isActive,
    isCurrentUser,
    isLastActiveDeveloper,
    isBusy,
    actionsDisabled,
    toggleDisabled,
    deleteDisabled,
    restriction,
  };
}

type RowPolicy = ReturnType<typeof rowPolicy>;

/**
 * Status as a word plus a shape, never a colour on its own: the badge carries the term and the
 * icon repeats it for a reader who cannot separate the palette.
 */
function AccountStatus({ status }: { status: DeveloperAccountEntry["status"] }) {
  const isActive = status === "Active";
  const Icon = isActive ? CheckCircle2 : MinusCircle;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon
        aria-hidden="true"
        className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-brand-success" : "text-brand-text-subtle"}`}
      />
      <StatusBadge status={status} size="sm" />
    </span>
  );
}

/** Visible on both layouts, never a tooltip. Keyboard and touch operators read it too. */
function RestrictionNote({ restriction }: { restriction: string }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-brand-text-muted">
      <Info aria-hidden="true" className="mt-px h-3 w-3 shrink-0 text-brand-text-subtle" />
      <span>{restriction}</span>
    </p>
  );
}

/**
 * The five operations, ranked rather than lined up as equals.
 *
 * There is no menu primitive in `src/components/ui`, and an ad-hoc popup would have to
 * reimplement roving focus, `aria-expanded`, outside-dismiss and Escape - every one of which is
 * a place to get it wrong. A labelled group is the honest alternative: the same controls, always
 * reachable by Tab, with the relationship stated in text instead of implied by a chevron.
 *
 * Rank: the password reset is the routine operation and keeps a full control; the two rarer
 * credential edits sit inside the bordered "Credentials" group; the lifecycle and destructive
 * operations are quiet text actions, tinted but not filled, so the row has one obvious action
 * rather than five competing ones. Delete still routes through the confirmation dialog.
 */
function RowActions({
  account,
  policy,
  layout,
  onEditUsername,
  onUpdateSecurityQuestion,
  onResetPassword,
  onToggleStatus,
  onDelete,
}: {
  account: DeveloperAccountEntry;
  policy: RowPolicy;
  layout: "row" | "record";
  onEditUsername: (account: DeveloperAccountEntry) => void;
  onUpdateSecurityQuestion: (account: DeveloperAccountEntry) => void;
  onResetPassword: (account: DeveloperAccountEntry) => void;
  onToggleStatus: (account: DeveloperAccountEntry) => void;
  onDelete: (account: DeveloperAccountEntry) => void;
}) {
  const name = account.username;
  const isRecord = layout === "record";
  // sm buttons are h-8. The record layout renders only below `lg`, so it keeps the 44px touch
  // target unconditionally - an `sm:` reset would shrink it on tablets, where it is still the
  // layout in use. The desktop row is `lg`-only and keeps the denser height.
  const touch = isRecord ? "min-h-11" : "min-h-11 sm:min-h-8";
  const toggleVerb = policy.isActive ? "Deactivate" : "Reactivate";

  return (
    <div className={isRecord ? "space-y-2" : "flex flex-col items-end gap-1.5"}>
      <div
        className={
          isRecord
            ? "flex flex-wrap items-center gap-1.5"
            : "flex flex-wrap items-center justify-end gap-1.5"
        }
      >
        <Button
          variant="outline"
          size="sm"
          className={touch}
          onClick={() => onResetPassword(account)}
          disabled={policy.actionsDisabled}
          aria-label={`Reset the password for ${name}`}
        >
          <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
          Reset password
        </Button>

        <div
          role="group"
          aria-label={`Credential settings for ${name}`}
          className="inline-flex flex-wrap items-center gap-1 rounded-md border border-brand-border-strong px-1.5 py-1"
        >
          <span
            aria-hidden="true"
            className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-text-subtle"
          >
            Credentials
          </span>
          <Button
            variant="ghost"
            size="sm"
            className={touch}
            onClick={() => onEditUsername(account)}
            disabled={policy.actionsDisabled}
            aria-label={`Change the username for ${name}`}
          >
            <Edit2 aria-hidden="true" className="h-3.5 w-3.5" />
            Username
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={touch}
            onClick={() => onUpdateSecurityQuestion(account)}
            disabled={policy.actionsDisabled}
            aria-label={`Update the security question for ${name}`}
          >
            <ShieldQuestion aria-hidden="true" className="h-3.5 w-3.5" />
            Security question
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={`${touch} ${
            policy.isActive
              ? "text-brand-warning hover:bg-brand-warning-bg hover:text-brand-warning"
              : "text-brand-success hover:bg-brand-success-bg hover:text-brand-success"
          }`}
          onClick={() => onToggleStatus(account)}
          disabled={policy.toggleDisabled}
          aria-label={`${toggleVerb} ${name}`}
        >
          <Power aria-hidden="true" className="h-3.5 w-3.5" />
          {toggleVerb}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={`${touch} text-brand-danger hover:bg-brand-danger-bg hover:text-brand-danger`}
          onClick={() => onDelete(account)}
          disabled={policy.deleteDisabled}
          aria-label={`Delete ${name}`}
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      {/* Keyed to this record alone. Every other row is disabled while a mutation runs, but only
          the record actually being written says so - the live region carries the announcement, so
          this indicator is presentational. */}
      {policy.isBusy && (
        <p
          aria-hidden="true"
          className="flex items-center gap-1.5 text-[11px] leading-snug text-brand-text-muted"
        >
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-brand-text-subtle" />
          <span>Updating...</span>
        </p>
      )}

      {policy.restriction && <RestrictionNote restriction={policy.restriction} />}
    </div>
  );
}

export function DeveloperAccountTable({
  accounts,
  currentUserId,
  activeDeveloperCount,
  busyAccountId,
  isAnyMutationPending,
  isFiltered = false,
  onClearFilters,
  onEditUsername,
  onUpdateSecurityQuestion,
  onResetPassword,
  onToggleStatus,
  onDelete,
}: DeveloperAccountTableProps) {
  if (accounts.length === 0) {
    // Two different facts, two different sentences. A filtered miss is about the search box and
    // is fixable from here; an empty directory is about the system and is not.
    const shell = "rounded-lg border border-brand-card-border bg-brand-card";
    return isFiltered ? (
      <EmptyState
        className={shell}
        icon={Search}
        headingLevel={3}
        title="No Developer accounts match this search"
        description="No Developer account username contains the text currently in the search box."
        action={
          onClearFilters ? (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-8"
              onClick={onClearFilters}
            >
              Clear search
            </Button>
          ) : undefined
        }
      />
    ) : (
      <EmptyState
        className={shell}
        icon={ShieldCheck}
        headingLevel={3}
        title="No Developer accounts yet"
        description="Developer accounts registered through this module will be listed here."
      />
    );
  }

  return (
    <>
      {/* Desktop: a real table. `Table` supplies its own bordered, scrollable card, so it is not
          wrapped in a second one. Below lg the record list takes over instead - a five-action
          administrative row squeezed onto a phone is unreadable whichever way it is squeezed. */}
      <div className="hidden lg:block">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const policy = rowPolicy(
                account,
                currentUserId,
                activeDeveloperCount,
                busyAccountId,
                isAnyMutationPending
              );

              return (
                <TableRow
                  key={account.id}
                  aria-busy={policy.isBusy || undefined}
                  className={`even:bg-brand-background ${policy.isBusy ? "opacity-60" : ""}`}
                >
                  <TableCell className="py-2 align-middle">
                    <span className="block break-all font-mono text-sm font-semibold text-brand-text">
                      @{account.username}
                    </span>
                    {policy.isCurrentUser && (
                      <span className="mt-0.5 block text-[11px] font-semibold text-brand-primary">
                        Current account
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 align-middle">
                    <AccountStatus status={account.status} />
                  </TableCell>
                  <TableCell className="py-2 align-middle text-xs text-brand-text-muted">
                    {formatDate(account.createdAt)}
                  </TableCell>
                  <TableCell className="py-2 text-right align-middle">
                    <RowActions
                      account={account}
                      policy={policy}
                      layout="row"
                      onEditUsername={onEditUsername}
                      onUpdateSecurityQuestion={onUpdateSecurityQuestion}
                      onResetPassword={onResetPassword}
                      onToggleStatus={onToggleStatus}
                      onDelete={onDelete}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Narrow widths: one record per account carrying every fact the row carries - username,
          status, created date and the same five operations behind the same handlers. */}
      <ul className="space-y-2 lg:hidden" aria-label="Developer accounts">
        {accounts.map((account) => {
          const policy = rowPolicy(
            account,
            currentUserId,
            activeDeveloperCount,
            busyAccountId,
            isAnyMutationPending
          );

          return (
            <li
              key={account.id}
              aria-busy={policy.isBusy || undefined}
              className={`rounded-lg border border-brand-card-border bg-brand-card p-3 shadow-sm ${
                policy.isBusy ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all font-mono text-sm font-semibold text-brand-text">
                    @{account.username}
                  </p>
                  {policy.isCurrentUser && (
                    <p className="mt-0.5 text-[11px] font-semibold text-brand-primary">
                      Current account
                    </p>
                  )}
                </div>
                <AccountStatus status={account.status} />
              </div>

              <dl className="mt-2.5 flex items-baseline gap-1.5">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-text-subtle">
                  Created
                </dt>
                <dd className="text-xs text-brand-text-muted">{formatDate(account.createdAt)}</dd>
              </dl>

              <div className="mt-3 border-t border-brand-border-subtle pt-2.5">
                <RowActions
                  account={account}
                  policy={policy}
                  layout="record"
                  onEditUsername={onEditUsername}
                  onUpdateSecurityQuestion={onUpdateSecurityQuestion}
                  onResetPassword={onResetPassword}
                  onToggleStatus={onToggleStatus}
                  onDelete={onDelete}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
