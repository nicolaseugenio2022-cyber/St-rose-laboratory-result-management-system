import React, { useState, useRef, useEffect } from "react";
import { HydratedTemplateSpec } from "@/services/interfaces";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Check, ChevronDown, FileText, MoreVertical, Trash2, X, XCircle } from "lucide-react";

/** Display-only encoding progress for one report. */
export interface ReportTabProgress {
  completedCount: number;
  selectedCount: number;
  isComplete: boolean;
  /**
   * A selected result of this report evaluated to `Invalid`. Supplied by the Workspace from the
   * shared completion rule; never recomputed here. Optional so a report whose progress has not
   * resolved yet is simply un-annotated rather than reported as clean.
   */
  hasInvalidResult?: boolean;
}

/**
 * The four states a queue entry can be in.
 *
 * Order is precedence, not severity of colour: `invalid` outranks `complete`, because a report
 * can be fully encoded and still carry a result that blocks completion, and reporting it as done
 * would hide the one thing standing between the operator and a completed session.
 */
type QueueState = "invalid" | "complete" | "inProgress" | "notStarted";

function resolveQueueState(progress: ReportTabProgress | undefined): QueueState | null {
  if (!progress) return null;
  if (progress.hasInvalidResult) return "invalid";
  if (progress.isComplete) return "complete";
  if (progress.completedCount === 0) return "notStarted";
  return "inProgress";
}

/** The accessible state word for each queue state. Rendered as text, never as a colour. */
const QUEUE_STATE_LABEL: Record<QueueState, string> = {
  invalid: "Contains invalid result",
  complete: "Complete",
  inProgress: "In progress",
  notStarted: "Not started",
};

/**
 * The state rail. Reinforcement only - every state already carries a glyph or a numeral and an
 * accessible word, so nothing here is the sole indicator of anything.
 *
 * The rail encodes report state and only report state. The active report is marked by its white
 * surface, its navy label and `aria-selected`, not by this rail, so the two channels never have
 * to be told apart.
 */
const QUEUE_STATE_RAIL: Record<QueueState, string> = {
  invalid: "border-l-brand-danger",
  complete: "border-l-brand-primary",
  inProgress: "border-l-transparent",
  notStarted: "border-l-transparent",
};

/**
 * The visible, non-colour signal for one state, plus its accessible word.
 *
 * `invalid` keeps the count alongside its glyph: the operator still needs to know how much of the
 * report is encoded, and dropping the numeral would make a nearly-finished report with one bad
 * value look identical to an untouched one.
 */
function QueueStateSignal({ state, progress }: { state: QueueState; progress: ReportTabProgress }) {
  const count = (
    <span className="font-mono text-xs font-medium tabular-nums">
      {progress.completedCount}/{progress.selectedCount}
    </span>
  );

  return (
    <span className="flex shrink-0 items-center gap-1">
      {state === "invalid" && (
        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-brand-danger" />
      )}
      {state === "complete" ? (
        <Check aria-hidden="true" className="h-4 w-4 shrink-0 stroke-[2.5] text-brand-primary" />
      ) : (
        count
      )}
      {/* The state in words, inside the control, so it joins the accessible name rather than
          replacing it - the visible title and code stay part of that name (WCAG 2.5.3). */}
      <span className="sr-only">{QUEUE_STATE_LABEL[state]}</span>
    </span>
  );
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
   * Per-report progress, keyed by template code. Display only: the Workspace derives it from the
   * shared completion rule, so this panel never computes completeness and cannot drift from the
   * meter the report card draws. A template with no entry is simply not annotated - it is never
   * dropped from the queue.
   */
  progressByTemplateCode?: Record<string, ReportTabProgress>;
  /**
   * Called after a report is activated from this queue. The drawer instance closes itself here;
   * the docked instance passes nothing, because nothing needs to happen.
   */
  onAfterSelect?: () => void;
  /**
   * Distinguishes the docked and drawer instances, which **can be mounted at the same time**.
   *
   * Responsive hiding here is CSS, not unmounting: below 1152px the docked queue is
   * `display:none` but still in the document, so opening the drawer puts a second live copy of
   * every entry on the page. This scopes the ids those entries mint, which is what keeps them
   * unique across both copies.
   */
  variant?: "docked" | "drawer";
}

