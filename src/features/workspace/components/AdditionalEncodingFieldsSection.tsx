import React from "react";
import { AdditionalEncodingFieldSpec } from "@/domain/types/report-definition";

export function AdditionalEncodingFieldsSection({ fields, values, onChange }: {
  fields: AdditionalEncodingFieldSpec[];
  values: Record<string, string>;
  onChange: (fieldCode: string, value: string) => void;
}) {
  if (fields.length === 0) return null;
  // Unframed, for the same reason as RequestedBySection: the setup band is the frame.
  return <section className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-additional-encoding-fields>
    {fields.map((field) => <label key={field.fieldCode} className="block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
      {field.label}{field.isRequired && <span className="text-rose-500"> *</span>}
      {field.inputType === "SingleSelect" ? <select value={values[field.fieldCode] || ""} onChange={(event) => onChange(field.fieldCode, event.target.value)} required={field.isRequired}
        data-additional-field={field.fieldCode} data-encoding-input className="mt-1 w-full rounded-md border border-brand-border bg-brand-card px-2.5 py-1.5 text-xs font-medium text-brand-text transition-colors focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring">
        <option value="">-- Select --</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
      </select> : <input type="text" value={values[field.fieldCode] || ""} onChange={(event) => onChange(field.fieldCode, event.target.value)} required={field.isRequired}
        placeholder={field.placeholder} data-additional-field={field.fieldCode} data-encoding-input className="mt-1 w-full rounded-md border border-brand-border bg-brand-card px-2.5 py-1.5 text-xs font-medium text-brand-text transition-colors focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring" />}
    </label>)}
  </section>;
}
