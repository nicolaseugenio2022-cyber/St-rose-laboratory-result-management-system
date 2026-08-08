import { IAutoSuggestionLearningService } from "./interfaces";
import { IAutoSuggestion } from "../domain/models/interfaces";
import { SupabaseAutoSuggestionRepository } from "../repositories/supabase-auto-suggestion-repository";

export class AutoSuggestionLearningService implements IAutoSuggestionLearningService {
  private repository: SupabaseAutoSuggestionRepository;

  constructor(repository?: SupabaseAutoSuggestionRepository) {
    this.repository = repository || new SupabaseAutoSuggestionRepository();
  }

  async learnSuggestionsFromSessionDemographics(demographics: {
    requestingPhysician: string;
    referrerName?: string;
    companyName?: string;
  }): Promise<void> {
    if (demographics.requestingPhysician) {
      await this.repository.recordSuggestion("physician", demographics.requestingPhysician);
    }
    if (demographics.referrerName) {
      await this.repository.recordSuggestion("referrer", demographics.referrerName);
    }
    if (demographics.companyName) {
      await this.repository.recordSuggestion("company", demographics.companyName);
    }
  }

  async getSuggestionsByCategory(
    category: "physician" | "referrer" | "company",
    query?: string
  ): Promise<IAutoSuggestion[]> {
    return this.repository.getSuggestionsByCategory(category, query);
  }
}

export const autoSuggestionLearningService = new AutoSuggestionLearningService();
