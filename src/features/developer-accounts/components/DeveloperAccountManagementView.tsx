"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createDeveloperAccountAction,
  deleteDeveloperAccountAction,
  listDeveloperAccountsAction,
  resetDeveloperPasswordAction,
  toggleDeveloperStatusAction,
  updateDeveloperSecurityQuestionAction,
  updateDeveloperUsernameAction,
} from "@/features/server-boundary/developer-account-actions";
import type { User } from "@/types/user";
import {
  DeveloperAccountFormModal,
  type DeveloperAccountModalMode,
} from "./DeveloperAccountFormModal";
import { DeveloperAccountTable } from "./DeveloperAccountTable";

interface DeveloperAccountManagementViewProps {
  currentUserId: string;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function DeveloperAccountManagementView({
  currentUserId,
}: DeveloperAccountManagementViewProps) {
  const [accounts, setAccounts] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalMode, setModalMode] = useState<DeveloperAccountModalMode | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const result = await listDeveloperAccountsAction({});
      setAccounts(result);
      setActionError(null);
    } catch (error) {
      setActionError(errorMessage(error, "Failed to load Developer accounts."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const closeModal = () => {
    if (isSubmitting) return;
    setModalMode(null);
    setSelectedAccount(null);
  };

  const openModal = (mode: DeveloperAccountModalMode, account: User | null = null) => {
    setActionError(null);
    setSelectedAccount(account);
    setModalMode(mode);
  };

  const submitAndRefresh = async (operation: () => Promise<unknown>) => {
    setIsSubmitting(true);
    try {
      await operation();
      setModalMode(null);
      setSelectedAccount(null);
      await loadAccounts();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (account: User) => {
    setActionError(null);
    setBusyAccountId(account.id);
    try {
      await toggleDeveloperStatusAction({ id: account.id });
      await loadAccounts();
    } catch (error) {
      setActionError(errorMessage(error, "Failed to update Developer account status."));
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleDelete = async (account: User) => {
    if (
      !window.confirm(
        `Delete Developer account '${account.username}'? This action cannot be undone.`
      )
    ) {
      return;
    }

    setActionError(null);
    setBusyAccountId(account.id);
    try {
      await deleteDeveloperAccountAction({ id: account.id });
      await loadAccounts();
    } catch (error) {
      setActionError(errorMessage(error, "Failed to delete Developer account."));
    } finally {
      setBusyAccountId(null);
    }
  };

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return accounts.filter((account) =>
      account.username.toLowerCase().includes(normalizedQuery)
    );
  }, [accounts, searchQuery]);

  const activeDeveloperCount = accounts.filter(
    (account) => account.status === "Active"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-brand-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-brand-primary" />
            <h2 className="text-2xl font-bold tracking-tight text-brand-text">
              Developer Account Management
            </h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-brand-text-muted/90">
            Manage Developer account credentials and activation status.
          </p>
        </div>
        <Button
          onClick={() => openModal("create")}
          size="md"
          className="shrink-0 gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Account</span>
        </Button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700"
        >
          {actionError}
        </div>
      )}

      <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface p-4 shadow-xs sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-brand-text-subtle" />
          <Input
            aria-label="Search Developer accounts by username"
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-12 text-center text-sm text-brand-text-muted">
          Loading Developer accounts...
        </div>
      ) : (
        <DeveloperAccountTable
          accounts={filteredAccounts}
          currentUserId={currentUserId}
          activeDeveloperCount={activeDeveloperCount}
          busyAccountId={busyAccountId}
          onEditUsername={(account) => openModal("username", account)}
          onUpdateSecurityQuestion={(account) =>
            openModal("security-question", account)
          }
          onResetPassword={(account) => openModal("password", account)}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
        />
      )}

      <DeveloperAccountFormModal
        key={`${modalMode ?? "closed"}-${selectedAccount?.id ?? "new"}`}
        mode={modalMode}
        account={selectedAccount}
        isLoading={isSubmitting}
        onClose={closeModal}
        onCreate={(values) =>
          submitAndRefresh(() => createDeveloperAccountAction(values))
        }
        onUpdateUsername={(values) =>
          submitAndRefresh(() => updateDeveloperUsernameAction(values))
        }
        onUpdateSecurityQuestion={(values) =>
          submitAndRefresh(() => updateDeveloperSecurityQuestionAction(values))
        }
        onResetPassword={(values) =>
          submitAndRefresh(() => resetDeveloperPasswordAction(values))
        }
      />
    </div>
  );
}
