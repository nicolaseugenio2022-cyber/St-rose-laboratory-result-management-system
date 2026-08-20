import React, { Suspense } from "react";
import { WelcomeBanner } from "../WelcomeBanner";
import DeveloperDashboardSection from "../DeveloperDashboardSection";
import { DeveloperDashboardSkeleton } from "../DeveloperDashboardSkeleton";
import type { IUserProfile } from "@/domain/models/interfaces";

export interface DeveloperDashboardProps {
  currentUserProfile: IUserProfile | null;
}

/**
 * Developer composition: system health, telemetry and audit activity only.
 *
 * `requireOperationalCaller` denies the Developer role patient and
 * report-registry data and emits a SecurityDenial when it does, so nothing here
 * reads session content. Everything rendered comes from
 * `developerDashboardService`, which is already the Developer-safe surface.
 *
 * The Administrative Operations panel and the account-summary tiles are
 * deliberately gone: the panel linked twice to /users, and the tiles duplicated
 * the Total Users figure the Developer section already reports.
 */
export function DeveloperDashboard({ currentUserProfile }: DeveloperDashboardProps) {
  return (
    <div className="space-y-6">
      <WelcomeBanner profile={currentUserProfile} />
      <Suspense fallback={<DeveloperDashboardSkeleton />}>
        <DeveloperDashboardSection currentUserProfile={currentUserProfile} />
      </Suspense>
    </div>
  );
}
