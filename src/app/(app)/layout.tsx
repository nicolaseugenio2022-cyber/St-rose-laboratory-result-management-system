import React from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function AppRouteGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}
