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
import { listWorkspacePersonnelAction } from "../_actions/workspace-personnel-actions";
import { PatientDemographics, PatientSex, PatientStatus } from "@/domain/types";
import { PatientDemographicsForm } from "./PatientDemographicsForm";
import { DynamicResultForm } from "./DynamicResultForm";
import { EncodingReportFooter } from "./EncodingReportFooter";
import { ExaminationCatalog } from "./ExaminationCatalog";
import { SelectedReportsPanel, WorkQueueTrigger, type ReportTabProgress } from "./SelectedReportsPanel";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
import { Save, CheckCircle2, AlertCircle, FileText, FlaskConical, Eye, Edit3, X, ArrowLeft, LogOut, Plus, RefreshCw, History } from "lucide-react";
import { suggestedSignatoryProvider } from "@/services/suggested-signatory-provider";
import { ReportDefinitionRegistry } from "@/domain/definitions/report-definition-registry";
import { applyCalculationMode, buildEncodingReport, reevaluateEncodingReport } from "../_lib/encoding/report-encoding";
import { getReportEncodingProgress, getSessionEncodingProgress } from "../_lib/encoding/encoding-progress";
import { initializeNewSessionAddress } from "../_lib/encoding/new-session-demographics";
import {
  clearWorkspaceRecovery,
  loadWorkspaceRecovery,
  saveWorkspaceRecovery,
} from "@/features/workspace/workspace-recovery";
import { useWorkspaceNavigationInterceptor } from "../../_components/workspace-navigation-guard";

// Shared workspace container: fluid width with a readability cap (UX2-A).
const WORKSPACE_CONTAINER = "w-full max-w-[1680px] mx-auto";

// Tabbable descendants of the catalog drawer. This follows the NavRail drawer precedent but
// excludes tabindex="-1" from every branch, not only the [tabindex] one: the catalog's own
// per-examination selection control is deliberately kept out of the Tab order, and matching it
// here would make it the trap's last element - a boundary Tab never actually reaches, letting
// focus escape the drawer. NavRail's selector is safe only because its drawer has no such nodes.
const CATALOG_DRAWER_FOCUSABLE =
  'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

/** The width at which the work queue can be docked as a column instead of opened as a drawer. */
const QUEUE_DOCK_QUERY = "(min-width: 1152px)";

/**
 * The modal-drawer contract, in one place, for the two drawers this Workspace owns.
 *
 * Both need identical behaviour and the two of them would otherwise be fifty near-identical
 * lines each - the shape in which a trap quietly drifts out of agreement with itself. It follows
 * the established shell precedent exactly: initial focus inside the panel, Tab and Shift+Tab
 * contained with recovery when focus has escaped, Escape dismisses, the page behind is
 * scroll-locked from its *captured* previous value rather than an assumed one, and focus returns
 * to the trigger on every close route.
 *
 * `retireQuery` names the width at which the drawer stops being a drawer. It is **read before it
 * is subscribed to**: subscribing alone leaves an already-wide viewport holding the lock, the
 * inert background and the trap forever, because no `change` event will ever fire.
 */
