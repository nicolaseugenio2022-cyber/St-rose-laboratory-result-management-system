import React from "react";
import { AdminDashboard } from "./compositions/AdminDashboard";
import { LaboratoryUserDashboard } from "./compositions/LaboratoryUserDashboard";
import { DeveloperDashboard } from "./compositions/DeveloperDashboard";
import { userService } from "@/services/user-service-instance";
import { IUserProfile } from "@/domain/models/interfaces";

export interface DashboardViewProps {
  currentUserProfile: IUserProfile | null;
}

/**
 * Role-aware dashboard entry point.
 *
 * This is a router, not a layout: it selects one composition and holds no
 * presentational markup of its own. Previously every role received the same
 * Administrator-oriented page — account tiles plus an "Administrative
 * Operations" panel linking twice to /users — with Developer content merely
 * appended. `checkRouteAccess` denies the `User` role on /users, /audit and
 * /personnel, so those links were dead ends for the operator who uses this
 * screen most.
 *
 * Role is taken from the server-resolved profile the page already awaits; no
 * permission is inferred or introduced here. An unrecognised role falls through
 * to the most restrictive composition.
 */
export default async function DashboardView({ currentUserProfile }: DashboardViewProps) {
  const role = currentUserProfile?.role;

  if (role === "Developer") {
    return <DeveloperDashboard currentUserProfile={currentUserProfile} />;
  }

  if (role === "Admin") {
    // Fetched only for the role that renders it, rather than for everyone.
    const users = await userService.getUsersVisibleTo(role);
    return (
      <AdminDashboard
        currentUserProfile={currentUserProfile}
        totalUsers={users.length}
        activeUsers={users.filter((u) => u.status === "Active").length}
        inactiveUsers={users.filter((u) => u.status !== "Active").length}
        adminUsers={users.filter((u) => u.role === "Admin").length}
      />
    );
  }

  return <LaboratoryUserDashboard currentUserProfile={currentUserProfile} />;
}
