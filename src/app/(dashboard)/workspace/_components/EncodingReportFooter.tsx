import React, { useState } from "react";
import { HydratedTemplateSpec } from "@/services/interfaces";
import { ILaboratoryReport } from "@/domain/models/interfaces";
import type { WorkspacePersonnelEntry } from "@/features/workspace/signatory-contracts";
import { LaboratoryReportDomain } from "@/domain/models/laboratory-report-domain";
import { ClinicalReportDefinition } from "@/domain/types/report-definition";
import { RepeatableFindingsSection } from "./RepeatableFindingsSection";
import { SignatorySelectionSection } from "./SignatorySelectionSection";
import { TemplateRemarksSection } from "./TemplateRemarksSection";
import { ReagentKitInfoSection } from "./ReagentKitInfoSection";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, PanelBottom } from "lucide-react";
import { PanelIcon } from "./PanelIcon";

export interface EncodingReportFooterProps {
  spec: HydratedTemplateSpec;
  definition: ClinicalReportDefinition;
  report: ILaboratoryReport;
  availablePersonnel: WorkspacePersonnelEntry[];
  onChangeReport: (updatedReport: ILaboratoryReport) => void;
  /** Selector of the control a completion failure resolved to. Optional; absent marks nothing. */
  invalidFieldSelector?: string | null;
  /** Controlled expansion. Omitted leaves the panel owning its own state. */
  isExpanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
}

/**
 * The docked report footer: signatories, remarks, kit information and additional findings.
 *
 * These sections used to be appended after the last parameter, so reaching them meant scrolling
 * past the whole grid. Docked here they stay reachable at any scroll position, and collapsed they
 * cost one slim bar instead of several hundred pixels.
 *
 * It is rendered by the Workspace as a sibling of the report card rather than inside it, which is
 * what lets `position: sticky` work at all - the card sets `overflow-hidden` for its rounded
 * header, and a sticky descendant of a clipping ancestor is silently inert.
 *
 * **This component relocates and summarises. It changes no behaviour.** The four sections are
 * rendered exactly as they were, with the same props and the same change handlers. In particular
 * the signatory section keeps its own accordion and its deliberately sibling - never nested -
 * Confirm control, whose nesting once caused a hydration failure (`e48967a`).
 */

/**
 * Collapsed-bar status, derived only from what the report actually carries.
 *
 * Signatory readiness is read from `report.signatories`, the shape that is actually persisted -
 * never from the signatory section's local `isConfirmed` flag, which is inert and must not be
 * promoted into a more prominent surface than it already occupies. This summary therefore states
 * whether the required signatories are present, and claims nothing about acknowledgement.
 */
function signatoriesAssigned(report: ILaboratoryReport, spec: HydratedTemplateSpec): boolean {
  const pathologists = report.signatories.filter((signatory) => signatory.role === "Pathologist").length;
  const medtechs = report.signatories.filter((signatory) => signatory.role === "MedicalTechnologist").length;
  return (
    pathologists >= spec.signatoryRequirement.requiredPathologistsCount &&
    medtechs >= spec.signatoryRequirement.requiredMedtechsCount
  );
}

function kitInfoComplete(report: ILaboratoryReport): boolean {
  const kit = report.reagentKitInfo;
  return Boolean(kit?.lotNumber?.trim() && kit?.expirationDate?.trim());
}

function findingsCount(report: ILaboratoryReport): number {
  const findings = report.encodingData?.repeatableFindings || {};
  return Object.values(findings).reduce((total, entries) => total + (entries?.length || 0), 0);
}

/**
 * One inline status item, not a pill. The wording is the signal and is unchanged; colour only
 * reinforces it, so the row still reads correctly in greyscale. The warning tone marks
 * outstanding required content. It never blocks and never validates.
 */
function SummaryChip({ label, isSatisfied, isRequired }: { label: string; isSatisfied: boolean; isRequired: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap text-xs",
        isSatisfied
          ? "font-medium text-brand-text-muted"
          : isRequired
            ? "font-semibold text-brand-warning"
            : "font-medium text-brand-text-muted"
      )}
    >
      {label}
    </span>
  );
}