/**
 * The work queue: every selected examination in this session, as a vertical column.
 *
 * This replaces the horizontal tab strip. Tabs truncated their titles at a fixed width and
 * overflowed sideways once a visit carried four or more examinations, which is routine; a column
 * carries any number, keeps the full title legible, and - because each entry states its own
 * state in place - can be scanned top to bottom for the report that still needs work.
 *
 * The tab/tabpanel contract:
 *
 * - **Tab ids are scoped to the variant** - `report-tab-${variant}-${code}` - because the docked
 *   and drawer instances can be in the DOM at the same time, and a shared id would resolve every
 *   reference to whichever copy came first in document order, which below 1152px is the hidden
 *   one.
 * - **The report panel keeps one unique id**, `report-panel-${code}`. There is only ever one
 *   panel, so it needs no scoping.
 * - **`aria-controls`** on each tab still points at that single panel id, from either variant.
 * - **The panel names itself directly**, with an `aria-label` carrying the report title, rather
 *   than `aria-labelledby` a tab id - no single tab id reliably identifies the *visible* variant.
 * - **Roving `tabIndex` is unchanged**: the active tab is the queue's only Tab stop, and the
 *   arrow keys move between entries from there.
 *
 * Only the orientation and the arrow keys that go with it differ from the previous horizontal
 * strip, which is what `aria-orientation="vertical"` declares.
 */
