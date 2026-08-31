import React from "react";
import { History, PlayCircle, ShieldCheck, Users } from "lucide-react";
import { SessionRow } from "../primitives/SessionRow";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RecentWork } from "@/features/dashboard/recent-work";
import { DashboardSection } from "../primitives/DashboardSection";
import { MetricTile } from "../primitives/MetricTile";
import { ActionCard } from "../primitives/ActionCard";
import { SectionLink } from "../primitives/SectionLink";

export interface AdminDashboardProps {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  recentWork: RecentWork;
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
  const completed = recentWork.recentCompleted.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* One action, full width. Completed history was a second card competing with the only
          thing this screen exists to launch; it stays reachable from the navigation and from
          the contextual link on the activity list, which is where an operator already is when
          they want it. */}
      <DashboardSection title="Start laboratory work">
        <ActionCard
          href="/workspace"
          icon={PlayCircle}
          emphasis="primary"
          title="Start new patient session"
          description="Open the guided workspace to register a visit and encode results."
        />
      </DashboardSection>

      <DashboardSection
        title="Account overview"
        description="Login accounts visible to your role"
      >
        {/* A strip of labelled figures is a description list. The tiles were a bag of
            divs, so a screen reader read eight unrelated fragments instead of four
            term/value pairs.

            Total is not redundant against Active + Inactive: they answer different questions
            at a glance - how large the estate is, versus how much of it is live. */}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-brand-card-border bg-brand-card-border md:grid-cols-4">
          <MetricTile className="bg-brand-structural" label="Total accounts" value={totalUsers} icon={Users} />
          <MetricTile className="bg-brand-structural" label="Active" value={activeUsers} />
          <MetricTile className="bg-brand-structural" label="Inactive" value={inactiveUsers} />
          <MetricTile className="bg-brand-structural" label="Administrators" value={adminUsers} icon={ShieldCheck} />
        </dl>
      </DashboardSection>

      {/* Full width now that Management is gone: the activity list is the only operational
          content on this screen and it was previously squeezed into two fifths of it. */}
      <DashboardSection
        title="Recent laboratory activity"
        description="Most recent completed sessions"
        action={<SectionLink href="/history">View all history</SectionLink>}
      >
        {completed.length === 0 ? (
          <EmptyState
            icon={History}
            title="No recent laboratory activity"
            description="Completed patient sessions will appear here."
            className="rounded-lg border border-brand-card-border bg-brand-card"
          />
        ) : (
          <div className="divide-y divide-brand-border-subtle overflow-hidden rounded-lg border border-brand-card-border bg-brand-card">
            {completed.map((item) => (
              <SessionRow key={item.id} item={item} showResume />
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
