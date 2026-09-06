"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, MessageSquare, Send, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * A floating support chat for the authenticated application shells. It sits in the
 * bottom-right corner of the viewport as a teal action button that expands into a
 * bounded panel. The conversation lives only in this component's memory: it is never
 * persisted, so a page reload clears it and nothing user- or patient-identifying is
 * written by the client.
 *
 * The panel marks a log region with polite announcements: streaming assistant text is
 * read as it arrives rather than being spelled out all at once. The composer is focused
 * when the panel opens and focus is returned to the launcher when it closes; Escape
 * closes it. The `print:hidden` matches the rest of the chrome - the widget is a screen
 * convenience and must never leak between the page and a printout.
 */
type ChatMessage = { role: "user" | "assistant"; content: string };

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hello! I'm the St. Rose Lab Assistant. I can help you use the system — encoding " +
    "reports, signatories, history and printing. Please keep patient names and clinical " +
    "data out of this chat; messages are handled by an external AI provider.",
};

const CHAT_PANEL_ID = "lab-support-chat";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Focus enters the composer when the panel opens and returns to the launcher on close.
  useEffect(() => {
    if (isOpen) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    toggleRef.current?.focus();
    return undefined;
  }, [isOpen]);

  // Stay pinned to the newest message while the conversation (or a stream) grows.
  useEffect(() => {
    const region = scrollRef.current;
    if (region) region.scrollTop = region.scrollHeight;
  }, [messages, isStreaming]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const sendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || isStreaming) return;

      const history: ChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setInput("");
      setError(null);
      setIsStreaming(true);

      let assembled = "";
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });

        if (!response.ok) {
          let message = "The assistant is having trouble right now. Please try again.";
          try {
            const body = (await response.json()) as { error?: unknown };
            if (response.status === 429) {
              message = "You've sent a lot of messages in a short time. Wait a moment and try again.";
            } else if (response.status === 503) {
              message = "Chat support isn't configured yet. Contact your administrator.";
            } else if (typeof body.error === "string") {
              message = body.error;
            }
          } catch {
            // Keep the generic message.
          }
          setError(message);
          setMessages(history);
          return;
        }

        // The middleware redirects an expired or missing session to the login page, which
        // comes back as HTML with a 200. Without this guard the NDJSON parser would swallow
        // that page silently and leave an empty bubble.
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("text/html")) {
          setError("Your session may have been closed. Refresh the page to continue.");
          setMessages(history);
          return;
        }

        if (!response.body) {
          setError("The assistant returned an empty response. Please try again.");
          setMessages(history);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            const trimmed = line.trim();
            if (!trimmed) continue;
            let parsed: unknown;
            try {
              parsed = JSON.parse(trimmed);
            } catch {
              continue;
            }
            if (typeof parsed !== "object" || parsed === null) continue;
            const payload = parsed as { text?: unknown; done?: unknown; error?: unknown };
            if (typeof payload.text === "string" && payload.text.length > 0) {
              assembled += payload.text;
              const snapshot = assembled;
              setMessages((prev) => {
                if (prev.length === 0) return prev;
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: snapshot };
                return next;
              });
            }
            if (typeof payload.error === "string") {
              setError(payload.error);
            }
          }
        }
      } catch {
        setError("The assistant is unavailable right now. Please try again.");
        setMessages(history);
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, isStreaming]
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

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
          "active:scale-[0.97] motion-reduce:active:scale-100 print:hidden"
        )}
      >
        {isOpen ? (
          <X aria-hidden="true" className="h-5 w-5" />
        ) : (
          <MessageSquare aria-hidden="true" className="h-5 w-5" />
        )}
      </button>

      {isOpen && (
        <section
          id={CHAT_PANEL_ID}
          role="dialog"
          aria-label="Lab support chat"
          className={cn(
            "no-print fixed bottom-[4.5rem] right-4 z-40 flex w-[min(24rem,calc(100vw-2rem))]",
            "flex-col overflow-hidden rounded-xl border border-brand-border-strong bg-brand-surface",
            "shadow-overlay motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95",
            "h-[26rem] max-h-[calc(100dvh-7.5rem)] sm:h-[30rem] print:hidden"
          )}
        >
          {/* Header band: identity navy with a quiet teal mark, matching the shell chrome. */}
          <header className="flex shrink-0 items-center justify-between gap-3 bg-brand-navy px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-brand-tint">
                <Sparkles aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold leading-tight text-white">
                  Lab Support Assistant
                </h2>
                <p className="text-[11px] leading-tight text-brand-navy-muted">Powered by Groq</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close lab support chat"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-brand-navy-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </header>

          {/* Message log: announced politely as assistant text streams in. */}
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
            className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-brand-surface px-3.5 py-4"
          >
            {messages.map((message, index) =>
              message.role === "user" ? (
                <div key={index} className="flex justify-end">
                  <div className="max-w-[85%] rounded-md bg-brand-primary px-3 py-2 text-[13px] leading-relaxed text-white [overflow-wrap:anywhere]">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={index} className="flex justify-start">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-md border border-brand-border bg-brand-structural px-3 py-2 text-[13px] leading-relaxed text-brand-text [overflow-wrap:anywhere]">
                    {message.content ||
                      (isStreaming && index === messages.length - 1 ? "\u2026" : "")}
                  </div>
                </div>
              )
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-brand-danger bg-brand-danger-bg px-3 py-2 text-xs font-medium text-brand-danger"
              >
                <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Composer: a compact field in the shared surface geometry with the medium action. */}
          <form
            onSubmit={handleSubmit}
            className="flex shrink-0 items-center gap-2 border-t border-brand-border bg-brand-surface p-3"
          >
            <label htmlFor="lab-support-chat-input" className="sr-only">
              Message
            </label>
            <input
              ref={inputRef}
              id="lab-support-chat-input"
              type="text"
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              placeholder="Ask a question about the system\u2026"
              autoComplete="off"
              disabled={isStreaming}
              className="h-9 min-w-0 flex-1 rounded-md border border-brand-border bg-brand-surface px-3 text-[13px] text-brand-text transition-[border-color,box-shadow] placeholder:text-slate-500 hover:border-brand-border-strong focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring disabled:cursor-not-allowed disabled:bg-brand-structural disabled:text-brand-text-muted disabled:opacity-80"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isStreaming}
              disabled={!input.trim() || isStreaming}
              className="h-9 shrink-0 px-3"
              aria-label="Send message"
            >
              <Send aria-hidden="true" className="h-4 w-4" />
            </Button>
          </form>
        </section>
      )}
    </>
  );
}