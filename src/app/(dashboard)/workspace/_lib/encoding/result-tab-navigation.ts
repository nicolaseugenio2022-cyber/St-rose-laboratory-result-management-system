/**
 * Forward-Tab fast path between result inputs.
 *
 * Encoding a report is a typing task: value, Tab, value, Tab. Native Tab order walks every
 * focusable node in the row - the next parameter's selection checkbox, and on a computed
 * parameter its Auto/Manual switch - so reaching the next result cost two or three keystrokes
 * per parameter. On a CBC that is forty wasted stops.
 *
 * This intercepts ONLY unmodified forward Tab raised from a result input, and only when a
 * later eligible result input exists. Everything else - Shift+Tab, any modified Tab, Tab from
 * anywhere outside the grid, and Tab from the last result - falls through to the browser.
 * Nothing is trapped, and no tabIndex is written anywhere: the checkboxes and mode switches
 * keep exactly the focusability they have, reachable by Shift+Tab and by tabbing into the row.
 *
 * The decision logic is pure and takes plain shapes rather than DOM nodes, so the verifier can
 * drive it with controlled fakes instead of asserting that a handler name appears in source.
 */

/** The contract every editable result control already carries. */
export const RESULT_INPUT_SELECTOR = "[data-encoding-input]";

/** The minimum a candidate must expose for eligibility to be decided. */
export interface ResultInputLike {
  /** Deselected parameters and Auto computed results are disabled. */
  disabled?: boolean;
  /** A read-only control is displayed, not edited. */
  readOnly?: boolean;
  /** False when the control is not rendered or not laid out. */
  isVisible?: boolean;
}

/** One collected candidate: its identity, its eligibility, and how to focus it. */
export interface ResultInputEntry extends ResultInputLike {
  /** Identity used to locate the event target. Any stable reference. */
  element: unknown;
  focus: () => void;
}

export interface ResultTabEvent {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target: unknown;
  preventDefault: () => void;
}

/**
 * A control is a Tab destination only when it can actually be typed into. Disabled covers
 * both a deselected parameter and an Auto computed result; read-only covers a control that
 * renders a value it will not accept; invisible covers a collapsed or unmounted region.
 */
export function isEligibleResultInput(candidate: ResultInputLike): boolean {
  if (candidate.disabled === true) return false;
  if (candidate.readOnly === true) return false;
  if (candidate.isVisible === false) return false;
  return true;
}

/**
 * The first eligible control strictly after `fromIndex`, or -1 when none remains.
 *
 * Strictly forward and never wrapping: reaching the end of the grid must hand Tab back to the
 * browser so the operator continues out of the grid, not back to the top of it.
 */
export function findNextEligibleResultIndex(
  inputs: readonly ResultInputLike[],
  fromIndex: number
): number {
  if (fromIndex < 0) return -1;
  for (let index = fromIndex + 1; index < inputs.length; index += 1) {
    if (isEligibleResultInput(inputs[index])) return index;
  }
  return -1;
}

/**
 * Handle one keydown. Returns true only when the Tab was taken over.
 *
 * Returning false means "not ours" and the caller must leave the event alone - that is the
 * boundary behaviour, not a failure.
 */
export function advanceToNextResultInput(
  event: ResultTabEvent,
  inputs: readonly ResultInputEntry[]
): boolean {
  if (event.key !== "Tab") return false;
  // Shift+Tab stays native so the operator can still reach the row's checkbox and mode switch
  // backwards. Ctrl/Alt/Meta+Tab belong to the platform and to the workspace shortcuts.
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return false;

  const currentIndex = inputs.findIndex((entry) => entry.element === event.target);
  // The event bubbled from something that is not a result input - a checkbox, a mode switch,
  // a menu. Not our concern.
  if (currentIndex < 0) return false;

  const nextIndex = findNextEligibleResultIndex(inputs, currentIndex);
  if (nextIndex < 0) return false;

  event.preventDefault();
  inputs[nextIndex].focus();
  return true;
}

/**
 * Collect candidates from the active result grid, in DOM order.
 *
 * Scoped to the grid container on purpose: `data-encoding-input` is also worn by Requested By,
 * the additional encoding fields, reagent kit information and repeatable findings, none of
 * which belong to this sequence. DOM order is also what preserves a ConditionalChoice's two
 * selects in their logical order before moving on to the next parameter.
 */
export function collectResultInputs(container: ParentNode): ResultInputEntry[] {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(RESULT_INPUT_SELECTOR));
  return nodes.map((node) => {
    const field = node as HTMLElement & { disabled?: boolean; readOnly?: boolean };
    return {
      element: node,
      disabled: field.disabled === true,
      readOnly: field.readOnly === true,
      // getClientRects is empty for anything display:none or not laid out, which covers a
      // collapsed region without needing to know why it collapsed.
      isVisible: node.getClientRects().length > 0,
      focus: () => node.focus(),
    };
  });
}
