import React from "react";
import { History, PlayCircle, Settings2, ShieldCheck, UserCheck, Users, UserX } from "lucide-react";
import { SessionRow } from "../primitives/SessionRow";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RecentWork } from "../../_lib/recent-work";
import { DashboardSection } from "../primitives/DashboardSection";
import { MetricTile } from "../primitives/MetricTile";
import { ActionCard } from "../primitives/ActionCard";
import { SectionLink } from "../primitives/SectionLink";
import { DestinationRow } from "../primitives/DestinationRow";
import { filterNavigationForRole } from "@/config/navigation";
import type { UserRole } from "@/domain/types";

export interface AdminDashboardProps {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  /** `null` means the operational read failed transiently - not that there is no recent work. */
  recentWork: RecentWork | null;
  /** The server-resolved role, used only to list this role's own management destinations. */
  role: UserRole;
}

/**
 * Administrator composition: the laboratory workflow this role still performs, the account
 * figures only this role can read, and the management destinations it owns.
 *
 * Management destinations are derived from `filterNavigationForRole` rather than listed here,
 * so this screen cannot offer a destination the role's own navigation would not, and cannot
 * drift from it. That is the same single source the sidebar and the Workspace rail consume; no
 * second role-to-route table exists on this page. They are drawn as scannable lines rather than
 * cards, so they stay plainly subordinate to the primary action.
 *
 * Recent laboratory activity is read through the same authorized operational path the
 * Laboratory User uses. Administrators see completed activity, but the repository query scopes
 * drafts to their owner, so an Administrator never sees another user's unfinished work and
 * gains no reopen power over it - Resume is rendered only where the server returned `canReopen`
 * for this caller.
 */
export function AdminDashboard({
  totalUsers,
  activeUsers,
  inactiveUsers,
  adminUsers,
  recentWork,
  role,
}: AdminDashboardProps) {
  const completed = recentWork ? recentWork.recentCompleted.slice(0, 5) : [];
  const managementDestinations = filterNavigationForRole(role).filter(
    (item) => item.group === "administration"
  );

  return (
    <div className="space-y-4">
      {/* The action card carries its own title, so it needs no titled region above it. A
          "Start laboratory work" heading over a card reading "Start new patient session" said
          the same thing twice before the operator reached anything actionable. */}
      <ActionCard
        href="/workspace"
        icon={PlayCircle}
        emphasis="primary"
        title="Start new patient session"
        description="Open the guided workspace to register a visit and encode results."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <DashboardSection
          title="Recent laboratory activity"
          description="Most recent completed sessions"
          icon={History}
          action={<SectionLink href="/history">View all history</SectionLink>}
        >
          {/* Unavailable is not empty. Only the activity panel degrades - the account figures
              beside it come from a different read that succeeded, and are left untouched. */}
          {recentWork === null ? (
            <Alert variant="warning">
              Recent activity is temporarily unavailable. Try again shortly.
            </Alert>
          ) : completed.length === 0 ? (
            <EmptyState
              icon={History}
              title="No recent laboratory activity"
              description="Completed patient sessions will appear here."
              className="rounded-none border-0"
            />
          ) : (
            // The list is a size container, so each SessionRow lays itself out against the
            // panel width rather than the viewport.
            <div className="divide-y divide-brand-border-subtle [container-type:inline-size]">
              {completed.map((item) => (
                <SessionRow key={item.id} item={item} showResume />
              ))}
            </div>
          )}
        </DashboardSection>

        {/* Two stacked panels, not one panel containing another: the figures and the
            destinations answer different questions and each owns its own surface. */}
        <div className="space-y-4">
          <DashboardSection
            title="Account overview"
            description="Login accounts visible to your role"
            icon={Users}
          >
            {/* A strip of labelled figures is a description list, inside the panel: the 1px
                gaps draw the separators against the panel border colour.

                Total is not redundant against Active + Inactive: they answer different questions
                at a glance - how large the estate is, versus how much of it is live. */}
            <dl className="grid grid-cols-2 gap-px bg-brand-border md:grid-cols-4 xl:grid-cols-2">
              <MetricTile className="bg-brand-card" label="Total accounts" value={totalUsers} icon={Users} />
              <MetricTile className="bg-brand-card" label="Active" value={activeUsers} icon={UserCheck} />
              <MetricTile className="bg-brand-card" label="Inactive" value={inactiveUsers} icon={UserX} />
              <MetricTile className="bg-brand-card" label="Administrators" value={adminUsers} icon={ShieldCheck} />
            </dl>
          </DashboardSection>

          {managementDestinations.length > 0 && (
            <DashboardSection title="Management" description="Administrative areas you own" icon={Settings2}>
              <div className="divide-y divide-brand-border-subtle">
                {managementDestinations.map((item) => (
                  <DestinationRow key={item.href} item={item} />
                ))}
              </div>
            </DashboardSection>
          )}
        </div>
      </div>
    </div>
  );
}
