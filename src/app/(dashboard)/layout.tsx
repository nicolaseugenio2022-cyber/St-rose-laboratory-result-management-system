import { redirect } from "next/navigation";
import React from "react";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { getCurrentUserProfile } from "@/lib/auth-guards";

export default async function WorkspaceRouteGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const currentUserProfile = await getCurrentUserProfile();
  if (!currentUserProfile) {
    redirect("/login");
  }

  return <WorkspaceShell currentUserRole={currentUserProfile.role}>{children}</WorkspaceShell>;
}
