"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Filter, Plus, RefreshCw, Search, X } from "lucide-react";
import { UserRole } from "@/types/user";
import { resetUserPasswordAction } from "@/features/server-boundary/user-account-actions";
import { createUserApi, deleteUserApi, fetchUsers, updateUserApi } from "@/lib/api/users";
import { CreateUserFormValues, UpdateUserFormValues } from "@/lib/validations/userValidation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SummaryBar } from "@/components/ui/SummaryBar";
import type {
  AccountDirectory,
  AdminAccountEntry,
} from "@/features/users/account-directory-entry";
import { UserTable } from "./UserTable";
import { ROLE_LABEL } from "./RoleBadge";
import { ReadOnlyUserDirectory } from "./ReadOnlyUserDirectory";
import { UserFormModal } from "./UserFormModal";
import { UserPasswordResetModal } from "./UserPasswordResetModal";

/**
 * Role language is decided once and reused.
 *
 * The filter offers exactly the words the row badge prints, so a reader never has to work out
 * that the "User" in the filter and the "Laboratory User" on the row name the same role. The
 * values remain the stored role identifiers - only the wording is presentational.
 *
 * There is no Developer option here. This branch is the Admin directory, and an Admin caller is
 * never served Developer rows, so a Developer filter could only ever return nothing.
 */
const ROLE_FILTER_OPTIONS = [
  { label: "All roles", value: "ALL" },
  { label: ROLE_LABEL.Admin, value: "Admin" },
  { label: ROLE_LABEL.User, value: "User" },
];

/**
 * Account lifecycle, in the same two words the row badge prints.
 *
 * The directory already carries `status` on every entry, so this narrows what is on screen and
 * asks the server for nothing. Deactivated accounts are the ones an administrator most often
 * needs to isolate - they are the accounts that can no longer sign in - and before this the only
 * way to find them was to read every row.
 */
const STATUS_FILTER_OPTIONS = [
  { label: "All statuses", value: "ALL" },
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
];

const REFRESH_FAILED_MESSAGE =
  "The account directory could not be refreshed. The accounts below are the last copy that loaded successfully.";
const INITIAL_LOAD_FAILED_MESSAGE =
  "The account directory could not be loaded, so no accounts are being shown. Nothing has been created or removed.";

export interface UserManagementViewProps {
  currentUserId: string;
  currentUserRole?: UserRole;
  /**
   * Server-rendered directory, already projected for this caller's access level. When present the
   * mount fetch is skipped, so the table paints with the page instead of after a second round
   * trip. Every later refresh - and every refresh after a mutation - still reloads from the server
   * through `loadUsers`, which returns the same role-tagged shape.
   */
  initialDirectory?: AccountDirectory;
}

