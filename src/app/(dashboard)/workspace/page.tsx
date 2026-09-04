import { GuidedWorkspace } from "./_components/GuidedWorkspace";
import { listRegistryTemplatesAction } from "@/features/server-boundary/server-actions";
import { describeErrorShape } from "@/lib/safe-error";
import { listWorkspacePersonnelAction } from "./_actions/workspace-personnel-actions";

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

  return (
    <GuidedWorkspace
      reopenSessionId={typeof sessionId === "string" ? sessionId : undefined}
      initialTemplates={initialTemplates}
      initialPersonnel={initialDirectory?.personnel}
    />
  );
}
