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
    <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">
      {children}
    </div>
  );
}
