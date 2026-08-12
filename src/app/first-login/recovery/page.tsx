import { redirect } from "next/navigation";
import { FirstLoginForm } from "@/features/auth/components/FirstLoginForm";
import { firstLoginRedirectPath } from "@/lib/first-login-gate";
import { getSession } from "@/lib/session";
import { userService } from "@/services/user-service-instance";

export default async function FirstLoginRecoveryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.mustSetRecovery) {
    redirect(
      session.mustChangePassword ? firstLoginRedirectPath(session) : "/dashboard"
    );
  }

  const securityQuestion = await userService.getSecurityQuestionForUser(session.userId);

  return <FirstLoginForm step="recovery" securityQuestion={securityQuestion} />;
}
