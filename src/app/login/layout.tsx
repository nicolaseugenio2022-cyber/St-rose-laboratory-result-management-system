import { redirect } from "next/navigation";
import React from "react";
import { firstLoginRedirectPath } from "@/lib/first-login-gate";
import { getSession } from "@/lib/session";

export default async function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  if (session) {
    const destination =
      session.mustChangePassword || session.mustSetRecovery
        ? firstLoginRedirectPath(session)
        : "/dashboard";
    redirect(destination);
  }

  return (
    // The composition lives in AuthShell, which each page renders itself - a page knows its own
    // task heading, and this layout does not. All that remains here is the route guard.
    <>{children}</>
  );
}