export function EncodingReportFooter({
  spec,
  definition,
  report,
  availablePersonnel,
  onChangeReport,
  invalidFieldSelector,
  isExpanded: controlledExpanded,
  onExpandedChange,
}: EncodingReportFooterProps) {
  // Collapsed by default and opened by the operator, exactly as before. The Workspace may also
  // drive it, because a completion failure against a signatory or a reagent lot number has to
  // open the panel that holds the field: the content is hidden with CSS, and focus cannot land on
  // a `display:none` control.
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded ?? internalExpanded;
  const setExpanded = (next: boolean) => {
    setInternalExpanded(next);
    onExpandedChange?.(next);
  };

  const hasFindings = (definition.repeatableFindings?.length || 0) > 0;
  const assigned = signatoriesAssigned(report, spec);
  const kitComplete = kitInfoComplete(report);
  const findings = findingsCount(report);

  return (
    <section
      data-encoding-footer={definition.templateCode}
      aria-label="Report footer"
      // Sticky chrome on a white working surface: the same low elevation as every other panel,
      // with the stronger border because this edge sits against the canvas.
      className="sticky bottom-0 z-20 overflow-hidden rounded-lg border border-brand-border-strong bg-brand-card shadow-low"
    >
      {/* Remarks sit above the disclosure, never inside it: this field must be readable and
          editable at any moment without expanding anything, and the CBC default text has to be
          on screen to be confirmed. Signatories, kit information and additional findings stay
          behind the toggle below. */}
      {definition.supportsRemarks && (
        <div className="border-b border-brand-border bg-brand-card px-3 py-2.5">
          <TemplateRemarksSection
            remarks={report.remarks}
            onChange={(remarks) => onChangeReport(new LaboratoryReportDomain({ ...report, remarks }))}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="encoding-footer-content"
        className="flex w-full items-center gap-2.5 bg-brand-structural px-3 py-2 text-left transition-colors hover:bg-brand-structural-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring"
      >
        <PanelIcon icon={PanelBottom} />
        <span className="shrink-0 text-[15px] font-semibold leading-tight tracking-tight text-brand-navy">
          Report Details
        </span>

        {/* Status items wrap at narrow widths rather than clipping; the divide rule gives them
            structure without turning each one into a chip. */}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 divide-x divide-brand-border [&>*:not(:first-child)]:pl-2">
          <SummaryChip
            label={assigned ? "Signatories assigned" : "Signatories incomplete"}
            isSatisfied={assigned}
            isRequired
          />
          {definition.requiresKitInfo && (
            <SummaryChip
              label={kitComplete ? "Kit info complete" : "Kit info incomplete"}
              isSatisfied={kitComplete}
              isRequired
            />
          )}
          {/* No remarks chip: remarks are no longer inside this panel, so summarising them on
              the collapsed bar would describe a field the operator can already see. */}
          {hasFindings && (
            <SummaryChip
              label={findings === 1 ? "1 additional finding" : `${findings} additional findings`}
              isSatisfied={findings > 0}
              isRequired={false}
            />
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1 rounded-md border border-brand-border bg-brand-surface px-1.5 py-0.5 text-xs font-semibold text-brand-text-muted">
          {isExpanded ? "Hide" : "Show"}
          {isExpanded ? (
            <ChevronDown aria-hidden="true" className="h-4 w-4" />
          ) : (
            <ChevronUp aria-hidden="true" className="h-4 w-4" />
          )}
        </span>
      </button>

      {/* Always mounted, hidden by CSS when collapsed. Unmounting would change behaviour rather
          than presentation: SignatorySelectionSection owns a mount effect that reconciles its
          selections into report.signatories, and a collapsed footer that never mounted it would
          leave a report unsynchronised. display:none also keeps the hidden controls out of the
          Tab order, so the collapsed bar is a single stop. */}
      <div
        id="encoding-footer-content"
        className={cn(
          // Bounded so an expanded footer can never cover the grid it is docked beneath. 50vh
          // took half the worksheet - the operator expanded the footer and lost sight of the
          // rows it belongs to. 38dvh keeps the results dominant; everything inside stays
          // reachable because the panel scrolls rather than clipping. dvh, not vh, so mobile
          // browser chrome shrinks the bound with the viewport instead of overflowing it.
          // White body; each section inside is a structural tint group, never another card.
          "max-h-[38dvh] space-y-3 overflow-y-auto overscroll-contain border-t border-brand-border bg-brand-card p-3",
          !isExpanded && "hidden"
        )}
      >
          {hasFindings && (
            <RepeatableFindingsSection
              specs={definition.repeatableFindings || []}
              values={report.encodingData?.repeatableFindings || {}}
              onChange={(category, entries) =>
                onChangeReport(
                  new LaboratoryReportDomain({
                    ...report,
                    encodingData: {
                      ...(report.encodingData || {}),
                      repeatableFindings: { ...(report.encodingData?.repeatableFindings || {}), [category]: entries },
                    },
                  })
                )
              }
            />
          )}
          {definition.requiresKitInfo && (
            <ReagentKitInfoSection
              kitInfo={report.reagentKitInfo}
              onChange={(reagentKitInfo) => onChangeReport(new LaboratoryReportDomain({ ...report, reagentKitInfo }))}
              invalidFieldSelector={invalidFieldSelector}
            />
          )}
          <SignatorySelectionSection
            templateCode={definition.templateCode}
            signatories={report.signatories}
            requiredPathologistsCount={spec.signatoryRequirement.requiredPathologistsCount}
            requiredMedtechsCount={spec.signatoryRequirement.requiredMedtechsCount}
            availablePersonnel={availablePersonnel}
            onChange={(signatories) => onChangeReport(new LaboratoryReportDomain({ ...report, signatories }))}
            invalidFieldSelector={invalidFieldSelector}
        />
      </div>
    </section>
  );
}
