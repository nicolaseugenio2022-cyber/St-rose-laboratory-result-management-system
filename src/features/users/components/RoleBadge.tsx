import React from "react";
import { UserRole } from "@/types/user";
import { Badge } from "@/components/ui/Badge";

export interface RoleBadgeProps {
  role: UserRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const isAdmin = role === "Admin";
  return (
    <Badge variant={isAdmin ? "indigo" : "neutral"} size="sm">
      {role}
    </Badge>
  );
}
