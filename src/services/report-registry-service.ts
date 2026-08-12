import "server-only";

import { 
  IReportRegistryService, 
  HydratedTemplateSpec 
} from "./interfaces";
import { IReportTemplate } from "../domain/models/interfaces";
import { IReportRegistryRepository } from "../repositories/interfaces";
import { SupabaseReportRegistryRepository } from "../repositories/supabase-report-registry-repository";

/**
 * Metadata-driven Report Registry Service Implementation.
 * Caches hydrated template specs in memory to eliminate redundant database roundtrips.
 */
export class ReportRegistryService implements IReportRegistryService {
  private repository: IReportRegistryRepository;
  private cache: Map<string, HydratedTemplateSpec> = new Map();

  constructor(repository?: IReportRegistryRepository) {
    this.repository = repository || new SupabaseReportRegistryRepository();
  }

  async getTemplateByCode(templateCode: string): Promise<HydratedTemplateSpec | null> {
    if (!templateCode) return null;

    // 1. Check in-memory cache
    if (this.cache.has(templateCode)) {
      return this.cache.get(templateCode)!;
    }

    // 2. Fetch from repository
    const [template, parameters, signatoryRequirement] = await Promise.all([
      this.repository.getTemplateByCode(templateCode),
      this.repository.getParametersByTemplateCode(templateCode),
      this.repository.getSignatoryRequirementByTemplateCode(templateCode)
    ]);

    if (!template) return null;

    const finalSignatoryRequirement = signatoryRequirement || {
      id: `default-${templateCode}`,
      templateCode,
      requiredPathologistsCount: 1,
      requiredMedtechsCount: 1,
    };

    const spec: HydratedTemplateSpec = {
      template,
      parameters,
      signatoryRequirement: finalSignatoryRequirement,
    };

    // 3. Cache hydrated spec
    this.cache.set(templateCode, spec);
    return spec;
  }

  async getAllActiveTemplates(): Promise<IReportTemplate[]> {
    return this.repository.getAllActiveTemplates();
  }

  async getAllTemplatesByFamily(family: string): Promise<IReportTemplate[]> {
    const all = await this.getAllActiveTemplates();
    return all.filter((t) => t.examinationFamily.toLowerCase() === family.toLowerCase());
  }

  /**
   * Warms the cache by bulk-loading all active templates.
   */
  async warmCache(): Promise<HydratedTemplateSpec[]> {
    if (this.repository.getAllHydratedTemplates) {
      const specs = await this.repository.getAllHydratedTemplates();
      for (const spec of specs) {
        this.cache.set(spec.template.templateCode, spec);
      }
      return specs;
    }
    
    // Fallback if bulk loading is not implemented
    const templates = await this.getAllActiveTemplates();
    const specs = await Promise.all(
      templates.map(t => this.getTemplateByCode(t.templateCode))
    );
    return specs.filter((s): s is HydratedTemplateSpec => s !== null);
  }

  /**
   * Clears in-memory cache to force fresh data fetching from repository.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance export for application convenience
export const reportRegistryService = new ReportRegistryService();
