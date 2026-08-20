import { redirect } from "next/navigation";
import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUserProfile } from "@/lib/auth-guards";

export default async function AppRouteGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUserProfile = await getCurrentUserProfile();
  if (!currentUserProfile) {
    redirect("/login");
  }

  return (
    <AppShell
      currentUserRole={currentUserProfile.role}
      username={currentUserProfile.username}
    >
      {children}
    </AppShell>
  );
}
