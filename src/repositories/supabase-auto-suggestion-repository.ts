import { IAutoSuggestion } from "../domain/models/interfaces";
import { supabase } from "../lib/supabase/client";

export class SupabaseAutoSuggestionRepository {
  async getSuggestionsByCategory(
    category: "physician" | "referrer" | "company",
    query?: string
  ): Promise<IAutoSuggestion[]> {
    try {
      let req = supabase
        .from("auto_suggestions")
        .select("*")
        .eq("category", category)
        .order("usage_count", { ascending: false })
        .limit(20);

      if (query && query.trim()) {
        req = req.ilike("suggestion_text", `%${query.trim()}%`);
      }

      const { data, error } = await req;
      if (error || !data) return [];

      return data.map((d: Record<string, unknown>) => ({
        id: String(d.id || ""),
        category: d.category as "physician" | "referrer" | "company",
        suggestionText: String(d.suggestion_text || ""),
        usageCount: Number(d.usage_count || 0),
        lastUsedAt: String(d.last_used_at || new Date().toISOString()),
      }));
    } catch {
      return [];
    }
  }

  async recordSuggestion(category: "physician" | "referrer" | "company", text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      // 1. Check if existing suggestion exists
      const { data } = await supabase
        .from("auto_suggestions")
        .select("id, usage_count")
        .eq("category", category)
        .eq("suggestion_text", trimmed)
        .single();

      if (data) {
        // Increment usage count
        await supabase
          .from("auto_suggestions")
          .update({
            usage_count: Number(data.usage_count || 1) + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", data.id);
      } else {
        // Insert new suggestion
        await supabase.from("auto_suggestions").insert({
          category,
          suggestion_text: trimmed,
          usage_count: 1,
          last_used_at: new Date().toISOString(),
        });
      }
    } catch {
      // Defensive silent fallback for auto-suggestion learning
    }
  }
}
