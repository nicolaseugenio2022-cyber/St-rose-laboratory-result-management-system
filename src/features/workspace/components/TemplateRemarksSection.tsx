import React, { useState } from "react";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

export interface TemplateRemarksSectionProps {
  remarks?: string | null;
  onChange: (remarks: string) => void;
}

export function TemplateRemarksSection({ remarks, onChange }: TemplateRemarksSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-slate-50/80 rounded-xl border border-slate-200 overflow-hidden mt-2.5 transition-all">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-100/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand-primary" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Laboratory Remarks</h3>
        </div>
        <div className="flex items-center gap-2">
          {remarks && remarks.trim() !== "" && (
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full">
              Has Remarks
            </span>
          )}
          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 border-t border-slate-200/60 mt-2">
          <textarea
            value={remarks || ""}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            placeholder="Enter official laboratory notes, observations, or specimen comments..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
