import { GuidedWorkspace } from "@/features/workspace/GuidedWorkspace";

export const runtime = "nodejs";

export const metadata = {
  title: "Guided Encoding Workspace | St. Rose Diagnostic Laboratory",
  description: "Dynamic result entry form engine and session workspace.",
};

export default function WorkspacePage() {
  return <GuidedWorkspace />;
}
