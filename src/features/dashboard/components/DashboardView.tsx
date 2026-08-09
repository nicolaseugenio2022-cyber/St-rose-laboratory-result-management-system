import React from "react";
import { WelcomeBanner } from "./WelcomeBanner";
import { SummaryCards } from "./SummaryCards";
import { QuickActions } from "./QuickActions";
import DeveloperDashboardSection from "./DeveloperDashboardSection";
import { userService } from "@/services/userService";
import { UserSummary } from "@/lib/api/users";
import { getCurrentUserProfile } from "@/lib/auth-guards";

export default async function DashboardView() {
  const users = await userService.getUsers();
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "Active").length;
  const inactiveUsers = users.filter((u) => u.status !== "Active").length;
  const adminUsers = users.filter((u) => u.role === "Admin").length;

  const userSummary: UserSummary = { totalUsers, activeUsers, inactiveUsers, adminUsers };
  const currentUserProfile = await getCurrentUserProfile();
  const isDeveloper = currentUserProfile?.role === "Developer";

  return (
    <div className="space-y-6">
      <WelcomeBanner />

      <SummaryCards
        totalUsers={userSummary.totalUsers}
        activeUsers={userSummary.activeUsers}
        inactiveUsers={userSummary.inactiveUsers}
        adminUsers={userSummary.adminUsers}
      />

      <QuickActions />

      {isDeveloper && <DeveloperDashboardSection />}
    </div>
  );
}
