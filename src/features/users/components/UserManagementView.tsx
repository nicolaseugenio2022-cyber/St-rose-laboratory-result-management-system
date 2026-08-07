"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, Users } from "lucide-react";
import { User } from "@/types/user";
import { userService } from "@/services/userService";
import { CreateUserFormValues, UpdateUserFormValues } from "@/lib/validations/userValidation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { UserTable } from "./UserTable";
import { UserFormModal } from "./UserFormModal";

export function UserManagementView() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    const data = await userService.getUsers();
    setUsers(data);
  }, []);

  useEffect(() => {
    loadUsers();
    // Subscribe to changes in the decoupled user service
    const unsubscribe = userService.subscribe(loadUsers);
    return () => unsubscribe();
  }, [loadUsers]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
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
        await userService.updateUser(editingUser.id, data as UpdateUserFormValues);
      } else {
        await userService.createUser(data as CreateUserFormValues);
      }
      handleCloseModal();
    } catch (err) {
      console.error("Failed to save user record:", err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await userService.toggleUserStatus(user.id);
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  // Filter users based on username search query and role filter
  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const roleFilterOptions = [
    { label: "All Roles", value: "ALL" },
    { label: "Admin", value: "Admin" },
    { label: "User", value: "User" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-primary" />
            <h2 className="text-xl font-bold text-brand-text">User Management</h2>
          </div>
          <p className="text-xs text-brand-text-muted mt-1">
            Manage staff login accounts, assign administrative roles, and toggle account activation status.
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="md" className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          <span>Add Account</span>
        </Button>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-brand-surface p-4 rounded-xl border border-brand-border shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-brand-text-subtle" />
          <Input
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
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
        onToggleStatus={handleToggleStatus}
      />

      {/* Create / Edit Form Modal */}
      <UserFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        initialData={editingUser}
        onSubmit={handleFormSubmit}
        isLoading={isSubmitting}
      />
    </div>
  );
}
