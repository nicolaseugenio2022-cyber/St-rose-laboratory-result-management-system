"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MessageSquare, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A floating support chat for the authenticated application shells. It sits in the
 * bottom-right corner of the viewport as a teal action button that expands into a
 * bounded panel. The conversation lives only in the panel's memory: it is never
 * persisted, so a page reload clears it and nothing user- or patient-identifying is
 * written by the client.
 *
 * CLINIC-PERF-01: this module is the LAUNCHER ONLY. Every protected page mounted the
 * whole widget - the conversation state, the NDJSON streaming reader, the assistant-content
 * renderer and the composer - while the panel was closed, so each navigation downloaded and
 * parsed code that nothing on the page could run until the operator chose to open it. The
 * body lives in `ChatPanel` and is fetched on first open through `next/dynamic`, the same
 * mechanism the Workspace and History already use for the rendering engine.
 *
 * What did not change: the launcher's markup, classes, icons and aria wiring; the panel's
 * appearance and privacy warning; the `/api/chat` contract; Escape-to-close; and the focus
 * model - the composer takes focus on open, and focus returns to this button on close.
 */

/**
 * The first-open placeholder, and why the panel identity lives on it.
 *
 * CLINIC-PERF-01-R1: the launcher sets `aria-expanded="true"` the moment it is pressed, and
 * `aria-controls` names `CHAT_PANEL_ID`. Between that press and the chunk arriving there was
 * nothing in the document with that id, so on a slow connection the button claimed an
 * expanded panel that did not exist and assistive technology was pointed at nothing. This
 * placeholder carries the same id, so the relationship the launcher advertises is true for
 * the whole of that interval.
 *
 * CLINIC-PERF-01-R2: it is not a dialog. The first revision reused the panel's
 * `role="dialog"` and label, which claimed an operable dialog while focus deliberately stayed
 * on the launcher and there was nothing inside to operate - a dialog nobody is in, with no
 * focusable content, is a false promise to a screen-reader user.
 *
 * CLINIC-PERF-01-R3: the announcement had to leave the busy container. R2 put `role="status"`
 * and `aria-busy="true"` on the SAME element, which is self-defeating: `aria-busy` tells
 * assistive technology to withhold updates from that region until it settles, so the live
 * region suppressed the very message it existed to deliver, and the region is then replaced
 * rather than settled - the update never arrives at all. The two responsibilities are now
 * separate elements:
 *
 *   - the CONTROLLED container keeps `id` and `aria-busy="true"`, and carries the geometry
 *     and the visible text. It has no role and no live semantics, so nothing about it is
 *     expected to be announced while it is busy.
 *   - a single `role="status"` sr-only SIBLING, outside that busy subtree, carries the
 *     message. Being outside is what makes it eligible to be announced at all.
 *
 * The visible copy is `aria-hidden`, so the text is presented once visually and once to
 * assistive technology - never twice to the same reader. Both elements are returned by this
 * one component, so the announcement is removed on exactly the events that retire the
 * placeholder: the panel finishing its load, and the operator cancelling before it does.
 *
 * The panel's own `role="log"` does not exist yet while this is on screen, so there is
 * exactly one live region at any moment and nothing can interleave.
 *
 * The geometry classes are copied from the panel deliberately, so the placeholder occupies
 * exactly the box the panel will occupy and the swap causes no layout jump. The sr-only
 * sibling is removed from flow and contributes none of it. The entrance animation is NOT
 * copied: animating the placeholder in and then the panel in again would play the same
 * motion twice for one open.
 */
const CHAT_PANEL_ID = "lab-support-chat";

const CHAT_LOADING_MESSAGE = "Loading Lab Support Assistant…";

function ChatPanelFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        {CHAT_LOADING_MESSAGE}
      </span>
      <section
        id={CHAT_PANEL_ID}
        aria-busy="true"
        data-chat-surface
        className={cn(
          "no-print fixed bottom-[4.5rem] right-4 z-40 flex w-[min(24rem,calc(100vw-2rem))]",
          "flex-col items-center justify-center overflow-hidden rounded-xl border border-brand-border-strong bg-brand-surface",
          "shadow-overlay",
          "h-[26rem] max-h-[calc(100dvh-7.5rem)] sm:h-[30rem] print:hidden",
          "px-4 text-[13px] text-brand-text-muted"
        )}
      >
        <span aria-hidden="true">{CHAT_LOADING_MESSAGE}</span>
      </section>
    </>
  );
}

const ChatPanel = dynamic(
  () => import("@/components/chat/ChatPanel").then((chatModule) => chatModule.ChatPanel),
  { loading: () => <ChatPanelFallback /> }
);

export interface ChatWidgetProps {
  /**
   * Where the launcher sits from `lg` up. Below `lg` it is always the bottom-right button,
   * because that is the only placement a thumb reaches on a phone.
   *
   * "floating" is the default and the behaviour every route outside the Workspace keeps: fixed
   * at the bottom-right corner at every width.
   *
   * "workspace-rail" moves it into the Workspace navigation rail's own column on desktop. The
   * rail is 56px of navy at the far left, its links stop below the brand block, and the mobile
   * navigation launcher that used to share that corner is `lg:hidden` - so the space is empty
   * and belongs to navigation rather than to the worksheet. This exists because the launcher is
   * `position: fixed` and reserves no space, so at the bottom-right it sat on top of the sticky
   * Report Details row and its Show/Hide control at 1024 and 1440. Measured, not assumed: 1920
   * escaped only because the shell caps at 1680px and centres, leaving a margin for the button
   * to land in. Nothing else about the control changes - same size, same colour, same accessible
   * name, same panel, same focus handling, one button and one tab stop.
   */
  launcherPlacement?: "floating" | "workspace-rail";
}

