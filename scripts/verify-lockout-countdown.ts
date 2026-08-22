import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Lockout countdown verification failed: ${message}`);
}

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function normalizedSha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

const statusSource = read("src/features/auth/lockout-status-actions.ts");
const loginPageSource = read("src/app/login/page.tsx");
const authActionsSource = read("src/features/auth/authActions.ts");
const loginRateLimitSource = read("src/lib/login-rate-limit.ts");

// --- Status action: no audit emission ---
assert(
  !/auditService|auditServiceInstance|emit\(/.test(statusSource),
  "lockout-status-actions.ts must not import or call auditService or emit audit events"
);

// --- Status action: no lockout dependency ---
assert(
  !/lockout|LockoutRepository|ILockoutRepository|openLockout|releaseExpiredLockout/.test(statusSource),
  "lockout-status-actions.ts must not reference lockout repository or open/release lockout"
);

// --- Status action: no hardcoded policy thresholds ---
assert(
  !/(?:const|let|var)\s+\w*(?:FAILURE|ATTEMPT|LOCKOUT|THRESHOLD|LIMIT)\w*\s*=\s*\d+|900000|15\s*\*\s*60\s*\*\s*1000/.test(statusSource),
  "lockout-status-actions.ts must not hard-code rate-limit thresholds (6 attempts, 900000ms, 15*60*1000)"
);

// --- Status action: no raw error detail exposure ---
assert(
  !/error\.message|error\.stack|JSON\.stringify\(error\)|String\(error\)|`\$\{.*error.*\}`/.test(statusSource),
  "lockout-status-actions.ts must not expose raw error messages or stack traces"
);

// --- Status action: delegates to LoginRateLimiter ---
assert(
  /new\s+LoginRateLimiter/.test(statusSource),
  "lockout-status-actions.ts must construct a LoginRateLimiter"
);
assert(
  /assertAllowed/.test(statusSource),
  "lockout-status-actions.ts must call assertAllowed on the limiter"
);

// --- Status action: catches LoginRateLimitError and returns retryAfterMs ---
assert(
  /LoginRateLimitError/.test(statusSource),
  "lockout-status-actions.ts must catch LoginRateLimitError"
);
assert(
  /error\.retryAfterMs/.test(statusSource),
  "lockout-status-actions.ts must return the server-derived retryAfterMs from the error"
);

// --- Status action: malformed input returns 0 ---
assert(
  /canonicalizeUsername/.test(statusSource),
  "lockout-status-actions.ts must use canonicalizeUsername"
);
assert(
  /if\s*\(\s*!canonical\s*\)\s*return\s*\{\s*retryAfterMs\s*:\s*0\s*\}/.test(statusSource),
  "lockout-status-actions.ts must return { retryAfterMs: 0 } for non-canonical input"
);

// --- Status action: all other errors return 0 ---
assert(
  /catch\s*\(\s*(?:_error|error)\s*\)\s*\{[\s\S]*?return\s*\{\s*retryAfterMs\s*:\s*0\s*\}/.test(statusSource),
  "lockout-status-actions.ts must return { retryAfterMs: 0 } for non-lockout errors"
);

// --- Status action: no credential lookup ---
assert(
  !/findByUsername|getUserById|authenticate|verifyPassword|password/.test(statusSource),
  "lockout-status-actions.ts must not perform credential or user lookup"
);

// --- Status action: "use server" directive ---
assert(
  /^"use server"/.test(statusSource),
  "lockout-status-actions.ts must have a 'use server' directive"
);

// --- Status action: exports getLockoutRetryAfterAction ---
assert(
  /export\s+async\s+function\s+getLockoutRetryAfterAction/.test(statusSource),
  "lockout-status-actions.ts must export getLockoutRetryAfterAction"
);

// --- Login page: uses getLockoutRetryAfterAction ---
assert(
  /getLockoutRetryAfterAction/.test(loginPageSource),
  "login page must import and call getLockoutRetryAfterAction"
);

// --- Login page: uses server-derived retryAfterMs, not client-invented ---
assert(
  /await\s+getLockoutRetryAfterAction/.test(loginPageSource),
  "login page must call getLockoutRetryAfterAction with await, not invent it client-side"
);

// --- Login page: does not hard-code lockout thresholds ---
assert(
  !/\b6\b.*(?:failure|attempt|lockout)|(?:failure|attempt|lockout).*\b6\b|900000|15\s*\*\s*60\s*\*\s*1000/.test(loginPageSource),
  "login page must not hard-code rate-limit thresholds"
);

// --- Login page: button disabled includes retryAfterMs or derived lockout flag ---
assert(
  /disabled=.*(?:retryAfterMs|isLocked)/.test(loginPageSource),
  "login page submit button must be disabled when retryAfterMs is active"
);

// --- Login page: countdown renders remaining time ---
assert(
  /minute\(s\)|second\(s\)|retryAfterMs/.test(loginPageSource),
  "login page must display remaining wait time in minutes and seconds"
);

// --- Login page: does not bypass loginAction ---
assert(
  /loginAction/.test(loginPageSource),
  "login page must use the existing loginAction for authentication"
);

// --- Login page: useEffect for countdown ---
assert(
  /useEffect/.test(loginPageSource),
  "login page must use useEffect for the countdown timer"
);

// --- Login page: does not modify the lockout error text ---
const lockoutErrorText = "Too many login attempts. Please try again later.";
assert(
  loginPageSource.includes(lockoutErrorText),
  "login page must match the existing generic lockout error text from authActions"
);

// --- M6C-pinned authActions.ts remains unchanged ---
const APPROVED_AUTH_ACTIONS_SHA256 =
  "a2020c3858e81fe53081c7ef54e85a58e42d7de0fa933690ea5e5b4e37b41c55";
assert(
  normalizedSha256(authActionsSource) === APPROVED_AUTH_ACTIONS_SHA256,
  "authActions.ts must remain byte-for-byte unchanged (M6C pin)"
);

// --- M6C-pinned login-rate-limit.ts remains unchanged ---
const APPROVED_LOGIN_RATE_LIMIT_SHA256 =
  "46f04f208fd6aa52962ae68fc02ce0af650decafd50c5870130473375f247bb1";
assert(
  normalizedSha256(loginRateLimitSource) === APPROVED_LOGIN_RATE_LIMIT_SHA256,
  "login-rate-limit.ts must remain byte-for-byte unchanged (M6C pin)"
);

// --- Status action: uses SupabaseLoginAttemptRepository (not lockout repo) ---
assert(
  /SupabaseLoginAttemptRepository/.test(statusSource),
  "lockout-status-actions.ts must use SupabaseLoginAttemptRepository"
);
assert(
  !/ILockoutRepository|SupabaseLockoutRepository/.test(statusSource),
  "lockout-status-actions.ts must not use any lockout repository"
);

// --- Status action: no record() call (read-only) ---
assert(
  !/\.record\(/.test(statusSource),
  "lockout-status-actions.ts must be read-only and never call record()"
);

// --- Status action: getClientIp extracts x-forwarded-for and x-real-ip ---
assert(
  /x-forwarded-for/.test(statusSource),
  "lockout-status-actions.ts must extract client IP from x-forwarded-for"
);
assert(
  /x-real-ip/.test(statusSource),
  "lockout-status-actions.ts must fall back to x-real-ip"
);

const total =
  statusSource.split("\n").length +
  loginPageSource.split("\n").length;

console.log(`Lockout countdown verification passed: all assertions verified (${total} lines of source inspected).`);
