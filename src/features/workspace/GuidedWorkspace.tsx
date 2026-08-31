"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { HydratedTemplateSpec } from "@/services/interfaces";
import { PatientReportSessionAggregate } from "@/domain/models/patient-report-session-aggregate";
import { LaboratoryReportDomain } from "@/domain/models/laboratory-report-domain";
import { ILaboratoryReport } from "@/domain/models/interfaces";
import type {
  WorkspacePersonnelEntry,
  WorkspaceSignatureAssetMap,
} from "@/features/workspace/signatory-contracts";
import { listWorkspacePersonnelAction } from "@/features/server-boundary/workspace-personnel-actions";
import { PatientSex, PatientStatus } from "@/domain/types";
import { PatientDemographicsForm } from "./components/PatientDemographicsForm";
import { DynamicResultForm } from "./components/DynamicResultForm";
import { EncodingReportFooter } from "./components/EncodingReportFooter";
import { ExaminationCatalog } from "./components/ExaminationCatalog";
import { SelectedReportsPanel } from "./components/SelectedReportsPanel";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import {
  completeSessionAction,
  getReopenableSessionAction,
  listRegistryTemplatesAction,
  replaceSessionAction,
  saveDraftAction,
} from "@/features/server-boundary/server-actions";
import {
  fromSessionTransport,
  toSessionTransport,
} from "@/features/server-boundary/session-transport";
import { cn, formatDateISO } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, AlertCircle, FileText, Eye, Edit3, Menu, X, ArrowLeft, LogOut, User, RefreshCw, History, PanelLeftOpen } from "lucide-react";
import { suggestedSignatoryProvider } from "@/services/suggested-signatory-provider";
import { ReportDefinitionRegistry } from "@/domain/definitions/report-definition-registry";
import { applyCalculationMode, buildEncodingReport, reevaluateEncodingReport } from "./encoding/report-encoding";
import { getReportEncodingProgress, getSessionEncodingProgress } from "./encoding/encoding-progress";
import { initializeNewSessionAddress } from "./encoding/new-session-demographics";
import {
  clearWorkspaceRecovery,
  loadWorkspaceRecovery,
  saveWorkspaceRecovery,
} from "./workspace-recovery";
import { useWorkspaceNavigationInterceptor } from "@/components/layout/workspace-navigation-guard";

// Shared workspace container: fluid width with a readability cap (UX2-A).
const WORKSPACE_CONTAINER = "w-full max-w-[1680px] mx-auto";

// Tabbable descendants of the catalog drawer. This follows the NavRail drawer precedent but
// excludes tabindex="-1" from every branch, not only the [tabindex] one: the catalog's own
// per-examination selection control is deliberately kept out of the Tab order, and matching it
// here would make it the trap's last element - a boundary Tab never actually reaches, letting
// focus escape the drawer. NavRail's selector is safe only because its drawer has no such nodes.
const CATALOG_DRAWER_FOCUSABLE =
  'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

/**
 * True for a target where the browser already owns the arrow keys.
 *
 * Ctrl/Cmd+Arrow is the platform word-jump inside a text field, so the report-switch
 * shortcut must not consume it there. Deliberately scoped to the arrow bindings only:
 * Ctrl/Cmd+S and Ctrl/Cmd+Enter keep their existing suppression rules unchanged.
 * `isContentEditable` is used rather than a `[contenteditable]` ancestor lookup because
 * it reflects inherited editability and correctly rejects `contenteditable="false"`.
 */
function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  return target.isContentEditable;
}

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

