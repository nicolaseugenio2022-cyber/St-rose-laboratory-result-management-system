"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { HydratedTemplateSpec } from "@/services/interfaces";
import { PatientReportSessionAggregate } from "@/domain/models/patient-report-session-aggregate";
import { LaboratoryReportDomain } from "@/domain/models/laboratory-report-domain";
import { IPersonnel, ILaboratoryReport } from "@/domain/models/interfaces";
import { PatientSex, PatientStatus } from "@/domain/types";
import { PatientDemographicsForm } from "./components/PatientDemographicsForm";
import { DynamicResultForm } from "./components/DynamicResultForm";
import { ExaminationCatalog } from "./components/ExaminationCatalog";
import { SelectedReportsPanel } from "./components/SelectedReportsPanel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import {
  completeSessionAction,
  getReopenableSessionAction,
  listActivePersonnelAction,
  listRegistryTemplatesAction,
  replaceSessionAction,
  saveDraftAction,
} from "@/features/server-boundary/server-actions";
import {
  fromSessionTransport,
  toSessionTransport,
} from "@/features/server-boundary/session-transport";
import { formatDateISO } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, AlertCircle, FileText, Eye, Edit3, Menu, X, ArrowLeft, LogOut, User, RefreshCw, History } from "lucide-react";
import { suggestedSignatoryProvider } from "@/services/suggested-signatory-provider";
import { ReportDefinitionRegistry } from "@/domain/definitions/report-definition-registry";
import { buildEncodingReport, reevaluateEncodingReport } from "./encoding/report-encoding";
import { initializeNewSessionAddress } from "./encoding/new-session-demographics";
import {
  clearWorkspaceRecovery,
  loadWorkspaceRecovery,
  saveWorkspaceRecovery,
} from "./workspace-recovery";
import { useWorkspaceNavigationInterceptor } from "@/components/layout/workspace-navigation-guard";

// Shared workspace container: fluid width with a readability cap (UX2-A).
const WORKSPACE_CONTAINER = "w-full max-w-[1680px] mx-auto";

const SharedRenderingEngine = dynamic(
  () =>
    import("@/rendering/SharedRenderingEngine").then(
      (renderingModule) => renderingModule.SharedRenderingEngine
    ),
  {
    loading: () => (
      <SkeletonRegion isLoading label="Loading report preview">
        <Skeleton className="mx-auto h-[70vh] min-h-96 w-full max-w-[210mm]" />
      </SkeletonRegion>
    ),
  }
);

type WorkspaceConfirmation = "clearAll" | "complete" | "replace";

