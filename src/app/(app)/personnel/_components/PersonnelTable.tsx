import React from "react";
import {
  AlertCircle,
  Edit2,
  Power,
  Trash2,
  UserCheck,
  PenLine,
  PenOff,
  MinusCircle,
} from "lucide-react";
import type { PersonnelDirectoryEntry } from "@/features/personnel/personnel-directory-entry";
import { personnelRoleLabel } from "@/lib/validations/personnelValidation";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

export interface PersonnelTableProps {
  personnel: readonly PersonnelDirectoryEntry[];
  canManage: boolean;
  onEdit: (person: PersonnelDirectoryEntry) => void;
  onToggleStatus: (person: PersonnelDirectoryEntry) => void;
  /** Opens the permanent-deletion confirmation. Offered for inactive records only. */
  onDelete: (person: PersonnelDirectoryEntry) => void;
  busyPersonnelId?: string | null;
  /** Which write the busy record is waiting on, so only that control shows pending feedback. */
  busyAction?: RowWrite | null;
  /** A refusal or failure that belongs to one record, shown on that record. */
  rowError?: RowError | null;
  /** True when a search or filter is narrowing the list, so "nothing here" can be phrased honestly. */
  isFiltered?: boolean;
  onClearFilters?: () => void;
}

export type RowWrite = "toggle" | "delete";

export interface RowError {
  id: string;
  message: string;
}

export function formatPersonnelName(person: PersonnelDirectoryEntry): string {
  const middle = person.middleInitial?.trim();
  const given = middle ? `${person.firstName} ${middle}.` : person.firstName;
  return `${person.lastName}, ${given}`;
}

/**
 * Signature state, reported as a plain fact.
 *
 * A signature image is optional. A signatory without one still signs reports through their
 * printed name, credentials and PRC licence, so "no image" is a normal configuration rather than
 * an outstanding task: it carries no warning colour, no alert icon and no urgency vocabulary.
 *
 * Both signing roles may hold an image - the server accepts an upload for a Pathologist and for
 * a Medical Technologist alike - so the "not required" state is reserved for a role that is
 * neither, and is unreachable while those are the only two roles the directory holds. It stays
 * because the role union is not this component's to close.
 *
 * The three states stay distinguishable because each carries its own icon and its own word.
 * Nothing here is conveyed by colour - every state renders in the same muted text - so the
 * distinction survives for a reader who cannot separate the palette.
 */
type SignatureState = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Spoken form, so a screen reader hears the subject rather than a bare status word. */
  srLabel: string;
};

export function signatureState(person: PersonnelDirectoryEntry): SignatureState {
  if (person.role !== "Pathologist" && person.role !== "MedicalTechnologist") {
    return {
      label: "Not required",
      Icon: MinusCircle,
      srLabel: "Signature not required for this role",
    };
  }
  return person.hasSignature
    ? {
        label: "On file",
        Icon: PenLine,
        srLabel: "Signature on file",
      }
    : {
        label: "None on file",
        Icon: PenOff,
        srLabel: "No signature on file",
      };
}

function SignatureIndicator({ person }: { person: PersonnelDirectoryEntry }) {
  const state = signatureState(person);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-brand-text-muted">
      <state.Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span aria-hidden="true">{state.label}</span>
      <span className="sr-only">{state.srLabel}</span>
    </span>
  );
}

function RoleBadge({ person }: { person: PersonnelDirectoryEntry }) {
  return (
    <Badge
      variant={person.role === "Pathologist" ? "indigo" : "neutral"}
      size="sm"
      className="whitespace-nowrap"
    >
      {personnelRoleLabel(person.role)}
    </Badge>
  );
}

/**
 * The row actions, shared by the desktop row and the narrow-width record.
 *
 * One component rather than two copies: a second copy is where a visible label and its accessible
 * name silently drift apart.
 *
 * Every control carries its own word at both widths. Three tiers, each read by fill: Edit is the
 * neutral outline; the status toggle is a quiet ghost tinted warning for the withdrawing action and
 * success for the restoring one, matching the two account directories; Delete is the destructive
 * fill, and it exists only on an INACTIVE record - an active record must be deactivated first, so
 * the permanent action is never one press away from a record in use. The server re-decides all of
 * it; showing or hiding a control grants nothing.
 */
