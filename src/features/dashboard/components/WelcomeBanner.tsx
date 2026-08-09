import React from "react";
import { Activity, Shield } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { getCurrentUserProfile } from "@/lib/auth-guards";

export async function WelcomeBanner() {
  const profile = await getCurrentUserProfile();
  const role = profile?.role || "User";

  const friendlyRole = role === "Admin" ? "Administrator" : role;

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <Badge variant="success" size="sm">
              <Activity className="h-3 w-3 mr-1 text-brand-success" />
              System Operational
            </Badge>
            <span className="text-xs text-brand-text-muted">v1.0.0</span>
          </div>

          <h2 className="text-2xl font-bold text-brand-text tracking-tight">
            St. Rose Diagnostic Laboratory
          </h2>

          <p className="text-xs text-brand-text-muted/90 leading-relaxed">
            Result Management System administrative workspace. Access account management, view operational metrics, and manage user access controls.
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
