"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { PatientReportSessionAggregate } from "@/domain/models/patient-report-session-aggregate";
import { listRecentSessionsAction } from "@/features/server-boundary/server-actions";
import { fromSessionTransport } from "@/features/server-boundary/session-transport";
import { SharedRenderingEngine } from "@/rendering/SharedRenderingEngine";
import { Search, History, Eye, Edit3, Calendar, FileText, CheckCircle2, Clock, X } from "lucide-react";
import { formatDateISO } from "@/lib/utils";

export function SessionHistoryView() {
  const [sessions, setSessions] = useState<PatientReportSessionAggregate[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Draft" | "Completed">("ALL");
  const [previewSession, setPreviewSession] = useState<PatientReportSessionAggregate | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load session history
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRecentSessionsAction({ limit: 50 });
      setSessions(data.map((entry) => fromSessionTransport(entry.session)));
      setLoadError(null);
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error ? error.message : "Session history could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Memoized filtered session list to prevent array filtering on unrelated state changes
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        s.accessionNumber?.toLowerCase().includes(q) === true ||
        s.demographics.fullName.toLowerCase().includes(q) ||
        s.demographics.requestingPhysician.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sessions, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-brand-primary">
              <History className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Patient Report Session History</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Search, preview, print, and manage patient laboratory report sessions within the 30-day retention window.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1 rounded-md transition-colors ${
              statusFilter === "ALL" ? "bg-white text-brand-primary shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({sessions.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("Completed")}
            className={`px-3 py-1 rounded-md transition-colors ${
              statusFilter === "Completed" ? "bg-white text-emerald-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Completed
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("Draft")}
            className={`px-3 py-1 rounded-md transition-colors ${
              statusFilter === "Draft" ? "bg-white text-amber-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Drafts
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Accession Number (e.g. SR-20260807-0001), Patient Name, or Physician..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium shrink-0">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span>Today: {formatDateISO()}</span>
        </div>
      </div>

      {/* Session Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading session history...</div>
        ) : loadError ? (
          <div className="p-12 text-center text-rose-700 text-xs">
            Session history could not be loaded: {loadError}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No patient report sessions found matching query &apos;{searchQuery}&apos;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200 text-[10px]">
                  <th className="py-3 px-4">ACCESSION NO</th>
                  <th className="py-3 px-4">PATIENT NAME</th>
                  <th className="py-3 px-4">AGE / SEX</th>
                  <th className="py-3 px-4">TESTS</th>
                  <th className="py-3 px-4">PHYSICIAN</th>
                  <th className="py-3 px-4">DATE</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map((sess) => {
                  const isCompleted = sess.status === "Completed";

                  return (
                    <tr key={sess.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-900">
                        {sess.accessionNumber}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 uppercase">
                        {sess.demographics.fullName || "Unnamed Patient"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {sess.demographics.age} {sess.demographics.ageUnit} / {sess.demographics.sex}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {sess.reports.map((r) => (
                            <span key={r.id} className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200">
                              {r.templateCode}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 truncate max-w-[150px]">
                        {sess.demographics.requestingPhysician || "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {sess.demographics.examinationDate}
                      </td>
                      <td className="py-3 px-4">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="h-3 w-3 text-amber-600" /> Draft
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => setPreviewSession(sess)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => alert(`Reopening session '${sess.accessionNumber}' in workspace.`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-blue-200 bg-blue-50 text-brand-primary hover:bg-blue-100 transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          {isCompleted ? "Replace" : "Edit"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Preview Modal */}
      {previewSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-300 w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 relative shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-brand-primary" />
                <h3 className="text-base font-bold text-slate-900">
                  Session Preview — {previewSession.accessionNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSession(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Shared Rendering Engine Output */}
            <SharedRenderingEngine session={previewSession} targetOutput="ScreenPreview" />
          </div>
        </div>
      )}
    </div>
  );
}