export function UserManagementView({
  currentUserId,
  currentUserRole,
  initialDirectory,
}: UserManagementViewProps) {
  // The directory carries its own access level, so "what may I see" and "what may I do" stay one
  // decision. A read-only payload cannot be widened into a manageable one by client state.
  //
  // The fallback is role-derived and fails closed. `initialDirectory` is undefined whenever the
  // server render hit a transient read failure, and defaulting that window to "manage" put the
  // Admin chrome - Add, Edit, Reset, Toggle, Delete - in front of a Developer until the refetch
  // resolved. The server refused every one of those writes, but the interface was still claiming
  // a capability the role does not have, which is the opposite of why the read-only view exists.
  // Anything that is not Admin - including an absent role - resolves to the read-only
  // presentation. This is presentation only; `authorizeOrdinaryAccountWrite` remains the boundary.
  const [directory, setDirectory] = useState<AccountDirectory>(
    () =>
      initialDirectory ??
      (currentUserRole === "Admin"
        ? { access: "manage", entries: [] }
        : { access: "read-only", entries: [] })
  );
  // Three separate facts, because the empty table used to conflate them. `hasLoadedDirectory`
  // says whether any answer has ever arrived; `loadFailed` says whether the most recent attempt
  // failed; `isLoadingDirectory` says whether one is in flight. "No accounts exist" is only
  // sayable when the first two are loaded-and-not-failed.
  const [hasLoadedDirectory, setHasLoadedDirectory] = useState(initialDirectory !== undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(initialDirectory === undefined);
  // Memoised, not derived inline. The read-only branch yields a fresh `[]` on every render, and
  // this array is a dependency of the filtering memo below - so an inline derivation changed
  // identity every render and defeated that memo entirely, which is exactly what
  // react-hooks/exhaustive-deps reports. Keyed to `directory`, the one thing it actually depends on.
  const users: AdminAccountEntry[] = useMemo(
    () => (directory.access === "manage" ? directory.entries : []),
    [directory]
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminAccountEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminAccountEntry | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminAccountEntry | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  // One mutation slot for the whole directory, and a ref rather than state because state is the
  // one thing that cannot guard this. A `setIsSubmitting(true)` reaches a handler only after a
  // render, so two events dispatched in the same tick both read the stale `false` and both write;
  // the `disabled` attribute lags by exactly the same render. The ref is current the instant the
  // first handler claims it.
  //
  // Deliberately one slot, not one per operation: the previous per-operation flags let a status
  // toggle and a delete run at once, racing two writes and two refreshes against each other with
  // no way to tell which answer the table ended up showing. Create, update, reset password,
  // status change and delete now all claim this same slot.
  //
  // The state flags above are kept, and stay keyed to the record actually being mutated - they
  // are what the row spinner and the "Updating..." text are drawn from. The ref is the gate; the
  // state is the description.
  const mutationRef = useRef(false);

  const loadUsers = useCallback(async () => {
    setIsLoadingDirectory(true);
    try {
      setDirectory(await fetchUsers());
      setHasLoadedDirectory(true);
      setLoadFailed(false);
    } catch {
      // The failure is recorded as a flag rather than as a sentence, so the wording can be
      // chosen at render time from what is actually on screen. Nothing here clears `directory`:
      // a failed refresh must not blank a directory the reader was using.
      setLoadFailed(true);
    } finally {
      setIsLoadingDirectory(false);
    }
  }, []);

  useEffect(() => {
    // The server already delivered the first directory; fetching it again on mount would repeat
    // that load. Only this mount fetch is skipped - mutations and refreshes call loadUsers directly.
    if (initialDirectory) return;
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUsers]);

  const handleOpenCreate = () => {
    // Checked here as well as in the disabled state: `disabled` is rendered from state and so
    // arrives a render late, which is exactly the window a doubled event lands in.
    if (mutationRef.current) return;
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: AdminAccountEntry) => {
    if (mutationRef.current) return;
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingUser(null);
    setIsModalOpen(false);
  };

  const handleFormSubmit = async (data: CreateUserFormValues | UpdateUserFormValues) => {
    // Claimed before the first await, so a second submit dispatched in the same tick finds the
    // slot taken and returns without sending anything.
    if (mutationRef.current) return;
    mutationRef.current = true;
    setIsSubmitting(true);
    try {
      if (editingUser) {
        await updateUserApi(editingUser.id, data as UpdateUserFormValues);
      } else {
        await createUserApi(data as CreateUserFormValues);
      }
      handleCloseModal();
      await loadUsers();
    } catch (err) {
      console.error("Failed to save user record:", err);
      throw err;
    } finally {
      // Released on the rethrow path too - the modal reports the failure, the slot must not stay
      // claimed behind it.
      mutationRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: AdminAccountEntry) => {
    // Single-flight across every write path, not just status changes: a duplicate click must not
    // be able to send this twice, and it must not be able to run alongside a delete.
    if (mutationRef.current) return;

    setActionError(null);
    if (user.id === currentUserId && user.status === "Active") {
      setActionError("You cannot deactivate the currently authenticated account.");
      return;
    }

    // Claimed only once the refusal above is past, and with no await between the check and the
    // claim, so nothing can interleave and no early return leaves the slot stuck.
    mutationRef.current = true;
    setStatusUpdatingUserId(user.id);
    try {
      await updateUserApi(user.id, {
        status: user.status === "Active" ? "Inactive" : "Active",
      });
      await loadUsers();
    } catch (err) {
      console.error("Failed to toggle status:", err);
      setActionError((err as Error)?.message || "Failed to update user status.");
    } finally {
      mutationRef.current = false;
      setStatusUpdatingUserId(null);
    }
  };

  const handleOpenPasswordReset = (user: AdminAccountEntry) => {
    if (mutationRef.current) return;
    if (user.role === "Developer") return;
    setResetPasswordUser(user);
  };

  const handleClosePasswordReset = () => {
    setResetPasswordUser(null);
  };

  const handlePasswordReset = async (password: string) => {
    if (!resetPasswordUser || resetPasswordUser.role === "Developer") return;
    if (mutationRef.current) return;

    mutationRef.current = true;
    setIsResettingPassword(true);
    try {
      await resetUserPasswordAction({
        id: resetPasswordUser.id,
        password,
      });
      handleClosePasswordReset();
    } finally {
      // The modal owns the failure message and rethrows, so the release has to sit in `finally`
      // rather than after the call.
      mutationRef.current = false;
      setIsResettingPassword(false);
    }
  };

  const handleDeleteUser = (user: AdminAccountEntry) => {
    if (mutationRef.current) return;
    setActionError(null);
    if (user.id === currentUserId) {
      setActionError("You cannot delete the currently authenticated account.");
      return;
    }

    setPendingDeleteUser(user);
  };

  const handleConfirmDeleteUser = async () => {
    const user = pendingDeleteUser;
    if (!user) return;
    // A confirm dialog is one button an operator can hit twice, and the second press would ask
    // the server to delete a record the first press already removed.
    if (mutationRef.current) return;

    mutationRef.current = true;
    setIsDeleting(user.id);
    try {
      await deleteUserApi(user.id);
      await loadUsers();
    } catch (err) {
      console.error("Failed to delete user:", err);
      setActionError((err as Error)?.message || "Failed to delete user account.");
    } finally {
      mutationRef.current = false;
      setIsDeleting(null);
      setPendingDeleteUser(null);
    }
  };

  // Username search plus the two structured filters, all three over data already on screen.
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "ALL" && user.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && user.status !== statusFilter) return false;
      if (!query) return true;
      return user.username.toLowerCase().includes(query);
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || roleFilter !== "ALL" || statusFilter !== "ALL";
  const activeFilterCount =
    (searchQuery.trim() !== "" ? 1 : 0) +
    (roleFilter !== "ALL" ? 1 : 0) +
    (statusFilter !== "ALL" ? 1 : 0);

  const clearDirectoryFilters = () => {
    setSearchQuery("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
  };

  const activeAdminCount = users.filter(
    (user) => user.role === "Admin" && user.status === "Active"
  ).length;

  // The standing shape of the directory, counted from the rows already delivered. Nothing here
  // is fetched, derived from a field the projection does not carry, or filtered - these describe
  // the whole directory, which is what makes them worth stating above a filtered table.
  const totalAccounts = users.length;
  const activeAccounts = users.filter((user) => user.status === "Active").length;
  const inactiveAccounts = totalAccounts - activeAccounts;
  const administratorCount = users.filter((user) => user.role === "Admin").length;

  // A load failure with nothing behind it is a different state from a refresh failure over rows
  // that are still perfectly readable. The first replaces the directory; the second annotates it.
  const directoryUnavailable = loadFailed && !hasLoadedDirectory;
  const loadErrorMessage = !loadFailed
    ? null
    : hasLoadedDirectory
      ? REFRESH_FAILED_MESSAGE
      : INITIAL_LOAD_FAILED_MESSAGE;
  const retryLoadUsers = () => {
    void loadUsers();
  };

  const statusUpdatingUser = users.find((user) => user.id === statusUpdatingUserId) ?? null;

  // The rendered mirror of the slot above. It is derived from the same per-operation state that
  // already existed, so nothing new has to be kept in sync, and it disables every write entry
  // point on screen while any one write is in flight. It is presentation only: it will be a
  // render behind the ref, which is why the ref - not this - is what the handlers check.
  const isMutating =
    isSubmitting || isResettingPassword || isDeleting !== null || statusUpdatingUserId !== null;

  // Read-only callers leave here. Not a flag threaded through the management tree, but a
  // different component: the create, edit, reset, toggle and delete handlers above are simply not
  // reachable, and neither are the modals that drive them. There is no disabled control to
  // re-enable and no prop to get wrong.
  if (directory.access === "read-only") {
    return (
      <ReadOnlyUserDirectory
        entries={directory.entries}
        loadError={loadErrorMessage}
        directoryUnavailable={directoryUnavailable}
        isLoading={isLoadingDirectory && !hasLoadedDirectory}
        onRetryLoad={retryLoadUsers}
        onDismissLoadError={() => setLoadFailed(false)}
      />
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {loadErrorMessage && (
        <Alert
          variant={directoryUnavailable ? "destructive" : "warning"}
          title={
            directoryUnavailable
              ? "Account directory could not be loaded"
              : "Showing previously loaded accounts"
          }
          // A directory that never loaded has nothing behind the message, so the message is not
          // dismissible: dismissing it would leave an unexplained blank screen.
          onDismiss={directoryUnavailable ? undefined : () => setLoadFailed(false)}
        >
          <p>{loadErrorMessage}</p>
          {!directoryUnavailable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 min-h-11 sm:min-h-8"
              onClick={retryLoadUsers}
              isLoading={isLoadingDirectory}
            >
              {!isLoadingDirectory && <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}
              Retry
            </Button>
          )}
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive" onDismiss={() => setActionError(null)}>{actionError}</Alert>
      )}

      {/* What the directory contains, before what is currently shown of it. Counted from the rows
          already delivered - no field the Admin projection does not carry, and no second request.

          Gated on `hasLoadedDirectory`, which is the only one of the three load facts that means
          "an answer arrived". `!directoryUnavailable` did NOT achieve what this comment claims:
          that flag turns true only once a load has FAILED, so during the very first in-flight
          load - the window a transient server-side read failure opens - it was false and the
          strip published four zeros as though the directory were genuinely empty. A successful
          empty directory still shows its zeros, because an answer did arrive. */}
      {hasLoadedDirectory && (
        <SummaryBar
          label="Staff account summary"
          figures={[
            { label: "Accounts", value: totalAccounts },
            { label: "Active", value: activeAccounts, tone: "success" },
            {
              label: "Inactive",
              value: inactiveAccounts,
              tone: inactiveAccounts > 0 ? "warning" : "muted",
            },
            { label: "Administrators", value: administratorCount },
          ]}
          note={
            administratorCount > 0 && activeAdminCount === 1
              ? "One Administrator account is Active. It cannot be deactivated or deleted while it is the last one."
              : undefined
          }
        />
      )}

      {/* Structural: the directory controls sit behind the records rather than presenting as
          another content card. Add staff account lives here as the page's primary action -
          the shell already supplies the title this block used to repeat. */}
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
          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 sm:min-h-8"
                onClick={clearDirectoryFilters}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleOpenCreate}
              className="min-h-11 sm:min-h-8"
              disabled={isMutating}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add staff account
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative min-w-0 lg:col-span-2">
            {/* A real label, not a placeholder: a placeholder disappears the moment the field
                is used, taking the field's name with it. */}
            <Input
              id="user-directory-search"
              label="Search accounts"
              type="search"
              placeholder="Username"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {/* Centred on the 44px field below sm and on the 36px field above it. */}
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3.5 left-3 h-4 w-4 text-brand-text-subtle sm:bottom-2.5"
            />
          </div>
          <Select
            id="user-directory-role"
            label="Role"
            options={ROLE_FILTER_OPTIONS}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          />
          <Select
            id="user-directory-status"
            label="Status"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>

        {/* One live region, carrying whichever of the three facts is currently true. A pending
            status change is announced here and stated in words, which is also what explains the
            other rows' held toggles - the operator is never left with a dead control and no
            reason for it. */}
        <p className="text-[11px] text-brand-text-muted" aria-live="polite">
          {directoryUnavailable ? (
            "Account totals are unavailable until the directory loads."
          ) : statusUpdatingUser ? (
            <>
              Updating{" "}
              <span className="font-semibold text-brand-text">@{statusUpdatingUser.username}</span>.
              Other account changes are paused until it finishes.
            </>
          ) : (
            <>
              Showing <span className="font-semibold text-brand-text">{filteredUsers.length}</span>{" "}
              of <span className="font-semibold text-brand-text">{users.length}</span> accounts
            </>
          )}
        </p>
      </div>

      {/* User Data Table */}
      <div aria-busy={isLoadingDirectory || undefined}>
        <UserTable
          users={filteredUsers}
          onEdit={handleOpenEdit}
          onResetPassword={handleOpenPasswordReset}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDeleteUser}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          activeAdminCount={activeAdminCount}
          deletingUserId={isDeleting}
          statusUpdatingUserId={statusUpdatingUserId}
          isMutating={isMutating}
          loadState={
            directoryUnavailable
              ? "failed"
              : isLoadingDirectory && !hasLoadedDirectory
                ? "loading"
                : "ready"
          }
          onRetryLoad={retryLoadUsers}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearDirectoryFilters}
        />
      </div>

      {/* Create / Edit Form Modal */}
      <UserFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        initialData={editingUser}
        onSubmit={handleFormSubmit}
        isLoading={isSubmitting}
      />

      <UserPasswordResetModal
        isOpen={resetPasswordUser !== null}
        targetUser={resetPasswordUser}
        onClose={handleClosePasswordReset}
        onSubmit={handlePasswordReset}
        isLoading={isResettingPassword}
      />

      <ConfirmDialog
        isOpen={pendingDeleteUser !== null}
        onCancel={() => setPendingDeleteUser(null)}
        onConfirm={() => void handleConfirmDeleteUser()}
        title="Delete user account?"
        description={`Permanently delete the account '${pendingDeleteUser?.username}'. This cannot be undone.`}
        confirmLabel="Delete account"
        pendingLabel="Deleting..."
        variant="destructive"
        isPending={isDeleting === pendingDeleteUser?.id}
      />
    </div>
  );
}
