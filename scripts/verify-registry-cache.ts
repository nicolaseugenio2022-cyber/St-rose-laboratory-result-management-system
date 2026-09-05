/**
 * SHADCN-07C1 — ReportRegistryService cache effectiveness.
 *
 * Behavioural, not textual: every assertion below is a COUNT of calls a fake repository actually
 * received. `warmCache()` populated the per-code map but never recorded that the collection as a
 * whole had loaded, so it re-ran the bulk query on every call. A source-text assertion could not
 * have caught that, and cannot catch its return either - only counting can.
 *
 * The fake repository is deliberately the narrow `IReportRegistryRepository` surface. Nothing here
 * touches Supabase, the network, or any clinical definition: the specs are opaque fixtures whose
 * only job is to be counted and to come back in the order they were given.
 */
import type { HydratedTemplateSpec } from "../src/services/interfaces";
import type { IReportTemplate } from "../src/domain/models/interfaces";
import type { IReportRegistryRepository } from "../src/repositories/interfaces";

/**
 * The service module reaches the Supabase server module, which builds its client at import time
 * and refuses to load without credentials. A cache gate must not depend on a configured
 * environment, so the module is required lazily behind inert placeholders - the same precedent
 * `verify-checkpoint-m6c.ts` established. Nothing here opens a connection: every test supplies its
 * own fake repository, so `SupabaseReportRegistryRepository` is never constructed, and no real
 * secret is read.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://verifier.invalid";
process.env.SUPABASE_SECRET_KEY ||= "verifier-placeholder-not-a-credential";
const { ReportRegistryService } =
  require("../src/services/report-registry-service") as typeof import("../src/services/report-registry-service");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Registry cache verification failed: ${message}`);
  console.log(`✓ ${message}`);
}

const TEMPLATE_CODES = ["CHEM_8", "HDL_LDL", "CHEM_10", "URINALYSIS"];

function spec(templateCode: string): HydratedTemplateSpec {
  return {
    template: { templateCode } as IReportTemplate,
    parameters: [],
    signatoryRequirement: {
      id: `default-${templateCode}`,
      templateCode,
      requiredPathologistsCount: 1,
      requiredMedtechsCount: 1,
    },
  } as HydratedTemplateSpec;
}

class CountingRegistryRepository implements IReportRegistryRepository {
  bulkLoads = 0;
  perCodeLoads = 0;
  failNextBulkLoad = false;
  private release: (() => void) | null = null;

  /** Hold the next bulk load open so concurrent callers overlap deterministically. */
  gate(): () => void {
    let opened = false;
    const pending = new Promise<void>((resolve) => {
      this.release = () => {
        if (!opened) {
          opened = true;
          resolve();
        }
      };
    });
    this.pending = pending;
    return () => this.release?.();
  }
  private pending: Promise<void> | null = null;

  async getAllHydratedTemplates(): Promise<HydratedTemplateSpec[]> {
    this.bulkLoads += 1;
    if (this.pending) {
      const waiting = this.pending;
      this.pending = null;
      await waiting;
    }
    if (this.failNextBulkLoad) {
      this.failNextBulkLoad = false;
      throw new Error("registry bulk load unavailable");
    }
    return TEMPLATE_CODES.map(spec);
  }

  async getTemplateByCode(templateCode: string): Promise<IReportTemplate | null> {
    this.perCodeLoads += 1;
    return { templateCode } as IReportTemplate;
  }

  async getParametersByTemplateCode(): Promise<never[]> {
    this.perCodeLoads += 1;
    return [];
  }

  async getSignatoryRequirementByTemplateCode(): Promise<null> {
    this.perCodeLoads += 1;
    return null;
  }

  async getAllActiveTemplates(): Promise<IReportTemplate[]> {
    this.perCodeLoads += 1;
    return TEMPLATE_CODES.map((templateCode) => ({ templateCode }) as IReportTemplate);
  }
}

/**
 * SHADCN-07C1-R1 — the fallback path, for a repository that does NOT implement
 * getAllHydratedTemplates(). It hydrates template by template, so it is the path where a partial
 * failure could leave half the registry cached. These cases prove commitment is all-or-nothing.
 */
class FallbackOnlyRepository implements IReportRegistryRepository {
  templateLoads = 0;
  listLoads = 0;
  parameterLoads = 0;
  requirementLoads = 0;
  failOnCode: string | null = null;
  private release: (() => void) | null = null;
  private pending: Promise<void> | null = null;

  gate(): () => void {
    let opened = false;
    const pending = new Promise<void>((resolve) => {
      this.release = () => {
        if (!opened) {
          opened = true;
          resolve();
        }
      };
    });
    this.pending = pending;
    return () => this.release?.();
  }

