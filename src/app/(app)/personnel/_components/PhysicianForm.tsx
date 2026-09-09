"use client";

import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { PhysicianDirectoryEntry } from "@/features/physicians/physician-directory-entry";
import type {
  PhysicianActionResult,
  PhysicianAssignmentActionResult,
} from "@/features/server-boundary/physician-actions";
import {
  PHYSICIAN_STATUS_OPTIONS,
  createPhysicianSchema,
} from "@/lib/validations/physicianValidation";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { PhysicianExaminationAssignmentField } from "./PhysicianExaminationAssignmentField";
import {
  NO_EXAMINATION_ASSIGNMENTS,
  defaultsWithinAssignments,
  isMaintainedExamination,
  normalizeExaminationCodes,
  type PhysicianExaminationAssignments,
} from "./physician-examinations";

/**
 * What one save of this form can be refused for.
 *
 * A save is up to two server writes - the physician record, then its assignment set - and each
 * has its own closed result union. Neither union is widened to accommodate the other: they are
 * separate server contracts and stay separate. The form accepts either, and every member of both
 * is answered below by name, so a code the server invents later fails the exhaustiveness check
 * here rather than reaching the operator as a generic banner.
 */
export type PhysicianSubmitResult = PhysicianActionResult | PhysicianAssignmentActionResult;

/**
 * The form's own shape: the stored `isActive` boolean is edited through the same Active/Inactive
 * select the personnel form uses, and the page maps it back on submit.
 *
 * The name rule is TAKEN from the server schema rather than retyped, so the trim, the required
 * message and the 150-character bound the action enforces are exactly the ones shown here. A
 * second hand-written copy is where a client-side message drifts from the rule that actually
 * rejects the value.
 *
 * The two assignment rules are restated rather than imported, because the client bundle must not
 * pull the server schema module in to validate two string lists. They say the same things the
 * server says, and the server says them again regardless: `savePhysicianConfigurationAction`
 * refuses a default that is not assigned and refuses a default on an inactive physician, and so
 * does the transaction underneath it. NEITHER refusal depends on anything here. What these buy is
 * a message before a round trip, not a guarantee.
 */
export const physicianFormSchema = z
  .object({
    fullName: createPhysicianSchema.shape.fullName,
    status: z.enum(["Active", "Inactive"]),
    assignedExaminations: z.array(z.string()),
    defaultExaminations: z.array(z.string()),
  })
  .superRefine((value, context) => {
    for (const code of value.assignedExaminations) {
      if (!isMaintainedExamination(code)) {
        context.addIssue({
          code: "custom",
          path: ["assignedExaminations"],
          message: "That examination is not one this laboratory maintains.",
        });
        break;
      }
    }
    const assigned = new Set(value.assignedExaminations);
    for (const code of value.defaultExaminations) {
      if (!assigned.has(code)) {
        context.addIssue({
          code: "custom",
          path: ["defaultExaminations"],
          message: "A default examination must also be an assigned examination.",
        });
        break;
      }
    }
    if (value.status === "Inactive" && value.defaultExaminations.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message:
          "An inactive physician is not offered for new reports, so they cannot be the default for an examination.",
      });
    }
  });

export type PhysicianFormValues = z.infer<typeof physicianFormSchema>;

export interface PhysicianFormProps {
  initialData?: PhysicianDirectoryEntry | null;
  /** The assignment set this physician holds now. Absent means the physician is unassigned. */
  initialAssignments?: PhysicianExaminationAssignments;
  onSubmit: (data: PhysicianFormValues) => Promise<PhysicianSubmitResult>;
  onCancel: () => void;
  /**
   * Raised while this form's save is in flight. The dialog that owns this form uses it to stop
   * offering Escape, backdrop and close-button dismissal while the write is still running -
   * closing mid-save abandons a request whose result nothing would then reconcile.
   */
  onSubmittingChange?: (isSubmitting: boolean) => void;
  /**
   * Raised whenever the form gains or loses unsaved edits. The dialog above owns every dismissal
   * route and cannot see these fields.
   */
  onDirtyChange?: (isDirty: boolean) => void;
}

function toFormValues(
  physician?: PhysicianDirectoryEntry | null,
  assignments: PhysicianExaminationAssignments = NO_EXAMINATION_ASSIGNMENTS
): PhysicianFormValues {
  const assignedExaminations = normalizeExaminationCodes(assignments.assignedCodes);
  return {
    fullName: physician?.fullName ?? "",
    status: physician && !physician.isActive ? "Inactive" : "Active",
    assignedExaminations,
    // Narrowed on the way in as well as on every edit. A stored default whose assignment has
    // gone would otherwise be shown as a default the form could not explain.
    defaultExaminations: defaultsWithinAssignments(
      assignments.defaultCodes,
      assignedExaminations
    ),
  };
}

