import { GuidedWorkspace } from "@/features/workspace/GuidedWorkspace";
import { listRegistryTemplatesAction } from "@/features/server-boundary/server-actions";
import { listWorkspacePersonnelAction } from "@/features/server-boundary/workspace-personnel-actions";

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
  } catch {
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
