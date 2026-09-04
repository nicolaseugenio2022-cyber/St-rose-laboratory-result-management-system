import React, { useEffect, useMemo, useState } from "react";
import { RequestedByPolicySpec } from "@/domain/types/report-definition";
import { listAutoSuggestionsAction } from "@/features/server-boundary/server-actions";
import { fieldLabelClassName, fieldSurfaceClassName } from "@/components/ui/Input";
import { mergePhysicianSuggestions } from "../_lib/encoding/physician-suggestions";
import { cn } from "@/lib/utils";
import { Stethoscope } from "lucide-react";

/**
 * Requested By, per examination.
 *
 * A free-text combobox, never a closed select: the roster below is a set of suggestions, and the
 * operator may type any physician over them. The value is held on this report's `encodingData`,
 * so two examinations in one session can be requested by different doctors.
 *
 * Suggestions come from the report definitions first and from learned operator entries second
 * (see physician-suggestions), so the practice's doctors are offered on a laboratory that has
 * never completed a session and the list is never empty.
 */
export function RequestedBySection({ policy, value, onChange }: {
  policy: RequestedByPolicySpec;
  value: string;
  onChange: (value: string) => void;
}) {
  const [learned, setLearned] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    listAutoSuggestionsAction({ category: "physician" })
      .then((items) => {
        if (active) setLearned(items.map((item) => item.suggestionText));
      })
      .catch(() => {
        if (active) setLearned([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const suggestions = useMemo(() => mergePhysicianSuggestions(learned), [learned]);
  const listId = `requested-by-${policy.fieldLabel || "physician"}`.replace(/\W+/g, "-").toLowerCase();

  return (
    // No frame of its own. The enclosing setup band already separates this from the
    // results, and a bordered card here made the report card a card inside a card.
    <section className="max-w-lg" data-requested-by-section>
      <label className={cn(fieldLabelClassName, "mb-1.5")} htmlFor={listId}>
        {policy.fieldLabel || "Requested By"}{policy.isRequired && <span className="text-brand-danger"> *</span>}
      </label>
      <div className="relative">
        {/* The shared field surface rather than a retyped copy of it, so this control keeps the
            same geometry, states and focus indicator as every other field in the system. */}
        <input
          data-slot="input"
          id={listId}
          list={`${listId}-options`}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={!policy.isEditable}
          required={policy.isRequired}
          data-requested-by-input
          data-encoding-input
          autoComplete="off"
          placeholder="Type or select a physician..."
          className={cn(fieldSurfaceClassName, "block border placeholder:text-slate-500", "pr-9")}
        />
        <Stethoscope aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-text-subtle" />
        <datalist id={`${listId}-options`}>
          {suggestions.map((item) => <option key={item} value={item} />)}
        </datalist>
      </div>
    </section>
  );
}
