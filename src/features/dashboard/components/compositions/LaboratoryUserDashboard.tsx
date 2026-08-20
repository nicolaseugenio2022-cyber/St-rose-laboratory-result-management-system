import React from "react";
import { FileEdit, History, PlayCircle } from "lucide-react";
import { WelcomeBanner } from "../WelcomeBanner";
import { DashboardSection } from "../primitives/DashboardSection";
import { ActionCard } from "../primitives/ActionCard";
import type { IUserProfile } from "@/domain/models/interfaces";

export interface LaboratoryUserDashboardProps {
  currentUserProfile: IUserProfile | null;
}

/**
 * Laboratory work home screen.
 *
 * Answers "what laboratory work should I do next?" — not "how many accounts
 * exist". Every route referenced here is one this role can actually reach:
 * `checkRouteAccess` denies `User` on /users, /audit and /personnel, so none of
 * them appear. That removes the two dead /users links this role was previously
 * shown by the shared Administrative Operations panel.
 *
 * Recent sessions, resumable drafts and expiring work are deliberately absent
 * here: they require session reads and land in UX1-B behind an independent
 * review, not in this composition slice.
 */
export function LaboratoryUserDashboard({ currentUserProfile }: LaboratoryUserDashboardProps) {
  return (
    <div className="space-y-6">
      <WelcomeBanner profile={currentUserProfile} />

      <DashboardSection
        title="Start laboratory work"
        description="Encode a new patient visit or continue where you left off."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ActionCard
            href="/workspace"
            icon={PlayCircle}
            emphasis="primary"
            title="Start new patient session"
            description="Open the guided workspace to register a visit and encode results."
          />
          <ActionCard
            href="/history"
            icon={History}
            title="Completed history"
            description="Find a completed session to preview, print or export."
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Shortcuts">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ActionCard
            href="/workspace"
            icon={FileEdit}
            title="Session workspace"
            description="Continue an in-progress encoding session."
          />
        </div>
      </DashboardSection>
    </div>
  );
}
