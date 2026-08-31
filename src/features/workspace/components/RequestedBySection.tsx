import React, { useEffect, useState } from "react";
import { RequestedByPolicySpec } from "@/domain/types/report-definition";
import { listAutoSuggestionsAction } from "@/features/server-boundary/server-actions";
import { Input } from "@/components/ui/Input";
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
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted" htmlFor={listId}>
        {policy.fieldLabel || "Requested By"}{policy.isRequired && <span className="text-brand-danger"> *</span>}
      </label>
      <div className="relative">
        <Input id={listId} list={`${listId}-options`} type="text" value={value} onChange={(event) => onChange(event.target.value)}
          readOnly={!policy.isEditable} required={policy.isRequired} data-requested-by-input data-encoding-input
          className="pr-9" />
        <Stethoscope aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-text-subtle" />
        <datalist id={`${listId}-options`}>{suggestions.map((item) => <option key={item} value={item} />)}</datalist>
      </div>
    </section>
  );
}