export function SelectedReportsPanel({
  selectedSpecs,
  activeTemplateCode,
  onSelectActiveTemplate,
  onRemoveTemplate,
  onCloseOtherTemplates,
  onClearAllTemplates,
  isDirty = false,
  progressByTemplateCode,
  onAfterSelect,
  variant = "docked",
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

  // The zero-selected session renders the catalog as its whole task surface, so the queue is not
  // mounted at all there. This guard exists so an unexpected empty render is silent rather than
  // drawing an empty frame beside a screen that already explains itself.
  if (selectedSpecs.length === 0) return null;

  const handleRequestClearAll = () => {
    setIsMenuOpen(false);
    onClearAllTemplates();
  };

  const activateAt = (index: number) => {
    const nextCode = selectedSpecs[index].template.templateCode;
    onSelectActiveTemplate(nextCode);
    // focus() also scrolls the newly active entry into view inside a queue taller than its
    // column, so keyboard switching never leaves it off screen.
    tabRefs.current[nextCode]?.focus();
    // Parity with click activation. Without this the drawer stayed open after an arrow-key or
    // Home/End activation while closing after a tap, so the same act had two different outcomes
    // depending on the input device. Undefined on the docked queue, where nothing should close.
    onAfterSelect?.();
  };

  /**
   * Vertical tablist keys. Up/Down wrap, Home/End jump - the pattern `aria-orientation="vertical"`
   * promises. Left/Right are deliberately not handled: `Ctrl/Cmd+Arrow` is the Workspace's own
   * report-switch shortcut and claiming the unmodified horizontal arrows here would put two
   * different meanings on the same key inside one surface.
   */
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key === "Home") {
      event.preventDefault();
      activateAt(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      activateAt(selectedSpecs.length - 1);
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    activateAt((currentIndex + direction + selectedSpecs.length) % selectedSpecs.length);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-brand-border bg-brand-structural">
      {/* Queue header: what this column is, how much of it there is, and whether the session has
          unsaved work. A count, not a row of badges. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-brand-border px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight tracking-tight text-brand-navy">
          Session examinations
        </h2>
        {isDirty && (
          <Badge variant="warning" size="sm" role="status" className="shrink-0">
            Unsaved
          </Badge>
        )}
        <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-brand-text-muted">
          {selectedSpecs.length}
        </span>
      </div>

      {/* The queue itself. White, so it reads as the working list against the structural frame. */}
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Selected examination reports"
        className="min-h-0 flex-1 divide-y divide-brand-border-subtle overflow-y-auto bg-brand-card"
      >
        {selectedSpecs.map((spec, index) => {
          const code = spec.template.templateCode;
          const isActive = activeTemplateCode === code;
          // Scoped to the variant, because responsive hiding is CSS and not unmounting: below
          // 1152px the docked queue is `display:none` but still in the DOM, so opening the drawer
          // puts a second copy of every entry on the page. A shared `report-tab-<code>` would
          // then be a duplicate id, and every aria reference to it would resolve to whichever
          // copy came first in document order - the invisible one.
          const tabId = `report-tab-${variant}-${code}`;
          const panelId = `report-panel-${code}`;
          const progress = progressByTemplateCode?.[code];
          const state = resolveQueueState(progress);

          return (
            <div
              key={code}
              role="presentation"
              className={cn(
                // Two edges, two meanings, on opposite sides so neither can mask the other.
                // LEFT (on the tab button below) is report STATE - rose for a report carrying an
                // invalid result, teal for a complete one. RIGHT is ACTIVE, the teal edge on the
                // side facing the worksheet this entry controls. An invalid report therefore
                // still reads as invalid while it is the open one, which a single shared edge
                // could not express. Both are always present and only change colour, so nothing
                // shifts by a pixel when either changes.
                "group relative flex items-stretch border-r-[3px] transition-colors duration-150",
                isActive
                  ? "border-r-brand-primary bg-brand-card"
                  : "border-r-transparent bg-brand-structural hover:bg-brand-structural-hover"
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
                onClick={() => {
                  onSelectActiveTemplate(code);
                  onAfterSelect?.();
                }}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                title={`${spec.template.templateTitle} (${spec.template.examinationFamily})`}
                className={cn(
                  // The rail is always present and only changes colour, so nothing shifts by a
                  // pixel when a report's state changes underneath the operator.
                  "flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center gap-0.5 border-l-[3px] py-2 pl-2.5 pr-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring",
                  state ? QUEUE_STATE_RAIL[state] : "border-l-transparent"
                )}
              >
                <span
                  className={cn(
                    "block truncate text-[13px] leading-tight",
                    isActive ? "font-semibold text-brand-navy" : "font-medium text-brand-text"
                  )}
                >
                  {spec.template.templateTitle}
                </span>
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-brand-text-muted">
                    {code}
                  </span>
                  {state && progress && <QueueStateSignal state={state} progress={progress} />}
                </span>
              </button>

              {/* Sibling of the tab, never nested: a control inside a control is invalid, and the
                  removal target must be reachable without activating the report first. */}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveTemplate(code);
                }}
                // 44px wide on touch, 36px from sm up. Height is already at least 44 because the
                // control stretches to the row, which carries min-h-11.
                className="inline-flex w-11 shrink-0 items-center justify-center self-stretch text-brand-text-subtle transition-colors hover:bg-brand-danger-bg hover:text-brand-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring sm:w-9"
                title={`Remove ${spec.template.templateTitle}`}
                aria-label={`Remove ${spec.template.templateTitle} examination`}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Queue footer: bulk actions only. The control that adds an examination lives beside this
          in the Workspace, where it is a primary action rather than a menu item. */}
      <div className="relative shrink-0 border-t border-brand-border px-2 py-1.5" ref={menuRef}>
        {/* A disclosure, not an ARIA menu. `aria-haspopup="menu"` would promise roving focus,
            Home/End and type-ahead, none of which the popup implements. */}
        <Button
          ref={menuButtonRef}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-expanded={isMenuOpen}
          aria-controls={actionsPopupId}
          className="w-full justify-start"
        >
          <MoreVertical aria-hidden="true" className="h-3.5 w-3.5" />
          Examination actions
        </Button>

        {isMenuOpen && (
          <div
            id={actionsPopupId}
            className={cn(
              // Both variants open UPWARD, into the queue body. The footer is the last row of a
              // container that clips (`overflow-hidden`, which is what keeps the tablist
              // scrolling inside its own column), so a popup placed below the footer with
              // `top-full` is drawn outside that box and clipped away entirely - it was
              // unreachable in the drawer. Opening upward keeps it inside the visible area
              // without removing the clipping or the scrolling that depend on it.
              "absolute bottom-full left-2 right-2 z-30 mb-1 overflow-hidden rounded-md border border-brand-border bg-brand-surface py-1 text-xs shadow-overlay"
            )}
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

export interface WorkQueueTriggerProps {
  selectedSpecs: HydratedTemplateSpec[];
  activeTemplateCode: string | null;
  progressByTemplateCode?: Record<string, ReportTabProgress>;
  isOpen: boolean;
  onOpen: () => void;
  drawerId: string;
  triggerRef?: React.Ref<HTMLButtonElement>;
}

/**
 * The compact queue trigger, below the width at which the queue can be docked.
 *
 * It names the active report rather than reducing it to an icon or a bare count: two reports in
 * one session routinely share a progress figure - `0/8` and `0/8` - so a count-only control could
 * not tell the operator which report they are looking at. Everything the docked queue header
 * carries is here in one row: how many examinations the session holds, which one is open, how far
 * it has got, and whether anything in the session is blocking completion.
 */
export function WorkQueueTrigger({
  selectedSpecs,
  activeTemplateCode,
  progressByTemplateCode,
  isOpen,
  onOpen,
  drawerId,
  triggerRef,
}: WorkQueueTriggerProps) {
  if (selectedSpecs.length === 0) return null;

  const activeSpec = selectedSpecs.find((spec) => spec.template.templateCode === activeTemplateCode);
  const activeProgress = activeTemplateCode ? progressByTemplateCode?.[activeTemplateCode] : undefined;
  const activeState = resolveQueueState(activeProgress);
  const invalidCount = selectedSpecs.filter(
    (spec) => progressByTemplateCode?.[spec.template.templateCode]?.hasInvalidResult
  ).length;

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={onOpen}
      aria-expanded={isOpen}
      aria-controls={drawerId}
      className="flex min-h-11 w-full items-center gap-2 border-b border-brand-border bg-brand-structural px-3 py-1.5 text-left transition-colors hover:bg-brand-structural-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring"
    >
      <span className="flex shrink-0 items-center gap-1 text-brand-text-muted">
        <FileText aria-hidden="true" className="h-4 w-4" />
        <span className="font-mono text-xs font-semibold tabular-nums">{selectedSpecs.length}</span>
      </span>
      <span className="sr-only">
        examinations in this session. Open the examination queue. Active report:
      </span>

      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight text-brand-navy">
        {activeSpec?.template.templateTitle ?? "No report open"}
      </span>
      {activeSpec && (
        <span className="hidden shrink-0 font-mono text-xs text-brand-text-muted sm:inline">
          {activeSpec.template.templateCode}
        </span>
      )}

      {activeState && activeProgress && (
        <QueueStateSignal state={activeState} progress={activeProgress} />
      )}

      {invalidCount > 0 && (
        <span className="flex shrink-0 items-center">
          <AlertTriangle aria-hidden="true" className="h-4 w-4 text-brand-danger" />
          <span className="sr-only">
            {invalidCount === 1
              ? "1 report in this session contains an invalid result"
              : `${invalidCount} reports in this session contain an invalid result`}
          </span>
        </span>
      )}

      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-text-subtle" />
    </button>
  );
}
