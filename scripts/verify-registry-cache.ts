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
import {
  isDegradedRegistryResult,
  markDegradedRegistryResult,
} from "../src/repositories/interfaces";

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
const { supabaseServer } =
  require("../src/lib/supabase/server") as typeof import("../src/lib/supabase/server");

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

/**
 * SHADCN-07CR — a seed fallback is served but never committed.
 *
 * The repository returns seed definitions when its bulk read fails, and that fallback stays: the
 * caller asking during an outage still gets a usable registry. What must not happen is caching it.
 * `hydratedRegistry` is the short-circuit every later call consults, so a committed fallback would
 * serve seed parameters and reference ranges for the life of the process - long after the database
 * recovered, and with nothing marking the data as unauthoritative.
 *
 * Behavioural, like the rest of this file: every assertion counts calls a fake repository actually
 * received, or reads what the service actually returned.
 */
class DegradingRegistryRepository implements IReportRegistryRepository {
  bulkLoads = 0;
  perCodeLoads = 0;
  /** While true, the bulk read "fails" and answers with a marked seed result. */
  degrade = true;
  private release: (() => void) | null = null;
  private pending: Promise<void> | null = null;

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

  async getAllHydratedTemplates(): Promise<HydratedTemplateSpec[]> {
    this.bulkLoads += 1;
    if (this.pending) {
      const waiting = this.pending;
      this.pending = null;
      await waiting;
    }
    if (this.degrade) {
      return markDegradedRegistryResult(TEMPLATE_CODES.map(spec));
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
 * SHADCN-07CR — a PARTIAL bulk read is degraded too, proven against the real repository.
 *
 * The cases above drive fake repositories, which cannot catch this: the defect lives in
 * `SupabaseReportRegistryRepository` itself. `template_parameters` and
 * `template_signatory_requirements` were consumed through `|| []`, so an errored query produced a
 * full set of templates carrying NO parameters - unmarked, and therefore committed by warmCache as
 * the authoritative registry. Reports would then render with no result rows until the process
 * restarted.
 *
 * The Supabase client is stubbed at `from()`, mimicking the PostgREST builder: every chained call
 * returns the same object, and awaiting it yields the `{ data, error }` this table was configured
 * to answer with. No network, no credentials, no real client behaviour relied upon.
 */
type StubbedTable = { data: unknown[] | null; error: unknown };
/** The restore function also reports how many table reads the stub served. */
type TableStubHandle = (() => void) & { reads: () => number };

function stubSupabaseTables(tables: Record<string, StubbedTable>): TableStubHandle {
  const client = supabaseServer as unknown as { from: (table: string) => unknown };
  const originalFrom = client.from;
  let reads = 0;
  client.from = (table: string) => {
    reads += 1;
    const answer = tables[table] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "limit", "in"]) {
      builder[method] = () => builder;
    }
    builder.then = (resolve: (value: StubbedTable) => unknown) => Promise.resolve(answer).then(resolve);
    return builder;
  };
  const restore = (() => {
    client.from = originalFrom;
  }) as TableStubHandle;
  restore.reads = () => reads;
  return restore;
}

const HEALTHY_TEMPLATE_ROW = {
  id: "t1",
  template_code: "CHEM_8",
  template_title: "Chemistry 8",
  examination_family: "Clinical Chemistry",
  renderer_family: "Tabular",
  is_active: true,
};

async function runPartialBulkFailure(): Promise<void> {
  const { SupabaseReportRegistryRepository } =
    require("../src/repositories/supabase-report-registry-repository") as typeof import("../src/repositories/supabase-report-registry-repository");

  // ── P1. A failed template_parameters read is degraded, not a healthy empty registry ──
  let restore = stubSupabaseTables({
    report_templates: { data: [HEALTHY_TEMPLATE_ROW], error: null },
    template_parameters: { data: null, error: { message: "parameters unavailable" } },
    template_signatory_requirements: { data: [], error: null },
  });
  let specs: HydratedTemplateSpec[];
  try {
    specs = await new SupabaseReportRegistryRepository().getAllHydratedTemplates();
  } finally {
    restore();
  }
  assert(
    isDegradedRegistryResult(specs),
    "P1 a failed template_parameters read yields a DEGRADED result, not a template set with no parameters"
  );

  // ── P2. A failed signatory-requirements read is degraded too ──────────────
  restore = stubSupabaseTables({
    report_templates: { data: [HEALTHY_TEMPLATE_ROW], error: null },
    template_parameters: { data: [], error: null },
    template_signatory_requirements: { data: null, error: { message: "requirements unavailable" } },
  });
  try {
    specs = await new SupabaseReportRegistryRepository().getAllHydratedTemplates();
  } finally {
    restore();
  }
  assert(
    isDegradedRegistryResult(specs),
    "P2 a failed template_signatory_requirements read yields a DEGRADED result, not silent default requirements"
  );

  // ── P3. Control: all three healthy reads are NOT degraded ─────────────────
  // Without this the two assertions above would pass on a repository that marked everything.
  restore = stubSupabaseTables({
    report_templates: { data: [HEALTHY_TEMPLATE_ROW], error: null },
    template_parameters: { data: [], error: null },
    template_signatory_requirements: { data: [], error: null },
  });
  try {
    specs = await new SupabaseReportRegistryRepository().getAllHydratedTemplates();
  } finally {
    restore();
  }
  assert(
    !isDegradedRegistryResult(specs) && specs.length === 1,
    "P3 a fully healthy bulk read is NOT marked degraded, so the marker distinguishes rather than blankets"
  );

  // ── P4. A degraded partial read is not committed by the service either ────
  restore = stubSupabaseTables({
    report_templates: { data: [HEALTHY_TEMPLATE_ROW], error: null },
    template_parameters: { data: null, error: { message: "parameters unavailable" } },
    template_signatory_requirements: { data: [], error: null },
  });
  try {
    const service = new ReportRegistryService(new SupabaseReportRegistryRepository());
    await service.warmCache();
    // The READ COUNT is the assertion. Checking only that the marker survived proved nothing:
    // with the service guard removed, the first call commits the degraded array, the second
    // short-circuits on it and hands back that same marked array - so the marker check passes
    // while the 'reads through again' half of the claim never happens. The stub owns the only
    // observation point that can tell those apart.
    const readsAfterFirst: number = restore.reads();
    const secondPass = await service.warmCache();
    const readsAfterSecond: number = restore.reads();
    assert(
      isDegradedRegistryResult(secondPass) && readsAfterSecond > readsAfterFirst,
      "P4 a partial-failure registry is never committed, so the next warmCache reads through again"
    );
  } finally {
    restore();
  }
}

async function runDegraded(): Promise<void> {
  // ── D1. A degraded result is RETURNED to its caller, but not cached ───────
  const degrading = new DegradingRegistryRepository();
  const degradedService = new ReportRegistryService(degrading);

  const served = await degradedService.warmCache();
  assert(
    served.map((s) => s.template.templateCode).join(",") === TEMPLATE_CODES.join(","),
    "D1 a degraded bulk result is still returned in full to the caller that asked for it"
  );
  assert(
    isDegradedRegistryResult(served),
    "D1 the served result carries the degraded marker, so the service could tell it apart"
  );

  // ── D2. The NEXT call queries the repository again ────────────────────────
  const loadsAfterDegraded: number = degrading.bulkLoads;
  await degradedService.warmCache();
  const loadsAfterRetry: number = degrading.bulkLoads;
  assert(
    loadsAfterDegraded === 1 && loadsAfterRetry === 2,
    "D2 a degraded result is not committed, so the next warmCache retries the repository"
  );

  // The per-template cache must be empty too: a direct lookup may not be served from a fallback.
  const perCodeBefore: number = degrading.perCodeLoads;
  await degradedService.getTemplateByCode(TEMPLATE_CODES[0]);
  assert(
    degrading.perCodeLoads > perCodeBefore,
    "D2 a degraded result populates no per-template entry either, so a direct lookup still reads through"
  );

  // ── D3. A later SUCCESSFUL load is cached normally ────────────────────────
  degrading.degrade = false;
  const recovered = await degradedService.warmCache();
  assert(
    !isDegradedRegistryResult(recovered) && recovered.length === TEMPLATE_CODES.length,
    "D3 the recovered load is a database result, not a fallback"
  );
  const loadsAfterRecovery: number = degrading.bulkLoads;
  await degradedService.warmCache();
  assert(
    degrading.bulkLoads === loadsAfterRecovery,
    "D3 the recovered registry IS committed, so the next warmCache performs no further load"
  );
  const perCodeAfterRecovery: number = degrading.perCodeLoads;
  const servedFromCache = await degradedService.getTemplateByCode(TEMPLATE_CODES[0]);
  assert(
    servedFromCache?.template.templateCode === TEMPLATE_CODES[0] &&
      degrading.perCodeLoads === perCodeAfterRecovery,
    "D3 the committed registry serves getTemplateByCode without another load"
  );

  // ── D4. Concurrent callers still share ONE in-flight load while degraded ──
  // The degraded path must not reintroduce a stampede: not committing is not the same as not
  // sharing, and the in-flight handle is what keeps N cold callers to one query.
  const concurrent = new DegradingRegistryRepository();
  const concurrentService = new ReportRegistryService(concurrent);
  const open = concurrent.gate();
  const waiters = [
    concurrentService.warmCache(),
    concurrentService.warmCache(),
    concurrentService.warmCache(),
  ];
  open();
  const results = await Promise.all(waiters);
  const concurrentLoads: number = concurrent.bulkLoads;
  assert(
    concurrentLoads === 1,
    "D4 three concurrent cold callers share one in-flight load even when the result is degraded"
  );
  assert(
    results.every((result) => result.length === TEMPLATE_CODES.length),
    "D4 every concurrent caller receives the degraded registry rather than an empty one"
  );
  // And the shared handle is released, so the next call is a fresh attempt rather than a replay.
  await concurrentService.warmCache();
  const concurrentLoadsAfterRetry: number = concurrent.bulkLoads;
  assert(
    concurrentLoadsAfterRetry === 2,
    "D4 the in-flight handle is released normally, so the next call retries instead of replaying"
  );
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

  // Proving that SOMETHING threw is not proving the injected failure propagated: a stub mismatch,
  // or any unrelated throw introduced later, keeps a bare boolean green while the behaviour named
  // here is gone. Bind the assertion to the identity of the caught value instead.
  let partialFailure: unknown;
  try {
    await partialService.warmCache();
  } catch (error) {
    partialFailure = error;
  }
  assert(
    partialFailure instanceof Error &&
      partialFailure.message.includes(`hydration failed for ${TEMPLATE_CODES[2]}`),
    `F2 a fallback load that fails on one template rejects as a whole (got ${String(partialFailure)})`
  );

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
  // Same standard as F2: swallowing the caught value proves only that something threw, never that
  // the injected hydration failure is what rejected this warmCache.
  let retryFailure: unknown;
  try {
    await retryService.warmCache();
  } catch (error) {
    retryFailure = error;
  }
  assert(
    retryFailure instanceof Error &&
      retryFailure.message.includes(`hydration failed for ${TEMPLATE_CODES[1]}`),
    `F3 the injected fallback failure is what rejects the first warmCache (got ${String(retryFailure)})`
  );
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
  // A boolean here would prove only that something threw, not that the injected bulk-load failure
  // is what reached the caller; an unrelated throw would satisfy it just as well. Pin the value.
  let bulkFailure: unknown;
  try {
    await failingService.warmCache();
  } catch (error) {
    bulkFailure = error;
  }
  assert(
    bulkFailure instanceof Error && bulkFailure.message.includes("registry bulk load unavailable"),
    `a failed bulk load rejects rather than resolving to a partial registry (got ${String(bulkFailure)})`
  );
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
  await runDegraded();
  await runPartialBulkFailure();

  console.log("\nRegistry cache verification passed: bulk loads are performed once per hydration.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
