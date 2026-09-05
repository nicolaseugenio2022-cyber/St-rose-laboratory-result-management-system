import React from "react";
import { FileEdit, Inbox, PlayCircle } from "lucide-react";
import { DashboardSection } from "../primitives/DashboardSection";
import { ActionCard } from "../primitives/ActionCard";
import { SectionLink } from "../primitives/SectionLink";
import { SessionRow } from "../primitives/SessionRow";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RecentWork } from "../../_lib/recent-work";

export interface LaboratoryUserDashboardProps {
  /** `null` means the operational read failed transiently - not that there is no recent work. */
  recentWork: RecentWork | null;
}

/**
 * Rows inside a panel: hairlines between them, and no outer border of their own. The list
 * is a size container, so each SessionRow lays itself out against the panel width rather
 * than the viewport - the narrow side column and the full-width list get the right shape.
 */
function RowList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-brand-border-subtle [container-type:inline-size]">{children}</div>;
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
  const drafts = recentWork ? recentWork.myDrafts.slice(0, 5) : [];
  const completed = recentWork ? recentWork.recentCompleted.slice(0, 5) : [];

  return (
    <div className="space-y-4">
      {/* One start action, not two. Completed history stays reachable from the
          contextual "View all history" link on each completed list, where the operator
          is already looking at completed work - it does not compete with starting a
          session, which is the only thing this screen exists to launch. */}
      <DashboardSection title="Start laboratory work" variant="bare" icon={PlayCircle}>
        <ActionCard
          href="/workspace"
          icon={PlayCircle}
          emphasis="primary"
          title="Start new patient session"
          description="Open the guided workspace to register a visit and encode results."
        />
      </DashboardSection>

      {/* Asymmetric on wide screens: unfinished work leads, because it is the only list on
          this page the operator is expected to act on. `items-start` keeps each panel the
          height of its own rows - a three-row list must not be stretched to match a five-row
          one with a blank white tail. */}
      {/* Both panels on this screen are projections of the same operational read, so a transient
          failure states the fact once rather than repeating it in two adjacent panels. Unavailable
          is not empty: an empty list here would assert that no unfinished work exists. */}
      {recentWork === null ? (
        <Alert variant="warning">
          Recent activity is temporarily unavailable. Try again shortly.
        </Alert>
      ) : (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr] xl:items-start">
        <DashboardSection
          title="Continue your work"
          description="Unfinished sessions you started"
          icon={Inbox}
        >
          {drafts.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No unfinished sessions"
              description="Sessions you start but do not complete will appear here."
              className="rounded-none border-0"
            />
          ) : (
            <RowList>
              {drafts.map((item) => (
                <SessionRow key={item.id} item={item} showResume />
              ))}
            </RowList>
          )}
        </DashboardSection>

        <DashboardSection
          title="Recently completed"
          description="Newest first"
          icon={FileEdit}
          action={viewAllHistory}
        >
          {completed.length === 0 ? (
            <EmptyState
              icon={FileEdit}
              title="No completed sessions yet"
              description="Completed patient sessions will be listed here."
              className="rounded-none border-0"
            />
          ) : (
            <RowList>
              {completed.map((item) => (
                <SessionRow key={item.id} item={item} showResume />
              ))}
            </RowList>
          )}
        </DashboardSection>
      </div>
      )}
    </div>
  );
}
