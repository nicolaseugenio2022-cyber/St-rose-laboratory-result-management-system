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
    <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-3" data-requested-by-section>
      <label className="mb-1 block text-[10px] font-bold uppercase text-slate-700" htmlFor={listId}>
        {policy.fieldLabel || "Requested By"}{policy.isRequired && <span className="text-rose-500"> *</span>}
      </label>
      <div className="relative max-w-lg">
        <input id={listId} list={`${listId}-options`} type="text" value={value} onChange={(event) => onChange(event.target.value)}
          readOnly={!policy.isEditable} required={policy.isRequired} data-requested-by-input data-encoding-input
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 pr-8 text-xs font-medium focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
        <Stethoscope className="pointer-events-none absolute right-2.5 top-1.5 h-3.5 w-3.5 text-slate-400" />
        <datalist id={`${listId}-options`}>{suggestions.map((item) => <option key={item} value={item} />)}</datalist>
      </div>
    </section>
  );
}
