import React from "react";
import { ShieldCheck, UserCheck, Users, UserPlus, History } from "lucide-react";
import { WelcomeBanner } from "../WelcomeBanner";
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
}

/**
 * Administrator composition: oversight plus the management routes this role can
 * actually reach (/users, /personnel, /audit are all Admin-permitted).
 *
 * The four oversized account-stat cards are replaced by one compact tile row —
 * the same four figures, read at a glance, without consuming the fold.
 *
 * Recent laboratory activity is deliberately absent here: it requires session
 * reads and belongs to UX1-B behind an independent review.
 */
export function AdminDashboard({
  currentUserProfile,
  totalUsers,
  activeUsers,
  inactiveUsers,
  adminUsers,
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

      <DashboardSection title="Laboratory">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ActionCard
            href="/history"
            icon={History}
            title="Completed history"
            description="Review completed sessions, replacements and exports."
          />
        </div>
      </DashboardSection>
    </div>
  );
}
