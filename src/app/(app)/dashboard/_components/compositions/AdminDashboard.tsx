import React from "react";
import { History, PlayCircle, ShieldCheck, UserCheck, Users, UserX } from "lucide-react";
import { SessionRow } from "../primitives/SessionRow";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RecentWork } from "../../_lib/recent-work";
import { DashboardSection } from "../primitives/DashboardSection";
import { MetricTile } from "../primitives/MetricTile";
import { ActionCard } from "../primitives/ActionCard";
import { SectionLink } from "../primitives/SectionLink";

export interface AdminDashboardProps {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  /** `null` means the operational read failed transiently - not that there is no recent work. */
  recentWork: RecentWork | null;
}

/**
 * Administrator composition: the laboratory workflow this role still performs, plus the
 * account figures only this role can read.
 *
 * Deliberately not a directory of the sidebar. User accounts, Personnel and Audit logs are
 * already permanent, role-aware navigation destinations; restating them as three large cards
 * meant the first screenful of the dashboard was a second copy of the menu. What is left is
 * the material the navigation cannot give: one action to start work, the account figures, and
 * the recent activity list.
 *
 * On a wide screen the activity list and the account figures share one row - the list takes
 * the wider column because it is the operational content; the figures sit beside it as a 2x2
 * strip. Below `xl` they stack in that same order.
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
}: AdminDashboardProps) {
  const completed = recentWork ? recentWork.recentCompleted.slice(0, 5) : [];

  return (
    <div className="space-y-4">
      {/* One action, full width, and no panel around it: the action card is already the
          surface. Completed history stays reachable from the navigation and from the
          contextual link on the activity list. */}
      <DashboardSection title="Start laboratory work" variant="bare" icon={PlayCircle}>
        <ActionCard
          href="/workspace"
          icon={PlayCircle}
          emphasis="primary"
          title="Start new patient session"
          description="Open the guided workspace to register a visit and encode results."
        />
      </DashboardSection>

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
      </div>
    </div>
  );
}
