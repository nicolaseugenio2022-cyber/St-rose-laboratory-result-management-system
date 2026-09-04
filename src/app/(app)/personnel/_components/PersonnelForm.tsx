"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PersonnelSignatureField } from "./PersonnelSignatureField";
import { formatPersonnelName } from "./PersonnelTable";
import type { PersonnelDirectoryEntry } from "@/features/personnel/personnel-directory-entry";
import {
  PERSONNEL_ROLE_OPTIONS,
  PERSONNEL_STATUS_OPTIONS,
  personnelFormSchema,
  PersonnelFormValues,
} from "@/lib/validations/personnelValidation";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

import type { PersonnelActionResult } from "@/features/server-boundary/personnel-actions";

export interface PersonnelFormProps {
  initialData?: PersonnelDirectoryEntry | null;
  onSubmit: (data: PersonnelFormValues) => Promise<PersonnelActionResult>;
  onCancel: () => void;
  onSignatureChanged: (hasSignature: boolean) => void;
  /**
   * Raised while a confirmation dialog is open inside this form. The dialog that owns this
   * form uses it to stop dismissing itself on the Escape press meant for the inner dialog.
   */
  onNestedDialogChange?: (isOpen: boolean) => void;
  /**
   * Raised while this form's save is in flight. The dialog that owns this form uses it to stop
   * offering Escape, backdrop and close-button dismissal while the write is still running -
   * closing mid-save abandons a request whose result nothing would then reconcile.
   */
  onSubmittingChange?: (isSubmitting: boolean) => void;
  /**
   * Raised while the signature control inside this form has an upload or a removal in flight.
   * That write is not this form's save, so `onSubmittingChange` never sees it; the dialog above
   * needs it for the same reason - Escape, the backdrop, the close control and Cancel would
   * otherwise tear the form down while the request is still outstanding.
   */
  onSignatureBusyChange?: (isBusy: boolean) => void;
}

function toFormValues(personnel?: PersonnelDirectoryEntry | null): PersonnelFormValues {
  return {
    role: personnel?.role ?? "Pathologist",
    firstName: personnel?.firstName ?? "",
    middleInitial: personnel?.middleInitial ?? "",
    lastName: personnel?.lastName ?? "",
    credentials: personnel?.credentials ?? "",
    prcLicenseNumber: personnel?.prcLicenseNumber ?? "",
    status: personnel && !personnel.isActive ? "Inactive" : "Active",
  };
}

/**
 * One titled group of related fields.
 *
 * A real `fieldset`/`legend` rather than a styled heading, so the grouping is announced as a
 * grouping instead of being purely visual. Seven flat controls in a column give a reader no
 * structure to hold on to; three named groups do.
 *
 * The body is a six-track grid from `sm` up: a field spanning three tracks takes half the
 * row, six the whole of it, and the first-name / middle-initial pair splits four to two, so
 * a two-character initial never takes half the width beside a full given name.
 */
function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted">
        {title}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">{children}</div>
    </fieldset>
  );
}

