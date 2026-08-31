import React from "react";
import { PatientDemographics, PatientSex } from "@/domain/types";
import { formatDateISO } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { User, MapPin, Pencil, ChevronUp } from "lucide-react";

export interface PatientDemographicsFormProps {
  demographics: PatientDemographics;
  onChange: (updated: PatientDemographics) => void;
  /**
   * Controlled by the Workspace rather than held locally, because the Workspace is what has to
   * force the fields back into view when validation resolves to one of them. A collapsed section
   * that owned its own state could hide the field an error is reported against.
   *
   * Defaults to expanded: an uncontrolled render shows the full form, so no caller can hide
   * clinical inputs by omission.
   */
  isExpanded?: boolean;
  onToggleExpanded?: (next: boolean) => void;
  /**
   * Id of the single field a validation failure resolved to, so it can be marked
   * programmatically invalid while focus lands on it. Presentation only: it changes no
   * value, no handler and no validation rule, and null marks nothing.
   */
  invalidFieldId?: "patient-full-name" | "patient-sex" | null;
}

/** The shared field label, hand-rendered here so the required mark can sit inside it. */
const FIELD_LABEL_CLASS = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted";

export function PatientDemographicsForm({
  demographics,
  onChange,
  isExpanded = true,
  onToggleExpanded,
  invalidFieldId = null,
}: PatientDemographicsFormProps) {
  const handleChange = (field: keyof PatientDemographics, value: unknown) => {
    onChange({
      ...demographics,
      [field]: value,
    });
  };

  /**
   * The collapsed one-line summary.
   *
   * It restates every demographic the expanded form edits - nothing is hidden, only unedited -
   * so the operator can confirm patient identity and the sex/age that select the reference
   * ranges without reopening the section. Values are shown exactly as stored; this summary
   * formats nothing and validates nothing.
   */
  if (!isExpanded) {
    return (
      <div
        data-demographics-summary
        className="mb-3 flex items-center gap-2.5 rounded-lg border border-brand-border bg-brand-card px-3.5 py-2 shadow-low"
      >
        <User aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-primary" />
        <span className="shrink-0 text-[13px] font-semibold text-brand-navy">
          {demographics.fullName || "Unnamed patient"}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-brand-text-muted" title={demographics.address || undefined}>
          {[
            demographics.age ? `${demographics.age} y/o` : null,
            demographics.sex || null,
            demographics.examinationDate || null,
            demographics.address || null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-demographics-edit
          onClick={() => onToggleExpanded?.(true)}
          aria-expanded={false}
          aria-controls="patient-demographics-fields"
          className="shrink-0"
        >
          <Pencil aria-hidden="true" className="h-3.5 w-3.5 text-brand-text-muted" />
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low">
      <div className="flex items-center gap-2 border-b border-brand-border bg-brand-structural px-4 py-2.5">
        <User aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-primary" />
        <h2 className="text-[13px] font-semibold leading-tight tracking-tight text-brand-navy">
          Patient Demographics
        </h2>
        {onToggleExpanded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-demographics-collapse
            onClick={() => onToggleExpanded(false)}
            aria-expanded
            aria-controls="patient-demographics-fields"
            className="ml-auto shrink-0"
          >
            Done
            <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div
        id="patient-demographics-fields"
        className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8"
      >
        {/* Full Name */}
        <div className="sm:col-span-2">
          <label htmlFor="patient-full-name" className={FIELD_LABEL_CLASS}>
            Patient Full Name <span className="text-brand-danger">*</span>
          </label>
          <Input
            id="patient-full-name"
            type="text"
            aria-invalid={invalidFieldId === "patient-full-name" ? true : undefined}
            value={demographics.fullName}
            onChange={(e) => handleChange("fullName", e.target.value)}
            placeholder="e.g. Dela Cruz, Juan Santos"
            className="scroll-mt-32"
            required
          />
        </div>

        {/* Simplified Age Field */}
        <div>
          <label htmlFor="patient-age" className={FIELD_LABEL_CLASS}>
            Age <span className="text-brand-danger">*</span>
          </label>
          <Input
            id="patient-age"
            type="number"
            min="0"
            value={demographics.age || ""}
            onChange={(e) => handleChange("age", parseInt(e.target.value, 10) || 0)}
            className="scroll-mt-32 tabular-nums"
            placeholder="e.g. 35"
            required
          />
        </div>

        {/* Sex Field with No Default Selection */}
        <div>
          <label htmlFor="patient-sex" className={FIELD_LABEL_CLASS}>
            Sex <span className="text-brand-danger">*</span>
          </label>
          <Select
            id="patient-sex"
            options={[]}
            aria-invalid={invalidFieldId === "patient-sex" ? true : undefined}
            value={demographics.sex || ""}
            onChange={(e) => handleChange("sex", e.target.value as PatientSex)}
            className="scroll-mt-32"
            required
          >
            <option value="" disabled>
              -- Select Sex --
            </option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </Select>
        </div>

        {/* Examination Date */}
        <div className="2xl:col-span-2">
          <label htmlFor="patient-examination-date" className={FIELD_LABEL_CLASS}>
            Examination Date <span className="text-brand-danger">*</span>
          </label>
          <div className="relative">
            <Input
              id="patient-examination-date"
              type="date"
              value={demographics.examinationDate || formatDateISO()}
              onChange={(e) => handleChange("examinationDate", e.target.value)}
              className="scroll-mt-32 tabular-nums"
              required
            />
          </div>
        </div>

        {/* Multiline Editable Address */}
        <div className="sm:col-span-2">
          <label htmlFor="patient-address" className={FIELD_LABEL_CLASS}>
            Address
          </label>
          <div className="relative">
            <textarea
              id="patient-address"
              rows={2}
              value={demographics.address || ""}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Enter complete patient address..."
              className="w-full resize-none scroll-mt-32 rounded-md border border-brand-border bg-brand-surface px-3 py-2 pr-8 text-[13px] text-brand-text transition-[border-color,box-shadow] placeholder:text-slate-500 hover:border-brand-border-strong focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
            />
            <MapPin aria-hidden="true" className="pointer-events-none absolute right-3 top-2.5 h-3.5 w-3.5 text-brand-text-subtle" />
          </div>
        </div>
      </div>
    </div>
  );
}