export function ChatWidget({ launcherPlacement = "floating" }: ChatWidgetProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  /**
   * Latched once the panel module has actually mounted.
   *
   * It keeps the panel RENDERED after a close, which is what preserves the conversation and
   * any half-typed draft across close/reopen - the panel returns null while shut rather than
   * unmounting. Before the first open both flags are false, so `ChatPanel` is not rendered at
   * all and its chunk is never requested.
   *
   * It also bounds the placeholder: if the operator closes the panel while the chunk is still
   * in flight, this is still false, the whole subtree unmounts, and no loading placeholder is
   * left on screen claiming to be open. The in-flight import is not wasted - the module
   * resolves into the bundler's cache, so reopening mounts it without a second request.
   */
  const [isPanelLoaded, setIsPanelLoaded] = useState(false);

  const toggleRef = useRef<HTMLButtonElement>(null);
  /**
   * Whether the panel has been open since the last focus restoration.
   *
   * CLINIC-PERF-01-R1: the restore effect below previously ran on MOUNT as well, because
   * `isOpen` starts false and "not open" was treated as "just closed". Every protected page
   * load therefore pulled keyboard focus out of the page and onto the floating chat button.
   * This ref makes the effect a real open -> closed TRANSITION detector: it is only armed by
   * an actual open, so the initial mount restores nothing and focus stays where the page put
   * it. A ref rather than state, because arming it must not itself cause a render.
   */
  const hasBeenOpenedRef = useRef(false);

  const closePanel = useCallback(() => setIsOpen(false), []);
  const handlePanelReady = useCallback(() => setIsPanelLoaded(true), []);

  // Focus returns to the launcher only after the panel has actually been open and is now
  // closed - by the launcher, by the header close button, or by Escape. Focusing the composer
  // on open is the panel's own effect, because it owns that field's ref.
  useEffect(() => {
    if (isOpen) {
      hasBeenOpenedRef.current = true;
      return;
    }
    if (!hasBeenOpenedRef.current) return;
    hasBeenOpenedRef.current = false;
    toggleRef.current?.focus();
  }, [isOpen]);

  /**
   * Escape during the first-open fetch, and only then.
   *
   * CLINIC-PERF-01-R2: Escape-to-close lives in `ChatPanel`, so while the chunk was still in
   * flight the key did nothing - the operator had opened something they could not dismiss
   * from the keyboard, for exactly as long as the network took. This covers that window and
   * nothing else.
   *
   * `isPanelLoaded` is the handover, so the two handlers can never both be listening: the
   * moment the panel mounts it registers its own and this effect tears down. The panel's
   * effect runs first (child before parent), so the transition is a swap rather than a gap,
   * and both would do the same thing anyway.
   *
   * Focus needs no restoration here - it never left the launcher during loading, because the
   * placeholder holds nothing focusable and the composer does not exist yet. The transition
   * effect above still runs on the close and re-focuses the launcher, which is harmless when
   * it is already the active element.
   */
  useEffect(() => {
    if (!isOpen || isPanelLoaded) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isPanelLoaded]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={CHAT_PANEL_ID}
        aria-label={isOpen ? "Close lab support chat" : "Open lab support chat"}
        className={cn(
          "no-print fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-xl",
          "bg-brand-primary text-white shadow-overlay transition-colors motion-reduce:transition-none",
          "hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
          "active:scale-[0.97] motion-reduce:active:scale-100 print:hidden",
          // Into the rail's column from lg up, centred in its 56px width: (56 - 48) / 2 = 4px.
          // `right-auto` is required - without it the button keeps both offsets and stretches.
          launcherPlacement === "workspace-rail" && "lg:left-1 lg:right-auto",
          // Out of the way while the panel is open, because on desktop the panel opens from the
          // same corner and would otherwise sit on top of its own launcher. Hidden only from lg
          // up: on a phone the panel is bottom-right and the launcher is its close affordance.
          //
          // `hidden` and not `invisible`, so it leaves the tab order rather than becoming an
          // invisible stop. Focus restoration still works: closing flips `isOpen` first, so the
          // button is back in the document by the time the restore effect runs and focuses it.
          launcherPlacement === "workspace-rail" && isOpen && "lg:hidden"
        )}
      >
        {isOpen ? (
          <X aria-hidden="true" className="h-5 w-5" />
        ) : (
          <MessageSquare aria-hidden="true" className="h-5 w-5" />
        )}
      </button>

      {(isOpen || isPanelLoaded) && (
        <ChatPanel
          isOpen={isOpen}
          panelId={CHAT_PANEL_ID}
          onClose={closePanel}
          onReady={handlePanelReady}
        />
      )}
    </>
  );
}
