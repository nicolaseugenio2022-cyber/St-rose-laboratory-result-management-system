import React from "react";
import Link from "next/link";
import { FileEdit, History, Inbox, PlayCircle } from "lucide-react";
import { WelcomeBanner } from "../WelcomeBanner";
import { DashboardSection } from "../primitives/DashboardSection";
import { ActionCard } from "../primitives/ActionCard";
import { SessionRow } from "../primitives/SessionRow";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RecentWork } from "@/features/dashboard/recent-work";
import type { IUserProfile } from "@/domain/models/interfaces";

export interface LaboratoryUserDashboardProps {
  currentUserProfile: IUserProfile | null;
  recentWork: RecentWork;
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
 * Recent work is read through the existing authorized operational path. Drafts
 * are owner-scoped by the repository query, so this list is the operator's own
 * unfinished work and nobody else's, and Resume appears only where the server
 * returned `canReopen`.
 */
export function LaboratoryUserDashboard({
  currentUserProfile,
  recentWork,
}: LaboratoryUserDashboardProps) {
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

      <DashboardSection
        title="Continue your work"
        description="Unfinished sessions you started."
      >
        {recentWork.myDrafts.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No unfinished sessions"
            description="Sessions you start but do not complete will appear here."
          />
        ) : (
          <div className="space-y-2">
            {recentWork.myDrafts.slice(0, 5).map((item) => (
              <SessionRow key={item.id} item={item} showResume />
            ))}
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        title="Recently completed"
        description="Completed sessions, newest first."
        action={
          <Link
            href="/history"
            className="rounded text-xs font-semibold text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2"
          >
            View all history
          </Link>
        }
      >
        {recentWork.recentCompleted.length === 0 ? (
          <EmptyState
            icon={FileEdit}
            title="No completed sessions yet"
            description="Completed patient sessions will be listed here."
          />
        ) : (
          <div className="space-y-2">
            {recentWork.recentCompleted.slice(0, 5).map((item) => (
              <SessionRow key={item.id} item={item} showResume />
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
