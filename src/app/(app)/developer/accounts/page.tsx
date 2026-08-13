import "server-only";

import React from "react";
import { DeveloperAccountManagementView } from "@/features/developer-accounts/components/DeveloperAccountManagementView";
import { requireDeveloper } from "@/lib/developer-guard";

export default async function DeveloperAccountsPage() {
  const developer = await requireDeveloper();
  return <DeveloperAccountManagementView currentUserId={developer.id} />;
}
