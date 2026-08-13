import packageJson from "../../package.json";
import type { IUserProfile } from "@/domain/models/interfaces";
import { userService } from "@/services/user-service-instance";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  toAuditReaderRole,
  type AuditEventTransport,
  type AuditPageTransport,
  type AuditReadCriteria,
} from "@/services/audit-read-service";
import { auditReadService } from "@/services/audit-read-service-instance";

export interface SupabaseHealthReport {
  status: "Connected" | "Disconnected";
  connected: boolean;
  responseTimeMs?: number;
  lastSuccessfulAt?: string | null;
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

async function getSupabaseHealth(): Promise<SupabaseHealthReport> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const { error } = await supabase
      .from("patient_report_sessions")
      .select("id", { head: true, count: "exact" })
      .limit(1)
      .abortSignal(controller.signal);

    clearTimeout(timeout);
    const responseTimeMs = Date.now() - start;

    if (error) {
      return {
        status: "Disconnected",
        connected: false,
        responseTimeMs,
        lastSuccessfulAt: null,
        message: "Unable to reach Supabase database.",
      };
    }

    return {
      status: "Connected",
      connected: true,
      responseTimeMs,
      lastSuccessfulAt: new Date().toISOString(),
      message: "Supabase connection successful.",
    };
  } catch {
    clearTimeout(timeout);
    return {
      status: "Disconnected",
      connected: false,
      responseTimeMs: undefined,
      lastSuccessfulAt: null,
      message: "Unable to reach Supabase database.",
    };
  }
}

async function getSupabaseCounts(): Promise<{ totalPersonnel: number | null; totalLaboratoryResults: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const [personnelResponse, totalLaboratoryResultsResponse] = await Promise.all([
      supabase.from("report_signatories").select("personnel_id").abortSignal(controller.signal),
      supabase.from("laboratory_results").select("id", { head: true, count: "exact" }).abortSignal(controller.signal),
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
        database: mapStatus(supabaseHealth.connected, true),
        authentication: mapStatus(true),
        api: mapStatus(apiHealthy, true),
      },
    };
  }
}

export const developerDashboardService = new DeveloperDashboardService();
