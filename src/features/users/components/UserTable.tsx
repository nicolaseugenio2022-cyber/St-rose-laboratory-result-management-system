import React from "react";
import { Edit2, Power } from "lucide-react";
import { UserProfile } from "@/types/user";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { RoleBadge } from "./RoleBadge";
import { UserStatusBadge } from "./UserStatusBadge";

export interface UserTableProps {
  users: UserProfile[];
  onEdit: (user: UserProfile) => void;
  onToggleStatus: (user: UserProfile) => void;
  onDelete: (user: UserProfile) => void;
  deletingUserId?: string | null;
  isLoading?: boolean;
}

export function UserTable({ users, onEdit, onToggleStatus, onDelete, deletingUserId, isLoading = false }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-surface p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-brand-text-subtle mb-3">
          <Edit2 className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-brand-text">No users found</h3>
        <p className="text-sm text-brand-text-muted mt-1">
          No user accounts match your active search or role filter criteria.
        </p>
      </div>
    );
  }

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Table>
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
          const isActive = user.status === "Active";
          return (
            <TableRow key={user.id}>
              <TableCell className="font-semibold text-brand-text font-mono text-sm">
                @{user.username}
              </TableCell>
              <TableCell>
                <RoleBadge role={user.role} />
              </TableCell>
              <TableCell>
                <UserStatusBadge status={user.status} />
              </TableCell>
              <TableCell className="text-brand-text-muted text-xs">{formatDate(user.createdAt)}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(user)}
                    disabled={isLoading}
                    title="Edit User Details"
                  >
                    <Edit2 className="h-4 w-4 text-brand-text-muted" />
                    <span className="sr-only">Edit {user.username}</span>
                  </Button>
                  <Button
                    variant={isActive ? "outline" : "secondary"}
                    size="sm"
                    onClick={() => onToggleStatus(user)}
                    disabled={isLoading}
                    title={isActive ? "Deactivate User" : "Activate User"}
                    className={isActive ? "text-brand-warning hover:bg-brand-warning-bg hover:border-brand-warning-border" : "text-brand-success-bg bg-brand-success hover:opacity-90"}
                  >
                    <Power className="h-4 w-4" />
                    <span className="text-xs">{isActive ? "Deactivate" : "Activate"}</span>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(user)}
                    disabled={isLoading || deletingUserId === user.id}
                    title="Delete User"
                  >
                    <Power className="h-4 w-4" />
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
