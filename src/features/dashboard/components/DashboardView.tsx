"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { User } from "@/types/user";
import { userService } from "@/services/userService";
import { startupValidationService, StartupValidationReport } from "@/services/startup-validation-service";
import { purgeSchedulerService } from "@/services/purge-scheduler-service";
import { WelcomeBanner } from "./WelcomeBanner";
import { SummaryCards } from "./SummaryCards";
import { QuickActions } from "./QuickActions";
import { ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export function DashboardView() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [validationReport, setValidationReport] = useState<StartupValidationReport | null>(null);
  const [purging, setPurging] = useState<boolean>(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await userService.getUsers();
      setUsers(data);

      const report = await startupValidationService.performStartupValidation();
      setValidationReport(report);
    } catch (err) {
      console.error("Failed to load user metrics:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = userService.subscribe(loadData);
    return () => unsubscribe();
  }, [loadData]);

  const handleManualPurge = useCallback(async () => {
    setPurging(true);
    try {
      const res = await purgeSchedulerService.executeScheduledPurge("manual-dashboard-trigger");
      setPurgeResult(`Scheduled retention purge executed cleanly. Purged ${res.purgedCount} expired sessions.`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPurgeResult(`Purge failed: ${err.message}`);
      }
    } finally {
      setPurging(false);
    }
  }, []);

  // Memoized user metric counts to prevent array filtering on unrelated re-renders
  const metrics = useMemo(() => {
    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === "Active").length,
      inactiveUsers: users.filter((u) => u.status === "Inactive").length,
      adminUsers: users.filter((u) => u.role === "Admin").length,
    };
  }, [users]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-48 w-full animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 w-full animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WelcomeBanner />

      {/* Operational Hardening Status Banner */}
      {validationReport && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${validationReport.isHardened ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  Operational Hardening Status
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    validationReport.isHardened
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}>
                    {validationReport.isHardened ? "HARDENED & READY" : "HARDENING WARNINGS"}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Templates Loaded: <strong className="text-slate-800">{validationReport.templatesLoadedCount}/17</strong> | 
                  Active Personnel: <strong className="text-slate-800">{validationReport.personnelActiveCount}</strong> | 
                  Supabase: <strong className="text-emerald-700">Connected</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleManualPurge}
              disabled={purging}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${purging ? "animate-spin" : ""}`} />
              Run Retention Purge Trigger
            </button>
          </div>

          {purgeResult && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-brand-primary font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{purgeResult}</span>
            </div>
          )}

          {validationReport.warnings.length > 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 space-y-1">
              {validationReport.warnings.map((w, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SummaryCards
        totalUsers={metrics.totalUsers}
        activeUsers={metrics.activeUsers}
        inactiveUsers={metrics.inactiveUsers}
        adminUsers={metrics.adminUsers}
      />

      <QuickActions />
    </div>
  );
}
