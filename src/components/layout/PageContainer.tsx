import React from "react";
import { cn } from "@/utils/cn";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageContainer({ className, children, ...props }: PageContainerProps) {
  return (
    <main className={cn("flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full", className)} {...props}>
      {children}
    </main>
  );
}
