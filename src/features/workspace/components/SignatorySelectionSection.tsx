import React, { useState, useEffect, useRef } from "react";
import type {
  WorkspacePersonnelEntry,
  WorkspaceSignatorySelection,
} from "@/features/workspace/signatory-contracts";
import { UserCheck, ShieldCheck, CheckCircle2, Clock } from "lucide-react";
import { suggestedSignatoryProvider } from "@/services/suggested-signatory-provider";

/**
 * Build one selection from a directory entry.
 *
 * The three call sites below were previously three copies of the same object literal, each of
 * which copied `signatureImageUrl` out of the personnel record and into the report. One builder
 * means the reference cannot be reintroduced in one branch and missed in the others, and the
 * entry type it accepts no longer carries a reference to copy.
 */
function toSelection(
  person: WorkspacePersonnelEntry,
  role: WorkspaceSignatorySelection["role"],
  displayOrder: number
): WorkspaceSignatorySelection {
  return {
    personnelId: person.id,
    role,
    printedFullName: `${person.firstName} ${person.lastName}`,
    printedCredentials: person.credentials,
    printedPrcLicenseNumber: person.prcLicenseNumber,
    displayOrder,
  };
}

export interface SignatorySelectionSectionProps {
  templateCode: string;
  signatories: WorkspaceSignatorySelection[];
  requiredPathologistsCount: number;
  requiredMedtechsCount: number;
  availablePersonnel: WorkspacePersonnelEntry[];
  onChange: (updatedSignatories: WorkspaceSignatorySelection[]) => void;
}

