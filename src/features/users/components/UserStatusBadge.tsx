import React from "react";
import { UserStatus } from "@/types/user";
import { Badge } from "@/components/ui/Badge";

export interface UserStatusBadgeProps {
  status: UserStatus;
}

export function UserStatusBadge({ status }: UserStatusBadgeProps) {
  const isActive = status === "Active";
  return (
    <Badge variant={isActive ? "success" : "warning"} size="sm">
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${isActive ? "bg-brand-success" : "bg-brand-warning"}`} />
      {status}
    </Badge>
  );
}
