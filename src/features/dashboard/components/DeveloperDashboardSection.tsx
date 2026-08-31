import React from "react";
import { Activity, Database, ServerCog } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardSection } from "./primitives/DashboardSection";
import { MetricTile } from "./primitives/MetricTile";
import { SectionLink } from "./primitives/SectionLink";
import type { IUserProfile } from "@/domain/models/interfaces";
import { developerDashboardService, DeveloperDashboardData } from "@/services/developer-dashboard-service";

/**
 * Health status is a real, service-supplied verdict. It is only ever rendered
 * for the four health indicators the service actually computes.
 */
function statusBadge(status: "Healthy" | "Warning" | "Error") {
  const variants = {
    Healthy: "success",
    Warning: "warning",
    Error: "danger",
  } as const;
  return (
    <Badge variant={variants[status]} size="sm">
      {status}
    </Badge>
  );
}

function humanizeTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString();
}

function formatMetric(value: number | null) {
  return value === null ? "Unavailable" : value.toLocaleString();
}

/** One label/value line in the diagnostics panels. */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3.5 py-1.5">
      <span className="shrink-0 text-[11px] text-brand-text-muted">{label}</span>
      {/* Wraps rather than truncating: a timestamp or a Supabase status string is
          diagnostic content, and an ellipsis destroys the part that matters on a narrow
          screen. Right alignment and the compact row density are unchanged. */}
      <span className="min-w-0 break-words text-right text-xs font-medium text-brand-text">{value}</span>
    </div>
  );
}

export interface DeveloperDashboardSectionProps {
  currentUserProfile: Pick<IUserProfile, "role"> | null;
}