function useWorkspaceModalDrawer({
  isOpen,
  panelRef,
  triggerRef,
  onClose,
  retireQuery,
  retireFocusRef,
}: {
  isOpen: boolean;
  panelRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  /** Omit for a drawer that is the only route to its content at every width. */
  retireQuery?: string;
  /**
   * Where focus goes when `retireQuery` is what closed the drawer.
   *
   * The trigger is the right destination for every close the operator asked for, but not for
   * this one: the same breakpoint that retires the drawer also hides the trigger, so restoring
   * to it would call focus() on a `display:none` element and drop the operator on
   * document.body. This names the surface that replaced the drawer instead.
   */
  retireFocusRef?: React.RefObject<HTMLElement | null>;
}): void {
  // onClose is an inline arrow at most call sites, so it changes identity every render. Holding
  // it in a ref keeps this effect from tearing down and rebuilding the trap on each render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const panel = panelRef.current;
    const returnTo = triggerRef.current;

    let mediaQuery: MediaQueryList | null = null;
    let handleBreakpointChange: ((event: MediaQueryListEvent) => void) | null = null;
    // Scoped to this open/close cycle rather than a ref, so it cannot leak into the next one.
    let retiredByBreakpoint = false;
    if (retireQuery) {
      mediaQuery = window.matchMedia(retireQuery);
      if (mediaQuery.matches) {
        onCloseRef.current();
        // Retired before it ever opened at this width, so this effect registers no cleanup and
        // the restoration below never runs. The breakpoint that put us here has already hidden
        // the trigger, and a browser drops focus to the body when the element holding it becomes
        // display:none - so if the trigger was the thing focused, focus is orphaned right now.
        //
        // Repair only that. An orphaned body focus is handed to the docked queue that replaced
        // the drawer; anything else holding focus - the mode switch, a control the operator has
        // since moved to - is left exactly where it is, because stealing focus on a resize would
        // be worse than the problem being fixed.
        if (!document.activeElement || document.activeElement === document.body) {
          retireFocusRef?.current?.focus();
        }
        return;
      }
      handleBreakpointChange = (event: MediaQueryListEvent) => {
        if (!event.matches) return;
        // Recorded before the close so the cleanup below can tell this apart from Escape, the
        // backdrop, or a selection - the only close whose trigger is about to be hidden.
        retiredByBreakpoint = true;
        onCloseRef.current();
      };
      mediaQuery.addEventListener("change", handleBreakpointChange);
    }

    panel?.querySelectorAll<HTMLElement>(CATALOG_DRAWER_FOCUSABLE)[0]?.focus();

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(CATALOG_DRAWER_FOCUSABLE));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }

      // Recover focus that is somehow outside the panel - a programmatic focus() elsewhere, or a
      // control removed mid-interaction - rather than letting Tab continue from wherever it
      // landed in the obscured page.
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (mediaQuery && handleBreakpointChange) {
        mediaQuery.removeEventListener("change", handleBreakpointChange);
      }
      document.body.style.overflow = previousBodyOverflow;
      // The inert attribute is already off the background by the time a passive effect cleanup
      // runs, so the destination is focusable again here.
      //
      // Which destination depends on WHY the drawer closed. Escape, the backdrop, the close
      // control and a selection all return to the trigger the operator came from. A breakpoint
      // retirement cannot: crossing that width hides the trigger in the same paint, so focusing
      // it would silently land on nothing. That path goes to the surface that replaced the
      // drawer, and only falls back to the trigger when no such surface was supplied.
      const retireTarget = retiredByBreakpoint ? retireFocusRef?.current ?? null : null;
      (retireTarget ?? returnTo)?.focus();
    };
  }, [isOpen, panelRef, triggerRef, retireQuery, retireFocusRef]);
}

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
  const [isDemographicsExpanded, setIsDemographicsExpanded] = useState(true);
  const hasAutoCollapsedDemographicsRef = useRef(false);
  const catalogToggleRef = useRef<HTMLButtonElement>(null);
  const catalogDrawerRef = useRef<HTMLDivElement>(null);
  const fullCatalogRef = useRef<HTMLDivElement>(null);
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState<boolean>(false);
  const queueToggleRef = useRef<HTMLButtonElement>(null);
  const queueDrawerRef = useRef<HTMLDivElement>(null);
  // The docked queue column, which is what the drawer becomes at QUEUE_DOCK_QUERY. It is the
  // focus destination when the breakpoint - rather than the operator - closes the drawer.
  const dockedQueueRef = useRef<HTMLDivElement>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);

  /**
   * The zero-selected state, derived and never stored.
   *
   * A session with nothing selected has one job - choose examinations - so the catalog is the
   * whole task surface rather than a column beside an empty desk. Deriving it means it is reached
   * identically whether the session is new, the last examination was removed from the queue,
   * "Close Other" left nothing, or "Clear All" ran; a stored flag would have four places to be
   * set and one to be forgotten.
   */
  const hasSelection = selectedTemplateCodes.length > 0;

  // Both drawers exist only inside Encoding, and only once something is selected: with an empty
  // session the catalog is already on screen in full and there is no queue to open. Deriving the
  // open state here keeps the dialog semantics, the focus traps and the shortcut suppression from
  // ever disagreeing with what is actually rendered.
  const isCatalogDrawerOpen = isMobileCatalogOpen && workspaceMode === "encoding" && hasSelection;
  const isQueueDrawerVisible = isQueueDrawerOpen && workspaceMode === "encoding" && hasSelection;
  const isAnyWorkspaceDrawerOpen = isCatalogDrawerOpen || isQueueDrawerVisible;

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

  const handleCloseQueueDrawer = useCallback(() => {
    setIsQueueDrawerOpen(false);
  }, []);

  /**
   * The catalog drawer is the only route to the catalog once an examination is selected, at every
   * width, so it retires at no breakpoint.
   */
  useWorkspaceModalDrawer({
    isOpen: isCatalogDrawerOpen,
    panelRef: catalogDrawerRef,
    triggerRef: catalogToggleRef,
    onClose: handleCloseCatalogDrawer,
  });

  /**
   * The queue drawer exists only below the width at which the queue can be docked as a column, so
   * crossing that width retires it: leaving it armed would strand a desktop operator inside a
   * modal over a queue that is already on screen beside them.
   */
  useWorkspaceModalDrawer({
    isOpen: isQueueDrawerVisible,
    panelRef: queueDrawerRef,
    triggerRef: queueToggleRef,
    onClose: handleCloseQueueDrawer,
    retireQuery: QUEUE_DOCK_QUERY,
    retireFocusRef: dockedQueueRef,
  });

  // Load all active hydrated template specs through the authenticated server boundary.
  useEffect(() => {
    if (initialTemplates) return; // server render already delivered the catalog
    async function loadTemplates() {
      try {
        const hydratedSpecs = await listRegistryTemplatesAction({});
        setAllActiveTemplates(hydratedSpecs);
      } catch {
        // Loader actions still throw on failure (out of scope for SHADCN-07B2). The fixed
        // fallback is now the only wording: the thrown message is a Next.js digest in production.
        setValidationError("The report registry could not be loaded.");
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
      .catch(() => {
        setValidationError("Active personnel could not be loaded.");
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
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          // Expected refusal - ownership, status or retention. The server already decided and
          // audited it; this only shows the sentence it chose.
          setReopenError(result.error);
          setReopenStatus("failed");
          return;
        }
        const reopened = fromSessionTransport(result.data);
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
      .catch(() => {
        if (cancelled) return;
        // Unexpected rejection only. Never the thrown message: in production Next.js has already
        // replaced it with its redaction string and a digest, and in development it could carry
        // server internals. The fixed sentence is the whole contract here.
        setReopenError("This session could not be reopened.");
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
      if (!saved.success) {
        setSaveStatus("unsaved");
        setValidationError(saved.error);
        return;
      }
      clearWorkspaceRecovery();
      setSession(fromSessionTransport(saved.data));
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
      if (!completed.success) {
        setSaveStatus("unsaved");
        setValidationError(completed.error);
        return;
      }
      clearWorkspaceRecovery();
      setSession(fromSessionTransport(completed.data));
      setIsDirty(false);
      setSaveStatus("saved");
      setValidationError(null);
      setWorkspaceMode("preview");
    } catch {
      // Unexpected rejection only - every expected refusal arrived as a typed result above.
      // The caught message is never shown: it is Next.js's redaction plus a digest in production.
      setSaveStatus("unsaved");
      setValidationError("An unexpected error occurred while completing the session.");
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
      if (!replaced.success) {
        setSaveStatus("unsaved");
        setValidationError(replaced.error);
        return;
      }
      setSession(fromSessionTransport(replaced.data));
      setIsDirty(false);
      setSaveStatus("saved");
      setValidationError(null);
      setWorkspaceMode("preview");
    } catch {
      // Unexpected rejection only. Recovery is deliberately never cleared on this path - a
      // Replacement Mode session never wrote recovery in the first place.
      setSaveStatus("unsaved");
      setValidationError("An unexpected error occurred while replacing the report.");
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
      const saved = await saveDraftAction({ session: toSessionTransport(session) });
      if (!saved.success) {
        setSaveStatus("unsaved");
        setValidationError(saved.error);
        return;
      }
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
    const map: Record<string, ReportTabProgress> = {};
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
        // Projected from the shared completion rule, never recomputed for the queue: one rule for
        // what counts as encoded and what counts as blocking, so the queue's indicator and the
        // report's own meter cannot disagree.
        hasInvalidResult: progress.hasInvalidResult,
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
  const areWorkspaceShortcutsSuppressed = isWorkspaceDialogOpen || isAnyWorkspaceDrawerOpen;

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

  // Demographic edits update the aggregate and, when Sex changes, re-evaluate every report's
  // sex-specific references. Hoisted out of the form's inline prop because the form now renders
  // from two places - expanded above the context strip, collapsed inside it - and this rule must
  // not exist twice. The body is the previous inline handler, unchanged.
  const handleDemographicsChange = useCallback((updated: PatientDemographics) => {
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
  }, []);

  // The empty state's one action. On a desktop the catalog is already on screen: expand it if
  // it was collapsed (focus then lands on its collapse control, beside the search field), or
  // move focus into its search field. Below lg the catalog exists only in the drawer, so open it.
  /**
   * The one route to the catalog, from wherever the operator is.
   *
   * With nothing selected the catalog is already the whole screen, so there is nothing to open -
   * the useful act is to put the caret in its search field. With something selected it is the
   * drawer, at every width: the catalog stopped being a permanent column, so this is no longer a
   * breakpoint-dependent decision.
   */
  const handleBrowseCatalog = useCallback(() => {
    if (!hasSelection) {
      fullCatalogRef.current?.querySelector<HTMLInputElement>("[data-catalog-search]")?.focus();
      return;
    }
    setIsMobileCatalogOpen(true);
  }, [hasSelection]);

  /**
   * Removing the last examination returns the session to the catalog, so focus has to follow: the
   * control that was just activated no longer exists, and a keyboard operator would otherwise be
   * dropped onto document.body in front of a screen that has completely changed.
   *
   * Only a genuine transition moves focus. A fresh session mounts with nothing selected and must
   * never steal the caret into the search field, and a Strict Mode replay finds the previous
   * value already updated, so neither can fire this.
   */
  const hadSelectionRef = useRef(hasSelection);
  useEffect(() => {
    const hadSelection = hadSelectionRef.current;
    hadSelectionRef.current = hasSelection;
    if (!hadSelection || hasSelection) return;
    // Clear the raw drawer state, not just the derived visibility. Both `isCatalogDrawerOpen`
    // and `isQueueDrawerVisible` are gated on `hasSelection`, so emptying the session hides a
    // drawer without closing it - the underlying flag stays true. Selecting the next examination
    // would then satisfy the gate again and reopen a drawer the operator had already dismissed.
    setIsMobileCatalogOpen(false);
    setIsQueueDrawerOpen(false);
    fullCatalogRef.current?.querySelector<HTMLInputElement>("[data-catalog-search]")?.focus();
  }, [hasSelection]);

  // A reopen request must resolve before the workspace is usable. Rendering the blank
  // new-session workspace after a failed load would invite encoding into a different
  // session than the one requested.
  if (reopenStatus === "loading" || reopenStatus === "failed") {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-brand-canvas p-4">
        {/* Both branches announce themselves: the reopen can outlast the spinner's
            usefulness, and under reduced motion the spinner does not turn at all, so the
            words have to carry the state. */}
        {/* One white working surface on the canvas: the state body, then - on failure only -
            a structural footer band holding the two routes out. */}
        <div
          role={reopenStatus === "failed" ? "alert" : "status"}
          aria-live={reopenStatus === "failed" ? "assertive" : "polite"}
          className="w-full max-w-md overflow-hidden rounded-lg border border-brand-border bg-brand-card text-center shadow-low"
        >
          {reopenStatus === "loading" ? (
            <div className="flex flex-col items-center gap-3 px-6 py-8">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-primary">
                <RefreshCw aria-hidden="true" className="h-5 w-5 animate-spin" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold leading-tight tracking-tight text-brand-navy">Reopening Session</h2>
                <p className="mt-1 text-xs leading-relaxed text-brand-text-muted">
                  Loading the saved patient report session from the laboratory record.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 px-6 py-8">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-danger-bg text-brand-danger">
                  <AlertCircle aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold leading-tight tracking-tight text-brand-navy">Session Could Not Be Reopened</h2>
                  <p className="mt-1 text-xs leading-relaxed text-brand-text-muted">
                    {reopenError ?? "This session could not be reopened."}
                  </p>
                </div>
              </div>
              {/* Both routes out were hand-rolled buttons with no focus ring at all - on a
                  screen a keyboard operator can be dropped onto, with nothing else to
                  focus. They are shared Buttons now. */}
              <div className="flex flex-col gap-2 border-t border-brand-border bg-brand-structural px-4 py-3">
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
      {/* Everything the drawers cover. Marked inert while either is open, so the desk behind the
          scrim is unreachable by pointer, Tab and assistive-technology browse navigation - the
          drawers themselves are siblings of this column, never descendants, which is what makes
          that possible at all. */}
      <div
        inert={isAnyWorkspaceDrawerOpen || undefined}
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
      >
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

            {/* The one route to the catalog, at every width, and the only control that adds an
                examination once the session has one. It is absent while nothing is selected,
                because the catalog is the whole screen there and a control to open it as a
                drawer would offer to do what has already happened. */}
            {hasSelection && workspaceMode === "encoding" && (
              <Button
                ref={catalogToggleRef}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMobileCatalogOpen(!isMobileCatalogOpen)}
                // 44x44 on touch, where the label is hidden and the glyph is the whole target;
                // the established 36px compact height from sm up, where the label returns.
                className="h-11 min-w-11 shrink-0 whitespace-nowrap px-2 sm:h-9 sm:min-w-0 sm:px-2.5"
                aria-expanded={isCatalogDrawerOpen}
                aria-controls="workspace-catalog-drawer"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">Add examinations</span>
                <span className="sr-only sm:hidden">Add examinations</span>
              </Button>
            )}

            <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-brand-border-strong sm:block" />

            {/* Session identity: the patient in navy at the command-bar scale, then the accession
                and the session status underneath. Status is the shared StatusBadge - the same
                Draft / Completed vocabulary the dashboard rows and History carry - rather than a
                third, local colouring of the word. */}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight tracking-tight text-brand-navy">
                {session.demographics.fullName || "New Patient Visit Session"}
              </h1>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs leading-none text-brand-text-muted">
                <span className="shrink-0 font-mono font-semibold tabular-nums" title={session.accessionNumber === null ? "Accession not assigned" : undefined}>
                  {session.accessionNumber ?? "Not assigned"}
                </span>
                <StatusBadge status={session.status} size="sm" className="shrink-0" />
                {isReplacementMode && (
                  <Badge variant="warning" size="sm" className="shrink-0 gap-1">
                    <RefreshCw aria-hidden="true" className="h-3 w-3" />
                    <span className="hidden sm:inline">Replacement Mode</span>
                    <span className="sm:hidden">Replacement</span>
                  </Badge>
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
            {/* The system's segmented control: a bordered structural track, the active
                segment lifted onto white in navy with the low shadow. */}
            <div role="group" aria-label="Workspace view mode" className="flex shrink-0 items-center rounded-md border border-brand-border bg-brand-structural p-0.5">
              <button
                type="button"
                onClick={() => setWorkspaceMode("encoding")}
                aria-pressed={workspaceMode === "encoding"}
                aria-label="Encoding"
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded px-2.5 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring",
                  workspaceMode === "encoding"
                    ? "bg-brand-surface text-brand-navy shadow-low"
                    : "text-brand-text-muted hover:text-brand-navy"
                )}
              >
                <Edit3 aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Encoding</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode("preview")}
                aria-pressed={workspaceMode === "preview"}
                aria-label="Live Preview"
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded px-2.5 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring",
                  workspaceMode === "preview"
                    ? "bg-brand-surface text-brand-navy shadow-low"
                    : "text-brand-text-muted hover:text-brand-navy"
                )}
              >
                <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Live Preview</span>
              </button>
            </div>

            <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-brand-border-strong sm:block" />

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
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-brand-warning px-2 text-xs font-semibold text-white shadow-low transition-[color,background-color,border-color,box-shadow,transform] duration-150 hover:bg-amber-900 active:scale-[0.98] active:bg-amber-950 active:shadow-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-60 sm:px-3"
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

      {/* ── Clinical ribbon ──────────────────────────────────────────────────────────────
          One row, always. It carries context ABOUT the work - who the patient is and how far
          the session has got - never the work itself, which is why it is structural rather
          than a working surface.

          It lives here, in the frame, rather than inside the scrolling column: as a sticky
          strip inside the scroller it had to be two rows tall when demographics were collapsed
          and one when they were expanded, and every scroll-padding value downstream had to be
          conditional on which. Out here it is one height, unconditionally.

          While the demographics editor is open the summary is not repeated - the fields are on
          screen and are the authority - so the ribbon states the session progress only. */}
      {workspaceMode === "encoding" && (
        <div className="z-20 flex shrink-0 items-center gap-3 border-b border-brand-border bg-brand-structural px-4 py-1.5">
          {isDemographicsExpanded ? (
            <p className="min-w-0 flex-1 truncate text-xs text-brand-text-muted">
              Editing patient details
            </p>
          ) : (
            <div className="min-w-0 flex-1">
              <PatientDemographicsForm
                isExpanded={false}
                onToggleExpanded={setIsDemographicsExpanded}
                demographics={session.demographics}
                onChange={handleDemographicsChange}
              />
            </div>
          )}

          {sessionProgress.totalReports > 0 && (
            <span
              data-session-progress
              className="hidden shrink-0 items-center gap-1.5 text-xs font-medium tabular-nums text-brand-text-muted sm:inline-flex"
              title="Reports in this session with every selected result encoded"
            >
              {/* The check turns teal once every report is complete and stays muted while any is
                  pending. The words carry the state; the colour only reinforces it. */}
              <CheckCircle2
                aria-hidden="true"
                className={
                  sessionProgress.completedReports === sessionProgress.totalReports
                    ? "h-3.5 w-3.5 text-brand-primary"
                    : "h-3.5 w-3.5 text-brand-text-subtle"
                }
              />
              {`${sessionProgress.completedReports} of ${sessionProgress.totalReports} report${sessionProgress.totalReports === 1 ? "" : "s"} complete`}
            </span>
          )}
        </div>
      )}

      {/* The compact queue trigger, below the width at which the queue can be a docked column.
          It names the active report rather than reducing it to an icon or a bare count: two
          reports in one session routinely share a progress figure, so a count alone could not
          say which one is open. */}
      {workspaceMode === "encoding" && hasSelection && (
        <div className="shrink-0 min-[1152px]:hidden">
          <WorkQueueTrigger
            selectedSpecs={selectedSpecs}
            activeTemplateCode={activeTemplateCode}
            progressByTemplateCode={progressByTemplateCode}
            isOpen={isQueueDrawerVisible}
            onOpen={() => setIsQueueDrawerOpen(true)}
            drawerId="workspace-queue-drawer"
            triggerRef={queueToggleRef}
          />
        </div>
      )}

      {/* Replacement Mode Notice */}
      {isReplacementMode && (
        <div className={`${WORKSPACE_CONTAINER} mt-3 shrink-0 px-3 sm:px-4 xl:px-6`}>
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
        <div className={`${WORKSPACE_CONTAINER} mt-3 shrink-0 px-3 sm:px-4 xl:px-6`}>
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

      {/* ── The desk ─────────────────────────────────────────────────────────────────────
          Encoding is one of two compositions, and which one is showing is decided by whether
          the session has anything selected at all. There is no third state and no stored flag:
          with nothing selected the catalog IS the task and takes the whole surface; with
          something selected the desk appears - work queue where it can be docked, the active
          report everywhere else - and the catalog retires to a drawer. */}
      <main className={`flex-1 overflow-hidden p-3 sm:px-4 sm:py-3 xl:px-6 ${WORKSPACE_CONTAINER}`}>
        {workspaceMode === "encoding" ? (
          !hasSelection ? (
            /* Zero-selected. Reached identically by a new session, by removing the last
               examination from the queue, by "Close Other" leaving nothing, and by "Clear All" -
               because it is derived from the selection rather than set by any of them. The
               patient, the accession and the rest of the session are untouched underneath; only
               the reports are gone. Capped rather than full-bleed: a 1680px-wide list of
               seventeen examinations is harder to read than a 768px one, not easier. */
            <div ref={fullCatalogRef} className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col">
              <ExaminationCatalog
                allTemplates={allActiveTemplates}
                selectedTemplateCodes={selectedTemplateCodes}
                activeTemplateCode={activeTemplateCode}
                onSelectTemplate={setActiveTemplateCode}
                onToggleTemplateSelection={handleToggleTemplateSelection}
                headingLevel={2}
              />
            </div>
          ) : (
            <div className="flex h-full min-h-0 gap-3 overflow-hidden">
              {/* The work queue, docked. 240px, and only at a width where surrendering 240px
                  still leaves the worksheet more than it needs; below that the same queue is
                  the drawer instead, reached from the trigger above. */}
              {selectedSpecs.length > 0 && (
                /* tabIndex={-1} makes this a programmatic landing target without entering the
                   Tab order, the same way PageContainer's #main-content and the shell's
                   #workspace-main already do. It receives focus only when the drawer retires at
                   this breakpoint, and the ring is kept visible so a keyboard operator can see
                   where they were moved to rather than guessing. */
                <div
                  ref={dockedQueueRef}
                  tabIndex={-1}
                  className="hidden h-full w-60 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring min-[1152px]:block"
                >
                  <SelectedReportsPanel
                    selectedSpecs={selectedSpecs}
                    activeTemplateCode={activeTemplateCode}
                    onSelectActiveTemplate={setActiveTemplateCode}
                    onRemoveTemplate={handleRemoveTemplate}
                    onCloseOtherTemplates={handleCloseOtherTemplates}
                    onClearAllTemplates={() => setPendingConfirmation("clearAll")}
                    isDirty={isDirty}
                    progressByTemplateCode={progressByTemplateCode}
                    variant="docked"
                  />
                </div>
              )}

              {/* The active report. Everything else on this screen is context; this is the work,
                  so it takes every pixel the queue does not.

                  scroll-padding clears the report's own sticky chrome, so a control reached by
                  keyboard is never parked underneath it (WCAG 2.2 Focus Not Obscured). It is a
                  single unconditional value now: the two-row context strip that used to force a
                  conditional one has moved out of this scroller and into the frame. */}
              <div className="flex-1 min-w-0 h-full overflow-y-auto pr-1 space-y-3 scroll-pt-3 scroll-pb-16">
                {/* Demographics, expanded: a white working card at the top of the pane. While the
                    operator is editing the patient, the fields ARE the work, so they scroll with
                    it. Collapsed, the same component renders its summary in the ribbon above, so
                    the data never leaves the screen. */}
                {isDemographicsExpanded && (
                  <PatientDemographicsForm
                    isExpanded
                    onToggleExpanded={setIsDemographicsExpanded}
                    invalidFieldId={validationError ? validationFieldTarget : null}
                    demographics={session.demographics}
                    onChange={handleDemographicsChange}
                  />
                )}

                {/* Dynamic Result Form Dispatcher */}
                {activeSpec && activeDefinition && activeReport && selectedSpecs.length > 0 ? (
                  // One tabpanel per report, owning the results AND the footer. The queue's
                  // aria-controls points here, so a screen-reader user moving by tabpanel reaches
                  // signatories, remarks and kit information instead of stopping at the grid.
                  <div
                    id={`report-panel-${activeDefinition.templateCode}`}
                    role="tabpanel"
                    // Named directly rather than by reference. The queue's tab ids are now scoped
                    // per variant, because the docked instance is hidden by CSS rather than
                    // unmounted and both can be in the DOM at once - so there is no single tab id
                    // that reliably names the *visible* one. An aria-labelledby pointing at the
                    // wrong copy would name this panel from a display:none element; the report
                    // title states it unambiguously at every width.
                    aria-label={activeDefinition.templateTitle}
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
                  /* Selected, but the active report has not resolved yet - a template still
                     loading, or one removed from the registry. The queue beside this already
                     lists what the session holds, so this states the one thing it cannot. */
                  <EmptyState
                    icon={FileText}
                    title="No examination open"
                    description="Choose an examination from the session queue to begin encoding patient results."
                    headingLevel={2}
                    action={
                      <Button type="button" variant="primary" size="sm" onClick={handleBrowseCatalog}>
                        <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
                        Add examinations
                      </Button>
                    }
                  />
                )}
              </div>
            </div>
          )
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

      </div>
      {/* ── end of the inert content column; both drawers are siblings of it ───────────── */}

      {/* Catalog drawer. The only route to the catalog once an examination is selected, so it is
          available at every width rather than below a breakpoint. */}
      {isCatalogDrawerOpen && (
        <>
          {/* Navy scrim, the same one the shell drawer and the dialogs use. */}
          <div
            className="fixed inset-0 z-40 bg-[rgb(13_43_64_/_0.55)] motion-safe:transition-opacity"
            onClick={handleCloseCatalogDrawer}
            aria-hidden="true"
          />
          {/* Drawer shell only. The catalog is the content and carries its own heading, so the
              shell prints no title of its own - two stacked titles for one panel read as a nested
              card. The close control stays the first focusable node, which is what the focus trap
              places initial focus on. */}
          <div
            ref={catalogDrawerRef}
            id="workspace-catalog-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Examination Catalog"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(24rem,88vw)] max-w-full flex-col overflow-hidden border-r border-brand-border-strong bg-brand-canvas shadow-overlay"
          >
            <div className="flex h-14 shrink-0 items-center justify-end border-b border-brand-border-strong bg-brand-structural px-1.5">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={handleCloseCatalogDrawer}
                className="h-11 w-11 shrink-0 px-0"
                aria-label="Close Examination Catalog"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </Button>
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

      {/* Queue drawer. The same queue the wide layout docks, below the width at which docking it
          would cost the worksheet more than the queue is worth. */}
      {isQueueDrawerVisible && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[rgb(13_43_64_/_0.55)] motion-safe:transition-opacity"
            onClick={handleCloseQueueDrawer}
            aria-hidden="true"
          />
          <div
            ref={queueDrawerRef}
            id="workspace-queue-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Session examinations"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] max-w-full flex-col overflow-hidden border-r border-brand-border-strong bg-brand-canvas shadow-overlay"
          >
            <div className="flex h-14 shrink-0 items-center justify-end border-b border-brand-border-strong bg-brand-structural px-1.5">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={handleCloseQueueDrawer}
                className="h-11 w-11 shrink-0 px-0"
                aria-label="Close session examinations"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 p-2">
              <SelectedReportsPanel
                selectedSpecs={selectedSpecs}
                activeTemplateCode={activeTemplateCode}
                onSelectActiveTemplate={setActiveTemplateCode}
                onRemoveTemplate={handleRemoveTemplate}
                onCloseOtherTemplates={handleCloseOtherTemplates}
                onClearAllTemplates={() => setPendingConfirmation("clearAll")}
                isDirty={isDirty}
                progressByTemplateCode={progressByTemplateCode}
                variant="drawer"
                onAfterSelect={handleCloseQueueDrawer}
              />
            </div>
          </div>
        </>
      )}

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

          <div className="mt-1 border-t border-brand-border pt-2">
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
