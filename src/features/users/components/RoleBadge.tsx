import React from "react";
import { UserRole } from "@/types/user";
import { Badge } from "@/components/ui/Badge";

export interface RoleBadgeProps {
  role: UserRole;
}

/**
 * Administrator is distinct, Developer is informational, Laboratory User is neutral.
 *
 * The label is never the bare stored value: "User" alone reads as a placeholder beside
 * "Administrator", and the rest of the application already calls that role Laboratory User. The
 * word carries the meaning here - the tint only reinforces it.
 *
 * Exported because it is the single source of role wording: the directory filters read their
 * option labels from this map, so a filter and a row badge cannot drift into naming the same
 * role two different ways.
 */
export const ROLE_LABEL: Record<UserRole, string> = {
  Admin: "Administrator",
  Developer: "Developer",
  User: "Laboratory User",
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const variant = role === "Admin" ? "indigo" : role === "Developer" ? "blue" : "neutral";
  return (
    <Badge variant={variant} size="sm">
      {ROLE_LABEL[role] ?? role}
    </Badge>
  );
}