/** A Manual -> Auto request awaiting confirmation, scoped to the report it came from. */
type PendingModeChange = { templateCode: string; parameterCode: string; parameterName: string };

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
  initialPersonnel?: WorkspacePersonnelEntry[];
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

  const [availablePersonnel, setAvailablePersonnel] = useState<WorkspacePersonnelEntry[]>(
    () => initialPersonnel ?? []
  );
  /**
   * Render-only signature addresses, derived here rather than received.
   *
   * Each value is `/api/signatures/proxy?personnelId=<id>` - an opaque authenticated endpoint
   * address built from an id this component already holds. The stored `signatureImageUrl`, which
   * embeds the storage object path, never crosses the boundary in any form.
   *
   * Only active Pathologists with a signature on file get an entry: a Medical Technologist slot
   * is hard-nulled by `composeSignatorySlots`, so an address there could never be drawn, and an
   * entry for someone without a signature would only produce a 404 the renderer then omits.
   *
   * Nothing merges this into `session`, writes it to recovery, or sends it to a server action.
   * It reaches exactly one consumer, below.
   */
  const signatureAssets = useMemo<WorkspaceSignatureAssetMap>(() => {
    const assets: Record<string, string> = {};
    for (const person of availablePersonnel) {
      if (person.role === "Pathologist" && person.isActive && person.hasSignature) {
        assets[person.id] = `/api/signatures/proxy?personnelId=${encodeURIComponent(person.id)}`;
      }
    }
    return assets;
  }, [availablePersonnel]);

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
  // The focus target above is consumed and cleared the moment focus lands, so the summary
  // keeps its own copy to decide whether it can offer a route back to that exact field.
  // Only the two targets the Workspace actually proves are ever recorded here.
  const [validationFieldTarget, setValidationFieldTarget] = useState<"patient-full-name" | "patient-sex" | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<WorkspaceConfirmation | null>(null);
  const [pendingModeChange, setPendingModeChange] = useState<PendingModeChange | null>(null);
  const [isMobileCatalogOpen, setIsMobileCatalogOpen] = useState<boolean>(false);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [exitDestination, setExitDestination] = useState<string>("/dashboard");
  const [isReplacementMode, setIsReplacementMode] = useState<boolean>(false);
  const [reopenStatus, setReopenStatus] = useState<"idle" | "loading" | "ready" | "failed">(
    reopenSessionId ? "loading" : "idle"
  );
  const [reopenError, setReopenError] = useState<string | null>(null);
  const submissionInFlightRef = useRef(false);
  const [isCatalogCollapsed, setIsCatalogCollapsed] = useState(false);
  const catalogRailToggleRef = useRef<HTMLButtonElement>(null);
  const catalogCollapseToggleRef = useRef<HTMLButtonElement>(null);
  // Focus intent is recorded by the click itself, never inferred from render count. A mount-count
  // guard cannot express this: Strict Mode replays effects, so the guard is already spent on the
  // replay and the catalog steals focus on load. An intent that only a real activation can set is
  // null on every mount and every replay, so neither can focus anything.
  const catalogFocusIntentRef = useRef<"collapsed" | "expanded" | null>(null);
  const [isDemographicsExpanded, setIsDemographicsExpanded] = useState(true);
  const hasAutoCollapsedDemographicsRef = useRef(false);
  const catalogToggleRef = useRef<HTMLButtonElement>(null);
  const catalogDrawerRef = useRef<HTMLDivElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);

  // The catalog drawer only exists inside Encoding. Deriving its open state here rather
  // than reading isMobileCatalogOpen directly keeps the dialog semantics, the focus trap
  // and the shortcut suppression from ever disagreeing with what is actually on screen.
  const isCatalogDrawerOpen = isMobileCatalogOpen && workspaceMode === "encoding";

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

  // The safe dismissal for the unsaved-changes dialog. Escape, the backdrop and the
  // close control all resolve here, so no dismissal path can discard or persist work.
  const handleContinueEditing = useCallback(() => {
    setShowExitModal(false);
  }, []);

  const handleCloseCatalogDrawer = useCallback(() => {
    setIsMobileCatalogOpen(false);
  }, []);

  // Dialog behaviour for the catalog drawer, following the NavRail drawer precedent:
  // initial focus inside the panel, Tab/Shift+Tab contained, Escape dismisses, and focus
  // returns to the toggle on close. The drawer keeps its own presentation, so it does not
  // route through the shared centred Modal.
  useEffect(() => {
    if (!isCatalogDrawerOpen) return;

    const catalogToggle = catalogToggleRef.current;
    const drawer = catalogDrawerRef.current;
    drawer?.querySelectorAll<HTMLElement>(CATALOG_DRAWER_FOCUSABLE)[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCloseCatalogDrawer();
        return;
      }

      if (event.key !== "Tab" || !drawer) return;

      const focusableElements = Array.from(
        drawer.querySelectorAll<HTMLElement>(CATALOG_DRAWER_FOCUSABLE)
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      catalogToggle?.focus();
    };
  }, [handleCloseCatalogDrawer, isCatalogDrawerOpen]);

  const handleCollapseCatalog = useCallback(() => {
    catalogFocusIntentRef.current = "collapsed";
    setIsCatalogCollapsed(true);
  }, []);

  const handleExpandCatalog = useCallback(() => {
    catalogFocusIntentRef.current = "expanded";
    setIsCatalogCollapsed(false);
  }, []);

  // Collapsing hides the control that was just activated and expanding unmounts it, so without a
  // handoff the keyboard operator is dropped onto document.body mid-task. Focus moves to whichever
  // control is now on screen, and only ever after a real activation: the intent is consumed here,
  // so a Strict Mode replay of this effect finds nothing to act on.
  useEffect(() => {
    const intent = catalogFocusIntentRef.current;
    if (!intent) return;
    catalogFocusIntentRef.current = null;
    if (intent === "collapsed") catalogRailToggleRef.current?.focus();
    else catalogCollapseToggleRef.current?.focus();
  }, [isCatalogCollapsed]);

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
    listWorkspacePersonnelAction()
      .then((directory) => {
        setAvailablePersonnel(directory.personnel);
      })
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
    setValidationFieldTarget(target);
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

  // Session-level encoding progress. The completion rule itself lives in encoding-progress.ts and
  // is the same one the per-report meter draws, so the two can never disagree. Only the pairing is
  // done here, from state the Workspace already holds: a selected examination whose report is not
  // built yet, or whose definition does not resolve, stays in the denominator and counts as
  // incomplete rather than silently shrinking the total.
  const sessionProgress = useMemo(
    () =>
      getSessionEncodingProgress(
        selectedSpecs.map((spec) => ({
          report: session.reports.find((item) => item.templateCode === spec.template.templateCode),
          definition: ReportDefinitionRegistry.getDefinition(spec.template.templateCode),
        }))
      ),
    [selectedSpecs, session.reports]
  );

  // Presentation trigger only. It reuses the aggregate's own demographic rule instead of
  // restating one here, so the collapse condition can never drift into a private definition of
  // "valid". That rule is exposed as a throwing validator, so the predicate reads it that way.
  const areDemographicsValid = useMemo(() => {
    try {
      session.validateDemographics();
      return true;
    } catch {
      return false;
    }
  }, [session]);

  // Collapse once, the first time the required demographics are satisfied - including on load for
  // a draft that already carries them. After that the operator owns the state through Edit, and
  // the Workspace only ever forces it back open.
  useEffect(() => {
    if (hasAutoCollapsedDemographicsRef.current || !areDemographicsValid) return;
    hasAutoCollapsedDemographicsRef.current = true;
    setIsDemographicsExpanded(false);
  }, [areDemographicsValid]);

  // A validation failure must never be reported against a field the operator cannot see. This
  // keys on any workspace validation error rather than only the two that carry a focus target:
  // the completion service rejects demographics this component never focuses - a non-positive age
  // among them - and erring toward revealing a clinical input is the safe direction.
  useEffect(() => {
    if (validationError) setIsDemographicsExpanded(true);
  }, [validationError]);
  // Display-only per-report progress for the tab strip. It reuses the same
  // getReportEncodingProgress rule the report card draws, so the two can never disagree,
  // and a template whose report or definition is missing simply carries no annotation
  // rather than being dropped from the queue.
  const progressByTemplateCode = useMemo(() => {
    const map: Record<string, { completedCount: number; selectedCount: number; isComplete: boolean }> = {};
    for (const spec of selectedSpecs) {
      const code = spec.template.templateCode;
      const report = session.reports.find((item) => item.templateCode === code);
      const definition = ReportDefinitionRegistry.getDefinition(code);
      if (!report || !definition) continue;
      const progress = getReportEncodingProgress(report, definition);
      map[code] = {
        completedCount: progress.completedCount,
        selectedCount: progress.selectedCount,
        isComplete: progress.isComplete,
      };
    }
    return map;
  }, [selectedSpecs, session.reports]);

  const activeReport = activeTemplateCode ? session.reports.find((r) => r.templateCode === activeTemplateCode) : undefined;
  const activeDefinition = activeTemplateCode ? ReportDefinitionRegistry.getDefinition(activeTemplateCode) : null;
  const isWorkspaceDialogOpen = showExitModal || pendingConfirmation !== null || pendingModeChange !== null;
  // The catalog drawer is a modal surface too, so workspace shortcuts stay suppressed while
  // it is open. Kept separate from isWorkspaceDialogOpen, which additionally governs the
  // navigation interceptor: the drawer must not change how link navigation is guarded.
  const areWorkspaceShortcutsSuppressed = isWorkspaceDialogOpen || isCatalogDrawerOpen;

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

  // Manual -> Auto discards an operator-entered clinical result, so it is confirmed. The pending
  // request carries its own template code: a report switch or removal must never let a confirmation
  // land on a different report than the one the operator was looking at.
  const handleRequestManualToAuto = useCallback(
    (templateCode: string, parameterCode: string, parameterName: string) => {
      setPendingModeChange({ templateCode, parameterCode, parameterName });
    },
    []
  );

  const handleCancelModeChange = useCallback(() => {
    setPendingModeChange(null);
  }, []);

  const handleConfirmModeChange = useCallback(() => {
    const pending = pendingModeChange;
    setPendingModeChange(null);
    if (!pending || pending.templateCode !== activeTemplateCode) return;
    const definition = ReportDefinitionRegistry.getDefinition(pending.templateCode);
    const report = session.reports.find((item) => item.templateCode === pending.templateCode);
    if (!definition || !report) return;
    handleReportChange(
      applyCalculationMode(report, definition, pending.parameterCode, "Auto", {
        sex: session.demographics.sex || null,
      })
    );
  }, [activeTemplateCode, handleReportChange, pendingModeChange, session.demographics.sex, session.reports]);

  useEffect(() => {
    setPendingModeChange((pending) => {
      if (!pending) return pending;
      const stillAddressable =
        pending.templateCode === activeTemplateCode &&
        session.reports.some((item) => item.templateCode === pending.templateCode);
      return stillAddressable ? pending : null;
    });
  }, [activeTemplateCode, session.reports]);

  const handleCancelConfirmation = useCallback(() => {
    setPendingConfirmation(null);
  }, []);

  const handleConfirmClearAll = useCallback(() => {
    handleClearAllTemplates();
    setPendingConfirmation(null);
  }, [handleClearAllTemplates]);

  useEffect(() => {
    const handleWorkspaceShortcut = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.defaultPrevented || areWorkspaceShortcutsSuppressed) return;
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
      // Arrow bindings only: inside a text field Ctrl/Cmd+Arrow is the platform
      // word-jump, and switching reports out from under the caret would lose it.
      if (isEditableShortcutTarget(event.target)) return;
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
  }, [activeTemplateCode, areWorkspaceShortcutsSuppressed, handleSaveDraft, isDirty, isReplacementMode, requestCompleteConfirmation, requestReplaceConfirmation, saveStatus, selectedSpecs, session.status]);

  // A reopen request must resolve before the workspace is usable. Rendering the blank
  // new-session workspace after a failed load would invite encoding into a different
  // session than the one requested.
  if (reopenStatus === "loading" || reopenStatus === "failed") {
    return (
      <div className="h-full min-h-0 w-full flex items-center justify-center bg-brand-canvas p-4">
        {/* Both branches announce themselves: the reopen can outlast the spinner's
            usefulness, and under reduced motion the spinner does not turn at all, so the
            words have to carry the state. */}
        <div
          role={reopenStatus === "failed" ? "alert" : "status"}
          aria-live={reopenStatus === "failed" ? "assertive" : "polite"}
          className="w-full max-w-md space-y-4 rounded-lg border border-brand-card-border bg-brand-card p-6 text-center"
        >
          {reopenStatus === "loading" ? (
            <>
              <div className="mx-auto w-fit rounded-full bg-brand-tint p-2.5 text-brand-primary">
                <RefreshCw aria-hidden="true" className="h-6 w-6 animate-spin" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-brand-text">Reopening Session</h2>
                <p className="mt-1 text-xs text-brand-text-muted">
                  Loading the saved patient report session from the laboratory record.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto w-fit rounded-full bg-brand-danger-bg p-2.5 text-brand-danger">
                <AlertCircle aria-hidden="true" className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-brand-text">Session Could Not Be Reopened</h2>
                <p className="mt-1 text-xs text-brand-text-muted">
                  {reopenError ?? "This session could not be reopened."}
                </p>
              </div>
              {/* Both routes out were hand-rolled buttons with no focus ring at all - on a
                  screen a keyboard operator can be dropped onto, with nothing else to
                  focus. They are shared Buttons now. */}
              <div className="flex flex-col gap-2 border-t border-brand-border-subtle pt-3">
                <Button type="button" variant="primary" onClick={() => router.push("/history")} className="w-full">
                  <History aria-hidden="true" className="h-4 w-4" />
                  Return to Session History
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/dashboard")} className="w-full">
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  Return to Dashboard
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 w-full overflow-hidden flex flex-col bg-brand-canvas">
      {/* Fixed Workspace command bar. One 56px line: navigation, then session identity, then
          the mode switch and the session actions. The patient leads because that is the context
          every decision in this screen is made against; accession, status and Replacement Mode
          sit under the name as metadata rather than as three competing pills above it. */}
      {/* Structural. The command bar is chrome, and a white bar above a white report card
          on a white catalog gave the Workspace no frame at all - the operator could not see
          where the application ended and the task began. */}
      <header className="z-30 flex h-14 shrink-0 items-center border-b border-brand-border-strong bg-brand-structural px-4">
        <div className={`${WORKSPACE_CONTAINER} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2 min-w-0">
            {/* Back to Dashboard Navigation Button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBackToDashboard}
              aria-label="Back to Dashboard"
              title="Return to Dashboard"
              className="shrink-0 whitespace-nowrap px-2 text-brand-text-muted"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span className="hidden md:inline">Back</span>
            </Button>

            {/* Mobile Catalog Drawer Button */}
            <button
              ref={catalogToggleRef}
              type="button"
              onClick={() => setIsMobileCatalogOpen(!isMobileCatalogOpen)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-brand-text-muted transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring lg:hidden"
              aria-label="Toggle Catalog"
              aria-expanded={isCatalogDrawerOpen}
              aria-controls="workspace-catalog-drawer"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </button>

            <span aria-hidden="true" className="hidden h-7 w-px shrink-0 bg-brand-border-strong sm:block" />

            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-tight text-brand-text">
                {session.demographics.fullName || "New Patient Visit Session"}
              </h1>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-none">
                <span className="shrink-0 font-mono font-semibold text-brand-text-muted" title={session.accessionNumber === null ? "Accession not assigned" : undefined}>
                  {session.accessionNumber ?? "Not assigned"}
                </span>
                <span aria-hidden="true" className="shrink-0 text-brand-text-subtle">/</span>
                <span
                  className={`shrink-0 font-semibold uppercase tracking-wide ${
                    session.status === "Completed" ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {session.status}
                </span>
                {isReplacementMode && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
                    <RefreshCw aria-hidden="true" className="h-3 w-3" />
                    <span className="hidden sm:inline">Replacement Mode</span>
                    <span className="sm:hidden">Replacement</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Session actions: mode switch, then the secondary save, then the primary action.
              Below sm the labels collapse to icon-only. Every control here is shrink-0 and
              whitespace-nowrap, so at 390px the full labels forced the header past the viewport
              and scrolled the whole page sideways. No action is hidden: each keeps its icon, an
              aria-label carrying the full name in both states, and a title for pointer users. */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Workspace View Mode Switcher. A two-state control, so each button reports its own
                pressed state and keeps a full accessible name when the label collapses. */}
            <div role="group" aria-label="Workspace view mode" className="flex shrink-0 items-center rounded-md bg-brand-surface-hover p-0.5">
              <button
                type="button"
                onClick={() => setWorkspaceMode("encoding")}
                aria-pressed={workspaceMode === "encoding"}
                aria-label="Encoding"
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring ${
                  workspaceMode === "encoding"
                    ? "bg-brand-card text-brand-text shadow-sm ring-1 ring-brand-card-border"
                    : "text-brand-text-muted hover:text-brand-text"
                }`}
              >
                <Edit3 aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Encoding</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode("preview")}
                aria-pressed={workspaceMode === "preview"}
                aria-label="Live Preview"
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring ${
                  workspaceMode === "preview"
                    ? "bg-brand-card text-brand-text shadow-sm ring-1 ring-brand-card-border"
                    : "text-brand-text-muted hover:text-brand-text"
                }`}
              >
                <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Live Preview</span>
              </button>
            </div>

            <span aria-hidden="true" className="hidden h-7 w-px shrink-0 bg-brand-border-strong sm:block" />

            {/* Save Draft Action — a completed session under replacement has no draft path */}
            {!isReplacementMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={saveStatus === "saving" || !isDirty}
                aria-keyshortcuts="Control+S Meta+S"
                aria-label={saveStatus === "saving" ? "Saving..." : "Save Draft"}
                title={saveStatus === "saving" ? "Saving..." : "Save Draft"}
                className="shrink-0 whitespace-nowrap px-2 sm:px-3"
              >
                <Save aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {saveStatus === "saving" ? "Saving..." : "Save Draft"}
                </span>
              </Button>
            )}

            {/* Replace Completed Report Action. Kept hand-styled rather than routed through
                Button: amber is this action's established meaning and no Button variant carries
                it. Geometry matches size="sm" so it sits on the same baseline as its neighbours. */}
            {isReplacementMode && (
              <button
                type="button"
                onClick={requestReplaceConfirmation}
                disabled={saveStatus === "saving"}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                aria-label={saveStatus === "saving" ? "Replacing..." : "Replace Completed Report"}
                title={saveStatus === "saving" ? "Replacing..." : "Replace Completed Report"}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-600 px-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-50 sm:px-3"
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {saveStatus === "saving" ? "Replacing..." : "Replace Completed Report"}
                </span>
              </button>
            )}

            {/* Complete Session Action */}
            {session.status !== "Completed" && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={requestCompleteConfirmation}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                aria-label="Complete Session"
                title="Complete Session"
                className="shrink-0 whitespace-nowrap px-2 sm:px-3"
              >
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Complete Session</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Replacement Mode Notice */}
      {isReplacementMode && (
        <div className={`${WORKSPACE_CONTAINER} px-4 mt-2 shrink-0`}>
          {/* The shared Alert rather than a bespoke amber box: warning already means this,
              and Alert carries the icon, the role="alert" urgency and the wrapping rules. */}
          <Alert variant="warning" title="Replacement Mode">
            Saving replaces the completed report for accession {session.accessionNumber}{" "}
            permanently. The previous content is not recoverable, and the accession number is
            not changed.
          </Alert>
        </div>
      )}

      {/* Validation summary. The message string is the existing one, unchanged; the heading
          and the route-to-field control are presentation around it. The control appears only
          for the two targets the Workspace genuinely resolves - nothing is parsed out of the
          message text, and no target is invented for an error that does not carry one. */}
      {validationError && (
        <div className={`${WORKSPACE_CONTAINER} px-4 mt-2 shrink-0`}>
          <Alert
            variant="destructive"
            title="Review required information"
            onDismiss={() => {
              setValidationError(null);
              setValidationFieldTarget(null);
            }}
            dismissLabel="Dismiss validation summary"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0">{validationError}</span>
              {validationFieldTarget && (
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceMode("encoding");
                    setValidationFocusTarget(validationFieldTarget);
                  }}
                  className="inline-flex min-h-7 shrink-0 items-center rounded-md border border-current px-2 text-[11px] font-semibold underline-offset-2 transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                >
                  {validationFieldTarget === "patient-full-name" ? "Go to Patient Full Name" : "Go to Sex"}
                </button>
              )}
            </div>
          </Alert>
        </div>
      )}

      {/* Main Workspace Dual-Pane Independent Scroll Layout */}
      <main className={`flex-1 overflow-hidden p-3 sm:px-4 sm:py-3 xl:px-6 ${WORKSPACE_CONTAINER}`}>
        {workspaceMode === "encoding" ? (
          <div className="h-full flex flex-col lg:flex-row gap-3 items-stretch overflow-hidden">
            {/* Desktop Left Sidebar: 280px expanded, 48px rail collapsed. The catalog itself is
                never unmounted - only hidden - so search text, expanded families, selections and
                the active examination all survive a collapse/expand round trip. The state is
                deliberately local and non-persistent, and the mobile drawer below never uses it. */}
            <div
              className={cn(
                "hidden lg:flex shrink-0 h-full flex-col overflow-hidden transition-[width] duration-200 motion-reduce:transition-none",
                isCatalogCollapsed ? "w-12" : "w-[280px]"
              )}
            >
              {isCatalogCollapsed && (
                <div className="flex h-full flex-col items-center gap-2.5 rounded-lg border border-brand-card-border bg-brand-card py-2">
                  <button
                    type="button"
                    ref={catalogRailToggleRef}
                    onClick={handleExpandCatalog}
                    aria-label="Expand examination catalog"
                    aria-expanded={false}
                    aria-controls="workspace-desktop-catalog"
                    title="Expand examination catalog"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-brand-card-border bg-brand-card text-brand-text-muted transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
                  >
                    <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />
                  </button>
                  {selectedTemplateCodes.length > 0 && (
                    <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-brand-tint px-1 text-[11px] font-semibold tabular-nums text-brand-primary">
                      {selectedTemplateCodes.length}
                    </span>
                  )}
                  <span aria-hidden="true" className="[writing-mode:vertical-rl] select-none text-[11px] font-semibold uppercase tracking-widest text-brand-text-subtle">
                    Catalog
                  </span>
                </div>
              )}
              <div id="workspace-desktop-catalog" className={cn("h-full min-h-0", isCatalogCollapsed && "hidden")}>
                <ExaminationCatalog
                  allTemplates={allActiveTemplates}
                  selectedTemplateCodes={selectedTemplateCodes}
                  activeTemplateCode={activeTemplateCode}
                  onSelectTemplate={setActiveTemplateCode}
                  onToggleTemplateSelection={handleToggleTemplateSelection}
                  onCollapse={handleCollapseCatalog}
                  catalogRegionId="workspace-desktop-catalog"
                  collapseControlRef={catalogCollapseToggleRef}
                />
              </div>
            </div>

            {/* Mobile/Tablet Catalog Overlay Drawer */}
            {isCatalogDrawerOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-slate-900/60 motion-safe:transition-opacity lg:hidden"
                  onClick={handleCloseCatalogDrawer}
                  aria-hidden="true"
                />
                {/* Drawer shell only. The catalog is the content and carries its own heading, so
                    the shell prints no title of its own - two stacked titles for one panel read as
                    a nested card. The close control stays the first focusable node, which is what
                    the focus trap places initial focus on. */}
                <div
                  ref={catalogDrawerRef}
                  id="workspace-catalog-drawer"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Examination Catalog"
                  className="fixed inset-y-0 left-0 z-50 flex w-[min(22rem,88vw)] max-w-full flex-col overflow-hidden border-r border-brand-card-border bg-brand-background lg:hidden"
                >
                  <div className="flex shrink-0 items-center justify-end border-b border-brand-card-border bg-brand-card px-2 py-1.5">
                    <button
                      type="button"
                      onClick={handleCloseCatalogDrawer}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-brand-text-muted transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
                      aria-label="Close Examination Catalog"
                    >
                      <X aria-hidden="true" className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 p-2">
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
              </>
            )}

            {/* Main Encoding Workspace Panel: Expanded horizontal area (~78-80% width) Independently Scrollable */}
            <div className="flex-1 min-w-0 h-full overflow-y-auto pr-1 space-y-2.5 scroll-pt-16 scroll-pb-16">
              {/* Patient Demographics Header Card */}
              <PatientDemographicsForm
                isExpanded={isDemographicsExpanded}
                onToggleExpanded={setIsDemographicsExpanded}
                invalidFieldId={validationError ? validationFieldTarget : null}
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
              {/* Clinical context rail: the reference-range context and session progress the
                  operator must not lose while scrolling, then the report tabs. Solid white and
                  unblurred so scrolled result rows never show through and reduce legibility. */}
              {/* Structural, and deliberately so: this rail carries context ABOUT the work
                  (patient, session progress, which report is active), never the work itself.
                  Tinting it is what lets the active tab lift onto the white working surface
                  and read as selected without a heavier border. */}
              <div className="sticky top-0 z-20 flex items-end gap-2.5 rounded-lg border border-brand-card-border bg-brand-structural px-3 py-1.5 shadow-low">
                {session.demographics.sex && session.demographics.age > 0 && (
                  <span
                    className="hidden shrink-0 items-center gap-1.5 pb-1.5 font-mono text-[11px] font-semibold text-brand-text-muted sm:inline-flex"
                    title="Patient sex and age determine the sex-specific reference ranges applied while encoding"
                  >
                    <User aria-hidden="true" className="h-3.5 w-3.5 text-brand-primary" />
                    {session.demographics.sex}, {session.demographics.age} y/o
                  </span>
                )}
                {sessionProgress.totalReports > 0 && (
                  <span
                    data-session-progress
                    className="hidden shrink-0 items-center gap-1.5 pb-1.5 text-[11px] font-medium text-brand-text-muted sm:inline-flex"
                    title="Reports in this session with every selected result encoded"
                  >
                    <CheckCircle2
                      aria-hidden="true"
                      className={
                        sessionProgress.completedReports === sessionProgress.totalReports
                          ? "h-3.5 w-3.5 text-emerald-600"
                          : "h-3.5 w-3.5 text-brand-text-subtle"
                      }
                    />
                    {`${sessionProgress.completedReports} of ${sessionProgress.totalReports} report${sessionProgress.totalReports === 1 ? "" : "s"} complete`}
                  </span>
                )}
                {/* One restrained rule instead of a second row of pills: it separates the
                    session context from the report tabs and disappears when neither meta item
                    is on screen. */}
                {(sessionProgress.totalReports > 0 || (session.demographics.sex && session.demographics.age > 0)) && (
                  <span aria-hidden="true" className="hidden h-6 w-px shrink-0 self-center bg-brand-border-strong sm:block" />
                )}
                <SelectedReportsPanel
                  selectedSpecs={selectedSpecs}
                  activeTemplateCode={activeTemplateCode}
                  onSelectActiveTemplate={setActiveTemplateCode}
                  onRemoveTemplate={handleRemoveTemplate}
                  onCloseOtherTemplates={handleCloseOtherTemplates}
                  onClearAllTemplates={() => setPendingConfirmation("clearAll")}
                  isDirty={isDirty}
                  progressByTemplateCode={progressByTemplateCode}
                />
              </div>

              {/* Dynamic Result Form Dispatcher */}
              {activeSpec && activeDefinition && activeReport && selectedSpecs.length > 0 ? (
                // One tabpanel per report, owning the results AND the footer. The strip's
                // aria-controls points here, so a screen-reader user moving by tabpanel reaches
                // signatories, remarks and kit information instead of stopping at the grid.
                <div
                  id={`report-panel-${activeDefinition.templateCode}`}
                  role="tabpanel"
                  aria-labelledby={`report-tab-${activeDefinition.templateCode}`}
                  data-encoding-report={activeDefinition.templateCode}
                  className="flex min-w-0 flex-col"
                >
                  <DynamicResultForm
                    definition={activeDefinition}
                    report={activeReport}
                    patientSex={session.demographics.sex || null}
                    onChangeReport={handleReportChange}
                    onRequestManualToAuto={handleRequestManualToAuto}
                  />
                  {/* Docked as a sibling of the report card, not inside it: the card clips with
                      overflow-hidden, and a sticky descendant of a clipping ancestor never sticks. */}
                  <EncodingReportFooter
                    spec={activeSpec}
                    definition={activeDefinition}
                    report={activeReport}
                    availablePersonnel={availablePersonnel}
                    onChangeReport={handleReportChange}
                  />
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No examination selected"
                  description="Choose a laboratory examination from the catalog to begin encoding patient results."
                  headingLevel={2}
                  className="my-3 rounded-lg border border-brand-card-border bg-brand-card"
                />
              )}
            </div>
          </div>
        ) : (
          /* Live Preview. The engine owns its own toolbar and its viewport is the single
             vertical scrolling region, so this wrapper adds no card frame, no second header
             and no duplicate mode switch - the command bar already carries that control. */
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <SharedRenderingEngine
              session={session}
              targetOutput="ScreenPreview"
              signatureAssets={signatureAssets}
            />
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

      <ConfirmDialog
        isOpen={pendingModeChange !== null}
        onCancel={handleCancelModeChange}
        onConfirm={handleConfirmModeChange}
        title={`Switch ${pendingModeChange?.parameterName ?? ""} to Auto?`}
        description={`The manually entered ${pendingModeChange?.parameterName ?? ""} result will be replaced by an automatically calculated value.`}
        confirmLabel="Use Auto"
        cancelLabel="Keep Manual"
      />

      {/* Unsaved Changes Exit Confirmation Modal */}
      <Modal
        isOpen={showExitModal}
        onClose={handleContinueEditing}
        title="Unsaved Changes in Workspace"
        description="You have unsaved changes in this visit session. What would you like to do before exiting?"
        role="alertdialog"
        initialFocusRef={continueEditingRef}
        closeLabel="Continue editing"
        className="max-w-md"
      >
        {/* One column at every width, order unchanged. The two exit paths are grouped and the
            stay-here path is separated by a rule, so the choice reads as leave-or-stay instead of
            three equal buttons. Variants are untouched: Discard stays an outline, never a solid
            danger button, so the destructive path is never the loudest thing in the dialog. */}
        <div className="flex flex-col gap-2">
          {!isReplacementMode && (
            <Button
              type="button"
              variant="primary"
              onClick={handleSaveDraftAndExit}
              disabled={saveStatus === "saving"}
              className="w-full justify-start gap-2.5"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save Draft & Exit
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleDiscardAndExit}
            disabled={saveStatus === "saving"}
            className="w-full justify-start gap-2.5"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Discard Changes & Exit
          </Button>

          <div className="mt-1 border-t border-brand-border-subtle pt-2">
            <Button
              ref={continueEditingRef}
              type="button"
              variant="ghost"
              onClick={handleContinueEditing}
              className="w-full justify-start gap-2.5"
            >
              Continue Editing
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
