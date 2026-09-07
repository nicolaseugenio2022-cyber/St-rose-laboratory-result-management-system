"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, Plus, RefreshCw, Search, X } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SkeletonRegion } from "@/components/ui/Skeleton";
import { SummaryBar } from "@/components/ui/SummaryBar";
import {
  createDeveloperAccountAction,
  deleteDeveloperAccountAction,
  listDeveloperAccountsAction,
  resetDeveloperPasswordAction,
  toggleDeveloperStatusAction,
  updateDeveloperSecurityQuestionAction,
  updateDeveloperUsernameAction,
} from "@/features/server-boundary/developer-account-actions";
import type { DeveloperAccountEntry } from "@/features/users/account-directory-entry";
import {
  DeveloperAccountFormModal,
  type DeveloperAccountModalMode,
} from "./DeveloperAccountFormModal";
import { DeveloperAccountDirectorySkeleton } from "./DeveloperAccountDirectorySkeleton";
import { DeveloperAccountTable } from "./DeveloperAccountTable";

interface DeveloperAccountManagementViewProps {
  currentUserId: string;
}

/**
 * The claim a create holds while it runs. Every other write claims the id of the record it
 * writes; a create has no record yet, so it claims this instead. It is only ever compared for
 * emptiness and never reaches `busyAccountId`, so no row can match it.
 */
const CREATE_MUTATION_CLAIM = "developer-account:create";

/**
 * Account lifecycle, in the two words the row badge prints.
 *
 * The directory already carries `status` on every entry, so this narrows what is on screen and
 * asks the server for nothing. A deactivated Developer account is the one an operator most often
 * needs to isolate - it is the account that can no longer sign in - and before this the only way
 * to find it was to read every row.
 */
