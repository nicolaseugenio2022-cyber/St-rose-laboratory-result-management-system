import { redirect } from "next/navigation";
import React from "react";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { AccountLoadError } from "@/features/auth/components/AccountLoadError";
import { loadAuthenticatedShellProfile } from "@/lib/authenticated-shell";

export default async function WorkspaceRouteGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const shellProfile = await loadAuthenticatedShellProfile();
  if (shellProfile.status === "unavailable") {
    // Fail-closed retry surface: a transient profile-read failure must not look like a logout,
    // and no children or role-dependent chrome may render without a resolved profile.
    return <AccountLoadError />;
  }
  if (shellProfile.status === "unauthenticated") {
    redirect("/login");
  }

  return <WorkspaceShell currentUserRole={shellProfile.profile.role}>{children}</WorkspaceShell>;
}
