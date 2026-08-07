"use client";

import React, { useState, useEffect, useCallback } from "react";
import { User } from "@/types/user";
import { userService } from "@/services/userService";
import { WelcomeBanner } from "./WelcomeBanner";
import { SummaryCards } from "./SummaryCards";
import { QuickActions } from "./QuickActions";

export function DashboardView() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err) {
      console.error("Failed to load user metrics:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Subscribe to real-time changes from in-memory user service
    const unsubscribe = userService.subscribe(loadData);
    return () => unsubscribe();
  }, [loadData]);

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "Active").length;
  const inactiveUsers = users.filter((u) => u.status === "Inactive").length;
  const adminUsers = users.filter((u) => u.role === "Admin").length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-48 w-full animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 w-full animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WelcomeBanner />

      <SummaryCards
        totalUsers={totalUsers}
        activeUsers={activeUsers}
        inactiveUsers={inactiveUsers}
        adminUsers={adminUsers}
      />

      <QuickActions />
    </div>
  );
}
