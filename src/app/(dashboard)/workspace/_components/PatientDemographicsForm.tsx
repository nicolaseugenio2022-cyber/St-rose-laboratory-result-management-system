import React from "react";
import { PatientDemographics, PatientSex } from "@/domain/types";
import { formatDateISO } from "@/lib/utils";
import { isValidDateOfBirth, resolvePatientAge } from "@/domain/patient-age";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { User, MapPin, Pencil, ChevronUp } from "lucide-react";
import { PanelIcon } from "./PanelIcon";

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
   * Selector of the single control a completion failure resolved to, so it can be marked
   * programmatically invalid while focus lands on it. Presentation only: it changes no
   * value, no handler and no validation rule, and null marks nothing.
   *
   * A selector rather than a bare id because the Workspace now routes to controls that are not
   * addressed by id at all - a result by its parameter, a signatory by its role - and one channel
   * for all of them cannot drift from another.
   */
  invalidFieldSelector?: string | null;
}

/** The shared field label, hand-rendered here so the required mark can sit inside it. */
const FIELD_LABEL_CLASS = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted";

export function PatientDemographicsForm({
  demographics,
  onChange,
  isExpanded = true,
  onToggleExpanded,
  invalidFieldSelector = null,
}: PatientDemographicsFormProps) {
  /**
   * Every demographic edit goes through one derivation step.
   *
   * A date of birth and an examination date together determine the age, so whichever of the two
   * the operator just changed, the stored `age` and `ageUnit` are recomputed from the pair. They
   * are stored rather than derived at read time for one reason: the session LIST projects a fixed
   * set of demographic columns and does not carry a date of birth, so the pair is what the work
   * queue renders. The report itself always re-derives from the date of birth.
   *
   * With no usable date of birth nothing is recomputed and the operator's typed age stands, which
   * is exactly how every record written before this field existed continues to behave.
   */
  const handleChange = (field: keyof PatientDemographics, value: unknown) => {
    const next: PatientDemographics = { ...demographics, [field]: value };
    const derived = resolvePatientAge(next);
    onChange(
      derived.source === "DateOfBirth" && derived.value !== null && derived.unit !== null
        ? { ...next, age: derived.value, ageUnit: derived.unit }
        : next
    );
  };

  const resolvedAge = resolvePatientAge(demographics);
  const hasDerivedAge = resolvedAge.source === "DateOfBirth";
  const dateOfBirthRejected =
    Boolean(demographics.dateOfBirth) && !isValidDateOfBirth(demographics.dateOfBirth, demographics.examinationDate);

  /**
   * The collapsed one-line summary.
   *
   * It restates every demographic the expanded form edits - nothing is hidden, only unedited -
   * so the operator can confirm patient identity and the sex/age that select the reference
   * ranges without reopening the section. Values are shown exactly as stored; this summary
   * formats nothing and validates nothing.
   *
   * Flat, with no frame of its own: the Workspace renders it as the first row of the sticky
   * context strip, which is the frame. A bordered card here would be a card inside a card.
   */
  if (!isExpanded) {
    return (
      <div
        data-demographics-summary
        className="flex min-w-0 items-center gap-2.5"
      >
        <User aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-primary" />
        <span className="shrink-0 text-[13px] font-semibold text-brand-navy">
          {demographics.fullName || "Unnamed patient"}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-brand-text-muted" title={demographics.address || undefined}>
          {[
            // The same wording the report prints, from the same resolver: an eight-month-old
            // reads "8 months" here and "8 months" on the sheet. The old `${age} y/o` restated
            // the number under a unit it had not checked, which is the defect this corrects.
            resolvedAge.display || null,
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
    // The panel header carries the same icon tile the dashboard's sections draw beside their
    // titles, so a Workspace panel reads as the same family of surface. Spacing below the card is
    // the pane's own rhythm, not a margin of this component's.
    <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low">
      <div className="flex items-center gap-2.5 border-b border-brand-border bg-brand-structural px-4 py-2.5">
        <PanelIcon icon={User} />
        <h2 className="text-[15px] font-semibold leading-tight tracking-tight text-brand-navy">
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
            aria-invalid={invalidFieldSelector === "#patient-full-name" ? true : undefined}
            value={demographics.fullName}
            onChange={(e) => handleChange("fullName", e.target.value)}
            placeholder="e.g. Dela Cruz, Juan Santos"
            className="scroll-mt-32"
            required
          />
        </div>

        {/* Date of Birth. Optional, and the authority on age whenever it is supplied. */}
        <div>
          <label htmlFor="patient-date-of-birth" className={FIELD_LABEL_CLASS}>
            Date of Birth
          </label>
          <Input
            id="patient-date-of-birth"
            type="date"
            data-patient-date-of-birth
            aria-invalid={dateOfBirthRejected ? true : undefined}
            aria-describedby={dateOfBirthRejected ? "patient-date-of-birth-error" : undefined}
            value={demographics.dateOfBirth || ""}
            onChange={(e) => handleChange("dateOfBirth", e.target.value)}
            className="scroll-mt-32"
          />
          {dateOfBirthRejected && (
            <p id="patient-date-of-birth-error" role="alert" className="mt-1 text-xs font-semibold text-brand-danger">
              Enter a real date of birth on or before the examination date.
            </p>
          )}
        </div>

        {/* Age. Derived from the date of birth when there is one, typed when there is not. */}
        <div>
          <label htmlFor="patient-age" className={FIELD_LABEL_CLASS}>
            Age <span className="text-brand-danger">*</span>
          </label>
          {hasDerivedAge ? (
            // Read-only rather than absent: the operator must still SEE the age the report will
            // print, and must not be able to type one that disagrees with the date of birth.
            <Input
              id="patient-age"
              type="text"
              data-patient-age-derived
              value={resolvedAge.display}
              readOnly
              aria-describedby="patient-age-derivation"
              className="scroll-mt-32 tabular-nums"
            />
          ) : (
            // No date of birth, so the operator states BOTH the number and its unit. A number
            // without a unit is what printed an eight-month-old as "8 years": the unit was
            // hardcoded and the operator had no way to correct it. The stored unit is used as the
            // selected value, so editing an existing record preserves whatever it was written
            // with rather than silently restating it.
            <div className="flex gap-2">
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
              <Select
                id="patient-age-unit"
                data-patient-age-unit
                aria-label="Age unit"
                options={[]}
                value={demographics.ageUnit || "years"}
                onChange={(e) => handleChange("ageUnit", e.target.value as PatientDemographics["ageUnit"])}
                className="w-28 shrink-0"
              >
                <option value="days">Days</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </Select>
            </div>
          )}
          <p id="patient-age-derivation" className="mt-1 text-xs text-brand-text-subtle">
            {hasDerivedAge
              ? "Calculated from the date of birth and the examination date."
              : "Enter a date of birth to calculate this automatically."}
          </p>
        </div>

        {/* Sex Field with No Default Selection */}
        <div>
          <label htmlFor="patient-sex" className={FIELD_LABEL_CLASS}>
            Sex <span className="text-brand-danger">*</span>
          </label>
          <Select
            id="patient-sex"
            options={[]}
            aria-invalid={invalidFieldSelector === "#patient-sex" ? true : undefined}
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