export function PhysicianForm({
  initialData,
  initialAssignments,
  onSubmit,
  onCancel,
  onSubmittingChange,
  onDirtyChange,
}: PhysicianFormProps) {
  const isEditing = !!initialData;
  const [serverError, setServerError] = useState<string | null>(null);
  // Pending state is owned here rather than taken from a prop: the submit is this form's own
  // await, so nothing outside it knows when the write starts or stops.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<PhysicianFormValues>({
    resolver: zodResolver(physicianFormSchema),
    defaultValues: toFormValues(initialData, initialAssignments),
  });

  // Reset on a change of *record*, not on every new `initialData` object - a refreshed directory
  // hands this form a new object for the same physician, and resetting on that would discard
  // whatever the user had already typed.
  const lastResetIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const recordId = initialData?.id ?? null;
    if (lastResetIdRef.current === recordId) return;
    lastResetIdRef.current = recordId;
    setServerError(null);
    reset(toFormValues(initialData, initialAssignments));
  }, [initialData, initialAssignments, reset]);

  useEffect(() => {
    onSubmittingChange?.(isSubmitting);
    return () => onSubmittingChange?.(false);
  }, [isSubmitting, onSubmittingChange]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  const assignedExaminations = watch("assignedExaminations");
  const defaultExaminations = watch("defaultExaminations");

  const handleAssignmentsChange = (nextAssigned: string[], nextDefaults: string[]) => {
    setValue("assignedExaminations", nextAssigned, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("defaultExaminations", nextDefaults, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleFormSubmit = async (values: PhysicianFormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const result = await onSubmit(values);
      // Every typed refusal lands on the control that caused it. A banner would make the
      // operator map a sentence back to a field; these are facts about ONE field each.
      if (!result.success && result.error === "DUPLICATE_NAME") {
        setError("fullName", {
          type: "manual",
          message: "That physician name is already registered.",
        });
      } else if (!result.success && result.error === "PHYSICIAN_INACTIVE") {
        setError("status", {
          type: "manual",
          message:
            "An inactive physician cannot be the default for an examination. Set the status to Active, or clear the defaults below.",
        });
      } else if (!result.success && result.error === "DEFAULT_NOT_ASSIGNED") {
        setError("defaultExaminations", {
          type: "manual",
          message:
            "A default examination must also be an assigned examination. Assign it, or clear the default.",
        });
      } else if (!result.success && result.error === "UNKNOWN_TEMPLATE") {
        setError("assignedExaminations", {
          type: "manual",
          message:
            "One of the selected examinations is not in the report registry. Reload the page and try again.",
        });
      } else if (!result.success && result.error === "DUPLICATE_ASSIGNMENT") {
        setError("assignedExaminations", {
          type: "manual",
          message:
            "That examination is already assigned to this physician. Reload the page to see the current assignments.",
        });
      } else if (!result.success && result.error === "PHYSICIAN_NOT_FOUND") {
        // The one refusal that is a fact about the RECORD rather than about any one field, so it
        // is the one that legitimately gets the banner. Named rather than caught by a trailing
        // `else`, so a code the server adds later stops being silently absorbed here.
        setServerError(
          "This physician record is no longer in the directory. Close this form and reload the page."
        );
      }
    } catch {
      setServerError("Failed to save physician record. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // The dialog body is handed to this form whole (`bodyLayout="managed"`), so the form is the
    // flex column: one scrolling region, then an action bar that sits OUTSIDE it and consumes its
    // own layout space. The bar was previously `sticky bottom-0` INSIDE the scrolling region,
    // which meant every examination row passed behind it on the way past - visible in the
    // Clinical Chemistry group, which is long enough to be under the bar at most scroll offsets.
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      aria-busy={isSubmitting || undefined}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
      {serverError && (
        <Alert variant="destructive" onDismiss={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <div className="sm:col-span-6">
          <Input
            label="Physician Name"
            placeholder="e.g. Dr. Maria Santos"
            helperText="Printed verbatim on every report requested by this physician."
            error={errors.fullName?.message}
            {...register("fullName")}
          />
        </div>
        <div className="sm:col-span-3">
          <Select
            label="Status"
            options={[...PHYSICIAN_STATUS_OPTIONS]}
            helperText="Inactive physicians are excluded from new report selection."
            error={errors.status?.message}
            {...register("status")}
          />
        </div>
      </div>

      <PhysicianExaminationAssignmentField
        assignedCodes={assignedExaminations}
        defaultCodes={defaultExaminations}
        onAssignmentsChange={handleAssignmentsChange}
        disabled={isSubmitting}
        error={errors.defaultExaminations?.message ?? errors.assignedExaminations?.message}
      />

      {/* The submit control shows the spinner, but a spinner is not announced. */}
      <p aria-live="polite" className="sr-only">
        {isSubmitting ? "Saving physician record." : ""}
      </p>

      </div>

      {/* Outside the scroll region. Not sticky, not absolute: it is a flex sibling, so the
          scrolling region's height is already reduced by it and no content can pass behind it at
          any scroll offset. Cancel and Save Changes stay continuously visible. */}
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-brand-border bg-brand-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="min-h-11 w-full sm:min-h-9 sm:w-auto"
        >
          Cancel
        </Button>
        {/* Button disables itself while isLoading, so the second press of a double submit
            never reaches the action. */}
        <Button
          type="submit"
          isLoading={isSubmitting}
          className="min-h-11 w-full sm:min-h-9 sm:w-auto"
        >
          {isEditing ? "Save Changes" : "Create Physician"}
        </Button>
      </div>
    </form>
  );
}
