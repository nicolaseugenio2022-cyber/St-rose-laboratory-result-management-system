import { GuidedWorkspace } from "@/features/workspace/GuidedWorkspace";

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
  return (
    <GuidedWorkspace reopenSessionId={typeof sessionId === "string" ? sessionId : undefined} />
  );
}