  async getAllActiveTemplates(): Promise<IReportTemplate[]> {
    this.listLoads += 1;
    return TEMPLATE_CODES.map((templateCode) => ({ templateCode }) as IReportTemplate);
  }

  async getTemplateByCode(templateCode: string): Promise<IReportTemplate | null> {
    this.templateLoads += 1;
    if (this.pending) {
      const waiting = this.pending;
      this.pending = null;
      await waiting;
    }
    if (this.failOnCode === templateCode) throw new Error(`hydration failed for ${templateCode}`);
    return { templateCode } as IReportTemplate;
  }

  // Counted, like CountingRegistryRepository counts them through perCodeLoads. Hydration calls all
  // three per-template methods, so leaving these two silent made every fallback measurement below
  // partial: a regression that served the template from cache but re-fetched the parameters or the
  // signatory requirement on each call would have satisfied "zero additional repository loads".
  async getParametersByTemplateCode(): Promise<never[]> {
    this.parameterLoads += 1;
    return [];
  }

  async getSignatoryRequirementByTemplateCode(): Promise<null> {
    this.requirementLoads += 1;
    return null;
  }
}

async function runFallback(): Promise<void> {
  // ── F1. Successful fallback commits only after full success ──────────────
  const fallback = new FallbackOnlyRepository();
  const fallbackService = new ReportRegistryService(fallback);

  const hydrated = await fallbackService.warmCache();
  assert(
    hydrated.map((s) => s.template.templateCode).join(",") === TEMPLATE_CODES.join(","),
    "F1 the fallback hydrates every definition in getAllActiveTemplates order"
  );
  const templateLoadsAfterFirst: number = fallback.templateLoads;
  const parameterLoadsAfterFirst: number = fallback.parameterLoads;
  const requirementLoadsAfterFirst: number = fallback.requirementLoads;
  await fallbackService.warmCache();
  assert(
    fallback.templateLoads === templateLoadsAfterFirst &&
      fallback.parameterLoads === parameterLoadsAfterFirst &&
      fallback.requirementLoads === requirementLoadsAfterFirst &&
      fallback.listLoads === 1,
    "F1 a warm fallback warmCache performs zero additional repository loads"
  );
  const served = await fallbackService.getTemplateByCode(TEMPLATE_CODES[0]);
  assert(
    served?.template.templateCode === TEMPLATE_CODES[0] &&
      fallback.templateLoads === templateLoadsAfterFirst,
    "F1 the committed fallback entries serve getTemplateByCode without another load"
  );

  // ── F2. A partial fallback failure caches nothing ────────────────────────
  const partial = new FallbackOnlyRepository();
  const partialService = new ReportRegistryService(partial);
  partial.failOnCode = TEMPLATE_CODES[2];

  let partialRejected = false;
  try {
    await partialService.warmCache();
  } catch {
    partialRejected = true;
  }
  assert(partialRejected, "F2 a fallback load that fails on one template rejects as a whole");

  // The templates that DID succeed must not be cached. Reading one back has to reach the
  // repository again, which is the observable proof that nothing was committed early.
  partial.failOnCode = null;
  const loadsBeforeReadback: number = partial.templateLoads;
  const readBack = await partialService.getTemplateByCode(TEMPLATE_CODES[0]);
  assert(
    readBack?.template.templateCode === TEMPLATE_CODES[0] &&
      partial.templateLoads === loadsBeforeReadback + 1,
    "F2 a template that succeeded during the failed load was not cached"
  );

  // ── F3. Retry after failure reaches the repository again ─────────────────
  const retryRepository = new FallbackOnlyRepository();
  const retryService = new ReportRegistryService(retryRepository);
  retryRepository.failOnCode = TEMPLATE_CODES[1];
  try {
    await retryService.warmCache();
  } catch {
    /* expected */
  }
  const listLoadsAfterFailure: number = retryRepository.listLoads;
  retryRepository.failOnCode = null;
  const retried = await retryService.warmCache();
  assert(
    retryRepository.listLoads === listLoadsAfterFailure + 1 &&
      retried.map((s) => s.template.templateCode).join(",") === TEMPLATE_CODES.join(","),
    "F3 a retry after a failed fallback load reaches the repository again and hydrates fully"
  );

  // ── F4. clearCache during an in-flight fallback cannot repopulate ────────
  const raced = new FallbackOnlyRepository();
  const racedService = new ReportRegistryService(raced);
  const openRaced = raced.gate();
  const inFlightFallback = racedService.warmCache();
  racedService.clearCache();
  openRaced();
  await inFlightFallback;

  const loadsAfterRace: number = raced.templateLoads;
  const afterRace = await racedService.getTemplateByCode(TEMPLATE_CODES[0]);
  assert(
    afterRace?.template.templateCode === TEMPLATE_CODES[0] &&
      raced.templateLoads === loadsAfterRace + 1,
    "F4 a fallback load superseded by clearCache repopulates neither the per-code nor the collection cache"
  );

  // ── F5. The next warm after clearing performs a fresh load ───────────────
  const listLoadsBeforeFreshWarm: number = raced.listLoads;
  await racedService.warmCache();
  assert(
    raced.listLoads === listLoadsBeforeFreshWarm + 1,
    "F5 the first warmCache after clearing performs a fresh fallback load"
  );
}

