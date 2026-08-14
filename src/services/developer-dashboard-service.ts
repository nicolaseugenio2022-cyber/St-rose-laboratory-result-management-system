import "server-only";

import packageJson from "../../package.json";
import type { IUserProfile } from "@/domain/models/interfaces";
import { userService } from "@/services/user-service-instance";
import { supabaseServer } from "@/lib/supabase/server";
import {
  toAuditReaderRole,
  type AuditEventTransport,
  type AuditPageTransport,
  type AuditReadCriteria,
} from "@/services/audit-read-service";
import { auditReadService } from "@/services/audit-read-service-instance";

export type SupabaseHealthStatus = "Connected" | "Degraded" | "Unreachable";

export interface SupabaseHealthReport {
  status: SupabaseHealthStatus;
  connected: boolean;
  responseTimeMs?: number;
  checkedAt: string;
  message: string;
}

export interface SystemHealthStatus {
  application: "Healthy" | "Warning" | "Error";
  database: "Healthy" | "Warning" | "Error";
  authentication: "Healthy" | "Warning" | "Error";
  api: "Healthy" | "Warning" | "Error";
}

export interface DeveloperDashboardData {
  totalUsers: number;
  totalPersonnel: number | null;
  totalAuditLogs: number | null;
  totalLaboratoryResults: number | null;
  recentActivity: AuditEventTransport[];
  technicalInfo: {
    appName: string;
    environment: string;
    nextVersion?: string;
    databaseProvider: "Supabase";
    authSession: string;
  };
  supabaseHealth: SupabaseHealthReport;
  systemHealth: SystemHealthStatus;
}

function mapStatus(isHealthy: boolean, fallbackHealthy = false): "Healthy" | "Warning" | "Error" {
  if (isHealthy) return "Healthy";
  return fallbackHealthy ? "Warning" : "Error";
}

const HEALTH_CACHE_TTL = 30_000; // 30 seconds
let healthCache: { data: SupabaseHealthReport; fetchedAt: number } | null = null;
let countsCache: { data: { totalPersonnel: number | null; totalLaboratoryResults: number | null }; fetchedAt: number } | null = null;

const CONNECTED_MESSAGE = "Supabase connection successful.";
const DEGRADED_MESSAGE = "Supabase responded, but the health check query did not succeed.";
const UNREACHABLE_MESSAGE = "Unable to reach the Supabase database.";

async function getSupabaseHealth(): Promise<SupabaseHealthReport> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    // `status` is 0 only when the request never completed (transport failure or abort). Any
    // completed PostgREST response carries its real HTTP status, including authorization
    // refusals, which prove the database was reached and must not read as an outage.
    const { error, status } = await supabaseServer
      .from("patient_report_sessions")
      .select("id", { head: true, count: "exact" })
      .limit(1)
      .abortSignal(controller.signal);

    clearTimeout(timeout);
    const responseTimeMs = Date.now() - start;
    const reachable = status > 0;
    const checkedAt = new Date().toISOString();

    if (error) {
      return {
        status: reachable ? "Degraded" : "Unreachable",
        connected: reachable,
        responseTimeMs,
        checkedAt,
        // Fixed operator-facing text only. Database error codes, hints, details, and messages
        // are internal and must never reach the UI.
        message: reachable ? DEGRADED_MESSAGE : UNREACHABLE_MESSAGE,
      };
    }

    return {
      status: "Connected",
      connected: true,
      responseTimeMs,
      checkedAt,
      message: CONNECTED_MESSAGE,
    };
  } catch {
    clearTimeout(timeout);
    return {
      status: "Unreachable",
      connected: false,
      responseTimeMs: undefined,
      checkedAt: new Date().toISOString(),
      message: UNREACHABLE_MESSAGE,
    };
  }
}

async function getSupabaseCounts(): Promise<{ totalPersonnel: number | null; totalLaboratoryResults: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const [personnelResponse, totalLaboratoryResultsResponse] = await Promise.all([
      supabaseServer.from("report_signatories").select("personnel_id").abortSignal(controller.signal),
      supabaseServer.from("laboratory_results").select("id", { head: true, count: "exact" }).abortSignal(controller.signal),
    ]);

    clearTimeout(timeout);

    const totalPersonnel = personnelResponse.data
      ? new Set((personnelResponse.data as { personnel_id?: string }[]).map((item) => item.personnel_id).filter(Boolean)).size
      : null;

    return {
      totalPersonnel,
      totalLaboratoryResults: totalLaboratoryResultsResponse.count ?? null,
    };
  } catch {
    clearTimeout(timeout);
    return {
      totalPersonnel: null,
      totalLaboratoryResults: null,
    };
  }
}

async function getSupabaseHealthCached(): Promise<SupabaseHealthReport> {
  if (healthCache && Date.now() - healthCache.fetchedAt < HEALTH_CACHE_TTL) {
    return healthCache.data;
  }
  const data = await getSupabaseHealth();
  healthCache = { data, fetchedAt: Date.now() };
  return data;
}

async function getSupabaseCountsCached(): Promise<{ totalPersonnel: number | null; totalLaboratoryResults: number | null }> {
  if (countsCache && Date.now() - countsCache.fetchedAt < HEALTH_CACHE_TTL) {
    return countsCache.data;
  }
  const data = await getSupabaseCounts();
  countsCache = { data, fetchedAt: Date.now() };
  return data;
}

export class DeveloperDashboardService {
  public async getDashboardData(
    callerProfile: Pick<IUserProfile, "role"> | null
  ): Promise<DeveloperDashboardData> {
    const readerRole = toAuditReaderRole(callerProfile?.role);
    const auditCriteria: AuditReadCriteria = {
      category: "ALL",
      limit: 6,
      offset: 0,
    };
    const auditProjectionPromise: Promise<AuditPageTransport | null> = readerRole
      ? auditReadService.readPage(auditCriteria, readerRole)
      : Promise.resolve(null);

    const [users, auditPage, supabaseHealth, supabaseCounts] = await Promise.all([
      userService.getUsers(),
      auditProjectionPromise,
      getSupabaseHealthCached(),
      getSupabaseCountsCached(),
    ]);

    const currentAuthStatus = "Authenticated";
    const appHealthy = true;
    const apiHealthy = Boolean(users && auditPage);

    return {
      totalUsers: users.length,
      totalPersonnel: supabaseCounts.totalPersonnel,
      totalAuditLogs: auditPage?.total ?? null,
      totalLaboratoryResults: supabaseCounts.totalLaboratoryResults,
      recentActivity: auditPage?.events ?? [],
      technicalInfo: {
        appName: "St. Rose Diagnostic Laboratory Result Management System",
        environment: process.env.NODE_ENV || "development",
        nextVersion:
          ((packageJson.dependencies as Record<string, string>)?.next as string) ||
          ((packageJson.devDependencies as Record<string, string>)?.next as string) ||
          undefined,
        databaseProvider: "Supabase",
        authSession: currentAuthStatus,
      },
      supabaseHealth,
      systemHealth: {
        application: mapStatus(appHealthy),
        database: mapStatus(
          supabaseHealth.status === "Connected",
          supabaseHealth.status === "Degraded"
        ),
        authentication: mapStatus(true),
        api: mapStatus(apiHealthy, true),
      },
    };
  }
}

export const developerDashboardService = new DeveloperDashboardService();
