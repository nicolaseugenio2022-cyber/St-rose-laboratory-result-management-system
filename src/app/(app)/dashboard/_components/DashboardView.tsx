import React from "react";
import { AdminDashboard } from "./compositions/AdminDashboard";
import { LaboratoryUserDashboard } from "./compositions/LaboratoryUserDashboard";
import { DeveloperDashboard } from "./compositions/DeveloperDashboard";
import { getRecentWork } from "../_lib/recent-work";
import { describeErrorShape } from "@/lib/safe-error";
import { userService } from "@/services/user-service-instance";
import { IUserProfile } from "@/domain/models/interfaces";

export interface DashboardViewProps {
  currentUserProfile: IUserProfile | null;
}

/**
 * Classify an operational recent-work read failure, and degrade ONLY for a proven transient one.
 *
 * The two outcomes are deliberately not symmetric:
 *
 *   - **Transient transport fault** (the bounded read envelope: attempt timeout, connect/socket
 *     failure) resolves to `null`, which the compositions render as an explicit temporary-
 *     unavailability message. `null` is used rather than an empty `RecentWork` because "you have
 *     no unfinished work" and "we could not find out" are different statements, and only one of
 *     them is true here. Substituting an empty list would tell a laboratory operator the first.
 *
 *   - **Anything else** - a coded PostgREST/SQL error, an authorization refusal, a programming
 *     fault - is re-raised unchanged and reaches the existing segment error boundary. A permanent
 *     failure must stay loud; this must never become a catch-all that hides a real defect.
 *
 * The classification is taken from the sanitized shape that is logged, so the branch and the
 * recorded evidence can never disagree about which case fired. Shape only - never the message,
 * the payload, or any session or patient field.
 *
 * Declared above the component and free of the operational read's own call text, so the ordering
 * this file is verified on - the Developer branch preceding any reachable operational read - is
 * unaffected.
 */
function handleRecentWorkFailure(error: unknown): null {
  const shape = describeErrorShape(error);
  console.error("Dashboard recent-work load failed.", {
    route: "/dashboard",
    stage: "recentWork",
    ...shape,
  });
  if (!shape.transientRead) throw error;
  return null;
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
 *
 * The operational session read is **role-gated at this boundary**: the Developer
 * branch returns before `getRecentWork` is reachable, so a Developer never
 * invokes it. `requireOperationalCaller` would refuse anyway and emit a
 * SecurityDenial audit — not calling it at all keeps the dashboard from
 * manufacturing denial noise on every page view.
 */
export default async function DashboardView({ currentUserProfile }: DashboardViewProps) {
  const role = currentUserProfile?.role;

  // Developer: system telemetry only. Returns before any operational read.
  if (role === "Developer") {
    return <DeveloperDashboard currentUserProfile={currentUserProfile} />;
  }

  if (role === "Admin") {
    // Fetched only for the role that renders it, rather than for everyone.
    const [users, recentWork] = await Promise.all([
      userService.getUsersVisibleTo(role),
      getRecentWork().catch(handleRecentWorkFailure),
    ]);
    return (
      <AdminDashboard
        totalUsers={users.length}
        activeUsers={users.filter((u) => u.status === "Active").length}
        inactiveUsers={users.filter((u) => u.status !== "Active").length}
        adminUsers={users.filter((u) => u.role === "Admin").length}
        recentWork={recentWork}
      />
    );
  }

  const recentWork = await getRecentWork().catch(handleRecentWorkFailure);
  return (
    <LaboratoryUserDashboard recentWork={recentWork} />
  );
}
