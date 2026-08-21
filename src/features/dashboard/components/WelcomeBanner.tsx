import React from "react";
import { Shield } from "lucide-react";
import { formatRoleLabel } from "@/config/roles";
import { IUserProfile } from "@/domain/models/interfaces";
import { SYSTEM_CONSTANTS } from "@/lib/constants";

interface WelcomeBannerProps {
  profile: IUserProfile | null;
}

export function WelcomeBanner({ profile }: WelcomeBannerProps) {
  const role = profile?.role || "User";

  const friendlyRole = formatRoleLabel(role);

  // Role-aware summary. The previous copy described an "administrative
  // workspace" with "account management" to every role, including the
  // Laboratory User who cannot reach any of those routes.
  const summary =
    role === "Developer"
      ? "Result Management System developer view. Monitor system health, telemetry and audit activity."
      : role === "Admin"
        ? "Result Management System administrative workspace. Manage staff access, laboratory personnel and security visibility."
        : "Result Management System laboratory workspace. Encode patient visit results and review completed reports.";

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-text-muted">v{SYSTEM_CONSTANTS.APP.VERSION}</span>
          </div>

          <h2 className="text-2xl font-bold text-brand-text tracking-tight">
            St. Rose Diagnostic Laboratory
          </h2>

          <p className="text-xs text-brand-text-muted/90 leading-relaxed">
            {summary}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-brand-surface-hover border border-brand-border-subtle p-3.5 rounded-lg shrink-0">
          <div className="h-8 w-8 rounded-lg bg-brand-info-bg flex items-center justify-center border border-brand-info-border">
            <Shield className="h-4 w-4 text-brand-info" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-brand-text-muted uppercase tracking-wider">Access Role</div>
            <div className="text-xs font-bold text-brand-text">{friendlyRole}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
