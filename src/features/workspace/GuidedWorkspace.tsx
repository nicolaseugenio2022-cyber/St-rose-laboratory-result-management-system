"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { reportRegistryService } from "@/services/report-registry-service";
import { HydratedTemplateSpec } from "@/services/interfaces";
import { PatientReportSessionAggregate } from "@/domain/models/patient-report-session-aggregate";
import { LaboratoryReportDomain, LaboratoryResultDomain } from "@/domain/models/laboratory-report-domain";
import { AccessionNumberGenerator } from "@/domain/services/accession-number-generator";
import { IPersonnel, ILaboratoryReport } from "@/domain/models/interfaces";
import { PatientSex, PatientStatus } from "@/domain/types";
import {
  INITIAL_REPORT_TEMPLATES,
  INITIAL_TEMPLATE_PARAMETERS,
  INITIAL_TEMPLATE_SIGNATORY_REQUIREMENTS,
} from "@/services/registry-seed-data";
import { PatientDemographicsForm } from "./components/PatientDemographicsForm";
import { DynamicResultForm } from "./components/DynamicResultForm";
import { ExaminationCatalog } from "./components/ExaminationCatalog";
import { SelectedReportsPanel } from "./components/SelectedReportsPanel";
import { SharedRenderingEngine } from "@/rendering/SharedRenderingEngine";
import { SupabasePatientReportSessionRepository } from "@/repositories/supabase-session-repository";
import { formatDateISO } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, AlertCircle, FileText, Eye, Edit3, Menu, X, ArrowLeft, LogOut, User } from "lucide-react";
import { suggestedSignatoryProvider } from "@/services/suggested-signatory-provider";

const sessionRepo = new SupabasePatientReportSessionRepository();

