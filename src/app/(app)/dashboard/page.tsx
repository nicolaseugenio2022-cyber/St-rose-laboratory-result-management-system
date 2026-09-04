import React, { Suspense } from "react";
import DashboardView from "./_components/DashboardView";
import { UnauthorizedNotice } from "./_components/UnauthorizedNotice";
import { getCurrentUserProfile } from "@/lib/auth-guards";

export default async function DashboardPage() {
  const currentUserProfile = await getCurrentUserProfile();
  return (
    <>
      <Suspense fallback={null}>
        <UnauthorizedNotice />
      </Suspense>
      <DashboardView currentUserProfile={currentUserProfile} />
    </>
  );
}
