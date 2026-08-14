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
  const appendStart = repositorySource.search(/\n\s*async\s+append\s*\(/);

  assert(appendStart >= 0, "the audit repository must expose an append method");
  assert(
    !/developer_involved/.test(repositorySource.slice(appendStart, queryStart)),
    "the audit repository must never write the generated developer_involved column"
  );

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
  // The classified branch: rows that carry write-time classification are excluded purely by the
  // generated developer_involved column, never by identity.
  assert(
    exclusionBuilder.includes("developer_involved.eq.false"),
    "the classified branch must exclude Developer-involved rows by the generated column"
  );
  assert(
    /or\(actor_role\.not\.is\.null,target_role\.not\.is\.null\)/.test(exclusionBuilder),
    "the classified branch must select rows where either role is non-null"
  );
  // The legacy branch: pre-classification rows have both roles null and fall back to identity.
  assert(
    /["']actor_role\.is\.null["']/.test(exclusionBuilder) &&
      /["']target_role\.is\.null["']/.test(exclusionBuilder),
    "the legacy branch must select rows where both roles are null"
  );
  assert(
    /return\s+`and\(\$\{\w+\}\),and\(\$\{\w+\}\)`;/.test(exclusionBuilder),
    "the exclusion predicate must compose exactly two and(...) branches as a top-level or"
  );
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

function verifyDeveloperInvolvedIsGeneratedAndStored(): void {
  const migrationsDirectory = path.join(root, "supabase", "migrations");
  const defining = readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".sql"))
    .filter((name) =>
      /developer_involved/.test(read(path.join("supabase", "migrations", name)))
    );
  assert(
    defining.length === 1,
    "exactly one migration must define developer_involved"
  );
  const source = read(path.join("supabase", "migrations", defining[0]));
  assert(
    /developer_involved\s+BOOLEAN\s+GENERATED\s+ALWAYS\s+AS\s*\([\s\S]*?\)\s*STORED/i.test(source),
    "developer_involved must be a STORED generated column, so classification cannot drift from the roles"
  );
  assert(
    /actor_role\s*=\s*'Developer'/i.test(source) && /target_role\s*=\s*'Developer'/i.test(source),
    "developer_involved must be generated from both actor_role and target_role"
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

// Regression guard for the Developer dashboard monitoring defect found during 6D-2 live
// acceptance. The health probe queried a protected table through the browser/anon Supabase
// client, whose privileges on that table were removed, so a completed HTTP 401 authorization
// refusal was presented to the operator as a connectivity outage.
function verifyDeveloperDashboardServerSideProbe(): void {
  const source = read("src/services/developer-dashboard-service.ts");
  const modules = importedModules(source);

  assert(
    !modules.some((moduleName) => /(?:^|\/)lib\/supabase\/client$/.test(moduleName)),
    "the Developer Dashboard service must not reach protected tables through the browser Supabase client"
  );
  assert(
    modules.some((moduleName) => /(?:^|\/)lib\/supabase\/server$/.test(moduleName)),
    "the Developer Dashboard service must reach the database through the server-only Supabase client"
  );
  assert(
    /^import ["']server-only["'];$/m.test(source),
    "the Developer Dashboard service imports the privileged Supabase client and must import server-only"
  );
  assert(
    !/\bsupabase\s*\./.test(source),
    "the Developer Dashboard service must issue no query through the browser Supabase client binding"
  );
  assert(
    /export type SupabaseHealthStatus\s*=\s*"Connected"\s*\|\s*"Degraded"\s*\|\s*"Unreachable"/.test(
      source
    ),
    "the Supabase health report must distinguish a degraded response from an unreachable database"
  );
  assert(
    /reachable\s*\?\s*"Degraded"\s*:\s*"Unreachable"/.test(source),
    "a Supabase error must be classified as Degraded when the database responded and Unreachable only when it did not"
  );
  assert(
    !/lastSuccessfulAt/.test(source),
    "the health report must not advertise a last-successful timestamp that is never persisted"
  );
  assert(
    !/error\s*\??\.\s*(?:message|details|hint|code)/.test(source),
    "the operator-facing health message must not carry raw database error text"
  );
}

// Slice E closes an omitted Slice B requirement: the two first-login self-service security
// mutations committed credential changes with no durable AuthAccount audit event. The writers
// live in UserService because src/features/auth/authActions.ts is byte-frozen against Milestone
// 6B and its bare `catch` would report a completed security operation to the user as a failure.
function verifyFirstLoginSecurityAuditWriters(): void {
  const source = read("src/services/userService.ts");

  assert(
    /const FIRST_LOGIN_AUDIT_RETRY_DELAYS_MS = \[250, 1000\];/.test(source),
    "the first-login audit retry budget must remain bounded and pinned"
  );

  const helper = /private\s+async\s+emitFirstLoginSecurityEvent\b[\s\S]*?(?=\n\s*private\s+async\s+findOrdinaryMutationTarget\b)/.exec(
    source
  )?.[0];
  assert(helper, "UserService must expose the private first-login audit writer");

  assert(
    /attempt\s*<=\s*FIRST_LOGIN_AUDIT_RETRY_DELAYS_MS\.length/.test(helper),
    "the first-login audit writer must bound its retries by the pinned delay list"
  );
  assert(
    !/\bthrow\b/.test(helper),
    "the first-login audit writer must never throw, so a completed credential mutation is never reported as failed"
  );
  assert(
    /category:\s*"AuthAccount"/.test(helper),
    "first-login security events must be classified as AuthAccount"
  );
  assert(
    /actorRole:\s*account\.role/.test(helper) && /targetRole:\s*account\.role/.test(helper),
    "a self-service first-login event must stamp both roles from the persisted account record"
  );
  assert(
    /performedByUserId:\s*account\.id/.test(helper) &&
      /performedByUsername:\s*account\.username/.test(helper) &&
      /targetReference:\s*account\.username/.test(helper),
    "first-login event identity must come from the persisted account record"
  );
  assert(
    !/\bcurrent\b/.test(helper) && !/\bsession\b/.test(helper) && !/\binput\b/.test(helper),
    "the first-login audit writer must not read identity from the pre-update record, the session, or input"
  );
  assert(
    /details:\s*\{\s*targetUserId:\s*account\.id,\s*selfService:\s*true\s*\}/.test(helper),
    "first-login event details must carry only the target user id and the self-service marker"
  );

  const logCall = /console\.error\([\s\S]*?\);/.exec(helper)?.[0];
  assert(logCall, "retry exhaustion must be recorded through sanitized operational logging");
  assert(
    /\{\s*userId:\s*account\.id,\s*eventType,\s*attempts:\s*attempt \+ 1\s*\}/.test(logCall),
    "the exhaustion log must carry exactly userId, eventType, and attempts"
  );
  assert(
    !/error|username|password|hash|answer|token|details|payload|supabase|sql/i.test(
      logCall.replace(/console\.error\(\s*"[^"]*",/, "")
    ),
    "the exhaustion log must not carry the error, credential material, or database detail"
  );
  assert(
    (source.match(/console\.error\(/g) ?? []).length === 3,
    "userService must log only the first-login audit exhaustion case, the failed-authentication audit failure, and the successful-authentication audit failure"
  );

  for (const [methodName, blockPattern, eventType] of [
    [
      "changeFirstLoginPassword",
      /async\s+changeFirstLoginPassword\b[\s\S]*?(?=\n\s*async\s+setFirstLoginRecoveryAnswer\b)/,
      "FirstLoginPasswordChanged",
    ],
    [
      "setFirstLoginRecoveryAnswer",
      /async\s+setFirstLoginRecoveryAnswer\b[\s\S]*?(?=\n\s*async\s+getRecoveryChallenge\b)/,
      "FirstLoginRecoveryConfigured",
    ],
  ] as const) {
    const block = blockPattern.exec(source)?.[0];
    assert(block, `${methodName} must be present`);
    assert(
      (block.match(/this\.credentials\.update\(/g) ?? []).length === 1,
      `${methodName} must perform exactly one credential mutation`
    );
    assert(
      /const\s+updated\s*=\s*await\s+this\.credentials\.update\(/.test(block),
      `${methodName} must bind the persisted post-update record`
    );
    const updateIndex = block.indexOf("this.credentials.update(");
    const emitIndex = block.indexOf("this.emitFirstLoginSecurityEvent(");
    assert(emitIndex !== -1, `${methodName} must emit a durable first-login audit event`);
    assert(
      emitIndex > updateIndex,
      `${methodName} must emit only after the credential mutation has succeeded`
    );
    assert(
      new RegExp(
        `await this\\.emitFirstLoginSecurityEvent\\(\\s*"${eventType}",\\s*updated\\s*\\)`
      ).test(block),
      `${methodName} must emit ${eventType} using the record returned by the mutation`
    );
    assert(
      /return toUser\(updated\);/.test(block),
      `${methodName} must return the persisted post-mutation record`
    );
  }

  assert(
    (source.match(/this\.emitFirstLoginSecurityEvent\(/g) ?? []).length === 2,
    "the first-login audit writer must be called by exactly the two first-login mutations"
  );
}

function verifyFailedAuthenticationAuditWriter(): void {
  const source = read("src/services/userService.ts");
  const helper = /private\s+async\s+emitAuthenticationFailure\b[\s\S]*?(?=\n\s*private\s+async\s+emitFirstLoginSecurityEvent\b)/.exec(
    source
  )?.[0];

  assert(
    helper,
    "UserService must expose the failed-authentication audit writer so unauthenticated failures reach the durable boundary"
  );
  assert(
    (helper.match(/\.emit\(/g) ?? []).length === 1,
    "the failed-authentication writer must make exactly one audit emission attempt"
  );
  assert(
    !/setTimeout|FIRST_LOGIN_AUDIT_RETRY_DELAYS_MS|for\s*\(|while\s*\(|retry/i.test(helper),
    "the unauthenticated failure path must not retry, back off, sleep, or repeat durable writes because that would create an amplification vector"
  );
  assert(
    !/\bthrow\b/.test(helper),
    "the failed-authentication audit writer must never replace the authentication rejection with an audit failure"
  );
  assert(
    /try\s*\{[\s\S]*?this\.recoveryAudit\.emit\([\s\S]*?\}\s*catch\s*\{/.test(helper),
    "the throwing recoveryAudit accessor and its emit call must both remain inside the swallowing try/catch block"
  );
  assert(
    /category:\s*"AuthAccount"/.test(helper) &&
      /eventType:\s*"AuthenticationFailed"/.test(helper),
    "failed authentication must use the durable AuthAccount AuthenticationFailed classification"
  );
  assert(
    /actorRole:\s*null/.test(helper) &&
      /performedByUserId:\s*null/.test(helper) &&
      /performedByUsername:\s*null/.test(helper),
    "an unauthenticated failure must never name or infer an actor"
  );
  assert(
    helper.includes("targetRole: record?.role ?? null"),
    "the failed-login target role must come only from the persisted record and remain null for an unknown username"
  );
  assert(
    helper.includes("targetReference: username.slice(0, MAX_USERNAME_LENGTH)"),
    "attacker-controlled usernames must be bounded before entering the append-only audit table"
  );
  assert(
    (helper.match(/\bdetails\s*:/g) ?? []).length === 1 &&
      /details:\s*\{\s*outcome\s*\}/.test(helper),
    "failed-authentication details must contain only the outcome classification"
  );
  assert(
    helper.includes('"unknown_username"') &&
      helper.includes('"inactive_account"') &&
      helper.includes('"invalid_password"'),
    "the writer must distinguish unknown usernames, inactive accounts, and invalid passwords without exposing secrets"
  );
  assert(
    !/clientIp/.test(helper),
    "client IP must not be duplicated into the permanent failed-authentication audit boundary in this slice"
  );

  const logCall = /console\.error\([\s\S]*?\);/.exec(helper)?.[0];
  assert(
    logCall,
    "failed-authentication audit persistence failure must use sanitized operational logging"
  );
  const logPayload = logCall.replace(/console\.error\(\s*"[^"]*",/, "");
  assert(
    /^\s*\{\s*eventType:\s*"AuthenticationFailed",\s*outcome,\s*\}\s*\);$/.test(
      logPayload
    ),
    "the failed-authentication persistence log must carry exactly eventType and outcome"
  );
  assert(
    !/username|userId|clientIp|role|password|hash|answer|token|details|payload|supabase|sql|attempts/i.test(
      logPayload
    ),
    "the failed-authentication persistence log must not expose identity, credential, database, payload, or attempt data"
  );

  const authenticate = /async\s+authenticate\b[\s\S]*?(?=\n\s*async\s+changeFirstLoginPassword\b)/.exec(
    source
  )?.[0];
  assert(authenticate, "UserService.authenticate must remain present");
  assert(
    /await\s+this\.loginRateLimiter\.record\(username,\s*clientIp,\s*authenticated\);\s*if\s*\(!authenticated\)\s*await\s+this\.emitAuthenticationFailure\(username,\s*record\);\s*if\s*\(!record\s*\|\|\s*!authenticated\)\s*throw\s+new\s+InvalidCredentialsError\(\);/.test(
      authenticate
    ),
    "rate limiting stays authoritative and ordered ahead of auditing, and the rejection is unchanged"
  );
  assert(
    /await\s+this\.loginRateLimiter\.assertAllowed\(username,\s*clientIp\)/.test(authenticate),
    "authenticate must still enforce the login rate limit before credential verification"
  );
  assert(
    authenticate.indexOf("this.emitAuthenticationFailure(") >
      authenticate.indexOf("this.loginRateLimiter.assertAllowed(") &&
      !/\b(?:catch|finally)\b/.test(authenticate),
    "the LoginRateLimitError path must reject before any failed-authentication audit emission"
  );
}

function verifyAuthenticationSuccessAuditWriter(): void {
  const source = read("src/services/userService.ts");
  const helper = /private\s+async\s+emitAuthenticationSuccess\b[\s\S]*?(?=\n\s*private\s+async\s+emitAuthenticationFailure\b)/.exec(
    source
  )?.[0];

  assert(
    helper,
    "UserService must expose the successful-authentication audit writer immediately before the failure writer"
  );
  assert(
    (helper.match(/\.emit\(/g) ?? []).length === 1,
    "the successful-authentication writer must make exactly one audit emission attempt"
  );
  assert(
    !/setTimeout|FIRST_LOGIN_AUDIT_RETRY_DELAYS_MS|for\s*\(|while\s*\(|retry/i.test(helper),
    "the successful-authentication path must not retry, back off, sleep, or repeat durable writes"
  );
  assert(
    !/\bthrow\b/.test(helper),
    "a failed audit write must never fail a login made with correct credentials"
  );
  assert(
    /try\s*\{[\s\S]*?this\.recoveryAudit\.emit\([\s\S]*?\}\s*catch\s*\{/.test(helper),
    "the throwing recoveryAudit accessor and its emit call must both remain inside the swallowing try/catch block"
  );
  assert(
    /category:\s*"AuthAccount"/.test(helper) &&
      /eventType:\s*"AuthenticationSucceeded"/.test(helper),
    "successful authentication must use the durable AuthAccount AuthenticationSucceeded classification"
  );
  assert(
    /actorRole:\s*record\.role/.test(helper) && /targetRole:\s*record\.role/.test(helper),
    "successful authentication proves identity, so both roles must come from the persisted record"
  );
  assert(
    /performedByUserId:\s*record\.id/.test(helper) &&
      /performedByUsername:\s*record\.username/.test(helper) &&
      /targetReference:\s*record\.username/.test(helper),
    "successful-authentication identity must come from the persisted record, never caller input"
  );
  assert(
    /details:\s*null/.test(helper),
    "successful-authentication identity already has dedicated columns and must not be duplicated in append-only details"
  );
  assert(
    !/clientIp/.test(helper),
    "successful-authentication auditing must not imply unavailable client-IP provenance"
  );

  const logCall = /console\.error\([\s\S]*?\);/.exec(helper)?.[0];
  assert(
    logCall,
    "successful-authentication audit persistence failure must use sanitized operational logging"
  );
  const logPayload = logCall
    .replace(/console\.error\(\s*"[^"]*",/, "")
    .replace(/\s*\);\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  assert(
    logPayload === '{ eventType: "AuthenticationSucceeded", }',
    "the successful-authentication persistence log payload must contain exactly the fixed event type"
  );
  assert(
    !/username|userId|role|password|hash|answer|token|details|payload|supabase|sql|clientIp/i.test(
      logPayload
    ),
    "the successful-authentication persistence log must not expose identity, credential, database, payload, or client-IP data"
  );

  const authenticate = /async\s+authenticate\b[\s\S]*?(?=\n\s*async\s+changeFirstLoginPassword\b)/.exec(
    source
  )?.[0];
  assert(authenticate, "UserService.authenticate must remain present");
  const rejectionIndex = authenticate.indexOf("throw new InvalidCredentialsError();");
  const successEmitIndex = authenticate.indexOf(
    "await this.emitAuthenticationSuccess(record);"
  );
  const returnIndex = authenticate.indexOf("return toUser(record);");
  assert(
    rejectionIndex !== -1 &&
      successEmitIndex > rejectionIndex &&
      returnIndex > successEmitIndex,
    "successful-authentication auditing must run after rejection and before return so rejected logins can never emit success"
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
verifyDeveloperInvolvedIsGeneratedAndStored();
verifyReadTimeCanonicalizationAndAppendOnlyUse();
verifyAuditReaderRoleNarrowing();
verifyAuditClientBoundary();
verifyDeveloperDashboardPersistentAudit();
verifyDeveloperDashboardServerSideProbe();
verifyFirstLoginSecurityAuditWriters();
verifyFailedAuthenticationAuditWriter();
verifyAuthenticationSuccessAuditWriter();
verifyPrototypeRetirement();
verifyAuthGuardsRemainOutside6D();

process.stdout.write(
  "M6D verification passed: persistent audit reads, role narrowing, Developer projection, client boundaries, prototype retirement, and the dual-mode exclusion invariant verified.\n"
);
