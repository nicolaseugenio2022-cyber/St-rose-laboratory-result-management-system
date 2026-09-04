import React, { useState, useRef, useEffect } from "react";
import { HydratedTemplateSpec } from "@/services/interfaces";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { X, MoreVertical, Trash2, XCircle, Check, FileText } from "lucide-react";

/** Display-only encoding progress for one report. */
export interface ReportTabProgress {
  completedCount: number;
  selectedCount: number;
  isComplete: boolean;
}

export interface SelectedReportsPanelProps {
  selectedSpecs: HydratedTemplateSpec[];
  activeTemplateCode: string | null;
  onSelectActiveTemplate: (templateCode: string) => void;
  onRemoveTemplate: (templateCode: string) => void;
  onCloseOtherTemplates: (keepTemplateCode: string) => void;
  onClearAllTemplates: () => void;
  isDirty?: boolean;
  /**
   * Per-report progress, keyed by template code. Display only: the Workspace derives
   * it from the shared completion rule, so this panel never computes completeness and
   * cannot drift from the meter the report card draws. A template with no entry is
   * simply not annotated - it is never dropped from the queue.
   */
  progressByTemplateCode?: Record<string, ReportTabProgress>;
}

export function SelectedReportsPanel({
  selectedSpecs,
  activeTemplateCode,
  onSelectActiveTemplate,
  onRemoveTemplate,
  onCloseOtherTemplates,
  onClearAllTemplates,
  isDirty = false,
  progressByTemplateCode,
}: SelectedReportsPanelProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Stable across renders, so aria-controls always resolves to the same element and two
  // workspaces on one page could never collide on the id.
  const actionsPopupId = `${React.useId()}-examination-actions`;

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Escape dismisses the menu and hands focus back to the control that opened it,
  // so a keyboard operator is never dropped onto the document body.
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  if (selectedSpecs.length === 0) {
    return (
      <div className="min-w-0 flex-1">
        {/* Sits inside the structural context strip, so it carries no frame of its own. */}
        <EmptyState
          icon={FileText}
          title="No examinations selected"
          description="Choose one or more laboratory examinations from the catalog to begin encoding results."
          headingLevel={2}
          className="border-0 bg-transparent px-3 py-3"
        />
      </div>
    );
  }

  const handleRequestClearAll = () => {
    setIsMenuOpen(false);
    onClearAllTemplates();
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + direction + selectedSpecs.length) % selectedSpecs.length;
    const nextCode = selectedSpecs[nextIndex].template.templateCode;
    onSelectActiveTemplate(nextCode);
    // focus() scrolls the newly active tab back into view in a horizontally
    // overflowing strip, so keyboard switching never leaves it off screen.
    tabRefs.current[nextCode]?.focus();
  };

  return (
    // Tabs lead in both DOM and visual order; the Actions control is the trailing edge.
    <div className="flex min-w-0 flex-1 items-end gap-2">
      {/* Browser-style Tab Strip */}
      <div
        role="tablist"
        aria-label="Selected examination reports"
        className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto border-b border-brand-border"
      >
        {selectedSpecs.map((spec, index) => {
          const code = spec.template.templateCode;
          const isActive = activeTemplateCode === code;
          const tabId = `report-tab-${code}`;
          const panelId = `report-panel-${code}`;
          const progress = progressByTemplateCode?.[code];

          return (
            // The active tab lifts onto the white working surface with a navy label and a teal
            // rail under it; the others stay muted on the structural strip.
            <div
              key={code}
              role="presentation"
              className={cn(
                "group relative flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-2.5 py-1.5 text-[13px] transition-colors duration-150",
                isActive
                  ? "border-b-brand-primary bg-brand-surface font-semibold text-brand-navy"
                  : "border-b-transparent font-medium text-brand-text-muted hover:bg-brand-structural-hover hover:text-brand-navy"
              )}
            >
              <button
                ref={(node) => {
                  tabRefs.current[code] = node;
                }}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive || (!activeTemplateCode && index === 0) ? 0 : -1}
                onClick={() => onSelectActiveTemplate(code)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                title={`${spec.template.templateTitle} (${spec.template.examinationFamily})`}
                className="flex min-h-6 min-w-0 cursor-pointer items-center gap-1.5 rounded text-left transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
              >
                <span className="max-w-[180px] truncate xl:max-w-[240px]">{spec.template.templateTitle}</span>

                {/* Compact completed/selected, or a teal check once the report is done. Never a
                    progress track inside every tab - seventeen of those is noise, not signal. */}
                {progress && (
                  progress.isComplete ? (
                    <Check
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 stroke-[2.5] text-brand-primary"
                    />
                  ) : (
                    <span className="shrink-0 font-mono text-xs font-normal tabular-nums text-brand-text-muted">
                      {progress.completedCount}/{progress.selectedCount}
                    </span>
                  )
                )}
              </button>

              {/* Close Tab (X) Action Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTemplate(code);
                }}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-brand-text-subtle transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 hover:bg-brand-structural-hover hover:text-brand-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
                title="Remove examination tab"
                aria-label={`Remove ${spec.template.templateTitle} examination tab`}
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Unsaved state as real text, announced politely rather than a bare pulsing dot. */}
      {isDirty && (
        <Badge variant="warning" size="sm" role="status" className="mb-1 shrink-0">
          Unsaved
        </Badge>
      )}

      {/* Examination Actions Dropdown Menu */}
      <div className="relative mb-1 shrink-0" ref={menuRef}>
        {/* A disclosure, not an ARIA menu. aria-haspopup="menu" promised the full menu
            keyboard model - roving focus, Home/End, type-ahead, arrow navigation - and the
            popup implements none of it, so a screen-reader user was told to expect
            interactions that do nothing. The honest contract is the one actually built:
            aria-expanded plus aria-controls, and the two actions stay ordinary Tab stops. */}
        <Button
          ref={menuButtonRef}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Examination Actions"
          aria-expanded={isMenuOpen}
          aria-controls={actionsPopupId}
        >
          Actions
          <MoreVertical aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>

        {isMenuOpen && (
          <div
            id={actionsPopupId}
            className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-md border border-brand-border bg-brand-surface py-1 text-xs shadow-overlay"
          >
            {selectedSpecs.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  if (activeTemplateCode) {
                    onCloseOtherTemplates(activeTemplateCode);
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-brand-text transition-colors hover:bg-brand-tint hover:text-brand-navy focus-visible:bg-brand-tint focus-visible:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring"
              >
                <XCircle aria-hidden="true" className="h-3.5 w-3.5 text-brand-text-muted" />
                Close Other Examinations
              </button>
            )}

            <div className="my-1 border-t border-brand-border-subtle" />

            <button
              type="button"
              onClick={handleRequestClearAll}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold text-brand-danger transition-colors hover:bg-brand-danger-bg focus-visible:bg-brand-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              Clear All Examinations...
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
