import React, { Suspense } from "react";
import { Settings2 } from "lucide-react";
import DeveloperDashboardSection from "../DeveloperDashboardSection";
import { DeveloperDashboardSkeleton } from "../DeveloperDashboardSkeleton";
import { DashboardSection } from "../primitives/DashboardSection";
import { DestinationRow } from "../primitives/DestinationRow";
import { filterNavigationForRole } from "@/config/navigation";
import type { IUserProfile } from "@/domain/models/interfaces";

export interface DeveloperDashboardProps {
  currentUserProfile: IUserProfile | null;
}

/**
 * Developer composition: a technical operations surface, not a patient-work one.
 *
 * `requireOperationalCaller` denies the Developer role patient and report-registry data and
 * emits a SecurityDenial when it does, so nothing here reads session content. Everything in the
 * diagnostics panels comes from `developerDashboardService`, which is already the
 * Developer-safe surface, and no route reachable from this page leads to /workspace or
 * /history.
 *
 * Management destinations are derived from `filterNavigationForRole` against the server-
 * resolved role, so this page can only ever offer what the role's own navigation already
 * grants - it introduces no destination and widens no boundary. For a Developer that set
 * excludes the operational routes by construction, which is why no /workspace or /history entry
 * can appear here even though this component names neither.
 *
 * Diagnostics lead and management follows, which is this role's stated priority order. The
 * management panel is nonetheless a SIBLING of the Suspense boundary rather than a child, so it
 * paints immediately instead of waiting behind the telemetry skeleton - it is below the
 * diagnostics on the page, but never later in time.
 *
 * The Suspense boundary is preserved: the awaited service call streams in behind a skeleton
 * shaped like the finished layout.
 */
export function DeveloperDashboard({ currentUserProfile }: DeveloperDashboardProps) {
  const managementDestinations = filterNavigationForRole(currentUserProfile?.role).filter(
    (item) => item.group === "administration"
  );

  return (
    <div className="space-y-4">
      <Suspense fallback={<DeveloperDashboardSkeleton />}>
        <DeveloperDashboardSection currentUserProfile={currentUserProfile} />
      </Suspense>

      {managementDestinations.length > 0 && (
        <DashboardSection
          title="Management"
          description="Administrative areas your role grants"
          icon={Settings2}
        >
          {/* Two columns from md up: these are short single-line entries, and stacking four of
              them made a tall thin panel out of what should read as one compact block. */}
          <div className="grid grid-cols-1 gap-px bg-brand-border-subtle md:grid-cols-2">
            {managementDestinations.map((item) => (
              <div key={item.href} className="bg-brand-card">
                <DestinationRow item={item} />
              </div>
            ))}
          </div>
        </DashboardSection>
      )}
    </div>
  );
}
