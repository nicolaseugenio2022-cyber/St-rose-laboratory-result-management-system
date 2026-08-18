import React from "react";
import { Edit2, Power, UserCheck } from "lucide-react";
import type { IPersonnel } from "@/domain/models/interfaces";
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
import { UserStatusBadge } from "@/features/users/components/UserStatusBadge";

export interface PersonnelTableProps {
  personnel: readonly IPersonnel[];
  canManage: boolean;
  onEdit: (person: IPersonnel) => void;
  onToggleStatus: (person: IPersonnel) => void;
  busyPersonnelId?: string | null;
}

export function formatPersonnelName(person: IPersonnel): string {
  const middle = person.middleInitial?.trim();
  const given = middle ? `${person.firstName} ${middle}.` : person.firstName;
  return `${person.lastName}, ${given}`;
}

export function PersonnelTable({
  personnel,
  canManage,
  onEdit,
  onToggleStatus,
  busyPersonnelId,
}: PersonnelTableProps) {
  if (personnel.length === 0) {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-surface p-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-brand-text-subtle">
          <UserCheck className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-brand-text">No personnel records found</h3>
        <p className="mt-1 text-sm text-brand-text-muted">
          No Pathologist or Medical Technologist records match your active search or role filter.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Full Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Credentials</TableHead>
          <TableHead>PRC License</TableHead>
          <TableHead>Status</TableHead>
          {canManage && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {personnel.map((person) => {
          const isBusy = busyPersonnelId === person.id;
          return (
            <TableRow key={person.id}>
              <TableCell className="text-sm font-semibold text-brand-text">
                {formatPersonnelName(person)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={person.role === "Pathologist" ? "indigo" : "neutral"}
                  size="sm"
                >
                  {personnelRoleLabel(person.role)}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-brand-text-muted">
                {person.credentials}
              </TableCell>
              <TableCell className="font-mono text-xs text-brand-text-muted">
                {person.prcLicenseNumber}
              </TableCell>
              <TableCell>
                <UserStatusBadge status={person.isActive ? "Active" : "Inactive"} />
              </TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(person)}
                      disabled={isBusy}
                      title="Edit Personnel Details"
                    >
                      <Edit2 className="h-4 w-4 text-brand-text-muted" />
                      <span className="sr-only">Edit {formatPersonnelName(person)}</span>
                    </Button>
                    <Button
                      variant={person.isActive ? "outline" : "secondary"}
                      size="sm"
                      onClick={() => onToggleStatus(person)}
                      disabled={isBusy}
                      title={person.isActive ? "Deactivate Personnel" : "Activate Personnel"}
                      className={
                        person.isActive
                          ? "text-brand-warning hover:border-brand-warning-border hover:bg-brand-warning-bg"
                          : "bg-brand-success text-brand-success-bg hover:opacity-90"
                      }
                    >
                      <Power className="h-4 w-4" />
                      <span className="text-xs">
                        {person.isActive ? "Deactivate" : "Activate"}
                      </span>
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
