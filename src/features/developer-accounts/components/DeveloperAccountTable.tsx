y
"use client";

import React from "react";
import { Edit2, KeyRound, Power, ShieldQuestion, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { UserStatusBadge } from "@/features/users/components/UserStatusBadge";
import type { User } from "@/types/user";

interface DeveloperAccountTableProps {
  accounts: User[];
  currentUserId: string;
  activeDeveloperCount: number;
  busyAccountId: string | null;
  onEditUsername: (account: User) => void;
  onUpdateSecurityQuestion: (account: User) => void;
  onResetPassword: (account: User) => void;
  onToggleStatus: (account: User) => void;
  onDelete: (account: User) => void;
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

export function DeveloperAccountTable({
  accounts,
  currentUserId,
  activeDeveloperCount,
  busyAccountId,
  onEditUsername,
  onUpdateSecurityQuestion,
  onResetPassword,
  onToggleStatus,
  onDelete,
}: DeveloperAccountTableProps) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-surface p-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-brand-text-subtle">
          <Edit2 className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-brand-text">No Developer accounts found</h3>
        <p className="mt-1 text-sm text-brand-text-muted">
          No Developer accounts match the current search.
        </p>
      </div>
    );
  }

  return (
    <Table>
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
          const isActive = account.status === "Active";
          const isCurrentUser = account.id === currentUserId;
          const isLastActiveDeveloper = isActive && activeDeveloperCount === 1;
          const isBusy = busyAccountId === account.id;
          const toggleDisabled =
            isBusy || (isActive && (isCurrentUser || isLastActiveDeveloper));
          const deleteDisabled = isBusy || isCurrentUser || isLastActiveDeveloper;

          return (
            <TableRow key={account.id}>
              <TableCell className="font-mono text-sm font-semibold text-brand-text">
                @{account.username}
              </TableCell>
              <TableCell>
                <UserStatusBadge status={account.status} />
              </TableCell>
              <TableCell className="text-xs text-brand-text-muted">
                {formatDate(account.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditUsername(account)}
                    disabled={isBusy}
                    title="Edit Username"
                  >
                    <Edit2 className="h-4 w-4 text-brand-text-muted" />
                    <span className="sr-only">Edit {account.username} username</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUpdateSecurityQuestion(account)}
                    disabled={isBusy}
                    title="Update Security Question"
                  >
                    <ShieldQuestion className="h-4 w-4 text-brand-text-muted" />
                    <span className="sr-only">
                      Update {account.username} security question
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onResetPassword(account)}
                    disabled={isBusy}
                    title="Reset Password"
                  >
                    <KeyRound className="h-4 w-4 text-brand-text-muted" />
                    <span className="sr-only">Reset {account.username} password</span>
                  </Button>
                  <Button
                    variant={isActive ? "outline" : "secondary"}
                    size="sm"
                    onClick={() => onToggleStatus(account)}
                    disabled={toggleDisabled}
                    title={
                      isCurrentUser && isActive
                        ? "You cannot deactivate the currently authenticated account."
                        : isLastActiveDeveloper
                          ? "The last Active Developer account cannot be deactivated."
                          : isActive
                            ? "Deactivate Developer"
                            : "Reactivate Developer"
                    }
                    className={
                      isActive
                        ? "text-brand-warning hover:border-brand-warning-border hover:bg-brand-warning-bg"
                        : "bg-brand-success text-brand-success-bg hover:opacity-90"
                    }
                  >
                    <Power className="h-4 w-4" />
                    <span className="text-xs">{isActive ? "Deactivate" : "Reactivate"}</span>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(account)}
                    disabled={deleteDisabled}
                    title={
                      isCurrentUser
                        ? "You cannot delete the currently authenticated account."
                        : isLastActiveDeveloper
                          ? "The last Active Developer account cannot be deleted."
                          : "Delete Developer"
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="text-xs">Delete</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