const STATUS_FILTER_OPTIONS = [
  { label: "All statuses", value: "ALL" },
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function DeveloperAccountManagementView({
  currentUserId,
}: DeveloperAccountManagementViewProps) {
  const [accounts, setAccounts] = useState<DeveloperAccountEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modalMode, setModalMode] = useState<DeveloperAccountModalMode | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<DeveloperAccountEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  // The state above is the busy *indicator*; this ref is the gate. State reaches a handler
  // only after a render, so a toggle and a delete confirmed before that render both read
  // `null` and both write. The ref is current the instant the first of them claims it.
  //
  // One slot, six writers: create, username, security question, password reset, status toggle
  // and delete. A modal submission and a row operation are two entry points into the same
  // directory, and before this they could not see each other at all.
  const busyAccountIdRef = useRef<string | null>(null);

  /** Takes the single mutation slot, or reports that another write already holds it. */
  const claimMutationSlot = (claim: string): boolean => {
    if (busyAccountIdRef.current !== null) return false;
    busyAccountIdRef.current = claim;
    return true;
  };

  const releaseMutationSlot = () => {
    busyAccountIdRef.current = null;
  };
  // A failed *read* and a failed *write* are different problems with different recoveries, and
  // folding them into one string is what let a load failure render underneath "No Developer
  // accounts found" - two contradictory claims about the same directory, on screen at once.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState<DeveloperAccountEntry | null>(
    null
  );

  const loadAccounts = useCallback(async () => {
    try {
      const result = await listDeveloperAccountsAction({});
      setAccounts(result);
      setLoadError(null);
      setHasLoadedOnce(true);
    } catch (error) {
      setLoadError(errorMessage(error, "Failed to load Developer accounts."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await loadAccounts();
    } finally {
      setIsRetrying(false);
    }
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setModalMode(null);
    setSelectedAccount(null);
  };

  const openModal = (
    mode: DeveloperAccountModalMode,
    account: DeveloperAccountEntry | null = null
  ) => {
    // Opening a modal is the first half of a write. The controls that open one are disabled
    // while a mutation runs, but they only become disabled a render later than the ref knows.
    if (busyAccountIdRef.current !== null) return;

    setActionError(null);
    setSelectedAccount(account);
    setModalMode(mode);
  };

  // Every modal submission - create, username, security question, password reset - takes the
  // same slot the row operations take. Claimed before the first await, released in `finally`,
  // so a submit confirmed in the same tick as a toggle or a delete cannot run alongside it.
  const submitAndRefresh = async (operation: () => Promise<unknown>) => {
    const target = selectedAccount;
    if (!claimMutationSlot(target?.id ?? CREATE_MUTATION_CLAIM)) return;

    setIsSubmitting(true);
    // Feedback stays keyed to the record actually being written. A create has no record, so it
    // lights up no row; the directory-wide lock and the live region still report it.
    setBusyAccountId(target?.id ?? null);
    try {
      await operation();
      setModalMode(null);
      setSelectedAccount(null);
      await loadAccounts();
    } finally {
      releaseMutationSlot();
      setBusyAccountId(null);
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (account: DeveloperAccountEntry) => {
    // Single-flight, enforced here and not only by the disabled controls: a click that arrives
    // while another record mutation is in flight would otherwise overwrite the busy id, and the
    // first operation's `finally` would then clear a marker that no longer belongs to it.
    // Gated on the ref, not the state: the disabled controls and the state behind them only
    // exist one render later, which is after a second click in the same tick has been read.
    if (!claimMutationSlot(account.id)) return;

    setActionError(null);
    setBusyAccountId(account.id);
    try {
      await toggleDeveloperStatusAction({ id: account.id });
      await loadAccounts();
    } catch (error) {
      setActionError(errorMessage(error, "Failed to update Developer account status."));
    } finally {
      releaseMutationSlot();
      setBusyAccountId(null);
    }
  };

  const handleDelete = (account: DeveloperAccountEntry) => {
    setPendingDeleteAccount(account);
  };

  const handleConfirmDelete = async () => {
    const account = pendingDeleteAccount;
    if (!account) return;
    // Same single-flight claim as the status toggle; the confirmation dialog is a second entry
    // point into the same mutation slot, and it can be answered in the same tick a toggle is
    // dispatched - before the state that disables either control has rendered.
    if (!claimMutationSlot(account.id)) return;

    setActionError(null);
    setBusyAccountId(account.id);
    try {
      await deleteDeveloperAccountAction({ id: account.id });
      await loadAccounts();
    } catch (error) {
      setActionError(errorMessage(error, "Failed to delete Developer account."));
    } finally {
      releaseMutationSlot();
      setBusyAccountId(null);
      setPendingDeleteAccount(null);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isFiltered = normalizedQuery !== "" || statusFilter !== "ALL";
  const activeFilterCount = (normalizedQuery !== "" ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (statusFilter !== "ALL" && account.status !== statusFilter) return false;
      return account.username.toLowerCase().includes(normalizedQuery);
    });
  }, [accounts, normalizedQuery, statusFilter]);

  const activeDeveloperCount = accounts.filter((account) => account.status === "Active").length;

  // One mutation at a time, across the whole directory and across every entry point. While one
  // is in flight every row's actions and the Add control are unavailable - not only the busy
  // row's - so a second write cannot be launched on top of it. `isSubmitting` is the modal half
  // of that: it covers the create, which locks the directory while marking no record. The
  // pending *indicator* stays keyed to the busy record alone.
  const isAnyMutationPending = isSubmitting || busyAccountId !== null;
  const busyAccountName =
    accounts.find((account) => account.id === busyAccountId)?.username ?? null;

  const clearSearch = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
  };

  // Four states, kept apart on purpose: the first load, a read that failed, a directory with
  // nothing in it, and a search that matched nothing. Only the last two belong to the table.
  const isInitialLoad = isLoading && !hasLoadedOnce;
  const isUnavailable = loadError !== null && !hasLoadedOnce;
  const isStale = loadError !== null && hasLoadedOnce;

  const countLine = isInitialLoad
    ? "Loading Developer accounts..."
    : isUnavailable
      ? "Developer account directory unavailable."
      : `Showing ${filteredAccounts.length} of ${accounts.length} Developer ${
          accounts.length === 1 ? "account" : "accounts"
        }`;

  return (
    <div className="space-y-4 pb-6">
      {actionError && (
        <Alert variant="destructive" onDismiss={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {/* What the module holds, before what is currently shown of it. Counted from the rows the
          safe projection already delivered - no field it does not carry, and no second request.
          Suppressed while nothing has loaded, because zeros would state something about the
          system that no answer established. */}
      {!isInitialLoad && !isUnavailable && (
        <SummaryBar
          label="Developer account summary"
          figures={[
            { label: "Developer accounts", value: accounts.length },
            { label: "Active", value: activeDeveloperCount, tone: "success" },
            {
              label: "Inactive",
              value: accounts.length - activeDeveloperCount,
              tone: accounts.length - activeDeveloperCount > 0 ? "warning" : "muted",
            },
          ]}
          note={
            activeDeveloperCount === 1
              ? "One Developer account is Active. It cannot be deactivated or deleted while it is the last one."
              : undefined
          }
        />
      )}

      {/* One structural toolbar behind the records: search, the status filter, Clear, and the
          page's primary action. The shell already renders the page title, so nothing here
          repeats it. */}
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
          {/* Medium controls line up with the fields below them on a desktop; the 44px minimum
              below sm keeps them a touch target. */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isFiltered && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 sm:min-h-8"
                onClick={clearSearch}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="min-h-11 sm:min-h-8"
              onClick={() => openModal("create")}
              // The page's primary write. It is locked by the same slot the rows are, so a
              // create cannot be started on top of a toggle, a delete, or another submission.
              disabled={isAnyMutationPending}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add Developer account
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative min-w-0 sm:col-span-2">
            {/* A real label rather than a placeholder: a placeholder vanishes the moment the
                field is used, taking the field's name with it. */}
            <Input
              id="developer-account-search"
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
            id="developer-account-status"
            label="Status"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          />
        </div>

        <p className="text-[11px] text-brand-text-muted" aria-live="polite">
          {countLine}
        </p>
      </div>

      {/* Announced once, semantically, rather than by the individual row controls guessing which
          of the five operations is the one in flight. It also states *why* the other rows have
          gone quiet, which a row that is merely disabled cannot say for itself. */}
      <p role="status" aria-live="polite" className="sr-only">
        {isAnyMutationPending
          ? `${
              busyAccountName
                ? `Updating the Developer account @${busyAccountName}.`
                : "Updating a Developer account."
            } Actions on all Developer accounts are unavailable until it finishes.`
          : ""}
      </p>

      {isInitialLoad ? (
        // The same placeholder the route's loading.tsx draws, so the directory does not jump
        // between the two placeholders that precede it.
        <SkeletonRegion isLoading label="Loading Developer accounts">
          <DeveloperAccountDirectorySkeleton />
        </SkeletonRegion>
      ) : isUnavailable ? (
        // A read failure, stated as itself. Nothing here claims the directory is empty, because
        // nothing here knows whether it is.
        <div className="space-y-3 rounded-lg border border-brand-border bg-brand-card p-4 shadow-low">
          <Alert variant="destructive" title="Could not load Developer accounts">
            {loadError}
          </Alert>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8"
            onClick={() => void handleRetry()}
            isLoading={isRetrying}
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {isStale && (
            // The refresh failed but the directory on screen is still real data, so it stays.
            // Blanking a list the reader was using is a worse outcome than showing it as stale.
            <Alert variant="warning" title="Showing previously loaded accounts">
              <span className="block">{loadError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 min-h-11 sm:min-h-8"
                onClick={() => void handleRetry()}
                isLoading={isRetrying}
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                Retry
              </Button>
            </Alert>
          )}
          <DeveloperAccountTable
            accounts={filteredAccounts}
            currentUserId={currentUserId}
            activeDeveloperCount={activeDeveloperCount}
            busyAccountId={busyAccountId}
            isAnyMutationPending={isAnyMutationPending}
            isFiltered={isFiltered}
            onClearFilters={clearSearch}
            onEditUsername={(account) => openModal("username", account)}
            onUpdateSecurityQuestion={(account) => openModal("security-question", account)}
            onResetPassword={(account) => openModal("password", account)}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDelete}
          />
        </div>
      )}

      <DeveloperAccountFormModal
        key={`${modalMode ?? "closed"}-${selectedAccount?.id ?? "new"}`}
        mode={modalMode}
        account={selectedAccount}
        isLoading={isSubmitting}
        onClose={closeModal}
        onCreate={(values) => submitAndRefresh(() => createDeveloperAccountAction(values))}
        onUpdateUsername={(values) => submitAndRefresh(() => updateDeveloperUsernameAction(values))}
        onUpdateSecurityQuestion={(values) =>
          submitAndRefresh(() => updateDeveloperSecurityQuestionAction(values))
        }
        onResetPassword={(values) => submitAndRefresh(() => resetDeveloperPasswordAction(values))}
      />

      <ConfirmDialog
        isOpen={pendingDeleteAccount !== null}
        onCancel={() => setPendingDeleteAccount(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Delete Developer account?"
        description={`Permanently delete the Developer account '${pendingDeleteAccount?.username}'. This cannot be undone.`}
        confirmLabel="Delete account"
        pendingLabel="Deleting..."
        variant="destructive"
        isPending={busyAccountId === pendingDeleteAccount?.id}
      />
    </div>
  );
}
