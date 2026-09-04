"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/Alert";

export function UnauthorizedNotice() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  if (searchParams.get("error") !== "unauthorized") return null;

  return (
    <Alert
      variant="warning"
      title="You do not have access to that page"
      onDismiss={() => router.replace(pathname, { scroll: false })}
      dismissLabel="Dismiss access notice"
      className="mb-4"
    >
      Your account role does not permit that destination. You were returned to the Dashboard.
    </Alert>
  );
}
