import React from "react";
import { FileEdit, Inbox, PlayCircle } from "lucide-react";
import { DashboardSection } from "../primitives/DashboardSection";
import { ActionCard } from "../primitives/ActionCard";
import { SectionLink } from "../primitives/SectionLink";
import { SessionRow } from "../primitives/SessionRow";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RecentWork } from "@/features/dashboard/recent-work";

export interface LaboratoryUserDashboardProps {
  recentWork: RecentWork;
}

/** One bordered panel per list, with hairlines between rows. */
function RowPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-brand-border-subtle overflow-hidden rounded-lg border border-brand-card-border bg-brand-card">
      {children}
    </div>
  );
}

const viewAllHistory = <SectionLink href="/history">View all history</SectionLink>;

/**
 * Laboratory work home screen.
 *
 * Answers "what laboratory work should I do next?" - not "how many accounts
 * exist". Every route referenced here is one this role can actually reach:
 * `checkRouteAccess` denies `User` on /users, /audit and /personnel, so none of
 * them appear.
 *
 * Recent work is read through the existing authorized operational path. Drafts
 * are owner-scoped by the repository query, so this list is the operator's own
 * unfinished work and nobody else's, and Resume appears only where the server
 * returned `canReopen`.
 *
 * There is no separate "Expiring soon" list. `expiringSoon` is a filtered view of
 * `recentCompleted`, so rendering both showed the operator the same session twice on one
 * screen; SessionRow already states the remaining days on the completed row itself, which is
 * the row they would act on anyway.
 */
export function LaboratoryUserDashboard({ recentWork }: LaboratoryUserDashboardProps) {
  const drafts = recentWork.myDrafts.slice(0, 5);
  const completed = recentWork.recentCompleted.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* One start action, not two. Completed history stays reachable from the
          contextual "View all history" link on each completed list, where the operator
          is already looking at completed work - it does not compete with starting a
          session, which is the only thing this screen exists to launch. */}
      <DashboardSection title="Start laboratory work">
        <ActionCard
          href="/workspace"
          icon={PlayCircle}
          emphasis="primary"
          title="Start new patient session"
          description="Open the guided workspace to register a visit and encode results."
        />
      </DashboardSection>

      {/* Asymmetric on wide screens: unfinished work leads, because it is the
          only list on this page the operator is expected to act on. */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[3fr_2fr]">
        <DashboardSection
          title="Continue your work"
          description="Unfinished sessions you started"
        >
          {drafts.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No unfinished sessions"
              description="Sessions you start but do not complete will appear here."
              className="rounded-lg border border-brand-card-border bg-brand-card"
            />
          ) : (
            <RowPanel>
              {drafts.map((item) => (
                <SessionRow key={item.id} item={item} showResume />
              ))}
            </RowPanel>
          )}
        </DashboardSection>

        <DashboardSection
          title="Recently completed"
          description="Newest first"
          action={viewAllHistory}
        >
          {completed.length === 0 ? (
            <EmptyState
              icon={FileEdit}
              title="No completed sessions yet"
              description="Completed patient sessions will be listed here."
              className="rounded-lg border border-brand-card-border bg-brand-card"
            />
          ) : (
            <RowPanel>
              {completed.map((item) => (
                <SessionRow key={item.id} item={item} showResume />
              ))}
            </RowPanel>
          )}
        </DashboardSection>
      </div>

    </div>
  );
}
