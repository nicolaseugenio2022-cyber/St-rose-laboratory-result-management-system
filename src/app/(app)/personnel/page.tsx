import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { PersonnelDirectoryView } from "./_components/PersonnelDirectoryView";
import { PhysicianDirectoryView } from "./_components/PhysicianDirectoryView";
import {
  listPersonnelAction,
  createPersonnelAction,
  updatePersonnelAction,
  togglePersonnelStatusAction,
} from "@/features/server-boundary/personnel-actions";
import {
  listPhysiciansAction,
  listPhysicianAssignmentsAction,
  savePhysicianConfigurationAction,
  togglePhysicianStatusAction,
} from "@/features/server-boundary/physician-actions";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";

/**
 * Two directories on one route.
 *
 * Signing personnel and requesting physicians are both name registries maintained by the same
 * Administrator, guarded by the same personnel reader/admin pair, and read in the same sitting -
 * so they are two sections of this page rather than two routes with two navigation entries.
 * Each section owns its own heading, its own summary strip, its own filters and its own modal;
 * neither shares state with the other.
 */
export default async function PersonnelPage() {
  const currentUserProfile = await getCurrentUserProfile();
  const { allowed, redirectUrl } = checkRouteAccess("/personnel", currentUserProfile);

  if (!allowed) {
    redirect(redirectUrl || "/login");
  }

  const canManage = currentUserProfile?.role === "Admin";
  // The two directories are loaded independently, and the physician read is allowed to fail.
  //
  // `Promise.all` rejects as a unit, so an unavailable `physicians` table - the window between
  // this code deploying and its migration being applied - would take the EXISTING Signing
  // Personnel directory down with it, turning a missing new feature into a regression of a page
  // that already worked. `allSettled` confines the failure to the section that caused it.
  //
  // This mirrors what the Workspace already does for the same read: RequestedBySection falls back
  // to an empty roster so encoding stays usable when the directory is unavailable.
  const [personnelResult, physiciansResult, assignmentsResult] = await Promise.allSettled([
    listPersonnelAction(),
    listPhysiciansAction(),
    listPhysicianAssignmentsAction(),
  ]);

  // Personnel is NOT given the same tolerance: this page exists to administer it, and rendering an
  // empty directory would misrepresent the record rather than degrade gracefully.
  if (personnelResult.status === "rejected") throw personnelResult.reason;
  const personnel = personnelResult.value;
  const physicians = physiciansResult.status === "fulfilled" ? physiciansResult.value : [];
  const physiciansUnavailable = physiciansResult.status === "rejected";
  // Assignments degrade on their own terms. An unavailable join table must not blank out the
  // roster: every physician then reads as Unassigned, which is a truthful rendering of an empty
  // assignment set and is corrected by the warning above the section.
  const physicianAssignments =
    assignmentsResult.status === "fulfilled" ? assignmentsResult.value : [];
  const assignmentsUnavailable = assignmentsResult.status === "rejected";

  return (
    <div className="space-y-8 pb-6">
      <section aria-labelledby="personnel-section-heading">
        <h2
          id="personnel-section-heading"
          className="mb-3 text-sm font-semibold text-brand-text"
        >
          Signing Personnel
        </h2>
        <PersonnelDirectoryView
          canManage={canManage}
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
      </section>

      <section aria-labelledby="physician-section-heading">
        <h2
          id="physician-section-heading"
          className="mb-3 text-sm font-semibold text-brand-text"
        >
          Requesting Physicians
        </h2>
        {physiciansUnavailable && (
          <Alert variant="warning" className="mb-3">
            The physician directory could not be loaded. Signing Personnel above is unaffected, and
            Requested By remains a free-text field, so encoding is not blocked.
          </Alert>
        )}
        {!physiciansUnavailable && assignmentsUnavailable && (
          <Alert variant="warning" className="mb-3">
            Examination assignments could not be loaded, so every physician below is shown without
            them. The names themselves are current, and nothing is changed by opening this page.
          </Alert>
        )}
        <PhysicianDirectoryView
          canManage={canManage}
          physicians={physicians}
          assignments={physicianAssignments}
          onSubmit={async (values, editingPhysician) => {
            "use server";
            // ONE ACTION, ONE TRANSACTION. The record and its complete assignment set are saved
            // together or not at all, and the physician identifier is produced server-side, so a
            // newly created physician is never resolved by looking its name up again. What was
            // here before was a composition - write the record, find it by name, then replace its
            // assignments - whose steps committed independently and could leave a physician
            // half-configured, or clear another physician's default while reporting failure.
            //
            // `savePhysicianConfigurationAction` authorizes for itself: requirePersonnelAdmin()
            // runs inside it before the payload is parsed, so passing through here adds no
            // authorization and removes none. `canManage` on the section below is presentation.
            // The server re-decides every rule the editor applied - unknown template, default
            // without assignment, default on an inactive physician - and so does the transaction.
            return savePhysicianConfigurationAction({
              id: editingPhysician?.id ?? null,
              fullName: values.fullName,
              isActive: values.status === "Active",
              templateCodes: values.assignedExaminations,
              defaultTemplateCodes: values.defaultExaminations,
            });
          }}
          onToggleStatus={async (physician) => {
            "use server";
            // Soft toggle only. A physician row is never deleted, so a historical report keeps
            // resolving the name it was issued with.
            await togglePhysicianStatusAction({
              id: physician.id,
              isActive: !physician.isActive,
            });
          }}
        />
      </section>
    </div>
  );
}
