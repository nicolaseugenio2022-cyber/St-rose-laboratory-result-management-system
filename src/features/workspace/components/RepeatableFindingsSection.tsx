import React from "react";
import { IRepeatableFindingValue } from "@/domain/models/interfaces";
import { RepeatableFindingSpec } from "@/domain/types/report-definition";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

export function RepeatableFindingsSection({ specs, values, onChange }: {
  specs: RepeatableFindingSpec[];
  values: Record<string, IRepeatableFindingValue[]>;
  onChange: (category: string, findings: IRepeatableFindingValue[]) => void;
}) {
  return <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3" data-repeatable-findings>
    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Additional Findings</h3>
    {specs.map((spec) => {
      const findings = [...(values[spec.findingCategory] || [])].sort((a, b) => a.displayOrder - b.displayOrder);
      const canAdd = spec.maxEntries == null || findings.length < spec.maxEntries;
      const commit = (next: IRepeatableFindingValue[]) => onChange(spec.findingCategory, next.map((item, index) => ({ ...item, displayOrder: index + 1 })));
      return <div key={spec.findingCategory} className="space-y-2" data-finding-category={spec.findingCategory}>
        <div className="text-[10px] font-bold uppercase text-slate-700">{spec.findingCategory}</div>
        {findings.map((finding, index) => <div key={finding.id} className="flex items-center gap-2" data-repeatable-finding={finding.id}>
          {spec.allowedOptions?.length ? <select value={finding.value} onChange={(e) => commit(findings.map((item) => item.id === finding.id ? { ...item, value: e.target.value } : item))} data-repeatable-finding-input data-encoding-input className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <option value="">-- Select --</option>{spec.allowedOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select> : <input type="text" value={finding.value} onChange={(e) => commit(findings.map((item) => item.id === finding.id ? { ...item, value: e.target.value } : item))} data-repeatable-finding-input data-encoding-input className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs" />}
          <button type="button" disabled={index === 0} onClick={() => { const next = [...findings]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; commit(next); }} aria-label={`Move ${spec.findingCategory} finding up`} className="rounded border border-slate-200 p-1 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
          <button type="button" disabled={index === findings.length - 1} onClick={() => { const next = [...findings]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; commit(next); }} aria-label={`Move ${spec.findingCategory} finding down`} className="rounded border border-slate-200 p-1 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => commit(findings.filter((item) => item.id !== finding.id))} aria-label={`Remove ${spec.findingCategory} finding`} className="rounded border border-rose-200 p-1 text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>)}
        {canAdd && <button type="button" onClick={() => commit([...findings, { id: `${spec.findingCategory}-${Date.now()}-${findings.length}`, category: spec.findingCategory, value: "", displayOrder: findings.length + 1 }])} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700" data-add-repeatable-finding>
          <Plus className="h-3.5 w-3.5" /> Add finding
        </button>}
      </div>;
    })}
  </section>;
}
