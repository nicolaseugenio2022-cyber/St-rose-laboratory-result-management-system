import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseRecentSessionsInput } from "../src/features/server-boundary/action-inputs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`M6C verification failed: ${message}`);
}

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function normalizedSha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function sourceFiles(directory: string): string[] {
  const absoluteDirectory = path.join(root, directory);
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relativePath);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [relativePath] : [];
  });
}

function verifyRevokedSessionPublicPathRouting(): void {
  const middlewareSource = read("src/middleware.ts");
  assert(
    !/if\s*\(\s*(?:isPublicPath\s*&&\s*session|session\s*&&\s*isPublicPath)\s*\)\s*(?:\{[^{}]*NextResponse\.redirect\s*\(|(?:return\s+)?NextResponse\.redirect\s*\()/.test(
      middlewareSource
    ),
    "middleware must not redirect from a public path based on a decode-only session"
  );

  const protectedPathWithoutSession =
    /if\s*\(\s*!isPublicPath\s*&&\s*!session\s*\)\s*\{([\s\S]*?)\n\s*\}/.exec(
      middlewareSource
    )?.[1];
  assert(
    protectedPathWithoutSession,
    "middleware must retain the protected-path branch for a missing usable session"
  );
  assert(
    /NextResponse\.redirect\s*\(\s*new URL\s*\(\s*["']\/login["']\s*,\s*request\.url\s*\)\s*,\s*303\s*\)/.test(
      protectedPathWithoutSession
    ),
    "a protected path without a usable session must redirect to /login"
  );
  assert(
    /response\.cookies\.delete\s*\(\s*["']session_token["']\s*\)/.test(
      protectedPathWithoutSession
    ),
    "a protected path with an unusable session cookie must delete that cookie"
  );

  const loginLayoutSource = read("src/app/login/layout.tsx");
  assert(
    /import\s*\{\s*getSession\s*\}\s*from\s*["']@\/lib\/session["']/.test(
      loginLayoutSource
    ),
    "the login layout must import getSession from @/lib/session"
  );
  assert(
    /const\s+session\s*=\s*await\s+getSession\s*\(\s*\)/.test(loginLayoutSource),
    "the login layout must use the authoritative session check"
  );
  assert(
    /session\.mustChangePassword\s*\|\|\s*session\.mustSetRecovery[\s\S]*?\?\s*firstLoginRedirectPath\s*\(\s*session\s*\)[\s\S]*?:\s*["']\/dashboard["'][\s\S]*?redirect\s*\(\s*destination\s*\)/.test(
      loginLayoutSource
    ),
    "the login layout must redirect first-login sessions through firstLoginRedirectPath and other sessions to /dashboard"
  );
  assert(
    !/decryptSessionToken/.test(loginLayoutSource),
    "the login layout must not use decryptSessionToken"
  );
  assert(
    !/^\s*["']use client["'];/m.test(loginLayoutSource),
    "the login layout must remain a server component"
  );
}

function milestone6BCommit(): string {
  const result = spawnSync(
    "git",
    [
      "-c",
      `safe.directory=${root.replace(/\\/g, "/")}`,
      "log",
      "--all",
      "--format=%H%x09%s",
    ],
    { cwd: root, encoding: "utf8" }
  );
  assert(result.status === 0, "Milestone 6B commit history must be readable");
  const match = result.stdout
    .split(/\r?\n/)
    .map((line) => line.split("\t", 2))
    .find(([, subject]) => subject === "feat(6B): authentication foundation");
  assert(match?.[0], "committed Milestone 6B baseline must exist");
  return match[0];
}

const milestone6B = milestone6BCommit();

function readAtMilestone6B(relativePath: string): string {
  const result = spawnSync(
    "git",
    [
      "-c",
      `safe.directory=${root.replace(/\\/g, "/")}`,
      "show",
      `${milestone6B}:${relativePath.replace(/\\/g, "/")}`,
    ],
    { cwd: root, encoding: "utf8" }
  );
  assert(result.status === 0, `${relativePath} must exist in the committed Milestone 6B baseline`);
  return result.stdout.replace(/\r\n/g, "\n");
}

function verifyClientBoundary(): void {
  for (const relativePath of sourceFiles("src")) {
    const source = read(relativePath);
    if (!/^\s*["']use client["'];/m.test(source)) continue;

    assert(
      !/security_?answer_?hash|password_?hash/i.test(source),
      `${relativePath} must not expose a credential hash from a client component`
    );

    const importedModules = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map(
      (match) => match[1]
    );
    assert(
      importedModules.every(
        (moduleName) =>
          !/(?:^|\/)repositories(?:\/|$)/.test(moduleName) &&
          !/(?:^|\/)lib\/supabase\/(?:client|server)$/.test(moduleName) &&
          moduleName !== "@supabase/supabase-js"
      ),
      `${relativePath} must not import a repository or Supabase client`
    );
  }
}

function verifyServerActionResponseBoundary(): void {
  for (const relativePath of sourceFiles("src")) {
    const source = read(relativePath);
    if (!/^\s*["']use server["'];/m.test(source)) continue;
    assert(
      !/security_?answer_?hash|password_?hash/i.test(source),
      `${relativePath} must not expose a credential hash in a server-action response type`
    );
  }
}

function verifyServerOnlyBoundary(): void {
  const packageJson = JSON.parse(read("package.json")) as {
    dependencies?: Record<string, string>;
  };
  assert(packageJson.dependencies?.["server-only"], "server-only must be a production dependency");

  const privilegedModules = [
    "src/lib/supabase/server.ts",
    "src/repositories/supabase-credential-repository.ts",
    "src/repositories/supabase-login-attempt-repository.ts",
    "src/repositories/supabase-audit-log-repository.ts",
    "src/repositories/supabase-report-registry-repository.ts",
    "src/repositories/supabase-session-repository.ts",
    "src/services/report-registry-service.ts",
    "src/services/user-service-instance.ts",
    "src/services/userService.ts",
    "src/services/audit-service.ts",
    "src/features/server-boundary/server-actions.ts",
  ];
  for (const relativePath of privilegedModules) {
    assert(
      /^import ["']server-only["'];$/m.test(read(relativePath)),
      `${relativePath} must import server-only`
    );
  }

  for (const relativePath of sourceFiles("src")) {
    const source = read(relativePath);
    if (!/\b(?:import|export)\b[^\n]*lib\/supabase\/server/.test(source)) continue;
    assert(
      /^import ["']server-only["'];$/m.test(source),
      `${relativePath} imports the privileged Supabase client and must import server-only`
    );
  }
}

function verifySupabaseServerClient(): void {
  const source = read("src/lib/supabase/server.ts");
  assert(
    /process\.env\.SUPABASE_SECRET_KEY\b/.test(source),
    "the server Supabase client must read SUPABASE_SECRET_KEY"
  );
  assert(
    !/NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE)[A-Z0-9_]*/.test(source),
    "the server Supabase client must have no NEXT_PUBLIC secret alias"
  );
}

function verifySessionRepositoryFailures(): void {
  const source = read("src/repositories/supabase-session-repository.ts");
  assert(!/inMemoryStore/.test(source), "the session repository must have no in-memory fallback");
  assert(!/fallback/i.test(source), "the session repository must have no fallback path");
  assert(!/catch\s*(?:\([^)]*\))?\s*{/.test(source), "session repository failures must not be caught and hidden");
  assert(!/return\s+(?:Array\.from\([^)]*\)|\[\])/.test(source), "session reads must not fall back to empty results");
  // Semantic, identifier-based: every error binding destructured from a Supabase operation
  // must be propagated by a throw naming that same identifier. Independent of formatting,
  // line distance, and the number of throw statements.
  const errorIdentifiers = new Set(
    [...source.matchAll(/const\s*{[^}]*?\b(?:error\s*:\s*(\w+)|(error))\b[^}]*}\s*=\s*await\b/g)]
      .map((match) => match[1] ?? match[2])
      .filter((name): name is string => Boolean(name))
  );
  assert(errorIdentifiers.size > 0, "the session repository must perform Supabase operations");
  for (const identifier of errorIdentifiers) {
    assert(
      new RegExp(`throw\\s+${identifier}\\b`).test(source),
      `Supabase persistence failures bound to '${identifier}' must be propagated via throw`
    );
  }
  assert(
    /if\s*\(\s*!data\s*\)\s*throw\s+new Error\("Supabase session history query returned no data\."\)/.test(
      source
    ),
    "session-history missing data must throw"
  );
}

function contractBlock(source: string, kind: "interface" | "type", name: string): string {
  const pattern =
    kind === "interface"
      ? new RegExp(`export interface ${name} \\{[\\s\\S]*?\\n\\}`)
      : new RegExp(`export type ${name}\\s*=\\s*[\\s\\S]*?;`);
  return pattern.exec(source)?.[0] ?? "";
}

function normalizeContract(source: string): string {
  return source.replace(/\s+/g, " ").trim();
}

function verifyRenamedContractsOnly(): void {
  const baseline = readAtMilestone6B("src/repositories/interfaces/index.ts")
    .replace(/IAuthCredentialRepository/g, "ICredentialRepository")
    .replace(/IAuthAttemptRepository/g, "ILoginAttemptRepository");
  const current = read("src/repositories/interfaces/index.ts");

  for (const name of [
    "AuthCredentialRecord",
    "AuthAttemptRecord",
    "AuthAttemptQuery",
    "ILoginAttemptRepository",
    "IPatientReportSessionRepository",
    "IPersonnelRepository",
    "IUserProfileRepository",
    "IReportRegistryRepository",
  ]) {
    const currentBlock = contractBlock(current, "interface", name);
    const baselineBlock = contractBlock(baseline, "interface", name);
    assert(currentBlock && baselineBlock, `${name} must remain present`);
    assert(
      normalizeContract(currentBlock) === normalizeContract(baselineBlock),
      `${name} must retain its Milestone 6B record shape and method signatures`
    );
  }

  for (const name of ["AuthRole", "AuthStatus"]) {
    assert(
      normalizeContract(contractBlock(current, "type", name)) ===
        normalizeContract(contractBlock(baseline, "type", name)),
      `${name} must retain its Milestone 6B shape`
    );
  }

  // F3 re-baseline, authorized 2026-08-14: AuthAttemptKind gains exactly one value,
  // "PasswordChange", giving the authenticated current-password proof its own rate-limit domain.
  // It remains frozen at that approved shape; this is a re-baseline, never an exemption.
  const APPROVED_AUTH_ATTEMPT_KIND =
    'export type AuthAttemptKind = "Login" | "RecoveryLookup" | "RecoveryAnswer" | "PasswordReset" | "PasswordChange";';
  const MILESTONE_6B_AUTH_ATTEMPT_KIND =
    'export type AuthAttemptKind = "Login" | "RecoveryLookup" | "RecoveryAnswer" | "PasswordReset";';
  assert(
    normalizeContract(contractBlock(current, "type", "AuthAttemptKind")) ===
      normalizeContract(APPROVED_AUTH_ATTEMPT_KIND),
    "AuthAttemptKind must retain its approved post-F3 shape: the Milestone 6B union plus PasswordChange, and nothing else"
  );
  assert(
    normalizeContract(contractBlock(baseline, "type", "AuthAttemptKind")) ===
      normalizeContract(MILESTONE_6B_AUTH_ATTEMPT_KIND),
    "the committed Milestone 6B AuthAttemptKind baseline must itself remain unchanged, so the F3 re-baseline provably adds exactly one value"
  );

  const credentialContract = contractBlock(current, "interface", "ICredentialRepository");
  const baselineCredentialContract = contractBlock(
    baseline,
    "interface",
    "ICredentialRepository"
  );
  assert(credentialContract && baselineCredentialContract, "ICredentialRepository must exist");
  const withoutGuardedUpdate = credentialContract.replace(
    /\n\s*updateIfTokenVersion\([\s\S]*?\): Promise<AuthCredentialRecord \| null>;/,
    ""
  );
  assert(
    normalizeContract(withoutGuardedUpdate) === normalizeContract(baselineCredentialContract),
    "ICredentialRepository must retain every Milestone 6B method unchanged"
  );
  assert(
    /updateIfTokenVersion\([\s\S]*?\): Promise<AuthCredentialRecord \| null>;/.test(
      credentialContract
    ),
    "updateIfTokenVersion must return AuthCredentialRecord | null"
  );

  const auditContract = contractBlock(current, "interface", "IAuditLogRepository");
  assert(auditContract, "IAuditLogRepository must exist");
  assert(
    /^export interface IAuditLogRepository \{\s*append\(entry: AuditLogEntry\): Promise<void>;\s*\}$/.test(
      auditContract
    ),
    "IAuditLogRepository must expose append and nothing else"
  );
}

function verifyBehaviouralFreeze(): void {
  for (const relativePath of [
    "src/lib/auth-guards.ts",
    "src/lib/password.ts",
    "src/lib/username.ts",
    "src/lib/first-login-gate.ts",
    "src/lib/session.ts",
  ]) {
    assert(
      read(relativePath) === readAtMilestone6B(relativePath),
      `${relativePath} must have no logic change from Milestone 6B`
    );
  }

  const APPROVED_AUTH_ACTIONS_SHA256 =
    "982bc087ba1214ac91e2109bc91cb59083ae4713290539bc8cfbe077e1aa04c6";
  // Persistent repository pins normalize line endings for portability; transient local candidate hashes may use raw bytes because they do not outlive the verification session.
  assert(
    normalizedSha256(read("src/features/auth/authActions.ts")) ===
      APPROVED_AUTH_ACTIONS_SHA256,
    "authActions.ts must remain byte-for-byte unchanged apart from line endings"
  );

  for (const relativePath of ["src/lib/login-rate-limit.ts"]) {
    const current = read(relativePath);
    assert(
      !/FileAuth|SupabaseCredentialRepository|SupabaseLoginAttemptRepository|supabaseServer/.test(current),
      `${relativePath} must reference no concrete repository or client type`
    );
    assert(
      /ICredentialRepository|ILoginAttemptRepository/.test(current),
      `${relativePath} must depend on the persistence-neutral contracts`
    );
    assert(
      !/IAuthCredentialRepository|IAuthAttemptRepository/.test(current),
      `${relativePath} must use only the renamed contracts, so undoing the rename is unambiguous`
    );

  }

  const APPROVED_LOGIN_RATE_LIMIT_SHA256 =
    "46f04f208fd6aa52962ae68fc02ce0af650decafd50c5870130473375f247bb1";
  assert(
    normalizedSha256(read("src/lib/login-rate-limit.ts")) ===
      APPROVED_LOGIN_RATE_LIMIT_SHA256,
    "login-rate-limit.ts must remain byte-for-byte unchanged apart from line endings"
  );
}

function verifyUserServiceInvariants(): void {
  const relativePath = "src/services/userService.ts";
  const source = read(relativePath);
  assert(
    !/FileAuth|SupabaseCredentialRepository|SupabaseLoginAttemptRepository|supabaseServer|@supabase\//.test(
      source
    ),
    `${relativePath} must reference no concrete repository or Supabase client type`
  );
  assert(
    /private readonly credentials:\s*ICredentialRepository/.test(source) &&
      /attempts:\s*ILoginAttemptRepository/.test(source),
    `${relativePath} must depend only on the persistence-neutral credential and login-attempt contracts`
  );

  const toUser = /function\s+toUser\b[\s\S]*?(?=\nfunction\s+validatedSecurityQuestion\b)/.exec(
    source
  )?.[0];
  assert(toUser, "userService.toUser must be present");
  assert(
    /passwordHash:\s*_passwordHash/.test(toUser) &&
      /securityAnswerHash:\s*_securityAnswerHash/.test(toUser) &&
      /securityQuestion:\s*_securityQuestion/.test(toUser),
    "userService.toUser must strip passwordHash, securityAnswerHash, and securityQuestion"
  );
  assert(
    !/^\s*(?:password|securityAnswer|recoveryAnswer)\s*:/m.test(source),
    "userService must not store a plaintext password or recovery answer"
  );
  assert(
    !/(?:console\.(?:log|info|warn|error)|process\.(?:stdout|stderr)\.write)[^\n]*(?:password|answer|credential)/i.test(
      source
    ),
    "userService must not log passwords, recovery answers, or credential material"
  );
  assert(
    !/\breturn\s+(?:record|current)\s*;/.test(source),
    "userService must not return raw credential records"
  );

  const passwordImport = /import\s*\{[\s\S]*?\}\s*from\s*["']@\/lib\/password["'];/.exec(
    source
  )?.[0];
  assert(passwordImport, "userService must import the approved password helpers");
  for (const helper of ["hashPassword", "verifyPassword", "hashSecurityAnswer"]) {
    assert(
      new RegExp(`\\b${helper}\\b`).test(passwordImport) &&
        new RegExp(`\\b${helper}\\s*\\(`).test(source),
      `userService must import and use ${helper} from @/lib/password`
    );
  }

  const createUser = /async\s+createUser\b[\s\S]*?(?=\n\s*async\s+updateUser\b)/.exec(source)?.[0];
  const updateUser = /async\s+updateUser\b[\s\S]*?(?=\n\s*async\s+toggleUserStatus\b)/.exec(
    source
  )?.[0];
  const resetUserPassword = /async\s+resetUserPassword\b[\s\S]*?\n\s*}\n}/.exec(source)?.[0];
  const toggleUserStatus = /async\s+toggleUserStatus\b[\s\S]*?(?=\n\s*async\s+deleteUser\b)/.exec(
    source
  )?.[0];
  const deleteUser = /async\s+deleteUser\b[\s\S]*?(?=\n\s*async\s+authenticate\b)/.exec(
    source
  )?.[0];
  const authenticate = /async\s+authenticate\b[\s\S]*?(?=\n\s*async\s+changeFirstLoginPassword\b)/.exec(
    source
  )?.[0];
  const changeFirstLoginPassword = /async\s+changeFirstLoginPassword\b[\s\S]*?(?=\n\s*async\s+setFirstLoginRecoveryAnswer\b)/.exec(
    source
  )?.[0];
  const setFirstLoginRecoveryAnswer = /async\s+setFirstLoginRecoveryAnswer\b[\s\S]*?\n\s*}\n}/.exec(
    source
  )?.[0];
  assert(
    createUser &&
      updateUser &&
      toggleUserStatus &&
      deleteUser &&
      authenticate &&
      changeFirstLoginPassword &&
      setFirstLoginRecoveryAnswer,
    "all invariant-bearing userService methods must be present"
  );

  assert(
    /canonicalizeAndValidateUsername\s*\(\s*input\.username\s*\)/.test(createUser) &&
      /canonicalizeAndValidateUsername\s*\(\s*input\.username\s*\)/.test(updateUser) &&
      /canonicalizeUsername\s*\(\s*usernameInput\s*\)/.test(authenticate),
    "userService must retain canonical username handling on create, update, and authenticate"
  );
  assert(
    /loginRateLimiter\.assertAllowed\s*\(/.test(authenticate) &&
      /loginRateLimiter\.record\s*\(/.test(authenticate),
    "userService.authenticate must invoke both login rate-limiter operations"
  );
  assert(
    /mustChangePassword:\s*false/.test(createUser) &&
      !/mustChangePassword:\s*true/.test(createUser),
    "userService.createUser must set mustChangePassword false"
  );

  assert(
    /tokenVersion:\s*current\.tokenVersion\s*\+\s*1/.test(changeFirstLoginPassword),
    "changeFirstLoginPassword must increment tokenVersion"
  );
  assert(
    /tokenVersion:\s*current\.tokenVersion\s*\+\s*1/.test(setFirstLoginRecoveryAnswer),
    "setFirstLoginRecoveryAnswer must increment tokenVersion"
  );
  assert(
    !/(?:input\.password|\bpasswordHash\b|\bpasswordUpdatedAt\b)/.test(updateUser),
    "updateUser must contain no password handling"
  );
  assert(
    resetUserPassword &&
      /tokenVersion:\s*current\.tokenVersion\s*\+\s*1/.test(resetUserPassword) &&
      /passwordHash:\s*await\s+hashPassword\s*\(\s*input\.password\s*\)/.test(
        resetUserPassword
      ),
    "resetUserPassword must hash the privileged replacement and increment tokenVersion"
  );

  const countOtherActiveAdmins = /private\s+async\s+countOtherActiveAdmins\b[\s\S]*?(?=\n\s*async\s+getUsers\b)/.exec(
    source
  )?.[0];
  assert(
    countOtherActiveAdmins &&
      /credentials\.findAll\s*\(\s*\)/.test(countOtherActiveAdmins) &&
      /user\.id\s*!==\s*userId/.test(countOtherActiveAdmins) &&
      /user\.role\s*===\s*["']Admin["']/.test(countOtherActiveAdmins) &&
      /user\.status\s*===\s*["']Active["']/.test(countOtherActiveAdmins),
    "userService must count other Active Admin accounts through ICredentialRepository.findAll"
  );
  assert(
    /countOtherActiveAdmins\s*\(\s*id\s*\)/.test(deleteUser) &&
      /throw\s+new\s+LastActiveAdminError\s*\(\s*\)/.test(deleteUser),
    "deleteUser must enforce the last-Active-Admin invariant"
  );
  assert(
    /countOtherActiveAdmins\s*\(\s*id\s*\)/.test(updateUser) &&
      /throw\s+new\s+LastActiveAdminError\s*\(\s*\)/.test(updateUser) &&
      /currentUserId\s*===\s*id\s*&&\s*input\.status\s*===\s*["']Inactive["'][\s\S]*?throw\s+new\s+SelfDeactivationError/.test(
        updateUser
      ),
    "updateUser must enforce last-Active-Admin and self-deactivation invariants"
  );
  assert(
    /this\.updateUser\s*\([\s\S]*?currentUserId\s*\)/.test(toggleUserStatus),
    "toggleUserStatus must thread currentUserId through the invariant-bearing updateUser path"
  );
  assert(
    /error\.code\s*===\s*["']23503["'][\s\S]*?throw\s+new\s+AccountOwnsReportsError/.test(
      deleteUser
    ),
    "deleteUser must translate foreign-key code 23503 to AccountOwnsReportsError"
  );
}

function verifyAdminInvariantApi(): void {
  const source = read("src/app/api/users/[id]/route.ts");
  for (const errorName of [
    "LastActiveAdminError",
    "SelfDeactivationError",
    "AccountOwnsReportsError",
    "SelfDeletionError",
  ]) {
    assert(
      new RegExp(`error\\s+instanceof\\s+${errorName}`).test(source),
      `the user API route must classify ${errorName} as a conflict`
    );
  }
  assert(
    (source.match(/status:\s*isUserConflict\s*\(\s*error\s*\)\s*\?\s*409\s*:\s*400/g) ?? [])
      .length === 2,
    "PATCH and DELETE must map user invariant conflicts to HTTP 409 and other failures to 400"
  );
  assert(
    /userService\.updateUser\s*\(\s*id\s*,\s*parsed\.data\s*,\s*currentUserProfile\?\.id\s*\)/.test(
      source
    ),
    "PATCH must pass the authenticated user ID to updateUser"
  );
  assert(
    (source.match(/status:\s*403/g) ?? []).length >= 2 && /status:\s*400/.test(source),
    "authorization must remain HTTP 403 and validation must remain HTTP 400"
  );
}

function verifyCredentialVisibilityControls(): void {
  const firstLoginSource = read("src/features/auth/components/FirstLoginForm.tsx");
  assert(
    /\[showAnswer,\s*setShowAnswer\]\s*=\s*useState\s*\(\s*false\s*\)/.test(
      firstLoginSource
    ) && /type=\{showAnswer\s*\?\s*["']text["']\s*:\s*["']password["']\}/.test(firstLoginSource),
    "FirstLoginForm must mask the recovery answer by default and reveal only the typed input"
  );
  assert(
    /aria-label=\{showAnswer\s*\?\s*["']Hide recovery answer["']\s*:\s*["']Show recovery answer["']\}/.test(
      firstLoginSource
    ),
    "FirstLoginForm must carry both recovery-answer visibility aria-labels"
  );
  assert(
    /className=["']relative["'][\s\S]*?className=["']pr-10["'][\s\S]*?<button[\s\S]*?type=["']button["'][\s\S]*?absolute right-3 top-1\/2 -translate-y-1\/2/.test(
      firstLoginSource
    ),
    "FirstLoginForm must use the inline, keyboard-reachable visibility-button pattern"
  );

  const loginSource = read("src/app/login/page.tsx");
  assert(
    /aria-label=\{showPassword\s*\?\s*["']Hide password["']\s*:\s*["']Show password["']\}/.test(
      loginSource
    ),
    "the login password toggle must carry both visibility aria-labels"
  );
  assert(
    !/tabIndex\s*=\s*\{\s*-1\s*\}/.test(firstLoginSource) &&
      !/tabIndex\s*=\s*\{\s*-1\s*\}/.test(loginSource),
    "neither credential visibility button may set tabIndex={-1}"
  );

  assert(
    existsSync(path.join(root, "src", "app", "forgot-password", "layout.tsx")) &&
      existsSync(path.join(root, "src", "app", "forgot-password", "page.tsx")),
    "the /forgot-password route must exist"
  );
  assert(
    /import\s+Link\s+from\s+["']next\/link["']/.test(loginSource) &&
      /<Link\b[\s\S]*?href=["']\/forgot-password["'][\s\S]*?>\s*Forgot password\?\s*<\/Link>/.test(
        loginSource
      ) &&
      !/href\s*=\s*["']#["']/.test(loginSource),
    "the login page must navigate to /forgot-password without an inert href"
  );

  const forgotPasswordSource = read(
    "src/features/auth/components/ForgotPasswordForm.tsx"
  );
  for (const [stateName, inputName] of [
    ["showAnswer", "answer"],
    ["showNewPassword", "password"],
    ["showConfirmPassword", "confirmPassword"],
  ]) {
    assert(
      new RegExp(`\\[${stateName},\\s*set[A-Z][A-Za-z]+\\]\\s*=\\s*useState\\(false\\)`).test(
        forgotPasswordSource
      ) &&
        new RegExp(
          `name=["']${inputName}["'][\\s\\S]*?type=\\{${stateName}\\s*\\?\\s*["']text["']\\s*:\\s*["']password["']\\}`
        ).test(forgotPasswordSource),
      `${inputName} must be masked by default and reveal only its typed value`
    );
  }

  for (const [stateName, visibleLabel, hiddenLabel] of [
    ["showAnswer", "Hide recovery answer", "Show recovery answer"],
    ["showNewPassword", "Hide new password", "Show new password"],
    ["showConfirmPassword", "Hide confirm password", "Show confirm password"],
  ]) {
    assert(
      new RegExp(
        `aria-label=\\{[\\s\\n]*${stateName}\\s*\\?\\s*["']${visibleLabel}["']\\s*:\\s*["']${hiddenLabel}["'][\\s\\n]*\\}`
      ).test(forgotPasswordSource),
      `${stateName} must carry both switching visibility aria-labels`
    );
  }

  assert(
    (forgotPasswordSource.match(/<button\s+[\s\S]*?type=["']button["']/g) ?? [])
      .length >= 3 &&
      !/tabIndex\s*=\s*\{\s*-1\s*\}/.test(forgotPasswordSource),
    "all three recovery visibility controls must be keyboard-reachable buttons"
  );
}

function verifyCorrectedInitialAccountLifecycle(): void {
  const userServiceSource = read("src/services/userService.ts");
  const createUser = /async\s+createUser\b[\s\S]*?(?=\n\s*async\s+updateUser\b)/.exec(
    userServiceSource
  )?.[0];
  assert(createUser, "userService.createUser must be present");
  assert(
    /mustChangePassword:\s*false/.test(createUser) &&
      !/mustChangePassword:\s*true/.test(createUser),
    "userService.createUser must not set mustChangePassword true"
  );

  const updateUser = /async\s+updateUser\b[\s\S]*?(?=\n\s*async\s+toggleUserStatus\b)/.exec(
    userServiceSource
  )?.[0];
  assert(updateUser, "userService.updateUser must be present");
  assert(
    !/updates\.mustChangePassword\s*=/.test(updateUser),
    "userService.updateUser must contain no automatic mustChangePassword assignment"
  );

  const recoveryPage = read("src/app/first-login/recovery/page.tsx");
  assert(
    /getSecurityQuestionForUser\s*\(\s*session\.userId\s*\)/.test(recoveryPage) &&
      /<FirstLoginForm\s+step=["']recovery["']\s+securityQuestion=\{securityQuestion\}\s*\/>/.test(
        recoveryPage
      ),
    "the recovery page must pass the authenticated user's security-question prop to FirstLoginForm"
  );
}

function verifyOwnershipInputs(): void {
  const source = read("src/features/server-boundary/action-inputs.ts");
  assert(
    !/^\s*(?:createdBy|createdByUserId|creatorUserId|owner|ownerId|ownerUserId|ownership)\s*:/m.test(
      source
    ),
    "server action schemas must expose no ownership field"
  );

  let rejected = false;
  try {
    parseRecentSessionsInput({ limit: 1, createdByUserId: "forged-owner" });
  } catch {
    rejected = true;
  }
  assert(rejected, "an ownership-bearing server action payload must be rejected");
}

function verifyOwnershipMigration(): void {
  const migrationsDirectory = path.join(root, "supabase", "migrations");
  const migrationNames = readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const ownershipMigrations = migrationNames.filter((name) =>
    /^\d+_enforce_session_ownership\.sql$/.test(name)
  );
  assert(ownershipMigrations.length === 1, "exactly one ownership-enforcement migration must exist");
  const migrationName = ownershipMigrations[0];
  assert(migrationName > "20260812100100_", "the ownership migration must sort after 20260812100100");
  assert(
    migrationName < "20260812110000_correct_initial_account_lifecycle.sql",
    "the ownership-enforcement migration must sort before the initial-account-lifecycle correction"
  );

  const source = read(path.join("supabase", "migrations", migrationName));
  assert(
    /DO\s+\$\$[\s\S]*DECLARE\s+unowned\s+BIGINT\s*;[\s\S]*SELECT\s+count\(\*\)\s+INTO\s+unowned\s+FROM\s+patient_report_sessions\s+WHERE\s+created_by_user_id\s+IS\s+NULL\s*;[\s\S]*IF\s+unowned\s*>\s*0\s+THEN[\s\S]*RAISE\s+EXCEPTION\s+'Cannot enforce session ownership: % row\(s\) have NULL created_by_user_id'\s*,\s*unowned\s*;[\s\S]*END\s+IF\s*;[\s\S]*END\s+\$\$\s*;/i.test(
      source
    ),
    "the ownership migration must refuse NULL owners before enforcement"
  );
  assert(
    /ALTER\s+TABLE\s+patient_report_sessions\s+ALTER\s+COLUMN\s+created_by_user_id\s+SET\s+NOT\s+NULL\s*;/i.test(
      source
    ),
    "the ownership migration must set created_by_user_id NOT NULL"
  );
  assert(!/\bDEFAULT\b/i.test(source), "the ownership migration must not fabricate a default owner");
}

function verifyPrototypeMigration(): void {
  const source = read("scripts/migrate-prototype-accounts.ts");
  assert(
    !/file-auth-(?:credential|attempt)-repository/.test(source),
    "the prototype migration must import no deleted file adapter"
  );
  assert(!/writeJsonStoreAtomic/.test(source), "the prototype migration must not write a JSON store");
  assert(
    /new\s+SupabaseCredentialRepository\s*\(\s*\)/.test(source) &&
      /ICredentialRepository/.test(source),
    "the prototype migration must use the production credential-repository construction path"
  );
  assert(
    /record\.role\s*===\s*["']Developer["'][\s\S]*Milestone 6D one-time Developer bootstrap/.test(
      source
    ),
    "the prototype migration must reject Developer and direct operators to the 6D bootstrap"
  );
  assert(
    /requires an explicit security question/.test(source) &&
      /unapproved predefined security question/.test(source) &&
      /non-empty custom security question/.test(source),
    "the prototype migration must require a valid explicit security question"
  );
  assert(
    /securityAnswerHash:\s*null/.test(source) &&
      /mustChangePassword:\s*false/.test(source) &&
      /mustSetRecovery:\s*true/.test(source),
    "provisioned accounts must preserve the assigned password and defer recovery setup"
  );
  const withoutRequiredNullHash = source.replace(/securityAnswerHash:\s*null/, "");
  assert(
    !/(?:securityAnswer|recoveryAnswer|hashSecurityAnswer|normalizeSecurityAnswer)/i.test(
      withoutRequiredNullHash
    ),
    "the prototype migration must never accept, derive, or generate a recovery answer"
  );
  assert(
    /process\.env\[MIGRATION_ENV\]/.test(source) && !/process\.argv/.test(source),
    "temporary passwords must come only from the process environment"
  );
  assert(
    !/(?:console\.(?:log|info|warn|error)|process\.(?:stdout|stderr)\.write)[^\n]*(?:temporaryPassword|passwordHash)/.test(
      source
    ),
    "the prototype migration must never log credential values"
  );
}

function verifyDeveloperBootstrapScript(): void {
  const cli = read("scripts/bootstrap-first-developer.ts");
  const core = read("scripts/bootstrap-core.ts");

  assert(
    /process\.env\[(?:BOOTSTRAP_ENV|REPAIR_ENV)\]/.test(cli) && !/process\.argv/.test(cli),
    "the Developer bootstrap CLI must take its input only from the process environment"
  );
  assert(
    !/process\.argv/.test(core),
    "the Developer bootstrap core must not read process.argv"
  );
  assert(
    !/(?:console\.(?:log|info|warn|error)|process\.(?:stdout|stderr)\.write)[^\n]*(?:temporaryPassword|passwordHash|password|securityAnswerHash|answer|token)/i.test(
      `${cli}\n${core}`
    ),
    "the Developer bootstrap must never print credential values"
  );
  assert(
    /PREDEFINED_SECURITY_QUESTIONS/.test(cli) &&
      /CUSTOM_SECURITY_QUESTION/.test(cli) &&
      /unapproved predefined security question/.test(cli) &&
      /non-empty custom security question/.test(cli),
    "the Developer bootstrap must require a valid explicit security question"
  );
  assert(
    !/(?:securityAnswer|recoveryAnswer|hashSecurityAnswer|normalizeSecurityAnswer)/i.test(
      `${cli}\n${core}`
    ),
    "the Developer bootstrap must never accept, derive, or generate a recovery answer"
  );
  assert(
    /targetRole:\s*["']Developer["']/.test(core) && /actorRole:\s*null/.test(core),
    "the bootstrap audit event must classify the operator as no role and the target as Developer"
  );
  assert(
    !/\.\s*delete\s*\(/.test(core),
    "the Developer bootstrap must never delete a credential to compensate for an audit failure"
  );
  assert(
    /canonicalizeAndValidateUsername/.test(core) &&
      /DuplicateUsernameError/.test(core),
    "the Developer bootstrap must translate known username failures into operator refusals"
  );
  assert(
    /Developer bootstrap failed without printing credential details\./.test(cli),
    "the Developer bootstrap CLI must retain its generic fallback for unknown errors"
  );

  for (const relativePath of sourceFiles("src")) {
    assert(
      !/bootstrapFirstDeveloper/.test(read(relativePath)) ||
        relativePath === path.join("src", "services", "userService.ts"),
      `${relativePath} must not reference the Developer bootstrap; it is operator-only`
    );
  }
}

function verifyDeletedAdapters(): void {
  assert(
    !existsSync(path.join(root, "src", "repositories", "file-auth-credential-repository.ts")),
    "file-auth-credential-repository.ts must be absent"
  );
  assert(
    !existsSync(path.join(root, "src", "repositories", "file-auth-attempt-repository.ts")),
    "file-auth-attempt-repository.ts must be absent"
  );
}

verifyClientBoundary();
verifyRevokedSessionPublicPathRouting();
verifyServerActionResponseBoundary();
verifyServerOnlyBoundary();
verifySupabaseServerClient();
verifySessionRepositoryFailures();
verifyRenamedContractsOnly();
verifyBehaviouralFreeze();
verifyUserServiceInvariants();
verifyAdminInvariantApi();
verifyCredentialVisibilityControls();
verifyCorrectedInitialAccountLifecycle();
verifyOwnershipInputs();
verifyOwnershipMigration();
verifyPrototypeMigration();
verifyDeveloperBootstrapScript();
verifyDeletedAdapters();

process.stdout.write(
  "M6C verification passed: server-only Supabase persistence, targeted authentication invariants, ownership enforcement, prototype provisioning, and operator-only Developer bootstrap verified.\n"
);
