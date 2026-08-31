import React, { useState, useEffect, useRef } from "react";
import type {
  WorkspacePersonnelEntry,
  WorkspaceSignatorySelection,
} from "@/features/workspace/signatory-contracts";
import { ShieldCheck, CheckCircle2, Clock } from "lucide-react";
import { suggestedSignatoryProvider } from "@/services/suggested-signatory-provider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

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

/** The option label is the same "First Last, Credentials" line the native select always showed. */
function toOption(person: WorkspacePersonnelEntry) {
  return { value: person.id, label: `${person.firstName} ${person.lastName}, ${person.credentials}` };
}

/**
 * The selected signatory summary as one detail row beneath its field. The wording is the
 * existing "PRC License:" line; only the layout is the shared label/value row.
 */
function PrcLicenseRow({ person }: { person: WorkspacePersonnelEntry }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1 py-1">
      <span className="text-xs text-brand-text-muted">PRC License:</span>
      <span className="font-mono text-xs font-medium tabular-nums text-brand-text">{person.prcLicenseNumber}</span>
    </div>
  );
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

  const pathologistOptions = pathologists.map(toOption);
  const medtechOptions = medtechs.map(toOption);

  return (
    // A structural tint group; the three signatory fields inside it are grouped by the grid,
    // never by a card each.
    <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-structural">
      {/* Header & Requirement Badges Accordion Toggle */}
      {/* The Confirm action is a sibling of the toggle, never a descendant: a button
          nested inside a button is invalid HTML and the parser hoists it out, which
          makes the server and client trees disagree during hydration. */}
      <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-1 flex-col justify-between gap-2 rounded-md text-left transition-colors sm:flex-row sm:items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-primary" />
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted">
                Assigned Signatories & Approval
              </h3>
              <p className="text-xs text-brand-text-muted">
                PRC-licensed medical personnel authorizing this laboratory report
              </p>
            </div>
          </div>

          {/* Metadata Requirement Badge */}
          <div className="flex flex-wrap items-center gap-2">
            {isFullyConfirmed ? (
              <Badge variant="success" size="sm" className="gap-1">
                <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                Assigned ✓
              </Badge>
            ) : (
              <Badge variant="warning" size="sm" className="gap-1">
                <Clock aria-hidden="true" className="h-3 w-3" />
                Suggested (Unconfirmed)
              </Badge>
            )}
          </div>
        </button>

        {!isFullyConfirmed && (
          <Button
            type="button"
            size="sm"
            onClick={() => setIsConfirmed(true)}
            className="shrink-0 self-start sm:self-auto"
          >
            Confirm ✓
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-brand-border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Pathologist */}
            <div>
              <Select
                label="Pathologist (Signatory 1)"
                value={selectedPathologistId}
                onChange={(e) => handleSelectPathologist(e.target.value)}
                options={pathologistOptions}
              />
              {activePathologist && <PrcLicenseRow person={activePathologist} />}
            </div>

            {/* Medical Technologist 1 */}
            <div>
              <Select
                label="Medical Technologist (Signatory 2)"
                value={selectedMedtech1Id}
                onChange={(e) => handleSelectMedtech1(e.target.value)}
                options={medtechOptions}
              />
              {activeMedtech1 && <PrcLicenseRow person={activeMedtech1} />}
            </div>

            {/* Medical Technologist 2 (Rendered ONLY when requiredMedtechsCount >= 2, e.g. HIV_RESULT) */}
            {requiredMedtechsCount >= 2 && (
              <div>
                <Select
                  label="Medical Technologist 2 (Signatory 3)"
                  value={selectedMedtech2Id}
                  onChange={(e) => handleSelectMedtech2(e.target.value)}
                  options={medtechOptions}
                />
                {activeMedtech2 && <PrcLicenseRow person={activeMedtech2} />}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
