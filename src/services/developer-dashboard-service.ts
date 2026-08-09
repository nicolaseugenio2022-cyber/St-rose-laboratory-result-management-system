import packageJson from "../../package.json";
import { AuditLogEntryDomain } from "@/domain/models/audit-log-entry";
import { auditLogService } from "@/services/audit-log-service";
import { userService } from "@/services/userService";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

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
  totalAuditLogs: number;
  totalLaboratoryResults: number | null;
  recentActivity: AuditLogEntryDomain[];
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

async function getSupabaseHealth(): Promise<SupabaseHealthReport> {
  const start = Date.now();
  try {
    const { error } = await supabase
      .from("patient_report_sessions")
      .select("id", { head: true, count: "exact" })
      .limit(1);

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
  try {
    const personnelResponse = await supabase.from("report_signatories").select("personnel_id");
    const totalPersonnel = personnelResponse.data
      ? new Set((personnelResponse.data as { personnel_id?: string }[]).map((item) => item.personnel_id).filter(Boolean)).size
      : null;

    const totalLaboratoryResultsResponse = await supabase
      .from("laboratory_results")
      .select("id", { head: true, count: "exact" });

    return {
      totalPersonnel,
      totalLaboratoryResults: totalLaboratoryResultsResponse.count ?? null,
    };
  } catch {
    return {
      totalPersonnel: null,
      totalLaboratoryResults: null,
    };
  }
}

export class DeveloperDashboardService {
  public async getDashboardData(): Promise<DeveloperDashboardData> {
    const [users, auditLogs, supabaseHealth, supabaseCounts] = await Promise.all([
      userService.getUsers(),
      auditLogService.getLogs(),
      getSupabaseHealth(),
      getSupabaseCounts(),
    ]);

    const currentAuthStatus = "Authenticated";
    const appHealthy = true;
    const apiHealthy = Boolean(users && auditLogs);

    return {
      totalUsers: users.length,
      totalPersonnel: supabaseCounts.totalPersonnel,
      totalAuditLogs: auditLogs.length,
      totalLaboratoryResults: supabaseCounts.totalLaboratoryResults,
      recentActivity: auditLogs.slice(0, 6),
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