function RowActions({
  person,
  busyAction,
  isDisabled,
  onEdit,
  onToggleStatus,
  onDelete,
  errorMessage,
  layout,
}: {
  person: PersonnelDirectoryEntry;
  /** The write this record is waiting on, if any. Only that control shows pending feedback. */
  busyAction: RowWrite | null;
  /** Some record is being written. Every row's actions stand down until it settles. */
  isDisabled: boolean;
  onEdit: (person: PersonnelDirectoryEntry) => void;
  onToggleStatus: (person: PersonnelDirectoryEntry) => void;
  onDelete: (person: PersonnelDirectoryEntry) => void;
  /** Why the last write against this record did not happen. */
  errorMessage: string | null;
  layout: "row" | "record";
}) {
  const name = formatPersonnelName(person);
  const activateVerb = person.isActive ? "Deactivate" : "Activate";
  const isRecord = layout === "record";
  const isToggling = busyAction === "toggle";
  const isDeleting = busyAction === "delete";
  // The record layout is rendered only below lg, where the pointer is a finger: its controls
  // keep a 44px target rather than the 32px a size="sm" Button gives a mouse.
  const touch = isRecord ? "min-h-11 flex-1" : "min-h-11 sm:min-h-8";
  return (
    <div className={isRecord ? "space-y-1.5" : "space-y-1"}>
      <div
        role="group"
        aria-label={`Actions for ${name}`}
        className={
          isRecord
            ? "flex items-center gap-2"
            : "flex items-center justify-end gap-1.5"
        }
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(person)}
          disabled={isDisabled}
          className={touch}
          aria-label={`Edit ${name}`}
        >
          <Edit2 aria-hidden="true" className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleStatus(person)}
          disabled={isDisabled}
          isLoading={isToggling}
          aria-label={`${activateVerb} ${name}`}
          className={[
            person.isActive
              ? "text-brand-warning hover:bg-brand-warning-bg hover:text-brand-warning"
              : "text-brand-success hover:bg-brand-success-bg hover:text-brand-success",
            touch,
          ].join(" ")}
        >
          {!isToggling && <Power aria-hidden="true" className="h-3.5 w-3.5" />}
          {activateVerb}
        </Button>
        {!person.isActive && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(person)}
            disabled={isDisabled}
            isLoading={isDeleting}
            aria-label={`Delete ${name}`}
            className={touch}
          >
            {!isDeleting && <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
            Delete
          </Button>
        )}
      </div>
      {errorMessage && (
        <p
          role="alert"
          className={[
            "flex items-start gap-1.5 text-[11px] leading-snug text-brand-danger",
            isRecord ? "" : "ml-auto max-w-72 text-left",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      )}
    </div>
  );
}

/** One labelled fact inside a narrow-width record. */
function RecordField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-xs text-brand-text">{children}</dd>
    </div>
  );
}

