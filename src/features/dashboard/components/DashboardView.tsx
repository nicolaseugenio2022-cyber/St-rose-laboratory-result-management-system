import React, { Suspense } from "react";
import { WelcomeBanner } from "./WelcomeBanner";
import { SummaryCards } from "./SummaryCards";
import { QuickActions } from "./QuickActions";
import DeveloperDashboardSection from "./DeveloperDashboardSection";
import { DeveloperDashboardSkeleton } from "./DeveloperDashboardSkeleton";
import { userService } from "@/services/user-service-instance";
import { UserSummary } from "@/lib/api/users";
import { IUserProfile } from "@/domain/models/interfaces";

export interface DashboardViewProps {
  currentUserProfile: IUserProfile | null;
}

export default async function DashboardView({ currentUserProfile }: DashboardViewProps) {
  const users = await userService.getUsersVisibleTo(
    currentUserProfile?.role ?? "User"
  );
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "Active").length;
  const inactiveUsers = users.filter((u) => u.status !== "Active").length;
  const adminUsers = users.filter((u) => u.role === "Admin").length;

  const userSummary: UserSummary = { totalUsers, activeUsers, inactiveUsers, adminUsers };
  const isDeveloper = currentUserProfile?.role === "Developer";

  return (
    <div className="space-y-6">
      <WelcomeBanner profile={currentUserProfile} />

      <SummaryCards
        totalUsers={userSummary.totalUsers}
        activeUsers={userSummary.activeUsers}
        inactiveUsers={userSummary.inactiveUsers}
        adminUsers={userSummary.adminUsers}
      />

      <QuickActions />

      {isDeveloper && (
        <Suspense fallback={<DeveloperDashboardSkeleton />}>
          <DeveloperDashboardSection />
        </Suspense>
      )}
    </div>
  );
}