export function GuidedWorkspace({
  reopenSessionId,
  initialTemplates,
  initialPersonnel,
}: {
  reopenSessionId?: string;
  /** Catalog and personnel fetched during server render (see workspace/page.tsx). When present,
   *  the corresponding client fetches are skipped: the workspace paints with its catalog instead
   *  of a loading state. When absent - including on any server-side fetch failure - the original
   *  client fetches below run unchanged, so no error path is lost. */
  initialTemplates?: HydratedTemplateSpec[];
  initialPersonnel?: IPersonnel[];
}) {
  const [session, setSession] = useState<PatientReportSessionAggregate>(() => {
    return new PatientReportSessionAggregate({
      id: crypto.randomUUID(),
      accessionNumber: null,
      demographics: {
        fullName: "",
        age: 0,
        ageUnit: "years",
        sex: "" as unknown as PatientSex, // No default sex selection
        address: initializeNewSessionAddress(""),
        patientStatus: "" as unknown as PatientStatus, // No default patient status selection
        examinationDate: formatDateISO(),
        requestingPhysician: "",
        referrerName: "",
        companyName: "",
      },
      reports: [],
    });
  });

  const [availablePersonnel, setAvailablePersonnel] = useState<IPersonnel[]>(() => initialPersonnel ?? []);

  const [allActiveTemplates, setAllActiveTemplates] = useState<HydratedTemplateSpec[]>(() => initialTemplates ?? []);

  const router = useRouter();
  const registerNavigationInterceptor = useWorkspaceNavigationInterceptor();
  const [activeTemplateCode, setActiveTemplateCode] = useState<string | null>(null);
  const [activeSpec, setActiveSpec] = useState<HydratedTemplateSpec | null>(null);
  const [selectedTemplateCodes, setSelectedTemplateCodes] = useState<string[]>([]);
  const [workspaceMode, setWorkspaceMode] = useState<"encoding" | "preview">("encoding");
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationFocusTarget, setValidationFocusTarget] = useState<"patient-full-name" | "patient-sex" | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<WorkspaceConfirmation | null>(null);
  const [isMobileCatalogOpen, setIsMobileCatalogOpen] = useState<boolean>(false);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [exitDestination, setExitDestination] = useState<string>("/dashboard");
  const [isReplacementMode, setIsReplacementMode] = useState<boolean>(false);
  const [reopenStatus, setReopenStatus] = useState<"idle" | "loading" | "ready" | "failed">(
    reopenSessionId ? "loading" : "idle"
  );
  const [reopenError, setReopenError] = useState<string | null>(null);
  const submissionInFlightRef = useRef(false);

  // Navigation handlers
  const handleBackToDashboard = useCallback(() => {
    if (isDirty) {
      setExitDestination("/dashboard");
      setShowExitModal(true);
    } else {
      router.push("/dashboard");
    }
  }, [isDirty, router]);

  const handleDiscardAndExit = useCallback(() => {
    clearWorkspaceRecovery();
    setShowExitModal(false);
    router.push(exitDestination);
  }, [exitDestination, router]);

  // Load all active hydrated template specs through the authenticated server boundary.
  useEffect(() => {
    if (initialTemplates) return; // server render already delivered the catalog
    async function loadTemplates() {
      try {
        const hydratedSpecs = await listRegistryTemplatesAction({});
        setAllActiveTemplates(hydratedSpecs);
      } catch (error: unknown) {
        setValidationError(
          error instanceof Error ? error.message : "The report registry could not be loaded."
        );
      }
    }
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialPersonnel) return; // server render already delivered the roster
    listActivePersonnelAction()
      .then(setAvailablePersonnel)
      .catch((error: unknown) => {
        setValidationError(
          error instanceof Error ? error.message : "Active personnel could not be loaded."
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!validationFocusTarget || workspaceMode !== "encoding") return;

    const frame = window.requestAnimationFrame(() => {
      const field = document.getElementById(validationFocusTarget);
      if (field instanceof HTMLElement) {
        field.focus({ preventScroll: true });
        field.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setValidationFocusTarget(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [validationFocusTarget, workspaceMode]);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Restore unsaved fresh-workspace input after an accidental refresh. This runs after
  // mount, never in a state initializer: sessionStorage does not exist during the server
  // render, so seeding initial state from it would make the client's first render disagree
  // with the server HTML and fail hydration. A persisted-session route always uses the
  // server-loaded session, so recovery is not read for it at all.
  useEffect(() => {
    if (reopenSessionId) return;

    const recovered = loadWorkspaceRecovery();
    if (!recovered) return;

    setSession(fromSessionTransport(recovered.session));
    setSelectedTemplateCodes(recovered.selectedTemplateCodes);
    setActiveTemplateCode(recovered.activeTemplateCode);
    setIsDirty(true);
    setSaveStatus("unsaved");
  }, [reopenSessionId]);

  // Persist unsaved fresh-workspace input for accidental-refresh recovery. Never for a
  // reopened or Replacement Mode session, and never once an accession exists — from the
  // first successful write onward the database is the authority, not sessionStorage.
  useEffect(() => {
    if (reopenSessionId || isReplacementMode) return;
    if (session.accessionNumber !== null || session.status !== "Draft") return;
    if (!isDirty) return;

    const timer = setTimeout(() => {
      saveWorkspaceRecovery({
        session: toSessionTransport(session),
        selectedTemplateCodes,
        activeTemplateCode,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [session, selectedTemplateCodes, activeTemplateCode, isDirty, isReplacementMode, reopenSessionId]);

  // Reopen an existing session through the server-authoritative load boundary.
  // Ownership, status and retention are decided by getReopenableSessionAction; a
  // session that cannot be reopened never reaches the workspace.
  useEffect(() => {
    if (!reopenSessionId) return;

    let cancelled = false;
    getReopenableSessionAction({ sessionId: reopenSessionId })
      .then((transport) => {
        if (cancelled) return;
        const reopened = fromSessionTransport(transport);
        const templateCodes = reopened.reports.map((report) => report.templateCode);
        setSession(reopened);
        setSelectedTemplateCodes(templateCodes);
        setActiveTemplateCode(templateCodes[0] ?? null);
        setIsReplacementMode(reopened.status === "Completed");
        setIsDirty(false);
        setSaveStatus("saved");
        setValidationError(null);
        setReopenStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setReopenError(
          error instanceof Error ? error.message : "This session could not be reopened."
        );
        setReopenStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [reopenSessionId]);

  // Resolve the hydrated spec loaded by the authenticated registry bootstrap.
  useEffect(() => {
    if (!activeTemplateCode) {
      setActiveSpec(null);
      return;
    }

    const spec = allActiveTemplates.find(
      (candidate) => candidate.template.templateCode === activeTemplateCode
    );
    if (spec) {
        setActiveSpec(spec);
        const definition = ReportDefinitionRegistry.getDefinition(activeTemplateCode);
        if (!definition) {
          setValidationError(`No approved encoding definition is registered for ${activeTemplateCode}.`);
          return;
        }

        setSession((prevSession) => {
          const existingReport = prevSession.reports.find((r) => r.templateCode === activeTemplateCode);

          const defaultSignatories = suggestedSignatoryProvider.getSuggestedSignatories(
            spec.template.templateCode,
            spec.signatoryRequirement.requiredPathologistsCount,
            spec.signatoryRequirement.requiredMedtechsCount,
            availablePersonnel
          );

          const encodingReport = buildEncodingReport({
            definition,
            sessionId: prevSession.id,
            reportId: existingReport?.id || crypto.randomUUID(),
            rendererFamily: spec.template.rendererFamily,
            signatories: defaultSignatories,
            existingReport,
            legacyRequestedBy: prevSession.demographics.requestingPhysician,
            legacyAdditionalFields: {
              companyName: prevSession.demographics.companyName,
            },
            evaluationContext: { sex: prevSession.demographics.sex || null },
            unmatchedParameterSelection: !isReplacementMode,
          });

          return new PatientReportSessionAggregate({
            ...prevSession,
            reports: existingReport
              ? prevSession.reports.map((report) => report.templateCode === activeTemplateCode ? encodingReport : report)
              : [...prevSession.reports, encodingReport],
          });
        });
    }
  }, [activeTemplateCode, allActiveTemplates, availablePersonnel, isReplacementMode]);

  // Toggle template selection in session
  const handleToggleTemplateSelection = useCallback((templateCode: string) => {
    setSelectedTemplateCodes((prev) => {
      if (prev.includes(templateCode)) {
        const updated = prev.filter((c) => c !== templateCode);
        if (activeTemplateCode === templateCode) {
          setActiveTemplateCode(updated[0] ?? null);
        }
        return updated;
      } else {
        if (!prev.includes(templateCode)) {
          if (!activeTemplateCode) {
            setActiveTemplateCode(templateCode);
          }
          return [...prev, templateCode];
        }
        return prev;
      }
    });

    setSession((prevSession) => {
      const exists = prevSession.reports.some((r) => r.templateCode === templateCode);
      if (exists) {
        const updatedReports = prevSession.reports.filter((r) => r.templateCode !== templateCode);
        return new PatientReportSessionAggregate({ ...prevSession, reports: updatedReports });
      }
      return prevSession;
    });
  }, [activeTemplateCode]);

  // Remove test from session (closes tab and activates nearest remaining)
  const handleRemoveTemplate = useCallback((templateCode: string) => {
    handleToggleTemplateSelection(templateCode);
  }, [handleToggleTemplateSelection]);

  // Close Other Examinations
  const handleCloseOtherTemplates = useCallback((keepTemplateCode: string) => {
    setSelectedTemplateCodes([keepTemplateCode]);
    setActiveTemplateCode(keepTemplateCode);
    setSession((prevSession) => {
      const updatedReports = prevSession.reports.filter((r) => r.templateCode === keepTemplateCode);
      return new PatientReportSessionAggregate({ ...prevSession, reports: updatedReports });
    });
  }, []);

  // Clear All Examinations
  const handleClearAllTemplates = useCallback(() => {
    setSelectedTemplateCodes([]);
    setActiveTemplateCode(null);
    setActiveSpec(null);
    setSession((prevSession) => {
      return new PatientReportSessionAggregate({ ...prevSession, reports: [] });
    });
  }, []);

  // Update active report in session aggregate
  const handleReportChange = useCallback(
    (updatedReport: ILaboratoryReport) => {
      setSession((prevSession) => {
        const updatedReports = prevSession.reports.map((r) =>
          r.templateCode === updatedReport.templateCode ? (updatedReport as LaboratoryReportDomain) : r
        );
        return new PatientReportSessionAggregate({
          ...prevSession,
          reports: updatedReports,
        });
      });
      setIsDirty(true);
      setSaveStatus("unsaved");
    },
    []
  );

  // Manual save draft handler
  const handleSaveDraft = useCallback(async () => {
    setSaveStatus("saving");
    try {
      const saved = await saveDraftAction({ session: toSessionTransport(session) });
      clearWorkspaceRecovery();
      setSession(fromSessionTransport(saved));
      setIsDirty(false);
      setSaveStatus("saved");
      setValidationError(null);
    } catch {
      setSaveStatus("unsaved");
      setValidationError("Failed to save draft session.");
    }
  }, [session]);

  const focusDemographicsValidationError = useCallback((message: string, target: "patient-full-name" | "patient-sex") => {
    setPendingConfirmation(null);
    setValidationError(message);
    setWorkspaceMode("encoding");
    setValidationFocusTarget(target);
  }, []);

  const requestCompleteConfirmation = useCallback(() => {
    if (!session.demographics.fullName.trim()) {
      focusDemographicsValidationError(
        "Patient Name is required before completing session.",
        "patient-full-name"
      );
      return;
    }
    if (!session.demographics.sex) {
      focusDemographicsValidationError(
        "Patient Sex is required before completing session.",
        "patient-sex"
      );
      return;
    }

    setPendingConfirmation("complete");
  }, [focusDemographicsValidationError, session.demographics.fullName, session.demographics.sex]);

  const requestReplaceConfirmation = useCallback(() => {
    if (!session.demographics.fullName.trim()) {
      focusDemographicsValidationError(
        "Patient Name is required before replacing this report.",
        "patient-full-name"
      );
      return;
    }
    if (!session.demographics.sex) {
      focusDemographicsValidationError(
        "Patient Sex is required before replacing this report.",
        "patient-sex"
      );
      return;
    }

    setPendingConfirmation("replace");
  }, [focusDemographicsValidationError, session.demographics.fullName, session.demographics.sex]);

  // Complete session handler
  const handleCompleteSession = async () => {
    if (!session.demographics.fullName.trim()) {
      focusDemographicsValidationError(
        "Patient Name is required before completing session.",
        "patient-full-name"
      );
      return;
    }
    if (!session.demographics.sex) {
      focusDemographicsValidationError(
        "Patient Sex is required before completing session.",
        "patient-sex"
      );
      return;
    }
    if (submissionInFlightRef.current) return;

    submissionInFlightRef.current = true;
    setSaveStatus("saving");
    try {
      const completed = await completeSessionAction({ session: toSessionTransport(session) });
      clearWorkspaceRecovery();
      setSession(fromSessionTransport(completed));
      setIsDirty(false);
      setSaveStatus("saved");
      setValidationError(null);
      setWorkspaceMode("preview");
    } catch (err: unknown) {
      setSaveStatus("unsaved");
      if (err instanceof Error) {
        setValidationError(err.message);
      } else {
        setValidationError("An unexpected error occurred while completing the session.");
      }
    } finally {
      submissionInFlightRef.current = false;
      setPendingConfirmation(null);
    }
  };

  // Replace the completed session wholesale (ADR-006 single-record replacement)
  const handleReplaceSession = async () => {
    if (!session.demographics.fullName.trim()) {
      focusDemographicsValidationError(
        "Patient Name is required before replacing this report.",
        "patient-full-name"
      );
      return;
    }
    if (!session.demographics.sex) {
      focusDemographicsValidationError(
        "Patient Sex is required before replacing this report.",
        "patient-sex"
      );
      return;
    }
    if (submissionInFlightRef.current) return;

    submissionInFlightRef.current = true;
    setSaveStatus("saving");
    try {
      const replaced = await replaceSessionAction({ session: toSessionTransport(session) });
      setSession(fromSessionTransport(replaced));
      setIsDirty(false);
      setSaveStatus("saved");
      setValidationError(null);
      setWorkspaceMode("preview");
    } catch (err: unknown) {
      setSaveStatus("unsaved");
      if (err instanceof Error) {
        setValidationError(err.message);
      } else {
        setValidationError("An unexpected error occurred while replacing the report.");
      }
    } finally {
      submissionInFlightRef.current = false;
      setPendingConfirmation(null);
    }
  };

  // Handle save draft & exit
  const handleSaveDraftAndExit = useCallback(async () => {
    if (saveStatus === "saving") return;

    setShowExitModal(false);
    setSaveStatus("saving");
    try {
      await saveDraftAction({ session: toSessionTransport(session) });
      clearWorkspaceRecovery();
      setIsDirty(false);
      setSaveStatus("saved");
      setValidationError(null);
      router.push(exitDestination);
    } catch {
      setSaveStatus("unsaved");
      setValidationError("Failed to save draft session before exit.");
    }
  }, [exitDestination, router, saveStatus, session]);

  const selectedSpecs = useMemo(() => {
    return allActiveTemplates.filter((spec) => selectedTemplateCodes.includes(spec.template.templateCode));
  }, [allActiveTemplates, selectedTemplateCodes]);

  const activeReport = activeTemplateCode ? session.reports.find((r) => r.templateCode === activeTemplateCode) : undefined;
  const activeDefinition = activeTemplateCode ? ReportDefinitionRegistry.getDefinition(activeTemplateCode) : null;
  const isWorkspaceDialogOpen = showExitModal || pendingConfirmation !== null;

  useEffect(() => {
    const interceptNavigation = (href: string) => {
      if (isWorkspaceDialogOpen) return true;
      if (!isDirty) return false;

      setExitDestination(href);
      setShowExitModal(true);
      return true;
    };

    return registerNavigationInterceptor(interceptNavigation);
  }, [isDirty, isWorkspaceDialogOpen, registerNavigationInterceptor]);

  const handleCancelConfirmation = useCallback(() => {
    setPendingConfirmation(null);
  }, []);

  const handleConfirmClearAll = useCallback(() => {
    handleClearAllTemplates();
    setPendingConfirmation(null);
  }, [handleClearAllTemplates]);

  useEffect(() => {
    const handleWorkspaceShortcut = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.defaultPrevented || isWorkspaceDialogOpen) return;
      if (event.target instanceof HTMLTextAreaElement) return;

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!isReplacementMode && !event.repeat && isDirty && saveStatus !== "saving") {
          void handleSaveDraft();
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (!event.repeat && saveStatus !== "saving") {
          if (isReplacementMode) {
            requestReplaceConfirmation();
          } else if (session.status !== "Completed") {
            requestCompleteConfirmation();
          }
        }
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const currentIndex = selectedSpecs.findIndex(
        (spec) => spec.template.templateCode === activeTemplateCode
      );
      if (currentIndex < 0 || selectedSpecs.length < 2) return;

      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + direction + selectedSpecs.length) % selectedSpecs.length;
      setActiveTemplateCode(selectedSpecs[nextIndex].template.templateCode);
    };

    window.addEventListener("keydown", handleWorkspaceShortcut);
    return () => window.removeEventListener("keydown", handleWorkspaceShortcut);
  }, [activeTemplateCode, handleSaveDraft, isDirty, isReplacementMode, isWorkspaceDialogOpen, requestCompleteConfirmation, requestReplaceConfirmation, saveStatus, selectedSpecs, session.status]);

  // A reopen request must resolve before the workspace is usable. Rendering the blank
  // new-session workspace after a failed load would invite encoding into a different
  // session than the one requested.
  if (reopenStatus === "loading" || reopenStatus === "failed") {
    return (
      <div className="h-full min-h-0 w-full flex items-center justify-center bg-slate-100/60 p-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm max-w-md w-full p-6 space-y-4 text-center">
          {reopenStatus === "loading" ? (
            <>
              <div className="mx-auto p-2.5 bg-blue-50 text-brand-primary rounded-full w-fit border border-blue-100">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Reopening Session</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Loading the saved patient report session from the laboratory record.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto p-2.5 bg-rose-50 text-rose-700 rounded-full w-fit border border-rose-200">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Session Could Not Be Reopened</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {reopenError ?? "This session could not be reopened."}
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => router.push("/history")}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg shadow-sm transition-colors"
                >
                  <History className="h-4 w-4" />
                  Return to Session History
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Return to Dashboard
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 w-full overflow-hidden flex flex-col bg-slate-100/60">
      {/* Fixed Workspace Top Navigation Bar */}
      <header className="h-14 bg-white border-b border-slate-200 shadow-sm px-4 flex items-center shrink-0 z-30">
        <div className={`${WORKSPACE_CONTAINER} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3 min-w-0">
            {/* Back to Dashboard Navigation Button */}
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 shrink-0"
              title="Return to Dashboard"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </button>

            {/* Mobile Catalog Drawer Button */}
            <button
              type="button"
              onClick={() => setIsMobileCatalogOpen(!isMobileCatalogOpen)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Toggle Catalog"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[11px] font-bold font-mono bg-blue-100 text-blue-800 rounded" title={session.accessionNumber === null ? "Accession not assigned" : undefined}>
                  {session.accessionNumber ?? "Not assigned"}
                </span>
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                    session.status === "Completed"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {session.status}
                </span>
                {isReplacementMode && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    <RefreshCw className="h-3 w-3" />
                    Replacement Mode
                  </span>
                )}
              </div>
              <h1 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight mt-0.5 truncate">
                {session.demographics.fullName || "New Patient Visit Session"}
              </h1>
            </div>
          </div>

          {/* Sticky Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Workspace View Mode Switcher */}
            <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setWorkspaceMode("encoding")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  workspaceMode === "encoding"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Encoding</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode("preview")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  workspaceMode === "preview"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Live Preview</span>
              </button>
            </div>

            {/* Save Draft Action — a completed session under replacement has no draft path */}
            {!isReplacementMode && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saveStatus === "saving" || !isDirty}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  isDirty
                    ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <Save className="h-3.5 w-3.5" />
                {saveStatus === "saving" ? "Saving..." : "Save Draft"}
              </button>
            )}

            {/* Replace Completed Report Action */}
            {isReplacementMode && (
              <button
                type="button"
                onClick={requestReplaceConfirmation}
                disabled={saveStatus === "saving"}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 rounded-lg shadow-sm transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {saveStatus === "saving" ? "Replacing..." : "Replace Completed Report"}
              </button>
            )}

            {/* Complete Session Action */}
            {session.status !== "Completed" && (
              <button
                type="button"
                onClick={requestCompleteConfirmation}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg shadow-sm transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete Session
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Replacement Mode Notice */}
      {isReplacementMode && (
        <div className={`${WORKSPACE_CONTAINER} px-4 mt-2 shrink-0`}>
          <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-900">
            <RefreshCw className="h-4 w-4 text-amber-700 flex-shrink-0" />
            <span>
              <span className="font-bold">Replacement Mode.</span> Saving replaces the completed
              report for accession {session.accessionNumber} permanently. The previous content is
              not recoverable, and the accession number is not changed.
            </span>
          </div>
        </div>
      )}

      {/* Validation Banner Notice */}
      {validationError && (
        <div className={`${WORKSPACE_CONTAINER} px-4 mt-2 shrink-0`}>
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="text-red-500 hover:text-red-700 font-bold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Dual-Pane Independent Scroll Layout */}
      <main className={`flex-1 overflow-hidden p-3 sm:px-4 sm:py-3 xl:px-6 ${WORKSPACE_CONTAINER}`}>
        {workspaceMode === "encoding" ? (
          <div className="h-full flex flex-col lg:flex-row gap-3 items-stretch overflow-hidden">
            {/* Desktop Left Sidebar: Fixed 280px width Independently Scrollable */}
            <div className="hidden lg:block w-[280px] shrink-0 h-full overflow-hidden">
              <ExaminationCatalog
                allTemplates={allActiveTemplates}
                selectedTemplateCodes={selectedTemplateCodes}
                activeTemplateCode={activeTemplateCode}
                onSelectTemplate={setActiveTemplateCode}
                onToggleTemplateSelection={handleToggleTemplateSelection}
              />
            </div>

            {/* Mobile/Tablet Catalog Overlay Drawer */}
            {isMobileCatalogOpen && (
              <div className="fixed inset-0 z-50 bg-slate-900/50 flex lg:hidden">
                <div className="w-80 max-w-full bg-white h-full p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-700 uppercase">Select Examinations</span>
                    <button
                      type="button"
                      onClick={() => setIsMobileCatalogOpen(false)}
                      className="p-1 text-slate-500 hover:text-slate-800"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <ExaminationCatalog
                    allTemplates={allActiveTemplates}
                    selectedTemplateCodes={selectedTemplateCodes}
                    activeTemplateCode={activeTemplateCode}
                    onSelectTemplate={(code) => {
                      setActiveTemplateCode(code);
                      setIsMobileCatalogOpen(false);
                    }}
                    onToggleTemplateSelection={handleToggleTemplateSelection}
                  />
                </div>
              </div>
            )}

            {/* Main Encoding Workspace Panel: Expanded horizontal area (~78-80% width) Independently Scrollable */}
            <div className="flex-1 min-w-0 h-full overflow-y-auto pr-1 space-y-2.5 scroll-pt-16">
              {/* Patient Demographics Header Card */}
              <PatientDemographicsForm
                demographics={session.demographics}
                onChange={(updated) => {
                  setSession((previous) => {
                    const sexChanged = previous.demographics.sex !== updated.sex;
                    const reports = sexChanged
                      ? previous.reports.map((report) => {
                          const definition = ReportDefinitionRegistry.getDefinition(report.templateCode);
                          return definition
                            ? reevaluateEncodingReport(report, definition, { sex: updated.sex || null })
                            : report;
                        })
                      : previous.reports;
                    return new PatientReportSessionAggregate({ ...previous, demographics: updated, reports });
                  });
                  setIsDirty(true);
                  setSaveStatus("unsaved");
                }}
              />

              {/* Single-Line Horizontal Scrollable Examination Tab Strip */}
              {/* Persistent session context: patient identity + report tab strip (UX2-A) */}
              <div className="sticky top-0 z-20 flex items-end gap-2.5 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm px-3 py-1.5">
                {session.demographics.sex && session.demographics.age > 0 && (
                  <span
                    className="hidden shrink-0 items-center gap-1.5 pb-1.5 font-mono text-[11px] font-semibold text-slate-500 sm:inline-flex"
                    title="Patient sex and age determine the sex-specific reference ranges applied while encoding"
                  >
                    <User aria-hidden="true" className="h-3.5 w-3.5 text-brand-primary" />
                    {session.demographics.sex}, {session.demographics.age} y/o
                  </span>
                )}
                <SelectedReportsPanel
                  selectedSpecs={selectedSpecs}
                  activeTemplateCode={activeTemplateCode}
                  onSelectActiveTemplate={setActiveTemplateCode}
                  onRemoveTemplate={handleRemoveTemplate}
                  onCloseOtherTemplates={handleCloseOtherTemplates}
                  onClearAllTemplates={() => setPendingConfirmation("clearAll")}
                  isDirty={isDirty}
                />
              </div>

              {/* Dynamic Result Form Dispatcher */}
              {activeSpec && activeDefinition && activeReport && selectedSpecs.length > 0 ? (
                <DynamicResultForm
                  spec={activeSpec}
                  definition={activeDefinition}
                  report={activeReport}
                  availablePersonnel={availablePersonnel}
                  patientSex={session.demographics.sex || null}
                  onChangeReport={handleReportChange}
                />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-6 py-6 text-center shadow-sm flex flex-col items-center justify-center my-3">
                  <div className="p-2.5 bg-blue-50 text-brand-primary rounded-full mb-2 border border-blue-100">
                    <FileText className="h-6 w-6" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-800">No Examination Selected</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
                    Choose a laboratory examination from the catalog on the left to begin encoding patient results.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Live Screen Preview Mode using SharedRenderingEngine */
          <div className="h-full overflow-y-auto bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-800">A4 Printable Document Screen Preview</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rendering exact physical A4 document output via SharedRenderingEngine
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWorkspaceMode("encoding")}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Return to Encoding Form
              </button>
            </div>

            <div className="space-y-8 overflow-x-auto pb-6">
              <SharedRenderingEngine session={session} targetOutput="ScreenPreview" />
            </div>
          </div>
        )}
      </main>

      <ConfirmDialog
        isOpen={pendingConfirmation === "complete"}
        onCancel={handleCancelConfirmation}
        onConfirm={() => void handleCompleteSession()}
        title="Complete Session?"
        description={`Complete the session for ${session.demographics.fullName.trim()} with ${selectedSpecs.length} laboratory report${selectedSpecs.length === 1 ? "" : "s"}, assigning its accession number and freezing the completed report snapshot.`}
        confirmLabel="Complete Session"
        pendingLabel="Completing..."
        isPending={pendingConfirmation === "complete" && saveStatus === "saving"}
      />

      <ConfirmDialog
        isOpen={pendingConfirmation === "replace"}
        onCancel={handleCancelConfirmation}
        onConfirm={() => void handleReplaceSession()}
        title="Replace Completed Report?"
        description={`Replace completed report ${session.accessionNumber ?? "Not assigned"} and permanently overwrite its prior content, which cannot be recovered.`}
        confirmLabel="Replace Report"
        pendingLabel="Replacing..."
        variant="destructive"
        isPending={pendingConfirmation === "replace" && saveStatus === "saving"}
      />

      <ConfirmDialog
        isOpen={pendingConfirmation === "clearAll"}
        onCancel={handleCancelConfirmation}
        onConfirm={handleConfirmClearAll}
        title="Clear All Examinations?"
        description="Are you sure you want to remove all laboratory examinations from this visit session?"
        confirmLabel="Clear All"
        variant="destructive"
      />

      {/* Unsaved Changes Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 text-amber-700 shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Unsaved Changes in Workspace</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  You have unsaved changes in this visit session. What would you like to do before exiting?
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              {!isReplacementMode && (
                <button
                  type="button"
                  onClick={handleSaveDraftAndExit}
                  disabled={saveStatus === "saving"}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary-hover rounded-lg shadow-sm transition-colors"
                >
                  <Save className="h-4 w-4" />
                  Save Draft & Exit
                </button>
              )}

              <button
                type="button"
                onClick={handleDiscardAndExit}
                disabled={saveStatus === "saving"}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Discard Changes & Exit
              </button>

              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
