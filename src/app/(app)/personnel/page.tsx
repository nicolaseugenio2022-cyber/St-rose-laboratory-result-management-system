import { redirect } from "next/navigation";
import { PersonnelDirectoryView } from "@/features/personnel/components/PersonnelDirectoryView";
// TEMPORARY — delete together with preview-fixture.ts in P2.
import { PERSONNEL_PREVIEW_FIXTURE } from "@/features/personnel/components/preview-fixture";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";

export default async function PersonnelPage() {
  const currentUserProfile = await getCurrentUserProfile();
  const { allowed, redirectUrl } = checkRouteAccess("/personnel", currentUserProfile);

  if (!allowed) {
    redirect(redirectUrl || "/login");
  }

  return (
    <PersonnelDirectoryView
      canManage={currentUserProfile?.role === "Admin"}
      personnel={PERSONNEL_PREVIEW_FIXTURE}
      isPreviewData
    />
  );
}
