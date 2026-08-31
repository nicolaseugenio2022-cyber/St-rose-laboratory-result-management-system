import React from "react";
import { IRepeatableFindingValue } from "@/domain/models/interfaces";
import { RepeatableFindingSpec } from "@/domain/types/report-definition";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

/** Icon-only row action: a square outline Button at the field height. */
const ROW_ACTION_CLASS = "h-11 w-11 shrink-0 px-0 sm:h-9 sm:w-9";

export function RepeatableFindingsSection({ specs, values, onChange }: {
  specs: RepeatableFindingSpec[];
  values: Record<string, IRepeatableFindingValue[]>;
  onChange: (category: string, findings: IRepeatableFindingValue[]) => void;
}) {
  return <section className="space-y-3 rounded-lg border border-brand-border bg-brand-structural p-3" data-repeatable-findings>
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted">Additional Findings</h3>
    {specs.map((spec) => {
      const findings = [...(values[spec.findingCategory] || [])].sort((a, b) => a.displayOrder - b.displayOrder);
      const canAdd = spec.maxEntries == null || findings.length < spec.maxEntries;
      const commit = (next: IRepeatableFindingValue[]) => onChange(spec.findingCategory, next.map((item, index) => ({ ...item, displayOrder: index + 1 })));
      return <div key={spec.findingCategory} className="space-y-2" data-finding-category={spec.findingCategory}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">{spec.findingCategory}</div>
        {findings.map((finding, index) => <div key={finding.id} className="flex items-center gap-2" data-repeatable-finding={finding.id}>
          <div className="min-w-0 flex-1">
            {spec.allowedOptions?.length ? <Select options={[]} value={finding.value} onChange={(e) => commit(findings.map((item) => item.id === finding.id ? { ...item, value: e.target.value } : item))} data-repeatable-finding-input data-encoding-input>
              <option value="">-- Select --</option>{spec.allowedOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select> : <Input type="text" value={finding.value} onChange={(e) => commit(findings.map((item) => item.id === finding.id ? { ...item, value: e.target.value } : item))} data-repeatable-finding-input data-encoding-input />}
          </div>
          <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => { const next = [...findings]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; commit(next); }} aria-label={`Move ${spec.findingCategory} finding up`} className={ROW_ACTION_CLASS}><ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /></Button>
          <Button type="button" variant="outline" size="sm" disabled={index === findings.length - 1} onClick={() => { const next = [...findings]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; commit(next); }} aria-label={`Move ${spec.findingCategory} finding down`} className={ROW_ACTION_CLASS}><ArrowDown aria-hidden="true" className="h-3.5 w-3.5" /></Button>
          <Button type="button" variant="outline" size="sm" onClick={() => commit(findings.filter((item) => item.id !== finding.id))} aria-label={`Remove ${spec.findingCategory} finding`} className={`${ROW_ACTION_CLASS} border-brand-danger-border text-brand-danger hover:border-brand-danger hover:bg-brand-danger-bg`}><Trash2 aria-hidden="true" className="h-3.5 w-3.5" /></Button>
        </div>)}
        {canAdd && <Button type="button" variant="outline" size="sm" onClick={() => commit([...findings, { id: `${spec.findingCategory}-${Date.now()}-${findings.length}`, category: spec.findingCategory, value: "", displayOrder: findings.length + 1 }])} data-add-repeatable-finding>
          <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add finding
        </Button>}
      </div>;
    })}
  </section>;
}
