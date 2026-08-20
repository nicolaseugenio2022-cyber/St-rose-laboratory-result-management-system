import React from "react";
import { ShieldCheck, UserCheck, Users, UserPlus, History } from "lucide-react";
import Link from "next/link";
import { WelcomeBanner } from "../WelcomeBanner";
import { SessionRow } from "../primitives/SessionRow";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RecentWork } from "@/features/dashboard/recent-work";
import { DashboardSection } from "../primitives/DashboardSection";
import { MetricTile } from "../primitives/MetricTile";
import { ActionCard } from "../primitives/ActionCard";
import type { IUserProfile } from "@/domain/models/interfaces";

export interface AdminDashboardProps {
  currentUserProfile: IUserProfile | null;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  recentWork: RecentWork;
}

/**
 * Administrator composition: oversight plus the management routes this role can
 * actually reach (/users, /personnel, /audit are all Admin-permitted).
 *
 * The four oversized account-stat cards are replaced by one compact tile row —
 * the same four figures, read at a glance, without consuming the fold.
 *
 * Recent laboratory activity is read through the same authorized operational
 * path the Laboratory User uses. Administrators see completed activity, but the
 * repository query scopes drafts to their owner, so an Administrator never sees
 * another user's unfinished work and gains no reopen power over it — Resume is
 * rendered only where the server returned `canReopen` for this caller.
 */
export function AdminDashboard({
  currentUserProfile,
  totalUsers,
  activeUsers,
  inactiveUsers,
  adminUsers,
  recentWork,
}: AdminDashboardProps) {
  return (
    <div className="space-y-6">
      <WelcomeBanner profile={currentUserProfile} />

      <DashboardSection
        title="Account overview"
        description="Login accounts visible to your role."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile label="Total" value={totalUsers} icon={Users} />
          <MetricTile label="Active" value={activeUsers} />
          <MetricTile label="Inactive" value={inactiveUsers} />
          <MetricTile label="Administrators" value={adminUsers} icon={ShieldCheck} />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Management"
        description="Staff access, laboratory personnel and security visibility."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ActionCard
            href="/personnel"
            icon={UserCheck}
            title="Personnel directory"
            description="Maintain PRC-licensed Pathologists, Medical Technologists and signatures."
          />
          <ActionCard
            href="/users"
            icon={Users}
            title="User accounts"
            description="Assign roles, activate or deactivate staff login access."
          />
          <ActionCard
            href="/users"
            icon={UserPlus}
            title="Register new account"
            description="Create a staff login with an initial username, password and role."
          />
          <ActionCard
            href="/audit"
            icon={ShieldCheck}
            title="Audit logs"
            description="Inspect security audit events and system history."
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Recent laboratory activity"
        description="Most recent completed sessions."
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
            icon={History}
            title="No recent laboratory activity"
            description="Completed patient sessions will appear here."
          />
        ) : (
          <div className="space-y-2">
            {recentWork.recentCompleted.slice(0, 6).map((item) => (
              <SessionRow key={item.id} item={item} showResume />
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
