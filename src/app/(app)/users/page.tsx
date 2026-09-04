import "server-only";

import { redirect } from "next/navigation";
import { UserManagementView } from "./_components/UserManagementView";
import {
  toAccountDirectory,
  type AccountDirectory,
} from "@/features/users/account-directory-entry";
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
  // The projection is role-aware and shared with the API route, so the server-rendered directory
  // and every later refetch carry the same shape. Admin receives the five fields its table
  // renders; Developer receives the three ADR-005 names - no id, no createdAt. The account's
  // internal fields - token version, first-login flags, password timestamps - never leave the
  // server on either path.
  //
  // A transient transport failure falls back to the client fetch that used to be the only path.
  // Anything else is a real fault and belongs to the route error boundary, not a silent empty table.
  let initialDirectory: AccountDirectory | undefined;
  try {
    initialDirectory = toAccountDirectory(
      await userService.getUsersVisibleTo(currentUserProfile.role),
      currentUserProfile.role
    );
  } catch (error) {
    if (!isTransientSupabaseReadFailure(error)) throw error;
    initialDirectory = undefined;
  }

  return (
    <UserManagementView
      currentUserId={currentUserProfile.id}
      currentUserRole={currentUserProfile.role}
      initialDirectory={initialDirectory}
    />
  );
}
