import React, { useState } from "react";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

export interface TemplateRemarksSectionProps {
  remarks?: string | null;
  onChange: (remarks: string) => void;
}

export function TemplateRemarksSection({ remarks, onChange }: TemplateRemarksSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="mt-2.5 overflow-hidden rounded-lg border border-brand-card-border bg-brand-background transition-colors">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-brand-structural-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand-primary" />
          <h3 className="text-xs font-bold text-brand-text uppercase tracking-wider">Laboratory Remarks</h3>
        </div>
        <div className="flex items-center gap-2">
          {remarks && remarks.trim() !== "" && (
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full">
              Has Remarks
            </span>
          )}
          {isExpanded ? <ChevronUp className="h-4 w-4 text-brand-text-subtle" /> : <ChevronDown className="h-4 w-4 text-brand-text-subtle" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 border-t border-brand-card-border mt-2">
          <textarea
            value={remarks || ""}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            placeholder="Enter official laboratory notes, observations, or specimen comments..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-brand-border bg-brand-card focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:border-brand-primary focus-visible:outline-none"
          />
        </div>
      )}
    </div>
  );
}
