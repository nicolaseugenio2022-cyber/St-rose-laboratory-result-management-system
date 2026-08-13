import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`M6D verification failed: ${message}`);
}

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function sourceFiles(directory: string): string[] {
  const absoluteDirectory = path.join(root, directory);
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relativePath);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [relativePath] : [];
  });
}

function importedModules(source: string): string[] {
  return [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1]);
}

function verifyRepositoryContracts(): void {
  const source = read("src/repositories/interfaces/index.ts");
  const appendRepository = /export\s+interface\s+IAuditLogRepository\s*\{([\s\S]*?)\}/.exec(
    source
  )?.[1];
  const queryRepository = /export\s+interface\s+IAuditLogQueryRepository\s*\{([\s\S]*?)\}/.exec(
    source
  )?.[1];

  assert(appendRepository, "IAuditLogRepository must exist");
  const appendMembers = appendRepository
    .replace(/\/\/.*$/gm, "")
    .split(";")
    .map((member) => member.trim())
    .filter(Boolean);
  const appendMember = appendMembers[0];
  assert(
    appendMembers.length === 1 &&
      typeof appendMember === "string" &&
      /^append\s*\([^)]*\)\s*:\s*Promise<void>$/.test(appendMember),
    "IAuditLogRepository must expose append and nothing else"
  );
  assert(
    queryRepository &&
      /^\s*query\s*\(/m.test(queryRepository) &&
      /^\s*count\s*\(/m.test(queryRepository),
    "IAuditLogQueryRepository must exist as a separate query interface"
  );
}

function verifyServerOnlyAuditBoundary(): void {
  for (const relativePath of [
    "src/services/audit-read-service.ts",
    "src/services/audit-read-service-instance.ts",
    "src/features/server-boundary/audit-actions.ts",
    "src/features/server-boundary/audit-action-inputs.ts",
  ]) {
    assert(
      /^import\s+["']server-only["'];$/m.test(read(relativePath)),
      `${relativePath} must contain a top-level server-only import`
    );
  }
}

function verifyAuditActionAuthorization(): void {
  const actionSource = read("src/features/server-boundary/audit-actions.ts");
  const inputSource = read("src/features/server-boundary/audit-action-inputs.ts");
  const callerGuard = /async\s+function\s+requireAuditCaller\b[\s\S]*?(?=\nexport\s+async\s+function)/.exec(
    actionSource
  )?.[0];

  assert(
    !/requireOperationalCaller/.test(actionSource),
    "the audit action must not reuse requireOperationalCaller"
  );
  assert(callerGuard, "the audit action must define its own caller guard");
  assert(
    /getSession\s*\(\s*\)/.test(callerGuard) &&
      /getUserById\s*\(\s*session\.userId\s*\)/.test(callerGuard) &&
      /profile\.status\s*!==\s*["']Active["']/.test(callerGuard) &&
      /profile\.role\s*!==\s*["']Admin["']/.test(callerGuard) &&
      /profile\.role\s*!==\s*["']Developer["']/.test(callerGuard) &&
      /return\s*\{\s*role:\s*profile\.role\s*\}/.test(callerGuard),
    "the audit action guard must derive and authorize the caller role from the session profile"
  );
  assert(
    !/^\s*(?:role|[A-Za-z_$][\w$]*role[\w$]*)\s*:/im.test(inputSource),
    "the audit action input schema must not accept a caller role"
  );
}

function verifyAuditActionInputBounds(): void {
  const source = read("src/features/server-boundary/audit-action-inputs.ts");
  assert(/\.strict\s*\(\s*\)/.test(source), "the audit action input schema must be strict");
  assert(
    /limit\s*:\s*z\.number\s*\(\s*\)\.int\s*\(\s*\)\.min\s*\(\s*1\s*\)\.max\s*\(\s*100\s*\)/.test(
      source
    ),
    "the audit action input schema must cap limit at 100"
  );
}

function verifyRepositoryLevelDeveloperExclusion(): void {
  const repositorySource = read("src/repositories/supabase-audit-log-repository.ts");
  const readServiceSource = read("src/services/audit-read-service.ts");
  const exclusionBuilder = /function\s+buildExclusionPredicate\b[\s\S]*?(?=\nexport\s+class)/.exec(
    repositorySource
  )?.[0];
  const queryStart = repositorySource.search(/\n\s*async\s+query\s*\(/);
  const countStart = repositorySource.search(/\n\s*async\s+count\s*\(/);

  assert(exclusionBuilder, "the audit repository must build an exclusion predicate");
  for (const column of [
    "performed_by_user_id",
    "performed_by_username",
    "target_reference",
  ]) {
    assert(
      exclusionBuilder.includes(column),
      `the repository exclusion predicate must reference ${column}`
    );
  }
  assert(
    queryStart >= 0 && countStart > queryStart,
    "the audit repository must expose distinct query and count methods"
  );
  const queryMethod = repositorySource.slice(queryStart, countStart);
  const countMethod = repositorySource.slice(countStart);
  for (const [methodName, methodSource] of [
    ["query", queryMethod],
    ["count", countMethod],
  ] as const) {
    assert(
      /buildExclusionPredicate\s*\(\s*criteria\s*\)/.test(methodSource) &&
        /query\s*=\s*query\.or\s*\(\s*exclusionPredicate\s*\)/.test(methodSource),
      `audit repository ${methodName} must apply the repository exclusion predicate`
    );
  }
  assert(
    !/\.filter\s*\(/.test(
      `${exclusionBuilder}\n${queryMethod}\n${countMethod}\n${readServiceSource}`
    ),
    "Developer exclusion must not be implemented with JavaScript array filtering"
  );
}

function verifyReadTimeCanonicalizationAndAppendOnlyUse(): void {
  const serviceSource = read("src/services/audit-read-service.ts");
  assert(
    /category\s*===\s*["']AuthAccount["'][\s\S]*?\[\s*["']AuthAccount["']\s*,\s*["']Authentication["']\s*\]/.test(
      serviceSource
    ) && /categories\s*:\s*storedCategoriesFor\s*\(\s*criteria\.category\s*\)/.test(serviceSource),
    "the AuthAccount filter must query both canonical and legacy Authentication rows"
  );

  for (const relativePath of sourceFiles("src")) {
    const source = read(relativePath);
    const dataApiMutation = /\.from\s*\(\s*["']audit_logs["']\s*\)[\s\S]{0,200}?\.\s*(?:update|delete)\s*\(/i;
    const sqlMutation = /\b(?:update\s+(?:["']?public["']?\.)?["']?audit_logs["']?|delete\s+from\s+(?:["']?public["']?\.)?["']?audit_logs["']?)\b/i;
    assert(
      !dataApiMutation.test(source) && !sqlMutation.test(source),
      `${relativePath} must not issue UPDATE or DELETE against audit_logs`
    );
  }
}

function verifyAuditReaderRoleNarrowing(): void {
  const allSource = sourceFiles("src")
    .map((relativePath) => read(relativePath))
    .join("\n");
  const serviceSource = read("src/services/audit-read-service.ts");
  const pageSource = read("src/app/(app)/audit/page.tsx");
  const dashboardServiceSource = read("src/services/developer-dashboard-service.ts");
  const dashboardPathSource = [
    dashboardServiceSource,
    read("src/features/dashboard/components/DeveloperDashboardSection.tsx"),
    read("src/features/dashboard/components/DashboardView.tsx"),
  ].join("\n");

  assert(!/\bas\s+AuditReaderRole\b/.test(allSource), "no as AuditReaderRole cast may remain");
  assert(
    !/!\s*\.\s*role\b/.test(`${pageSource}\n${dashboardPathSource}`),
    "the audit page and Developer Dashboard path must not use a non-null assertion before .role"
  );
  assert(
    /export\s+function\s+toAuditReaderRole\s*\(\s*role\s*:\s*unknown\s*\)\s*:\s*AuditReaderRole\s*\|\s*null/.test(
      serviceSource
    ) &&
      /role\s*===\s*["']Admin["']/.test(serviceSource) &&
      /role\s*===\s*["']Developer["']/.test(serviceSource),
    "toAuditReaderRole must perform explicit runtime narrowing"
  );
  assert(
    /toAuditReaderRole\s*\(\s*currentUserProfile\?\.role\s*\)/.test(pageSource) &&
      /readPage\s*\(\s*initialCriteria\s*,\s*readerRole\s*\)/.test(pageSource),
    "the audit page must pass only the narrowed reader role"
  );
  assert(
    /toAuditReaderRole\s*\(\s*callerProfile\?\.role\s*\)/.test(dashboardServiceSource) &&
      /readPage\s*\(\s*auditCriteria\s*,\s*readerRole\s*\)/.test(dashboardServiceSource),
    "the Developer Dashboard must pass only the narrowed reader role"
  );
}

function verifyAuditClientBoundary(): void {
  const source = read("src/features/audit/components/AuditLogView.tsx");
  assert(/^\s*["']use client["'];/m.test(source), "AuditLogView must remain a client component");

  const modules = importedModules(source);
  assert(
    !modules.includes("@/services/audit-log-service") &&
      !modules.includes("@/domain/models/audit-log-entry") &&
      modules.every(
        (moduleName) =>
          !/(?:^|\/)repositories(?:\/|$)/.test(moduleName) &&
          !/(?:^|\/)lib\/supabase\/(?:client|server)$/.test(moduleName) &&
          moduleName !== "@supabase/supabase-js"
      ),
    "AuditLogView must import no prototype audit model, repository, or Supabase client"
  );
}

function verifyDeveloperDashboardPersistentAudit(): void {
  const source = read("src/services/developer-dashboard-service.ts");
  assert(
    !importedModules(source).includes("@/services/audit-log-service"),
    "the Developer Dashboard service must not import audit-log-service"
  );
  assert(
    /limit\s*:\s*6\b/.test(source) &&
      /totalAuditLogs\s*:\s*auditPage\?\.total/.test(source) &&
      /recentActivity\s*:\s*auditPage\?\.events/.test(source),
    "the Developer Dashboard count and recent events must come from one six-event persistent page"
  );
}

function verifyPrototypeRetirement(): void {
  assert(
    !existsSync(path.join(root, "src", "services", "audit-log-service.ts")),
    "6D-2 requires the audit-log-service.ts prototype to be retired"
  );
  assert(
    !existsSync(path.join(root, "src", "domain", "models", "audit-log-entry.ts")),
    "6D-2 requires the audit-log-entry.ts prototype model to be retired"
  );
  for (const relativePath of sourceFiles("src")) {
    assert(
      !importedModules(read(relativePath)).some((moduleName) =>
        /(?:^|\/)(?:audit-log-service|audit-log-entry)$/.test(moduleName)
      ),
      `${relativePath} must not import the retired prototype audit module`
    );
  }
}

function verifyAuthGuardsRemainOutside6D(): void {
  const source = read("src/lib/auth-guards.ts");
  assert(
    !/(?:AuditReaderRole|toAuditReaderRole|@\/services\/audit-read-service)/.test(source),
    "auth-guards.ts must contain no 6D-1 audit-reader-role narrowing"
  );
}

verifyRepositoryContracts();
verifyServerOnlyAuditBoundary();
verifyAuditActionAuthorization();
verifyAuditActionInputBounds();
verifyRepositoryLevelDeveloperExclusion();
verifyReadTimeCanonicalizationAndAppendOnlyUse();
verifyAuditReaderRoleNarrowing();
verifyAuditClientBoundary();
verifyDeveloperDashboardPersistentAudit();
verifyPrototypeRetirement();
verifyAuthGuardsRemainOutside6D();

process.stdout.write(
  "M6D verification passed: persistent audit reads, role narrowing, Developer projection, client boundaries, and prototype retirement verified.\n"
);
