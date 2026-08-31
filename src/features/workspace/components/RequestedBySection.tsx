import React, { useEffect, useState } from "react";
import { RequestedByPolicySpec } from "@/domain/types/report-definition";
import { listAutoSuggestionsAction } from "@/features/server-boundary/server-actions";
import { Stethoscope } from "lucide-react";

export function RequestedBySection({ policy, value, onChange }: {
  policy: RequestedByPolicySpec;
  value: string;
  onChange: (value: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    listAutoSuggestionsAction({ category: "physician" })
      .then((items) => setSuggestions(items.map((item) => item.suggestionText)))
      .catch(() => setSuggestions([]));
  }, []);
  const listId = `requested-by-${policy.fieldLabel || "physician"}`.replace(/\W+/g, "-").toLowerCase();
  return (
    // No frame of its own. The enclosing setup band already separates this from the
    // results, and a bordered card here made the report card a card inside a card.
    <section className="max-w-lg" data-requested-by-section>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted" htmlFor={listId}>
        {policy.fieldLabel || "Requested By"}{policy.isRequired && <span className="text-rose-500"> *</span>}
      </label>
      <div className="relative">
        <input id={listId} list={`${listId}-options`} type="text" value={value} onChange={(event) => onChange(event.target.value)}
          readOnly={!policy.isEditable} required={policy.isRequired} data-requested-by-input data-encoding-input
          className="w-full rounded-md border border-brand-border bg-brand-card px-2.5 py-1.5 pr-8 text-xs font-medium text-brand-text transition-colors focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring" />
        <Stethoscope aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-brand-text-subtle" />
        <datalist id={`${listId}-options`}>{suggestions.map((item) => <option key={item} value={item} />)}</datalist>
      </div>
    </section>
  );
}
