"use client";

import React, { useState, useEffect, useCallback } from "react";
import { auditLogService } from "@/services/audit-log-service";
import { AuditLogEntryDomain, AuditEventCategory } from "@/domain/models/audit-log-entry";
import { ShieldCheck, Filter, RefreshCw, Key, UserCheck, FileText, AlertTriangle } from "lucide-react";

export function AuditLogView() {
  const [logs, setLogs] = useState<AuditLogEntryDomain[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntryDomain | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const cat = categoryFilter === "ALL" ? undefined : (categoryFilter as AuditEventCategory);
      const data = await auditLogService.getLogs(cat);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getCategoryBadge = (cat: AuditEventCategory) => {
    switch (cat) {
      case "AuthAccount":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-800 border border-blue-200">
            <Key className="h-3 w-3" /> Auth / Account
          </span>
        );
      case "PersonnelCredential":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-purple-50 text-purple-800 border border-purple-200">
            <UserCheck className="h-3 w-3" /> Personnel
          </span>
        );
      case "SessionReport":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            <FileText className="h-3 w-3" /> Session / Report
          </span>
        );
      case "SecurityDenial":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="h-3 w-3 text-rose-600" /> Security Denial
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Security Audit Log Viewer</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Inspect append-only security logs for administrative actions, personnel updates, session events, and access denials per SECURITY_MODEL.md.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          Refresh Logs
        </button>
      </div>

      {/* Category Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Filter className="h-4 w-4 text-slate-400" />
          <span>Category Filter:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {["ALL", "AuthAccount", "PersonnelCredential", "SessionReport", "SecurityDenial"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors border ${
                categoryFilter === cat
                  ? "bg-indigo-900 text-white border-indigo-900 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {cat === "ALL" ? "All Events" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No audit logs recorded for category &apos;{categoryFilter}&apos;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200 text-[10px]">
                  <th className="py-3 px-4">TIMESTAMP</th>
                  <th className="py-3 px-4">CATEGORY</th>
                  <th className="py-3 px-4">EVENT TYPE</th>
                  <th className="py-3 px-4">PERFORMED BY</th>
                  <th className="py-3 px-4">TARGET ENTITY</th>
                  <th className="py-3 px-4 text-right">DETAILS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">{getCategoryBadge(log.category)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono text-[11px]">
                      {log.eventType}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {log.performedByUsername} <span className="text-[10px] text-slate-400 font-mono">({log.performedByUserId})</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {log.targetEntityType ? `${log.targetEntityType}: ${log.targetEntityId || "N/A"}` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Inspect JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JSON Details Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 text-slate-200 rounded-2xl border border-slate-700 w-full max-w-xl p-6 relative shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white font-mono">{selectedLog.eventType} — Event Inspection</h3>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <pre className="bg-slate-950 p-4 rounded-lg font-mono text-xs overflow-x-auto text-emerald-400">
              {JSON.stringify(selectedLog, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
