import React from "react";
import DashboardView from "@/features/dashboard/components/DashboardView";
import { getCurrentUserProfile } from "@/lib/auth-guards";

export default async function DashboardPage() {
  const currentUserProfile = await getCurrentUserProfile();
  return <DashboardView currentUserProfile={currentUserProfile} />;
}
