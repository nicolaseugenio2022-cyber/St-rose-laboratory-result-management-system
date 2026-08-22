import "server-only";

// Server-side auto-suggestion learning under the privileged server boundary (M6 P2b).
//
// The shared repository defaults to the anon browser client, which on the server both bypassed the
// P2 transport policy (default PostgREST retries, no read bound - a stalled suggestion lookup could
// hold the session-completion response toward undici's 300s default) and, under the checked-in RLS
// state (`auto_suggestions` has row level security enabled with no policies), left the learning
// writes silently denied. Constructing the same repository with `supabaseServer` closes both:
// suggestion reads inherit the bounded single-retry read policy, writes remain single-attempt with
// no added timeout, and the existing learning operations persist as originally intended.
//
// This is deliberately a transport-and-boundary correction only. It reuses the existing service and
// repository logic unchanged, touches only the existing `auto_suggestions` operations, and decides
// no authorization: callers reach it exclusively through server-only modules (the session
// repository), never from client components - `server-only` above enforces that at build time.
import { supabaseServer } from "@/lib/supabase/server";
import { AutoSuggestionLearningService } from "./auto-suggestion-service";
import { SupabaseAutoSuggestionRepository } from "@/repositories/supabase-auto-suggestion-repository";

export const serverAutoSuggestionLearningService = new AutoSuggestionLearningService(
  new SupabaseAutoSuggestionRepository(supabaseServer)
);
