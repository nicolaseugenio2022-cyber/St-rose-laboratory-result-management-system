import React from "react";

export interface TemplateRemarksBlockProps {
  remarks?: string | null;
}

export function TemplateRemarksBlock({ remarks }: TemplateRemarksBlockProps) {
  if (!remarks) return null;

  return (
    <div className="w-full mt-4 pt-2 border-t border-slate-200 text-xs">
      <div className="flex items-start gap-2">
        <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px] shrink-0 mt-0.5">
          REMARKS:
        </span>
        <span className="font-medium text-slate-800 whitespace-pre-line">{remarks}</span>
      </div>
    </div>
  );
}