export function SignatorySelectionSection({
  templateCode,
  signatories,
  requiredPathologistsCount,
  requiredMedtechsCount,
  availablePersonnel,
  onChange,
}: SignatorySelectionSectionProps) {
  const pathologists = availablePersonnel.filter((p) => p.role === "Pathologist" && p.isActive);
  const medtechs = availablePersonnel.filter((p) => p.role === "MedicalTechnologist" && p.isActive);

  // Use suggestedSignatoryProvider service to resolve initial suggestions cleanly by role
  const initialSuggestions = suggestedSignatoryProvider.getSuggestedSignatories(
    templateCode,
    requiredPathologistsCount,
    requiredMedtechsCount,
    availablePersonnel
  );

  const [selectedPathologistId, setSelectedPathologistId] = useState<string>(() => {
    const existing = signatories.find((s) => s.role === "Pathologist");
    if (existing) return existing.personnelId;
    const suggestedPathologist = initialSuggestions.find((s) => s.role === "Pathologist");
    return suggestedPathologist ? suggestedPathologist.personnelId : pathologists[0]?.id || "";
  });

  const [selectedMedtech1Id, setSelectedMedtech1Id] = useState<string>(() => {
    const medtechList = signatories.filter((s) => s.role === "MedicalTechnologist");
    if (medtechList[0]) return medtechList[0].personnelId;
    const suggestedMedtechs = initialSuggestions.filter((s) => s.role === "MedicalTechnologist");
    return suggestedMedtechs[0] ? suggestedMedtechs[0].personnelId : medtechs[0]?.id || "";
  });

  const [selectedMedtech2Id, setSelectedMedtech2Id] = useState<string>(() => {
    const medtechList = signatories.filter((s) => s.role === "MedicalTechnologist");
    if (medtechList[1]) return medtechList[1].personnelId;
    const suggestedMedtechs = initialSuggestions.filter((s) => s.role === "MedicalTechnologist");
    return suggestedMedtechs[1] ? suggestedMedtechs[1].personnelId : medtechs[1]?.id || "";
  });

  // Track whether signatories have been explicitly confirmed or interacted with by the user
  const [isConfirmed, setIsConfirmed] = useState<boolean>(() => signatories.length > 0);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const areSignatoriesEqual = (
    a: WorkspaceSignatorySelection[],
    b: WorkspaceSignatorySelection[]
  ) => {
    if (a.length !== b.length) return false;
    return a.every(
      (item, idx) =>
        item.personnelId === b[idx]?.personnelId &&
        item.role === b[idx]?.role &&
        item.displayOrder === b[idx]?.displayOrder
    );
  };

  useEffect(() => {
    const updated: WorkspaceSignatorySelection[] = [];

    const pathObj = pathologists.find((p) => p.id === selectedPathologistId);
    if (pathObj) updated.push(toSelection(pathObj, "Pathologist", 1));

    const mt1Obj = medtechs.find((p) => p.id === selectedMedtech1Id);
    if (mt1Obj) updated.push(toSelection(mt1Obj, "MedicalTechnologist", 2));

    if (requiredMedtechsCount >= 2) {
      const mt2Obj = medtechs.find((p) => p.id === selectedMedtech2Id);
      if (mt2Obj) updated.push(toSelection(mt2Obj, "MedicalTechnologist", 3));
    }

    if (!areSignatoriesEqual(signatories, updated)) {
      onChangeRef.current(updated);
    }
  }, [selectedPathologistId, selectedMedtech1Id, selectedMedtech2Id, requiredMedtechsCount, pathologists, medtechs, signatories]);

  const activePathologist = pathologists.find((p) => p.id === selectedPathologistId);
  const activeMedtech1 = medtechs.find((p) => p.id === selectedMedtech1Id);
  const activeMedtech2 = medtechs.find((p) => p.id === selectedMedtech2Id);

  const hasRequiredSignatories = Boolean(
    (requiredPathologistsCount === 0 || selectedPathologistId) &&
    (requiredMedtechsCount <= 1 ? selectedMedtech1Id : selectedMedtech1Id && selectedMedtech2Id)
  );

  const isFullyConfirmed = hasRequiredSignatories && isConfirmed;

  const [isExpanded, setIsExpanded] = useState(true);

  const handleSelectPathologist = (id: string) => {
    setSelectedPathologistId(id);
    setIsConfirmed(true);
  };

  const handleSelectMedtech1 = (id: string) => {
    setSelectedMedtech1Id(id);
    setIsConfirmed(true);
  };

  const handleSelectMedtech2 = (id: string) => {
    setSelectedMedtech2Id(id);
    setIsConfirmed(true);
  };

  return (
    <div className="mt-3.5 overflow-hidden rounded-lg border border-brand-card-border bg-brand-background transition-colors">
      {/* Header & Requirement Badges Accordion Toggle */}
      {/* The Confirm action is a sibling of the toggle, never a descendant: a button
          nested inside a button is invalid HTML and the parser hoists it out, which
          makes the server and client trees disagree during hydration. */}
      <div className="w-full p-3 sm:py-3 sm:px-4 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-brand-structural-hover transition-colors">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-brand-text uppercase tracking-wider">
                Assigned Signatories & Approval
              </h3>
              <p className="text-[11px] text-brand-text-muted">
                PRC-licensed medical personnel authorizing this laboratory report
              </p>
            </div>
          </div>

          {/* Metadata Requirement Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            {isFullyConfirmed ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-emerald-50/90 text-emerald-800 border border-emerald-200/80 rounded-full">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Assigned ✓
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                <Clock className="h-3 w-3 text-amber-600" />
                Suggested (Unconfirmed)
              </span>
            )}
          </div>
        </button>

        {!isFullyConfirmed && (
          <button
            type="button"
            onClick={() => setIsConfirmed(true)}
            className="shrink-0 self-start sm:self-auto px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm"
          >
            Confirm ✓
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="p-3 pt-0 border-t border-brand-card-border mt-1.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Pathologist Card */}
            <div className="bg-brand-card border border-brand-card-border rounded-lg p-2.5 shadow-sm">
              <label className="block text-[11px] font-bold text-brand-text-muted uppercase mb-1 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                Pathologist (Signatory 1)
              </label>
              <select
                value={selectedPathologistId}
                onChange={(e) => handleSelectPathologist(e.target.value)}
                className="w-full text-xs bg-brand-structural border border-brand-border rounded-md p-1.5 font-medium text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:border-brand-primary mb-1"
              >
                {pathologists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}, {p.credentials}
                  </option>
                ))}
              </select>
              {activePathologist && (
                <div className="text-[10px] text-brand-text-muted font-mono">
                  PRC License: <span className="font-bold text-brand-text-muted">{activePathologist.prcLicenseNumber}</span>
                </div>
              )}
            </div>

            {/* Medical Technologist 1 Card */}
            <div className="bg-brand-card border border-brand-card-border rounded-lg p-2.5 shadow-sm">
              <label className="block text-[11px] font-bold text-brand-text-muted uppercase mb-1 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                Medical Technologist (Signatory 2)
              </label>
              <select
                value={selectedMedtech1Id}
                onChange={(e) => handleSelectMedtech1(e.target.value)}
                className="w-full text-xs bg-brand-structural border border-brand-border rounded-md p-1.5 font-medium text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:border-brand-primary mb-1"
              >
                {medtechs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}, {p.credentials}
                  </option>
                ))}
              </select>
              {activeMedtech1 && (
                <div className="text-[10px] text-brand-text-muted font-mono">
                  PRC License: <span className="font-bold text-brand-text-muted">{activeMedtech1.prcLicenseNumber}</span>
                </div>
              )}
            </div>

            {/* Medical Technologist 2 Card (Rendered ONLY when requiredMedtechsCount >= 2, e.g. HIV_RESULT) */}
            {requiredMedtechsCount >= 2 && (
              <div className="bg-brand-card border border-brand-card-border rounded-lg p-2.5 shadow-sm">
                <label className="block text-[11px] font-bold text-brand-text-muted uppercase mb-1 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                  Medical Technologist 2 (Signatory 3)
                </label>
                <select
                  value={selectedMedtech2Id}
                  onChange={(e) => handleSelectMedtech2(e.target.value)}
                  className="w-full text-xs bg-brand-structural border border-brand-border rounded-md p-1.5 font-medium text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:border-brand-primary mb-1"
                >
                  {medtechs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}, {p.credentials}
                    </option>
                  ))}
                </select>
                {activeMedtech2 && (
                  <div className="text-[10px] text-brand-text-muted font-mono">
                    PRC License: <span className="font-bold text-brand-text-muted">{activeMedtech2.prcLicenseNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
