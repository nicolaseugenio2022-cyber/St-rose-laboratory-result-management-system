import "server-only";

import { redirect } from "next/navigation";
import { UserManagementView } from "@/features/users/components/UserManagementView";
import type { UserDirectoryEntry } from "@/features/users/components/UserTable";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";
import { isTransientSupabaseReadFailure } from "@/lib/supabase/server";
import { userService } from "@/services/user-service-instance";

export default async function UsersPage() {
  const currentUserProfile = await getCurrentUserProfile();
  const { allowed, redirectUrl } = checkRouteAccess("/users", currentUserProfile);

  if (!allowed || !currentUserProfile) {
    redirect(redirectUrl || "/login");
  }

  // Serve the directory with the page. Previously the table mounted empty and the browser fetched
  // it back through /api/users - a second request that had to re-resolve the caller before it
  // could read anything. Visibility is unchanged: the same service call, scoped by the same
  // session-derived role the API route uses.
  //
  // Only the five fields the table renders cross the boundary. The account's internal fields -
  // token version, first-login flags, password timestamps - never leave the server.
  //
  // A transient transport failure falls back to the client fetch that used to be the only path.
  // Anything else is a real fault and belongs to the route error boundary, not a silent empty table.
  let initialUsers: UserDirectoryEntry[] | undefined;
  try {
    initialUsers = (await userService.getUsersVisibleTo(currentUserProfile.role)).map(
      (user): UserDirectoryEntry => ({
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      })
    );
  } catch (error) {
    if (!isTransientSupabaseReadFailure(error)) throw error;
    initialUsers = undefined;
  }

  return (
    <UserManagementView
      currentUserId={currentUserProfile.id}
      currentUserRole={currentUserProfile.role}
      initialUsers={initialUsers}
    />
  );
}
