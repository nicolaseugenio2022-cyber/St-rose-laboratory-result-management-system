import { GuidedWorkspace } from "./_components/GuidedWorkspace";
import { listRegistryTemplatesAction } from "@/features/server-boundary/server-actions";
import { describeErrorShape } from "@/lib/safe-error";
import { listWorkspacePersonnelAction } from "./_actions/workspace-personnel-actions";
import { listWorkspacePhysicianOptionsAction } from "./_actions/workspace-physician-actions";

export const runtime = "nodejs";

export const metadata = {
  title: "Guided Encoding Workspace | St. Rose Diagnostic Laboratory",
  description: "Dynamic result entry form engine and session workspace.",
};

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sessionId } = await searchParams;

  // Catalog and personnel fetched during server render, in parallel, so the workspace paints with
  // its data instead of fetching after hydration. On any failure both fall back to undefined and
  // GuidedWorkspace runs its original client fetches - no error path is lost, nothing is cached.
  let initialTemplates;
  let initialDirectory;
  let initialPhysicianOptions;

  /**
   * CLINIC-PERF-01: the physician roster joins the server bootstrap.
   *
   * It was read after hydration instead, and the Workspace waited for it before it would
   * materialize any report - so the operator watched an empty desk for a full client round
   * trip that the server render could have already paid for. Started here, before the await
   * below, it overlaps the registry and personnel reads rather than following them.
   *
   * Its failure domain is deliberately its OWN. Folding it into the Promise.all beside the
   * other two would mean a physician outage also erased the catalog and the roster, which is
   * the coupling the existing handler below already warns about. The rejection handler is
   * attached at creation, not at the await, so nothing is reported as unhandled in between.
   */
  const physicianOptionsPromise = listWorkspacePhysicianOptionsAction();
  void physicianOptionsPromise.catch(() => undefined);

  try {
    [initialTemplates, initialDirectory] = await Promise.all([
      listRegistryTemplatesAction({}),
      listWorkspacePersonnelAction(),
    ]);
  } catch (error: unknown) {
    // Both fall back to the client fetches exactly as before. The bootstrap covers two dependencies
    // in one Promise.all, so a failure here previously erased the registry and the roster with no
    // record of which one failed or why. Shape only; no template, personnel or session data.
    console.error("Workspace bootstrap load failed.", {
      route: "/workspace",
      stage: "registryAndPersonnelBootstrap",
      ...describeErrorShape(error),
    });
    initialTemplates = undefined;
    initialDirectory = undefined;
  }

  try {
    initialPhysicianOptions = await physicianOptionsPromise;
  } catch (error: unknown) {
    // Requested By is optional free text, so a physician outage costs a suggestion list and
    // nothing else. The client effect stays as the fallback and resolves the roster either
    // way, so encoding is never blocked. Shape only; no physician or assignment data.
    console.error("Workspace physician bootstrap load failed.", {
      route: "/workspace",
      stage: "physicianOptionsBootstrap",
      ...describeErrorShape(error),
    });
    initialPhysicianOptions = undefined;
  }

  return (
    <GuidedWorkspace
      reopenSessionId={typeof sessionId === "string" ? sessionId : undefined}
      initialTemplates={initialTemplates}
      initialPersonnel={initialDirectory?.personnel}
      initialPhysicianOptions={initialPhysicianOptions}
    />
  );
}
