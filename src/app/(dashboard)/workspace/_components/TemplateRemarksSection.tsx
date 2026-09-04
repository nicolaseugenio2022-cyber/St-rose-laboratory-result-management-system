import React from "react";
import { MessageSquare } from "lucide-react";
import { fieldLabelClassName } from "@/components/ui/Input";
import { cn } from "@/utils/cn";

export interface TemplateRemarksSectionProps {
  remarks?: string | null;
  onChange: (remarks: string) => void;
}

/**
 * Laboratory remarks for the active examination.
 *
 * Always visible, and deliberately without a disclosure control. Remarks were previously a
 * collapsible group inside the collapsed "Report Details" footer, so reaching them cost two
 * separate expansions - and the CBC default text, which the operator is meant to read and
 * confirm rather than discover, was invisible until both were opened.
 *
 * The field is optional at every examination: a blank remark stays valid, and nothing here
 * validates, trims or rewrites what is typed. The starting text is the report definition's own
 * `defaultRemarks`, applied when the report is created, and it remains fully editable.
 */
export function TemplateRemarksSection({ remarks, onChange }: TemplateRemarksSectionProps) {
  const fieldId = "template-remarks";

  return (
    <div data-remarks-section>
      <label htmlFor={fieldId} className={cn(fieldLabelClassName, "mb-1.5 flex items-center gap-1.5")}>
        <MessageSquare aria-hidden="true" className="h-3.5 w-3.5 text-brand-primary" />
        Laboratory Remarks
        <span className="font-normal normal-case tracking-normal text-brand-text-subtle">(optional)</span>
      </label>
      <textarea
        id={fieldId}
        data-remarks-input
        value={remarks || ""}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        placeholder="Enter official laboratory notes, observations, or specimen comments..."
        // The shared field surface, with the height left to `rows` because a textarea is not a
        // 36px control. `data-slot` gives it the same teal focus indicator as every other field.
        className="block w-full resize-y rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-[13px] text-brand-text outline-none transition-[color,border-color,box-shadow] placeholder:text-slate-500 hover:border-brand-border-strong focus-visible:border-ring"
        data-slot="textarea"
      />
    </div>
  );
}
