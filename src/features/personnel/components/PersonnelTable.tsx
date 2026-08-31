import React from "react";
import { Edit2, Power, UserCheck, PenLine, PenOff, MinusCircle } from "lucide-react";
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
  busyPersonnelId?: string | null;
  /** True when a search or filter is narrowing the list, so "nothing here" can be phrased honestly. */
  isFiltered?: boolean;
  onClearFilters?: () => void;
}

export function formatPersonnelName(person: PersonnelDirectoryEntry): string {
  const middle = person.middleInitial?.trim();
  const given = middle ? `${person.firstName} ${middle}.` : person.firstName;
  return `${person.lastName}, ${given}`;
}

/**
 * Signature state, reported as a plain fact.
 *
 * A signature image is optional. A Pathologist without one still signs reports through their
 * printed name, credentials and PRC licence, so "no image" is a normal configuration rather than
 * an outstanding task: it carries no warning colour, no alert icon and no urgency vocabulary.
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
  if (person.role !== "Pathologist") {
    return {
      label: "Not required",
      Icon: MinusCircle,
      srLabel: "Signature image not required for this role",
    };
  }
  return person.hasSignature
    ? {
        label: "On file",
        Icon: PenLine,
        srLabel: "Signature on file",
      }
    : {
        label: "No image",
        Icon: PenOff,
        srLabel: "No signature image",
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
 * The two row actions, shared by the desktop row and the narrow-width record.
 *
 * One component rather than two copies: the labels below are the accessible names for icon-only
 * controls, and a second copy is where those silently drift out of sync with the visible action.
 */
function RowActions({
  person,
  isBusy,
  isDisabled,
  onEdit,
  onToggleStatus,
  layout,
}: {
  person: PersonnelDirectoryEntry;
  /** This record is the one being written. Only it shows pending feedback. */
  isBusy: boolean;
  /** Some record is being written. Every row's actions stand down until it settles. */
  isDisabled: boolean;
  onEdit: (person: PersonnelDirectoryEntry) => void;
  onToggleStatus: (person: PersonnelDirectoryEntry) => void;
  layout: "row" | "record";
}) {
  const name = formatPersonnelName(person);
  const activateVerb = person.isActive ? "Deactivate" : "Activate";
  // The record layout is rendered only below lg, where the pointer is a finger: its controls
  // keep a 44px target rather than the 32px a size="sm" Button gives a mouse.
  const recordTarget = layout === "record" ? "min-h-11 flex-1" : "";
  return (
    <div
      className={
        layout === "row"
          ? "flex items-center justify-end gap-1.5"
          : "flex items-center gap-2 border-t border-brand-border-subtle pt-2.5"
      }
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(person)}
        disabled={isDisabled}
        className={recordTarget || undefined}
      >
        <Edit2 aria-hidden="true" className="h-3.5 w-3.5" />
        <span className={layout === "record" ? "ml-1.5 text-xs" : "sr-only"}>
          {layout === "record" ? "Edit" : `Edit ${name}`}
        </span>
      </Button>
      <Button
        variant={person.isActive ? "outline" : "secondary"}
        size="sm"
        onClick={() => onToggleStatus(person)}
        disabled={isDisabled}
        isLoading={isBusy}
        aria-label={`${activateVerb} ${name}`}
        className={[
          person.isActive
            ? "text-brand-warning hover:border-brand-warning-border hover:bg-brand-warning-bg"
            : "bg-brand-success text-white hover:opacity-90",
          recordTarget,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {!isBusy && <Power aria-hidden="true" className="h-3.5 w-3.5" />}
        <span className="ml-1.5 text-xs">{activateVerb}</span>
      </Button>
    </div>
  );
}

/** One labelled fact inside a narrow-width record. */
function RecordField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-text-subtle">
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
  busyPersonnelId,
  isFiltered = false,
  onClearFilters,
}: PersonnelTableProps) {
  if (personnel.length === 0) {
    // The two empty cases are different problems and deserve different sentences: an unfiltered
    // directory is genuinely empty and wants the create action, while a filtered one is intact
    // and wants the filters cleared.
    const shell = "rounded-lg border border-brand-card-border bg-brand-card";
    return isFiltered ? (
      <EmptyState
        className={shell}
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
        className={shell}
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

  return (
    <>
      {/* Desktop and tablet: a real table. Hidden rather than horizontally scrolled below lg -
          a six-column clinical table compressed into 375px is unreadable whichever way it is
          squeezed, so narrow widths get the record list below instead. */}
      <div className="hidden lg:block">
        <Table>
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
                    "even:bg-brand-background",
                    isBusy ? "opacity-60" : "",
                    person.isActive ? "" : "text-brand-text-muted",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {/* Name and credentials share one cell: they are read together, and pairing
                      them removes a column without losing a fact. */}
                  <TableCell className="py-2">
                    <div className="font-semibold text-brand-text">
                      {formatPersonnelName(person)}
                    </div>
                    {person.credentials && (
                      <div className="mt-0.5 text-[11px] text-brand-text-muted">
                        {person.credentials}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <RoleBadge person={person} />
                  </TableCell>
                  {/* Tabular figures so licence numbers align digit-for-digit down the column,
                      which is how a mismatched one gets spotted. */}
                  <TableCell className="py-2 font-mono text-[11px] tabular-nums text-brand-text-muted">
                    {person.prcLicenseNumber}
                  </TableCell>
                  <TableCell className="py-2">
                    <SignatureIndicator person={person} />
                  </TableCell>
                  <TableCell className="py-2">
                    <StatusBadge status={person.isActive ? "Active" : "Inactive"} size="sm" />
                  </TableCell>
                  {canManage && (
                    <TableCell className="py-2 text-right">
                      <RowActions
                        person={person}
                        isBusy={isBusy}
                        isDisabled={isAnyRowBusy}
                        onEdit={onEdit}
                        onToggleStatus={onToggleStatus}
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

      {/* Narrow widths: one elevated record per person, carrying every fact the row carries. */}
      <ul className="space-y-2 lg:hidden">
        {personnel.map((person) => {
          const isBusy = busyPersonnelId === person.id;
          return (
            <li
              key={person.id}
              aria-busy={isBusy || undefined}
              className={[
                "rounded-lg border border-brand-card-border bg-brand-card p-3 shadow-sm",
                isBusy ? "opacity-60" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* Identity wraps rather than truncates. A clipped surname is the single thing that
                  makes an Edit or Deactivate press ambiguous, and two extra lines on a phone cost
                  far less than acting on the wrong Pathologist. */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-brand-text">
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

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
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

              {canManage && (
                <div className="mt-3">
                  <RowActions
                    person={person}
                    isBusy={isBusy}
                    isDisabled={isAnyRowBusy}
                    onEdit={onEdit}
                    onToggleStatus={onToggleStatus}
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
