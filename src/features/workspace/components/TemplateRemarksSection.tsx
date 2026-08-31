import React, { useState } from "react";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export interface TemplateRemarksSectionProps {
  remarks?: string | null;
  onChange: (remarks: string) => void;
}

export function TemplateRemarksSection({ remarks, onChange }: TemplateRemarksSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    // A structural tint group inside the white footer body, never another white card.
    <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-structural">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-brand-structural-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring"
      >
        <div className="flex items-center gap-2">
          <MessageSquare aria-hidden="true" className="h-4 w-4 text-brand-primary" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted">Laboratory Remarks</h3>
        </div>
        <div className="flex items-center gap-2">
          {remarks && remarks.trim() !== "" && (
            <Badge variant="success" size="sm">Has Remarks</Badge>
          )}
          {isExpanded ? <ChevronUp aria-hidden="true" className="h-4 w-4 text-brand-text-subtle" /> : <ChevronDown aria-hidden="true" className="h-4 w-4 text-brand-text-subtle" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-brand-border px-3 pb-3 pt-2.5">
          <textarea
            value={remarks || ""}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            placeholder="Enter official laboratory notes, observations, or specimen comments..."
            className="w-full rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-[13px] text-brand-text transition-[border-color,box-shadow] placeholder:text-slate-500 hover:border-brand-border-strong focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
          />
        </div>
      )}
    </div>
  );
}
