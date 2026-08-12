import { redirect } from "next/navigation";
import { FirstLoginForm } from "@/features/auth/components/FirstLoginForm";
import { firstLoginRedirectPath } from "@/lib/first-login-gate";
import { getSession } from "@/lib/session";

export default async function FirstLoginPasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.mustChangePassword) {
    redirect(
      session.mustSetRecovery ? firstLoginRedirectPath(session) : "/dashboard"
    );
  }

  return <FirstLoginForm step="password" />;
}
