import React from "react";
import { AdditionalEncodingFieldSpec } from "@/domain/types/report-definition";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export function AdditionalEncodingFieldsSection({ fields, values, onChange }: {
  fields: AdditionalEncodingFieldSpec[];
  values: Record<string, string>;
  onChange: (fieldCode: string, value: string) => void;
}) {
  if (fields.length === 0) return null;
  // Unframed, for the same reason as RequestedBySection: the setup band is the frame.
  // Each field is the shared Input/Select bound to its label by id, so the label keeps its
  // association while the control takes the system field styling.
  return <section className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-additional-encoding-fields>
    {fields.map((field) => {
      const fieldId = `additional-field-${field.fieldCode}`;
      return <div key={field.fieldCode}>
        <label htmlFor={fieldId} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
          {field.label}{field.isRequired && <span className="text-brand-danger"> *</span>}
        </label>
        {field.inputType === "SingleSelect" ? <Select id={fieldId} options={[]} value={values[field.fieldCode] || ""} onChange={(event) => onChange(field.fieldCode, event.target.value)} required={field.isRequired}
          data-additional-field={field.fieldCode} data-encoding-input>
          <option value="">-- Select --</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </Select> : <Input id={fieldId} type="text" value={values[field.fieldCode] || ""} onChange={(event) => onChange(field.fieldCode, event.target.value)} required={field.isRequired}
          placeholder={field.placeholder} data-additional-field={field.fieldCode} data-encoding-input />}
      </div>;
    })}
  </section>;
}