export function PersonnelForm({
  initialData,
  onSubmit,
  onCancel,
  onSignatureChanged,
  onNestedDialogChange,
  onSubmittingChange,
  onSignatureBusyChange,
}: PersonnelFormProps) {
  const isEditing = !!initialData;
  const [serverError, setServerError] = useState<string | null>(null);
  // Pending state is owned here rather than taken from a prop. The submit is this form's own
  // await, so nothing outside it knows when the write starts or stops; a prop threaded down
  // from the page reported the directory's loading state and left the submit control live
  // through the entire request, which is exactly the window a double submit lands in.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<PersonnelFormValues | null>(null);
  const [isSignatureConfirmOpen, setIsSignatureConfirmOpen] = useState(false);
  // The signature control's own upload and removal are writes against the same record this
  // form saves. It guards itself against a second signature write, but nothing here or above
  // knew one was running, so a save - or a dismissal - could land on top of it.
  const [isSignatureBusy, setIsSignatureBusy] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    setValue,
    formState: { errors },
  } = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelFormSchema),
    defaultValues: toFormValues(initialData),
  });

  // Reset on a change of *record*, not on every new `initialData` object. Uploading or
  // removing a signature hands this form a new object for the same person, and resetting on
  // that discarded whatever the user had already typed into the fields above it.
  const lastResetIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const recordId = initialData?.id ?? null;
    if (lastResetIdRef.current === recordId) return;
    lastResetIdRef.current = recordId;
    setServerError(null);
    reset(toFormValues(initialData));
  }, [initialData, reset]);

  // Two dialogs listening for Escape on the document would both act on one press: the inner
  // confirmation would close and the outer personnel dialog would discard the edit underneath
  // it. Reporting the inner state upward is what keeps that from happening.
  const isNestedDialogOpen = pendingRoleChange !== null || isSignatureConfirmOpen;
  useEffect(() => {
    onNestedDialogChange?.(isNestedDialogOpen);
    return () => onNestedDialogChange?.(false);
  }, [isNestedDialogOpen, onNestedDialogChange]);

  // Same channel, second fact: the pending write is this form's own await, so the dialog above
  // it cannot see the save start or finish unless the form says so.
  useEffect(() => {
    onSubmittingChange?.(isSubmitting);
    return () => onSubmittingChange?.(false);
  }, [isSubmitting, onSubmittingChange]);

  // Same channel, third fact: the signature write belongs to the control below, so it is
  // passed straight through. It is reported the instant the control raises it and withdrawn
  // the instant the operation settles, which is what restores ordinary dismissal.
  useEffect(() => {
    onSignatureBusyChange?.(isSignatureBusy);
    return () => onSignatureBusyChange?.(false);
  }, [isSignatureBusy, onSignatureBusyChange]);

  // Only Pathologists may ever carry a signature image; Medical Technologists
  // are textual only, so the signature area is never rendered for them.
  const isPathologist = watch("role") === "Pathologist";

  const submitValues = useCallback(
    async (values: PersonnelFormValues) => {
      setServerError(null);
      setIsSubmitting(true);
      try {
        const result = await onSubmit(values);
        if (!result.success && result.error === "DUPLICATE_PRC") {
          setError("prcLicenseNumber", {
            type: "manual",
            message: "That PRC licence number is already registered.",
          });
        }
      } catch {
        setServerError("Failed to save personnel record. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit, setError],
  );

  /**
   * The one role change that destroys stored data.
   *
   * A Medical Technologist cannot hold a signature image, so saving this change clears the one
   * on file. That is worth a question - unlike a Pathologist simply having no image, which is
   * a supported configuration and gets no warning anywhere in this module.
   */
  const destroysStoredSignature =
    isEditing &&
    initialData?.role === "Pathologist" &&
    initialData.hasSignature === true;

  const handleFormSubmit = (values: PersonnelFormValues) => {
    // A save started while a signature upload or removal is in flight would write the same
    // record from two directions at once. The submit control is disabled for the same reason,
    // but Enter in a text field reaches here without it, so the gate is here as well.
    if (isSignatureBusy) return;
    if (destroysStoredSignature && values.role === "MedicalTechnologist") {
      setPendingRoleChange(values);
      return;
    }
    return submitValues(values);
  };

  const handleConfirmRoleChange = async () => {
    const values = pendingRoleChange;
    if (!values) return;
    await submitValues(values);
    // On success the parent closes this dialog outright; on failure the confirmation steps
    // aside so the error is readable against the form it belongs to.
    setPendingRoleChange(null);
  };

  const handleCancelRoleChange = () => {
    setPendingRoleChange(null);
    // Cancelling must leave the record exactly as it was found: the role select goes back to
    // Pathologist, the signature area returns with it, and nothing was sent.
    setValue("role", initialData?.role ?? "Pathologist", { shouldDirty: false });
  };

  const personnelName = initialData ? formatPersonnelName(initialData) : "";

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      aria-busy={isSubmitting || undefined}
      className="space-y-4"
    >
      {serverError && (
        <Alert variant="destructive" onDismiss={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      <FieldGroup title="Role and identity">
        <div className="sm:col-span-6">
          <Select
            label="Personnel Role"
            options={[...PERSONNEL_ROLE_OPTIONS]}
            error={errors.role?.message}
            {...register("role")}
          />
        </div>

        {/* Last name is the sort key and the widest value, so it gets its own row rather than
            being squeezed into a third of the width beside a two-character initial. */}
        <div className="sm:col-span-4">
          <Input
            label="First Name"
            placeholder="e.g. Maria"
            error={errors.firstName?.message}
            {...register("firstName")}
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            label="Middle Initial"
            placeholder="Optional"
            error={errors.middleInitial?.message}
            {...register("middleInitial")}
          />
        </div>
        <div className="sm:col-span-6">
          <Input
            label="Last Name"
            placeholder="e.g. Santos"
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>
      </FieldGroup>

      <FieldGroup title="Licensing">
        <div className="sm:col-span-3">
          <Input
            label="Credentials"
            placeholder={isPathologist ? "e.g. MD, FPSP" : "e.g. RMT"}
            helperText="Printed beside the name on every signed report."
            error={errors.credentials?.message}
            {...register("credentials")}
          />
        </div>
        <div className="sm:col-span-3">
          <Input
            label="PRC License Number"
            placeholder="e.g. 0012345"
            error={errors.prcLicenseNumber?.message}
            {...register("prcLicenseNumber")}
          />
        </div>
      </FieldGroup>

      <FieldGroup title="Directory status">
        <div className="sm:col-span-3">
          <Select
            label="Directory Status"
            options={[...PERSONNEL_STATUS_OPTIONS]}
            helperText="Inactive personnel are excluded from new report signatory selection."
            error={errors.status?.message}
            {...register("status")}
          />
        </div>

        {/* Signature management needs a saved record to attach to, so it appears only when
            editing. On create, say so rather than showing a control that cannot work yet. */}
        {isPathologist &&
          (initialData?.id ? (
            <div className="sm:col-span-6">
              <PersonnelSignatureField
                personnelId={initialData.id}
                personnelName={personnelName}
                hasSignature={initialData.hasSignature}
                onSignatureChanged={onSignatureChanged}
                onConfirmationOpenChange={setIsSignatureConfirmOpen}
                onBusyChange={setIsSignatureBusy}
              />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-brand-border bg-brand-structural px-3 py-2.5 text-[11px] leading-relaxed text-brand-text-muted sm:col-span-6">
              Create this record first, then reopen it to upload an optional signature image.
            </p>
          ))}
      </FieldGroup>

      {/* The submit control shows the spinner, but a spinner is not announced. */}
      <p aria-live="polite" className="sr-only">
        {isSubmitting ? "Saving personnel record." : ""}
      </p>

      {/* Sticky so the primary action stays reachable while a long form scrolls inside the
          dialog, rather than being stranded below the fold on a short viewport. It bleeds to
          the dialog body's edges so its hairline runs the full width of the surface. */}
      <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-brand-border bg-brand-surface px-4 pt-3 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting || isSignatureBusy}
          className="min-h-11 w-full sm:min-h-9 sm:w-auto"
        >
          Cancel
        </Button>
        {/* Button disables itself while isLoading, so the second press of a double submit
            never reaches the action. */}
        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={isSignatureBusy}
          className="min-h-11 w-full sm:min-h-9 sm:w-auto"
        >
          {isEditing ? "Save Changes" : "Create Personnel"}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={pendingRoleChange !== null}
        onCancel={handleCancelRoleChange}
        onConfirm={handleConfirmRoleChange}
        title="Change role and remove the signature image?"
        description={`${personnelName} currently has a signature image on file.`}
        confirmLabel="Change role"
        pendingLabel="Saving..."
        cancelLabel="Keep as Pathologist"
        variant="destructive"
        isPending={isSubmitting}
      >
        <p>
          A Medical Technologist cannot hold a signature image, so saving this change removes
          the stored image. Reports completed from now on will carry this person&rsquo;s
          textual signatory information - printed name, credentials and PRC licence number.
          Reports already completed keep the signature they were issued with.
        </p>
        <p className="mt-2 text-brand-text-muted">
          Cancelling leaves the role and the stored image exactly as they are.
        </p>
      </ConfirmDialog>
    </form>
  );
}
