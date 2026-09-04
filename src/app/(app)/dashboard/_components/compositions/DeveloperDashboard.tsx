import React, { Suspense } from "react";
import DeveloperDashboardSection from "../DeveloperDashboardSection";
import { DeveloperDashboardSkeleton } from "../DeveloperDashboardSkeleton";
import type { IUserProfile } from "@/domain/models/interfaces";

export interface DeveloperDashboardProps {
  currentUserProfile: IUserProfile | null;
}

/**
 * Developer composition: a technical operations surface, not a patient-work one.
 *
 * `requireOperationalCaller` denies the Developer role patient and
 * report-registry data and emits a SecurityDenial when it does, so nothing here
 * reads session content. Everything rendered comes from
 * `developerDashboardService`, which is already the Developer-safe surface, and
 * no route reachable from this page leads to /workspace or /history.
 *
 * The Suspense boundary is preserved: the awaited service call streams in behind
 * a skeleton shaped like the finished layout.
 */
export function DeveloperDashboard({ currentUserProfile }: DeveloperDashboardProps) {
  return (
    <div className="space-y-5">
      <Suspense fallback={<DeveloperDashboardSkeleton />}>
        <DeveloperDashboardSection currentUserProfile={currentUserProfile} />
      </Suspense>
    </div>
  );
}
