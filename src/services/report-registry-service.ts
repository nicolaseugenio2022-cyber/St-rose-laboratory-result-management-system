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
  /**
   * The complete hydrated registry, in repository order, once one bulk load has succeeded.
   *
   * `warmCache()` populated the per-code map but never recorded that the collection as a whole was
   * loaded, so every call re-ran the bulk query even when the map already held all 17 definitions.
   * The map alone cannot answer "is this complete?" - a map with 17 entries is indistinguishable
   * from a map that happens to have 17 entries - which is why completeness needs its own field.
   */
  private hydratedRegistry: HydratedTemplateSpec[] | null = null;
  /** The single in-flight bulk load, so concurrent cold callers share one query rather than N. */
  private inFlightRegistryLoad: Promise<HydratedTemplateSpec[]> | null = null;
  /**
   * Incremented by `clearCache()`. A load that started before an invalidation must not commit its
   * now-stale result afterwards, so the commit step checks the generation it was issued under.
   */
  private cacheGeneration = 0;

  constructor(repository?: IReportRegistryRepository) {
    this.repository = repository || new SupabaseReportRegistryRepository();
  }

  /**
   * Hydrate one template from the repository, WITHOUT touching any cache (SHADCN-07C1-R1).
   *
   * The fallback bulk path used to hydrate through `getTemplateByCode`, which commits each spec as
   * it succeeds. That made the fallback non-transactional: a load that failed on the ninth template
   * left the first eight cached, and a `clearCache()` during the load could be undone by writes
   * that were still arriving. Hydration and commitment are separated here so the fallback can build
   * the whole registry first and commit it once, under the same generation check the bulk path uses.
   *
   * The read itself - the same three parallel repository calls, the same default signatory
   * requirement, the same null-template short-circuit - is unchanged.
   */
  private async hydrateTemplate(templateCode: string): Promise<HydratedTemplateSpec | null> {
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

    return {
      template,
      parameters,
      signatoryRequirement: finalSignatoryRequirement,
    };
  }

  async getTemplateByCode(templateCode: string): Promise<HydratedTemplateSpec | null> {
    if (!templateCode) return null;

    // 1. Check in-memory cache
    if (this.cache.has(templateCode)) {
      return this.cache.get(templateCode)!;
    }

    // 2. Fetch from repository
    const spec = await this.hydrateTemplate(templateCode);
    if (!spec) return null;

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
   * The bulk load itself. Unchanged in what it reads and in what it returns: the same bulk call
   * when the repository implements it, the same per-template fallback when it does not, and the
   * same repository ordering either way.
   */
  private async loadCompleteRegistry(): Promise<HydratedTemplateSpec[]> {
    if (this.repository.getAllHydratedTemplates) {
      return this.repository.getAllHydratedTemplates();
    }

    // Fallback if bulk loading is not implemented. Hydrated through the uncached helper, so a
    // partial failure commits nothing: if any template rejects, Promise.all rejects and warmCache's
    // commit step never runs. Ordering still follows getAllActiveTemplates.
    const templates = await this.getAllActiveTemplates();
    const specs = await Promise.all(
      templates.map(t => this.hydrateTemplate(t.templateCode))
    );
    // A null is a partial failure too, and it must not commit. `hydrateTemplate` resolves to null
    // when a template listed by getAllActiveTemplates no longer answers its per-code read, so
    // filtering nulls away silently produced a SHORTER registry that warmCache then cached as
    // complete - and, because the collection is now marked hydrated, never retried. Rejecting here
    // is what makes the comment above true for both failure shapes.
    const hydrated: HydratedTemplateSpec[] = [];
    for (let index = 0; index < specs.length; index += 1) {
      const spec = specs[index];
      if (!spec) {
        throw new Error(
          `Report registry hydration is incomplete: '${templates[index].templateCode}' is listed as active but did not hydrate.`
        );
      }
      hydrated.push(spec);
    }
    return hydrated;
  }

  /**
   * Warms the cache by bulk-loading all active templates.
   *
   * Three states, in order: already hydrated, currently loading, cold. Only the cold path reaches
   * the repository. A rejection is never cached - the in-flight handle is released in `finally`,
   * so the failure propagates to everyone waiting on that attempt and the next call retries from
   * cold rather than replaying a poisoned promise.
   */
  async warmCache(): Promise<HydratedTemplateSpec[]> {
    if (this.hydratedRegistry) return this.hydratedRegistry;
    if (this.inFlightRegistryLoad) return this.inFlightRegistryLoad;

    const generation = this.cacheGeneration;
    const load = this.loadCompleteRegistry()
      .then((specs) => {
        // A clearCache() during the load bumped the generation; committing here would reinstate
        // exactly the data the caller asked to discard.
        if (this.cacheGeneration === generation) {
          for (const spec of specs) {
            this.cache.set(spec.template.templateCode, spec);
          }
          this.hydratedRegistry = specs;
        }
        return specs;
      })
      .finally(() => {
        if (this.inFlightRegistryLoad === load) this.inFlightRegistryLoad = null;
      });

    this.inFlightRegistryLoad = load;
    return load;
  }

  /**
   * Clears in-memory cache to force fresh data fetching from repository.
   */
  clearCache(): void {
    this.cache.clear();
    this.hydratedRegistry = null;
    this.inFlightRegistryLoad = null;
    this.cacheGeneration += 1;
  }
}

// Singleton instance export for application convenience
export const reportRegistryService = new ReportRegistryService();
