import "server-only";

// Shared profile resolution for the authenticated route-group layouts (M6 resilience follow-up).
//
// The layouts previously awaited getCurrentUserProfile() bare, so a bounded transport failure
// from the profile read (the P2 timeout envelope, DNS/connect faults) escaped as a generic 500 -
// indistinguishable from a logout. This helper is the single owner of that distinction:
//
//   ready           - profile resolved; render the shell as before.
//   unauthenticated - resolved null: missing/invalid/expired cookie, or DB revalidation rejected
//                     the session (user missing, inactive, tokenVersion mismatch). Callers keep
//                     the existing redirect("/login") behavior unchanged.
//   unavailable     - the read itself failed with a proven transient transport shape. Callers
//                     must render a retryable fail-closed surface: no children, no
//                     role-dependent chrome, no redirect - a temporary infrastructure fault must
//                     not look like an expired session.
//
// Anything else (coded PostgREST/SQL errors, app-internal Error instances, aborts) rethrows
// unchanged to the framework error boundary. The try wraps ONLY the profile read; redirect()
// stays in the layouts, outside any catch, so NEXT_REDIRECT control flow is never swallowed.
import { getCurrentUserProfile } from "@/lib/auth-guards";
import { isTransientSupabaseReadFailure } from "@/lib/supabase/server";
import type { UserProfile } from "@/types/user";

export type AuthenticatedShellProfile =
  | { status: "ready"; profile: UserProfile }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

export async function loadAuthenticatedShellProfile(): Promise<AuthenticatedShellProfile> {
  try {
    const profile = await getCurrentUserProfile();
    return profile ? { status: "ready", profile } : { status: "unauthenticated" };
  } catch (error) {
    if (isTransientSupabaseReadFailure(error)) return { status: "unavailable" };
    throw error;
  }
}
