import Link from "next/link";
import React from "react";
import { ArrowRight, Database, Hash, ShieldCheck, ServerCog, Activity, CheckCircle2, AlertTriangle, CircleDot } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { IUserProfile } from "@/domain/models/interfaces";
import { developerDashboardService, DeveloperDashboardData } from "@/services/developer-dashboard-service";

function statusBadge(status: "Healthy" | "Warning" | "Error") {
  const variants = {
    Healthy: "success",
    Warning: "warning",
    Error: "danger",
  } as const;
  return <Badge variant={variants[status]}>{status}</Badge>;
}

function humanizeTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString();
}

function formatMetric(value: number | null) {
  return value === null ? "Unavailable" : value.toLocaleString();
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

  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-text">Developer Technical Monitoring</h2>
          <p className="text-sm text-brand-text-muted mt-2 max-w-2xl">
            Live health diagnostics, Supabase connectivity, and system telemetry for Developer users only.
          </p>
        </div>
        <Link href="/audit" className="inline-flex items-center gap-2 text-xs font-semibold text-brand-primary hover:text-brand-primary-hover">
          View full audit logs
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-brand-info" />
                <CardTitle>Supabase Database Health</CardTitle>
              </div>
              <CardDescription>Real server-side connectivity check against the Supabase database.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-brand-text-muted">Connection</span>
                {statusBadge(data.systemHealth.database)}
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm text-brand-text-muted">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="font-semibold text-brand-text">{data.supabaseHealth.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Response time</span>
                  <span className="font-semibold text-brand-text">{data.supabaseHealth.responseTimeMs ?? "N/A"} ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last checked</span>
                  <span className="font-semibold text-brand-text">{humanizeTimestamp(data.supabaseHealth.checkedAt)}</span>
                </div>
              </div>
              <p className="text-xs text-brand-text-muted leading-relaxed">{data.supabaseHealth.message}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-success" />
                <CardTitle>System Health</CardTitle>
              </div>
              <CardDescription>Core health indicators for the application stack.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-brand-text-muted">Application</div>
                  <div className="mt-2 font-semibold text-brand-text">{statusBadge(data.systemHealth.application)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-brand-text-muted">Supabase DB</div>
                  <div className="mt-2 font-semibold text-brand-text">{statusBadge(data.systemHealth.database)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-brand-text-muted">Authentication</div>
                  <div className="mt-2 font-semibold text-brand-text">{statusBadge(data.systemHealth.authentication)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-brand-text-muted">API</div>
                  <div className="mt-2 font-semibold text-brand-text">{statusBadge(data.systemHealth.api)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ServerCog className="h-4 w-4 text-brand-primary" />
              <CardTitle>Technical Information</CardTitle>
            </div>
            <CardDescription>Metadata and runtime environment details safe for Developer visibility.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-brand-text-muted">
            <div className="rounded-2xl bg-slate-50 p-4 grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-brand-text">Application</span>
                <span>{data.technicalInfo.appName}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-brand-text">Environment</span>
                <span>{data.technicalInfo.environment}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-brand-text">Next.js</span>
                <span>{data.technicalInfo.nextVersion ?? "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-brand-text">Database</span>
                <span>{data.technicalInfo.databaseProvider}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-brand-text">Session</span>
                <span>{data.technicalInfo.authSession}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-brand-secondary" />
              <CardTitle>Real System Statistics</CardTitle>
            </div>
            <CardDescription>Counts based on existing persisted data and Supabase-backed records.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm text-brand-text-muted">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-brand-text-muted">Total Users</div>
              <div className="mt-3 text-3xl font-bold text-brand-text">{formatMetric(data.totalUsers)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-brand-text-muted">Total Personnel</div>
              <div className="mt-3 text-3xl font-bold text-brand-text">{formatMetric(data.totalPersonnel)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-brand-text-muted">Audit Log Entries</div>
              <div className="mt-3 text-3xl font-bold text-brand-text">{formatMetric(data.totalAuditLogs)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-brand-text-muted">Lab Results</div>
              <div className="mt-3 text-3xl font-bold text-brand-text">{formatMetric(data.totalLaboratoryResults)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-warning" />
              <CardTitle>Recent System Activity</CardTitle>
            </div>
            <CardDescription>Recent audit events from existing audit log data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-brand-text-muted">No recent activity is available.</p>
            ) : (
              <div className="space-y-3">
                {data.recentActivity.map((log) => (
                  <div key={log.id} className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-brand-text-muted">
                          {new Date(log.occurredAt).toLocaleString()}
                        </div>
                        <div className="mt-2 font-semibold text-brand-text">{log.eventType}</div>
                        <div className="text-xs text-brand-text-muted mt-1">
                          {log.performedByUsername ?? "—"} • {log.category}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {statusBadge(log.category === "SecurityDenial" ? "Warning" : "Healthy")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Link href="/audit" className="inline-flex items-center gap-2 text-xs font-semibold text-brand-primary hover:text-brand-primary-hover">
              View audit logs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