async function run(): Promise<void> {
  // ── 1. Cold warm → exactly one bulk load ─────────────────────────────────
  const repository = new CountingRegistryRepository();
  const service = new ReportRegistryService(repository);

  const cold = await service.warmCache();
  assert(repository.bulkLoads === 1, "a cold warmCache performs exactly one bulk repository load");
  assert(
    cold.length === TEMPLATE_CODES.length &&
      cold.map((s) => s.template.templateCode).join(",") === TEMPLATE_CODES.join(","),
    "the cold load returns every definition in repository order"
  );

  // ── 2. Warm warm → zero additional loads ─────────────────────────────────
  const warm = await service.warmCache();
  assert(repository.bulkLoads === 1, "a warm warmCache performs zero additional repository loads");
  assert(
    warm.map((s) => s.template.templateCode).join(",") === TEMPLATE_CODES.join(","),
    "the warm call returns the same complete registry, in the same order"
  );

  // ── 3. getTemplateByCode after warming → zero additional loads ───────────
  const perCodeBefore = repository.perCodeLoads;
  for (const templateCode of TEMPLATE_CODES) {
    const hydrated = await service.getTemplateByCode(templateCode);
    assert(
      hydrated?.template.templateCode === templateCode,
      `getTemplateByCode serves ${templateCode} from the hydrated entries`
    );
  }
  assert(
    repository.perCodeLoads === perCodeBefore && repository.bulkLoads === 1,
    "getTemplateByCode after warming performs zero additional repository loads"
  );

  // ── 4. Concurrent cold calls share one in-flight load ────────────────────
  const concurrent = new CountingRegistryRepository();
  const concurrentService = new ReportRegistryService(concurrent);
  const open = concurrent.gate();
  const inFlight = [
    concurrentService.warmCache(),
    concurrentService.warmCache(),
    concurrentService.warmCache(),
  ];
  open();
  const settled = await Promise.all(inFlight);
  assert(
    concurrent.bulkLoads === 1,
    "three concurrent cold warmCache calls share one bulk repository load"
  );
  assert(
    settled.every((s) => s.map((x) => x.template.templateCode).join(",") === TEMPLATE_CODES.join(",")),
    "every concurrent caller receives the same complete registry"
  );

  // ── 5. A failed load is not cached, and does not poison the retry ────────
  const failing = new CountingRegistryRepository();
  const failingService = new ReportRegistryService(failing);
  failing.failNextBulkLoad = true;
  let rejected = false;
  try {
    await failingService.warmCache();
  } catch {
    rejected = true;
  }
  assert(rejected, "a failed bulk load rejects rather than resolving to a partial registry");
  assert(failing.bulkLoads === 1, "the failed attempt made exactly one repository load");

  const retried = await failingService.warmCache();
  const loadsAfterRetry: number = failing.bulkLoads;
  assert(
    loadsAfterRetry === 2,
    "a retry after a failed load reaches the repository again; the rejection was not cached"
  );
  assert(
    retried.map((s) => s.template.templateCode).join(",") === TEMPLATE_CODES.join(","),
    "the retry hydrates the complete registry"
  );
  await failingService.warmCache();
  const loadsAfterRecovery: number = failing.bulkLoads;
  assert(loadsAfterRecovery === 2, "the recovered cache is reused, so no third load occurs");

  // ── 6. clearCache invalidates the collection and the supporting state ────
  service.clearCache();
  await service.warmCache();
  const loadsAfterClear: number = repository.bulkLoads;
  assert(loadsAfterClear === 2, "clearCache forces the next warmCache to reload");

  const afterClear = await service.getTemplateByCode(TEMPLATE_CODES[0]);
  const loadsAfterRehydrate: number = repository.bulkLoads;
  assert(
    afterClear?.template.templateCode === TEMPLATE_CODES[0] && loadsAfterRehydrate === 2,
    "the reloaded registry rehydrates the per-code entries without another load"
  );

  await runFallback();

  console.log("\nRegistry cache verification passed: bulk loads are performed once per hydration.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
