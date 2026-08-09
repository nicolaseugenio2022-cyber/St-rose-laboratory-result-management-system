import { redirect } from "next/navigation";
import { UserManagementView } from "@/features/users/components/UserManagementView";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";

export default async function UsersPage() {
  const currentUserProfile = await getCurrentUserProfile();
  const { allowed, redirectUrl } = checkRouteAccess("/users", currentUserProfile);

  if (!allowed) {
    redirect(redirectUrl || "/login");
  }

  return (
    <UserManagementView
      currentUserId={currentUserProfile?.id ?? ""}
      currentUserRole={currentUserProfile?.role}
    />
  );
}
