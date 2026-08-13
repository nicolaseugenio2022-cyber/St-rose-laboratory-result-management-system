import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth-guards";

export async function requireDeveloper() {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== "Developer" || profile.status !== "Active") {
    redirect("/dashboard?error=unauthorized");
  }
  return profile;
}