export function GuidedWorkspace() {
  const [session, setSession] = useState<PatientReportSessionAggregate>(() => {
    return new PatientReportSessionAggregate({
      id: `sess-${Date.now()}`,
      accessionNumber: AccessionNumberGenerator.generate(1),
      demographics: {
        fullName: "",
        age: 0,
        ageUnit: "years",
        sex: "" as unknown as PatientSex, // No default sex selection
        address: "",
        patientStatus: "" as unknown as PatientStatus, // No default patient status selection
        examinationDate: formatDateISO(),
        requestingPhysician: "",
        referrerName: "",
        companyName: "",
      },
      reports: [],
    });
  });

  const [availablePersonnel] = useState<IPersonnel[]>([
    {
      id: "p-01",
      firstName: "Maria",
      lastName: "Santos",
      middleInitial: "A",
      credentials: "MD, FPSP",
      prcLicenseNumber: "PRC-0098765",
      role: "Pathologist",
      signatureImageUrl: "/signatures/dr-santos.png",
      isActive: true,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "mt-01",
      firstName: "Juan",
      lastName: "Dela Cruz",
      middleInitial: "B",
      credentials: "RMT",
      prcLicenseNumber: "PRC-0012345",
      role: "MedicalTechnologist",
      signatureImageUrl: "/signatures/j-delacruz.png",
      isActive: true,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "mt-02",
      firstName: "Ana",
      lastName: "Reyes",
      middleInitial: "C",
      credentials: "RMT",
      prcLicenseNumber: "PRC-0054321",
      role: "MedicalTechnologist",
      signatureImageUrl: "/signatures/a-reyes.png",
      isActive: true,
      createdAt: "",
      updatedAt: "",
    },
  ]);

  // Synchronously pre-hydrate all 17 templates so catalog renders instantly with 17 Available templates
  const [allActiveTemplates, setAllActiveTemplates] = useState<HydratedTemplateSpec[]>(() => {
    return INITIAL_REPORT_TEMPLATES.map((t) => ({
      template: t,
      parameters: INITIAL_TEMPLATE_PARAMETERS.filter((p) => p.templateCode === t.templateCode),
      signatoryRequirement: INITIAL_TEMPLATE_SIGNATORY_REQUIREMENTS.find((s) => s.templateCode === t.templateCode) || {
        id: `req-${t.templateCode}`,
        templateCode: t.templateCode,
        requiredPathologistsCount: 1,
        requiredMedtechsCount: 1,
      },
    }));
  });

  const router = useRouter();
  const [activeTemplateCode, setActiveTemplateCode] = useState<string | null>(null);
  const [activeSpec, setActiveSpec] = useState<HydratedTemplateSpec | null>(null);
  const [selectedTemplateCodes, setSelectedTemplateCodes] = useState<string[]>([]);
  const [workspaceMode, setWorkspaceMode] = useState<"encoding" | "preview">("encoding");
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isMobileCatalogOpen, setIsMobileCatalogOpen] = useState<boolean>(false);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);

  // Navigation handlers
  const handleBackToDashboard = useCallback(() => {
    if (isDirty) {
      setShowExitModal(true);
    } else {
      router.push("/dashboard");
    }
  }, [isDirty, router]);

  const handleDiscardAndExit = useCallback(() => {
    setShowExitModal(false);
    router.push("/dashboard");
  }, [router]);

  // Load ALL active hydrated template specs from ReportRegistryService on mount to refresh cache
  useEffect(() => {
    async function loadTemplates() {
      const summaries = await reportRegistryService.getAllActiveTemplates();
      const hydratedSpecs: HydratedTemplateSpec[] = [];
      for (const summary of summaries) {
        const spec = await reportRegistryService.getTemplateByCode(summary.templateCode);
        if (spec) {
          hydratedSpecs.push(spec);
        }
      }
      if (hydratedSpecs.length > 0) {
        setAllActiveTemplates(hydratedSpecs);
      }
    }
    loadTemplates();
  }, []);

  // Load hydrated spec whenever activeTemplateCode changes
  useEffect(() => {
    if (!activeTemplateCode) {
      setActiveSpec(null);
      return;
    }

    reportRegistryService.getTemplateByCode(activeTemplateCode).then((spec) => {
      if (spec) {
        setActiveSpec(spec);

        setSession((prevSession) => {
          if (prevSession.reports.some((r) => r.templateCode === activeTemplateCode)) {
            return prevSession;
          }

          const initialResults = spec.parameters.map(
            (p) =>
              new LaboratoryResultDomain({
                id: `res-${p.parameterCode}-${Date.now()}`,
                reportId: `rep-${spec.template.templateCode}`,
                parameterCode: p.parameterCode,
                parameterName: p.parameterName,
                resultValue: p.defaultValue || "",
                unit: p.unit,
                evaluationOutcome: "NoEvaluation",
                displayOrder: p.displayOrder,
                isSelected: true,
              })
          );

          const defaultSignatories = suggestedSignatoryProvider.getSuggestedSignatories(
            spec.template.templateCode,
            spec.signatoryRequirement.requiredPathologistsCount,
            spec.signatoryRequirement.requiredMedtechsCount,
            availablePersonnel
          );

          const newReport = new LaboratoryReportDomain({
            id: `rep-${spec.template.templateCode}-${Date.now()}`,
            sessionId: prevSession.id,
            templateCode: spec.template.templateCode,
            templateTitle: spec.template.templateTitle,
            rendererFamily: spec.template.rendererFamily,
            remarks: spec.template.defaultRemarks || "",
            reagentKitInfo: spec.template.requiresKitInfo
              ? { kitBrand: "", lotNumber: "", expirationDate: "" }
              : undefined,
            results: initialResults,
            signatories: defaultSignatories,
          });

          return new PatientReportSessionAggregate({
            ...prevSession,
            reports: [...prevSession.reports, newReport],
          });
        });
      }
    });
  }, [activeTemplateCode, availablePersonnel]);

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
  const handleSaveDraft = async () => {
    setSaveStatus("saving");
    try {
      await sessionRepo.saveDraft(session);
      setIsDirty(false);
      setSaveStatus("saved");
      setValidationError(null);
    } catch {
      setSaveStatus("unsaved");
      setValidationError("Failed to save draft session.");
    }
  };

  // Complete session handler
  const handleCompleteSession = async () => {
    if (!session.demographics.fullName.trim()) {
      setValidationError("Patient Name is required before completing session.");
      return;
    }
    if (!session.demographics.sex) {
      setValidationError("Patient Sex is required before completing session.");
      return;
    }

    setSaveStatus("saving");
    try {
      const lookupReq = (code: string) => {
        const spec = allActiveTemplates.find((t) => t.template.templateCode === code);
        return {
          requiredPathologistsCount: spec?.signatoryRequirement.requiredPathologistsCount || 1,
          requiredMedtechsCount: spec?.signatoryRequirement.requiredMedtechsCount || 1,
        };
      };

      session.completeSession(lookupReq);
      await sessionRepo.completeSession(session);
      setSession(session);
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
    }
  };

  // Handle save draft & exit
  const handleSaveDraftAndExit = useCallback(async () => {
    setShowExitModal(false);
    setSaveStatus("saving");
    try {
      await sessionRepo.saveDraft(session);
      setIsDirty(false);
      setSaveStatus("saved");
      setValidationError(null);
      router.push("/dashboard");
    } catch {
      setSaveStatus("unsaved");
      setValidationError("Failed to save draft session before exit.");
    }
  }, [session, router]);

  const selectedSpecs = useMemo(() => {
    return allActiveTemplates.filter((spec) => selectedTemplateCodes.includes(spec.template.templateCode));
  }, [allActiveTemplates, selectedTemplateCodes]);

  const activeReport = activeTemplateCode ? session.reports.find((r) => r.templateCode === activeTemplateCode) : undefined;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-100/60">
      {/* Fixed Workspace Top Navigation Bar */}
      <header className="h-14 bg-white border-b border-slate-200 shadow-xs px-4 flex items-center shrink-0 z-30">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[11px] font-bold font-mono bg-blue-100 text-blue-800 rounded">
                  {session.accessionNumber}
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
              </div>
              <h1 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight mt-0.5">
                {session.demographics.fullName || "New Patient Visit Session"}
              </h1>
            </div>
          </div>

          {/* Sticky Action Toolbar */}
          <div className="flex items-center gap-2">
            {/* Workspace View Mode Switcher */}
            <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setWorkspaceMode("encoding")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  workspaceMode === "encoding"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Encoding
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode("preview")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  workspaceMode === "preview"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Live Preview
              </button>
            </div>

            {/* Save Draft Action */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saveStatus === "saving" || !isDirty}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                isDirty
                  ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs"
                  : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              {saveStatus === "saving" ? "Saving..." : "Save Draft"}
            </button>

            {/* Complete Session Action */}
            {session.status !== "Completed" && (
              <button
                type="button"
                onClick={handleCompleteSession}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-brand-primary hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete Session
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Validation Banner Notice */}
      {validationError && (
        <div className="w-full max-w-7xl mx-auto px-4 mt-2 shrink-0">
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
      <main className="flex-1 overflow-hidden p-3 sm:p-4 max-w-7xl w-full mx-auto">
        {workspaceMode === "encoding" ? (
          <div className="h-full flex flex-col lg:flex-row gap-3.5 items-stretch overflow-hidden">
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
            <div className="flex-1 min-w-0 h-full overflow-y-auto pr-1 space-y-4">
              {/* Sticky Patient Context Bar inside Encoding Pane */}
              {session.demographics.fullName && (
                <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border border-slate-200 shadow-2xs py-2 px-3.5 rounded-xl flex items-center justify-between gap-3 text-xs text-slate-700 font-medium">
                  <div className="flex items-center gap-2 truncate">
                    <User className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                    <span className="font-bold text-slate-900 truncate">{session.demographics.fullName}</span>
                    {session.demographics.sex && session.demographics.age > 0 && (
                      <span className="text-slate-500 font-mono text-[11px] shrink-0">
                        • {session.demographics.sex}, {session.demographics.age} y/o
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-bold">
                      {session.accessionNumber}
                    </span>
                    {activeSpec && (
                      <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 font-bold">
                        {activeSpec.template.templateCode}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Patient Demographics Header Card */}
              <PatientDemographicsForm
                demographics={session.demographics}
                onChange={(updated) => {
                  setSession(
                    new PatientReportSessionAggregate({
                      ...session,
                      demographics: updated,
                    })
                  );
                  setIsDirty(true);
                  setSaveStatus("unsaved");
                }}
              />

              {/* Single-Line Horizontal Scrollable Examination Tab Strip */}
              <SelectedReportsPanel
                selectedSpecs={selectedSpecs}
                activeTemplateCode={activeTemplateCode}
                onSelectActiveTemplate={setActiveTemplateCode}
                onRemoveTemplate={handleRemoveTemplate}
                onCloseOtherTemplates={handleCloseOtherTemplates}
                onClearAllTemplates={handleClearAllTemplates}
                isDirty={isDirty}
              />

              {/* Dynamic Result Form Dispatcher */}
              {activeSpec && activeReport && selectedSpecs.length > 0 ? (
                <DynamicResultForm
                  spec={activeSpec}
                  report={activeReport}
                  availablePersonnel={availablePersonnel}
                  onChangeReport={handleReportChange}
                />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-6 py-6 text-center shadow-2xs flex flex-col items-center justify-center my-3">
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
          <div className="h-full overflow-y-auto bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
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

      {/* Unsaved Changes Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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
              <button
                type="button"
                onClick={handleSaveDraftAndExit}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-brand-primary hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
              >
                <Save className="h-4 w-4" />
                Save Draft & Exit
              </button>

              <button
                type="button"
                onClick={handleDiscardAndExit}
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
