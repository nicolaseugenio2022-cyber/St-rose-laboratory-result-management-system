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
  // True only when an account protection blocks DEACTIVATION specifically. Distinct from
  // `toggleDisabled`, which also covers the transient single-flight hold that carries no
  // protection sentence. An inactive current user stays reactivatable, so the restriction
  // (delete-only) does not describe its Reactivate action.
  const toggleRestricted = isActive && (isCurrentUser || isLastActiveDeveloper);
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
    toggleRestricted,
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
  restrictionId,
  onEditUsername,
  onUpdateSecurityQuestion,
  onResetPassword,
  onToggleStatus,
  onDelete,
}: {
  account: DeveloperAccountEntry;
  policy: RowPolicy;
  layout: "row" | "record";
  /**
   * Id of the sentence explaining why a control is unavailable, passed to `aria-describedby` on
   * exactly the controls the restriction governs - Delete always; the status toggle only when
   * the restriction also blocks deactivation. Without it a screen-reader operator who lands on a
   * disabled Deactivate hears silence where the reason is sitting in plain text directly
   * underneath.
   */
  restrictionId?: string;
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
      {/* The same named group the other three directories expose. This was the one action set a
          screen reader reached as a run of loose buttons with no statement of which account they
          act on, so the accessible name of each control was the only thing tying them together. */}
      <div
        role="group"
        aria-label={`Actions for ${name}`}
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
          className="inline-flex flex-wrap items-center gap-1 rounded-md border border-brand-border px-1.5 py-1"
        >
          <span
            aria-hidden="true"
            className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted"
          >
            Credentials
          </span>
          {/* Outline, like every other neutral record action. The bordered Credentials box says
              these two belong together; it never said they were controls, and inside it they read
              as two labels until the pointer arrived. */}
          <Button
            variant="outline"
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
            variant="outline"
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

        {/* The shared soft status variants, and below them the shared danger variant the other
            three directories already use for an irreversible act. All three colour pairs this row
            spelled out by hand are gone rather than moved: the variants state them once. */}
        <Button
          variant={policy.isActive ? "warning" : "success"}
          size="sm"
          className={touch}
          onClick={() => onToggleStatus(account)}
          disabled={policy.toggleDisabled}
          aria-label={`${toggleVerb} ${name}`}
          aria-describedby={policy.toggleRestricted ? restrictionId : undefined}
        >
          <Power aria-hidden="true" className="h-3.5 w-3.5" />
          {toggleVerb}
        </Button>

        <Button
          variant="danger"
          size="sm"
          className={touch}
          onClick={() => onDelete(account)}
          disabled={policy.deleteDisabled}
          aria-label={`Delete ${name}`}
          aria-describedby={policy.restriction ? restrictionId : undefined}
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

      {policy.restriction && restrictionId && (
        <RestrictionNote id={restrictionId} restriction={policy.restriction} />
      )}
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
    return isFiltered ? (
      <EmptyState
        icon={Search}
        headingLevel={3}
        title="No Developer accounts match these filters"
        description="No Developer account matches the active username search and status selection."
        action={
          onClearFilters ? (
            <Button
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
    ) : (
      <EmptyState
        icon={ShieldCheck}
        headingLevel={3}
        title="No Developer accounts yet"
        description="Developer accounts registered through this module will be listed here."
      />
    );
  }

  return (
    <>
      {/* Desktop: a real table. `Table` supplies its own bordered, scrollable white panel, so it
          is not wrapped in a second one. Below lg the record list takes over instead - a
          five-action administrative row squeezed onto a phone is unreadable whichever way it is
          squeezed. */}
      <div className="hidden lg:block">
        <Table striped wrapperClassName="shadow-low" className="min-w-[640px]">
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
                  className={policy.isBusy ? "opacity-60" : undefined}
                >
                  <TableCell>
                    <span className="block break-all font-mono text-xs font-semibold text-brand-text">
                      @{account.username}
                    </span>
                    {policy.isCurrentUser && (
                      <span className="mt-0.5 block text-[11px] font-semibold text-brand-primary">
                        Current account
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <AccountStatus status={account.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono tabular-nums text-brand-text-muted">
                    {formatDate(account.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      account={account}
                      policy={policy}
                      layout="row"
                      restrictionId={`developer-row-${account.id}-restriction`}
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

      {/* Narrow widths: one white record per account carrying every fact the row carries -
          username, status, created date and the same five operations behind the same handlers,
          the actions in a structural footer band. */}
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
              className={`overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low ${
                policy.isBusy ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="break-all font-mono text-[13px] font-semibold text-brand-text">
                    @{account.username}
                  </p>
                  {policy.isCurrentUser && (
                    <p className="mt-0.5 text-[11px] font-semibold text-brand-primary">
                      Current account
                    </p>
                  )}
                </div>
                <span className="shrink-0">
                  <AccountStatus status={account.status} />
                </span>
              </div>

              <dl className="flex items-baseline gap-1.5 px-3.5 pb-2.5">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
                  Created
                </dt>
                <dd className="font-mono text-[11px] tabular-nums text-brand-text-muted">
                  {formatDate(account.createdAt)}
                </dd>
              </dl>

              <div className="border-t border-brand-border bg-brand-structural px-3.5 py-2.5">
                <RowActions
                  account={account}
                  policy={policy}
                  layout="record"
                  restrictionId={`developer-card-${account.id}-restriction`}
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
