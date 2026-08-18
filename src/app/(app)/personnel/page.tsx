import { redirect } from "next/navigation";
import { PersonnelDirectoryView } from "@/features/personnel/components/PersonnelDirectoryView";
import {
  listPersonnelAction,
  createPersonnelAction,
  updatePersonnelAction,
  togglePersonnelStatusAction,
} from "@/features/server-boundary/personnel-actions";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";

export default async function PersonnelPage() {
  const currentUserProfile = await getCurrentUserProfile();
  const { allowed, redirectUrl } = checkRouteAccess("/personnel", currentUserProfile);

  if (!allowed) {
    redirect(redirectUrl || "/login");
  }

  const personnel = await listPersonnelAction();

  return (
    <PersonnelDirectoryView
      canManage={currentUserProfile?.role === "Admin"}
      personnel={personnel}
      onSubmit={async (values, editingPersonnel) => {
        "use server";
        const statusActive = values.status === "Active";
        if (editingPersonnel) {
          return updatePersonnelAction({
            id: editingPersonnel.id,
            firstName: values.firstName,
            lastName: values.lastName,
            middleInitial: values.middleInitial,
            credentials: values.credentials,
            prcLicenseNumber: values.prcLicenseNumber,
            role: values.role,
            isActive: statusActive,
          });
        } else {
          return createPersonnelAction({
            firstName: values.firstName,
            lastName: values.lastName,
            middleInitial: values.middleInitial,
            credentials: values.credentials,
            prcLicenseNumber: values.prcLicenseNumber,
            role: values.role,
            isActive: statusActive,
          });
        }
      }}
      onToggleStatus={async (person) => {
        "use server";
        await togglePersonnelStatusAction({
          id: person.id,
          isActive: !person.isActive,
        });
      }}
    />
  );
}