export default async function DeveloperDashboardSection({
  currentUserProfile,
}: DeveloperDashboardSectionProps) {
  const data: DeveloperDashboardData = await developerDashboardService.getDashboardData(
    currentUserProfile
  );

  // Presentation cap, matching the operational dashboards. The service payload is
  // unchanged; only how many of its rows this panel draws.
  const recentActivity = data.recentActivity.slice(0, 5);

  const health = [
    { label: "Application", status: data.systemHealth.application },
    { label: "Supabase DB", status: data.systemHealth.database },
    { label: "Authentication", status: data.systemHealth.authentication },
    { label: "API", status: data.systemHealth.api },
  ] as const;

  return (
    <div className="space-y-4">
      <DashboardSection
        title="System health"
        description="Live indicators for the application stack"
      >
        <dl className="grid grid-cols-2 gap-px bg-brand-border md:grid-cols-4">
          {health.map((entry) => (
            <div key={entry.label} className="flex flex-col gap-1.5 bg-brand-card px-3.5 py-3">
              {/* Wraps rather than truncates: "Authentication" is a fixed label, and at
                  two cells per row on a narrow screen clipping it teaches nothing. */}
              <dt className="text-[10.5px] font-semibold uppercase leading-tight tracking-wide text-brand-text-muted">
                {entry.label}
              </dt>
              <dd>{statusBadge(entry.status)}</dd>
            </div>
          ))}
        </dl>
      </DashboardSection>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DashboardSection
          title="Supabase database"
          description="Server-side connectivity check"
        >
          <div className="divide-y divide-brand-border-subtle">
            <div className="flex items-center justify-between gap-3 px-3.5 py-2">
              <span className="flex items-center gap-2 text-xs font-semibold text-brand-navy">
                <Database aria-hidden="true" className="h-3.5 w-3.5 text-brand-text-muted" />
                Connection
              </span>
              {statusBadge(data.systemHealth.database)}
            </div>
            <DetailRow label="Status" value={data.supabaseHealth.status} />
            {/* The unit belongs to a number. When the probe never completed there is no
                measurement, and "N/A ms" reads like one that came back as N/A. */}
            <DetailRow
              label="Response time"
              value={
                data.supabaseHealth.responseTimeMs == null
                  ? "Unavailable"
                  : `${data.supabaseHealth.responseTimeMs} ms`
              }
            />
            <DetailRow label="Last checked" value={humanizeTimestamp(data.supabaseHealth.checkedAt)} />
            <p className="bg-brand-structural px-3.5 py-2 text-[11px] leading-relaxed text-brand-text-muted">
              {data.supabaseHealth.message}
            </p>
          </div>
        </DashboardSection>

        <DashboardSection
          title="Environment"
          description="Runtime details safe for Developer visibility"
        >
          <div className="divide-y divide-brand-border-subtle">
            <div className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-brand-navy">
              <ServerCog aria-hidden="true" className="h-3.5 w-3.5 text-brand-text-muted" />
              Technical information
            </div>
            <DetailRow label="Application" value={data.technicalInfo.appName} />
            <DetailRow label="Environment" value={data.technicalInfo.environment} />
            <DetailRow label="Next.js" value={data.technicalInfo.nextVersion ?? "Unknown"} />
            <DetailRow label="Database" value={data.technicalInfo.databaseProvider} />
            <DetailRow label="Session" value={data.technicalInfo.authSession} />
          </div>
        </DashboardSection>
      </div>

      <DashboardSection
        title="System statistics"
        description="Counts from existing persisted records"
      >
        {/* `unavailable` is passed wherever the service returned null, so an outage
            renders as muted prose instead of a bold tabular figure. "Unavailable" set
            in the same weight as a count reads as a value that was measured. */}
        <dl className="grid grid-cols-2 gap-px bg-brand-border md:grid-cols-4">
          <MetricTile className="bg-brand-card" label="Total users" value={formatMetric(data.totalUsers)} />
          <MetricTile
            className="bg-brand-card"
            label="Total personnel"
            value={formatMetric(data.totalPersonnel)}
            unavailable={data.totalPersonnel === null}
          />
          <MetricTile
            className="bg-brand-card"
            label="Audit log entries"
            value={formatMetric(data.totalAuditLogs)}
            unavailable={data.totalAuditLogs === null}
          />
          <MetricTile
            className="bg-brand-card"
            label="Lab results"
            value={formatMetric(data.totalLaboratoryResults)}
            unavailable={data.totalLaboratoryResults === null}
          />
        </dl>
      </DashboardSection>

      {/* Full width. The Administration card list restated destinations that are already
          permanent entries in the Developer navigation, and it was taking two fifths of the
          row from the only diagnostic list on this screen. */}
        <DashboardSection
          title="Recent system activity"
          description="Recent audit events"
          action={<SectionLink href="/audit">View audit logs</SectionLink>}
        >
          {recentActivity.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No recent activity"
              description="Recent audit events will appear here."
              className="rounded-none border-0"
            />
          ) : (
            <div className="divide-y divide-brand-border-subtle">
              {recentActivity.map((log) => {
                // The event's own category is the label. Marking an ordinary audit
                // event "Healthy" would assert a verdict the audit trail never made;
                // only a SecurityDenial carries an emphasised treatment, and even then
                // the visible text is still the category itself.
                const isDenial = log.category === "SecurityDenial";
                return (
                  <div key={log.id} className="flex items-start justify-between gap-3 px-3.5 py-2">
                    <div className="min-w-0">
                      <div className="break-words text-[13px] font-semibold text-brand-navy" title={log.eventType}>
                        {log.eventType}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-brand-text-muted">
                        <span className="break-words" title={log.performedByUsername ?? undefined}>
                          {log.performedByUsername ?? "—"}
                        </span>
                        <time dateTime={log.occurredAt} className="tabular-nums">
                          {humanizeTimestamp(log.occurredAt)}
                        </time>
                      </div>
                    </div>
                    <span
                      className={
                        isDenial
                          ? "shrink-0 whitespace-nowrap rounded-md bg-brand-warning-bg px-2 py-0.5 text-[11px] font-semibold text-brand-warning ring-1 ring-inset ring-brand-warning-border"
                          : "shrink-0 whitespace-nowrap rounded-md bg-brand-structural px-2 py-0.5 text-[11px] font-medium text-brand-text-muted ring-1 ring-inset ring-brand-card-border"
                      }
                    >
                      {log.category}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardSection>

    </div>
  );
}
