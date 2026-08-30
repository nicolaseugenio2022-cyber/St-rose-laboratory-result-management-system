import React from "react";
import { PatientDemographics, PatientSex } from "@/domain/types";
import { formatDateISO } from "@/lib/utils";
import { User, Calendar, MapPin, Pencil, ChevronUp } from "lucide-react";

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
}

export function PatientDemographicsForm({
  demographics,
  onChange,
  isExpanded = true,
  onToggleExpanded,
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
        className="mb-3 flex items-center gap-2.5 rounded-lg border border-slate-200 border-l-2 border-l-brand-primary bg-white px-3 py-1.5"
      >
        <User aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-primary" />
        <span className="shrink-0 text-sm font-semibold text-slate-900">
          {demographics.fullName || "Unnamed patient"}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-500" title={demographics.address || undefined}>
          {[
            demographics.age ? `${demographics.age} y/o` : null,
            demographics.sex || null,
            demographics.examinationDate || null,
            demographics.address || null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <button
          type="button"
          data-demographics-edit
          onClick={() => onToggleExpanded?.(true)}
          aria-expanded={false}
          aria-controls="patient-demographics-fields"
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
        >
          <Pencil aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" />
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-slate-200 border-l-2 border-l-brand-primary bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-1.5">
        <User aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-primary" />
        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
          Patient Demographics
        </h2>
        {onToggleExpanded && (
          <button
            type="button"
            data-demographics-collapse
            onClick={() => onToggleExpanded(false)}
            aria-expanded
            aria-controls="patient-demographics-fields"
            className="ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
          >
            Done
            <ChevronUp aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" />
          </button>
        )}
      </div>

      <div
        id="patient-demographics-fields"
        className="grid grid-cols-1 gap-x-3 gap-y-2.5 p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8"
      >
        {/* Full Name */}
        <div className="sm:col-span-2">
          <label htmlFor="patient-full-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Patient Full Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="patient-full-name"
            type="text"
            value={demographics.fullName}
            onChange={(e) => handleChange("fullName", e.target.value)}
            placeholder="e.g. Dela Cruz, Juan Santos"
            className="h-8 w-full scroll-mt-32 rounded-md border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-800 transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            required
          />
        </div>

        {/* Simplified Age Field */}
        <div>
          <label htmlFor="patient-age" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Age <span className="text-rose-500">*</span>
          </label>
          <input
            id="patient-age"
            type="number"
            min="0"
            value={demographics.age || ""}
            onChange={(e) => handleChange("age", parseInt(e.target.value, 10) || 0)}
            className="h-8 w-full scroll-mt-32 rounded-md border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-800 transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            placeholder="e.g. 35"
            required
          />
        </div>

        {/* Sex Field with No Default Selection */}
        <div>
          <label htmlFor="patient-sex" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Sex <span className="text-rose-500">*</span>
          </label>
          <select
            id="patient-sex"
            value={demographics.sex || ""}
            onChange={(e) => handleChange("sex", e.target.value as PatientSex)}
            className="h-8 w-full scroll-mt-32 rounded-md border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-800 transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            required
          >
            <option value="" disabled>
              -- Select Sex --
            </option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        {/* Examination Date */}
        <div className="2xl:col-span-2">
          <label htmlFor="patient-examination-date" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Examination Date <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="patient-examination-date"
              type="date"
              value={demographics.examinationDate || formatDateISO()}
              onChange={(e) => handleChange("examinationDate", e.target.value)}
              className="h-8 w-full scroll-mt-32 rounded-md border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-800 transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              required
            />
            <Calendar aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        {/* Multiline Editable Address */}
        <div className="sm:col-span-2">
          <label htmlFor="patient-address" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Address
          </label>
          <div className="relative">
            <textarea
              id="patient-address"
              rows={2}
              value={demographics.address || ""}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Enter complete patient address..."
              className="w-full resize-none scroll-mt-32 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <MapPin aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
