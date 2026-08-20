import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export default function WorkspaceLoading() {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden" aria-busy="true">
      <span className="sr-only">Loading workspace</span>
      <Skeleton className="h-full w-16 shrink-0 rounded-none" />
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <Skeleton className="h-14 w-full shrink-0" />
        <Skeleton className="mt-4 min-h-0 w-full flex-1" />
      </div>
    </div>
  );
}
