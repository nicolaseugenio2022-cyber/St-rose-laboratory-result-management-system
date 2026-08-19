"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search, Users } from "lucide-react";
import { UserProfile, UserRole } from "@/types/user";
import { resetUserPasswordAction } from "@/features/server-boundary/user-account-actions";
import { createUserApi, deleteUserApi, fetchUsers, updateUserApi } from "@/lib/api/users";
import { CreateUserFormValues, UpdateUserFormValues } from "@/lib/validations/userValidation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { UserTable } from "./UserTable";
import { UserFormModal } from "./UserFormModal";
import { UserPasswordResetModal } from "./UserPasswordResetModal";

export interface UserManagementViewProps {
  currentUserId: string;
  currentUserRole?: UserRole;
}

export function UserManagementView({ currentUserId, currentUserRole }: UserManagementViewProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserProfile | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const loadUsers = useCallback(async () => {
    const data = await fetchUsers();
    setUsers(data);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingUser(null);
    setIsModalOpen(false);
  };

  const handleFormSubmit = async (data: CreateUserFormValues | UpdateUserFormValues) => {
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
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    if (user.id === currentUserId && user.status === "Active") {
      window.alert("You cannot deactivate the currently authenticated account.");
      return;
    }

    try {
      await updateUserApi(user.id, {
        status: user.status === "Active" ? "Inactive" : "Active",
      });
      await loadUsers();
    } catch (err) {
      console.error("Failed to toggle status:", err);
      window.alert((err as Error)?.message || "Failed to update user status.");
    }
  };

  const handleOpenPasswordReset = (user: UserProfile) => {
    if (user.role === "Developer") return;
    setResetPasswordUser(user);
  };

  const handleClosePasswordReset = () => {
    setResetPasswordUser(null);
  };

  const handlePasswordReset = async (password: string) => {
    if (!resetPasswordUser || resetPasswordUser.role === "Developer") return;

    setIsResettingPassword(true);
    try {
      await resetUserPasswordAction({
        id: resetPasswordUser.id,
        password,
      });
      handleClosePasswordReset();
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.id === currentUserId) {
      window.alert("You cannot delete the currently authenticated account.");
      return;
    }

    if (!window.confirm(`Delete user account '${user.username}'? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(user.id);
    try {
      await deleteUserApi(user.id);
      await loadUsers();
    } catch (err) {
      console.error("Failed to delete user:", err);
      window.alert((err as Error)?.message || "Failed to delete user account.");
    } finally {
      setIsDeleting(null);
    }
  };

  // Filter users based on username search query and role filter
  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const activeAdminCount = users.filter(
    (user) => user.role === "Admin" && user.status === "Active"
  ).length;

  const roleFilterOptions = useMemo(() => {
    const options = [
      { label: "All Roles", value: "ALL" },
      { label: "Admin", value: "Admin" },
      { label: "User", value: "User" },
    ];

    if (currentUserRole === "Developer") {
      options.splice(2, 0, { label: "Developer", value: "Developer" });
    }

    return options;
  }, [currentUserRole]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-brand-primary" />
            <h2 className="text-2xl font-bold text-brand-text tracking-tight">User Management</h2>
          </div>
          <p className="text-xs text-brand-text-muted/90 mt-1.5 leading-relaxed">
            Manage staff login accounts, assign administrative roles, and toggle account activation status.
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="md" className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          <span>Add Account</span>
        </Button>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-brand-surface p-4 rounded-xl border border-brand-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-brand-text-subtle pointer-events-none" />
          <Input
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            options={roleFilterOptions}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          />
        </div>
      </div>

      {/* User Data Table */}
      <UserTable
        users={filteredUsers}
        onEdit={handleOpenEdit}
        onResetPassword={handleOpenPasswordReset}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteUser}
        currentUserId={currentUserId}
        activeAdminCount={activeAdminCount}
        deletingUserId={isDeleting}
      />

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
    </div>
  );
}