export function PersonnelTable({
  personnel,
  canManage,
  onEdit,
  onToggleStatus,
  onDelete,
  busyPersonnelId,
  busyAction = null,
  rowError = null,
  isFiltered = false,
  onClearFilters,
}: PersonnelTableProps) {
  if (personnel.length === 0) {
    // The two empty cases are different problems and deserve different sentences: an unfiltered
    // directory is genuinely empty and wants the create action, while a filtered one is intact
    // and wants the filters cleared. Both stand on the canvas in the shared empty-state panel.
    return isFiltered ? (
      <EmptyState
        icon={UserCheck}
        headingLevel={3}
        title="No personnel match these filters"
        description="No Pathologist or Medical Technologist record matches the current search, role, or status selection."
        action={
          onClearFilters ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="min-h-11 sm:min-h-8"
            >
              Clear filters
            </Button>
          ) : undefined
        }
      />
    ) : (
      <EmptyState
        icon={UserCheck}
        headingLevel={3}
        title="No personnel on file"
        description={
          canManage
            ? "Add the PRC-licensed Pathologists and Medical Technologists who sign laboratory reports."
            : "No PRC-licensed personnel have been registered in this directory yet."
        }
      />
    );
  }

  // One row mutation at a time. While any record is being written every row's actions stand
  // down, because a second toggle fired against the stale list would be reconciled away by the
  // refresh the first one is still waiting on. Pending feedback stays on the busy record only.
  const isAnyRowBusy = busyPersonnelId != null;
  const busyActionFor = (id: string): RowWrite | null =>
    busyPersonnelId === id ? busyAction : null;
  const errorFor = (id: string): string | null => (rowError?.id === id ? rowError.message : null);

  return (
    <>
      {/* Desktop and tablet: a real table. Hidden rather than horizontally scrolled below lg -
          a six-column clinical table compressed into 375px is unreadable whichever way it is
          squeezed, so narrow widths get the record list below instead. */}
      <div className="hidden lg:block">
        <Table striped>
          <TableHeader>
            <TableRow>
              <TableHead>Personnel</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>PRC Licence</TableHead>
              <TableHead>Signature</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {personnel.map((person) => {
              const isBusy = busyPersonnelId === person.id;
              return (
                <TableRow
                  key={person.id}
                  aria-busy={isBusy || undefined}
                  className={[
                    isBusy ? "opacity-60" : "",
                    person.isActive ? "" : "text-brand-text-muted",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {/* Name and credentials share one cell: they are read together, and pairing
                      them removes a column without losing a fact. */}
                  <TableCell>
                    <div className="font-semibold text-brand-text">
                      {formatPersonnelName(person)}
                    </div>
                    {person.credentials && (
                      <div className="mt-0.5 text-[11px] text-brand-text-muted">
                        {person.credentials}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <RoleBadge person={person} />
                  </TableCell>
                  {/* Tabular figures so licence numbers align digit-for-digit down the column,
                      which is how a mismatched one gets spotted. */}
                  <TableCell className="font-mono text-[11px] tabular-nums text-brand-text-muted">
                    {person.prcLicenseNumber}
                  </TableCell>
                  <TableCell>
                    <SignatureIndicator person={person} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={person.isActive ? "Active" : "Inactive"} size="sm" />
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <RowActions
                        person={person}
                        busyAction={busyActionFor(person.id)}
                        isDisabled={isAnyRowBusy}
                        onEdit={onEdit}
                        onToggleStatus={onToggleStatus}
                        onDelete={onDelete}
                        errorMessage={errorFor(person.id)}
                        layout="row"
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Narrow widths: one record per person, carrying every fact the row carries. A white
          working surface with the facts in the body and the actions in a structural footer
          band, so the two controls read as the record's own rather than as loose buttons. */}
      <ul className="space-y-2 lg:hidden">
        {personnel.map((person) => {
          const isBusy = busyPersonnelId === person.id;
          return (
            <li
              key={person.id}
              aria-busy={isBusy || undefined}
              className={[
                "overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low",
                isBusy ? "opacity-60" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="px-3.5 py-2.5">
                {/* Identity wraps rather than truncates. A clipped surname is the single thing
                    that makes an Edit or Deactivate press ambiguous, and two extra lines on a
                    phone cost far less than acting on the wrong Pathologist. */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-[13px] font-semibold leading-snug text-brand-text">
                      {formatPersonnelName(person)}
                    </p>
                    {person.credentials && (
                      <p className="mt-0.5 break-words text-[11px] text-brand-text-muted">
                        {person.credentials}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    status={person.isActive ? "Active" : "Inactive"}
                    size="sm"
                    className="shrink-0"
                  />
                </div>

                <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
                  <RecordField label="Role">
                    <RoleBadge person={person} />
                  </RecordField>
                  <RecordField label="Signature">
                    <SignatureIndicator person={person} />
                  </RecordField>
                  <RecordField label="PRC Licence">
                    <span className="font-mono tabular-nums text-brand-text-muted">
                      {person.prcLicenseNumber}
                    </span>
                  </RecordField>
                </dl>
              </div>

              {canManage && (
                <div className="border-t border-brand-border bg-brand-structural px-3.5 py-2">
                  <RowActions
                    person={person}
                    busyAction={busyActionFor(person.id)}
                    isDisabled={isAnyRowBusy}
                    onEdit={onEdit}
                    onToggleStatus={onToggleStatus}
                    onDelete={onDelete}
                    errorMessage={errorFor(person.id)}
                    layout="record"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
