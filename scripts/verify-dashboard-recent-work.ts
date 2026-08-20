/**
 * UX1-B: dashboard recent-work authorization invariants.
 *
 * Semantic checks on the properties that make it safe to surface operational
 * session data on the Dashboard. Deliberately small: it asserts structure, not
 * styling or class names.
 *
 * Source-only by design. Importing the projection would pull in the Supabase
 * server client and require secrets, which would make a security gate depend on
 * a configured environment.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

/**
 * Strip block and line comments.
 *
 * These files document the very identifiers the assertions forbid — the
 * ownership predicate, `completedSnapshot`, raw results — so matching raw
 * source would fail on the explanation rather than the code. Every assertion
 * about what the code must not contain runs through this.
 */
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let failures = 0;
function assert(condition: unknown, message: string): void {
  if (condition) {
    process.stdout.write(`  PASS  ${message}\n`);
  } else {
    failures += 1;
    process.stdout.write(`  FAIL  ${message}\n`);
  }
}

const view = read("src/features/dashboard/components/DashboardView.tsx");
const recentWork = read("src/features/dashboard/recent-work.ts");
const row = read("src/features/dashboard/components/primitives/SessionRow.tsx");
const developer = read("src/features/dashboard/components/compositions/DeveloperDashboard.tsx");

const recentWorkCode = code(recentWork);
const developerCode = code(developer);

// ── 1. Developer never invokes the operational session read ──────────────────
const devBranch = view.indexOf('role === "Developer"');
const firstRead = view.indexOf("getRecentWork(");
assert(devBranch !== -1, "DashboardView branches on the Developer role");
assert(
  firstRead === -1 || devBranch < firstRead,
  "the Developer branch returns before any getRecentWork call is reachable"
);
assert(
  !developerCode.includes("getRecentWork") && !developerCode.includes("listRecentSessions"),
  "DeveloperDashboard imports no operational session read"
);
assert(
  !/\b(results|completedSnapshot|accessionNumber|demographics)\b/.test(developerCode),
  "DeveloperDashboard references no patient or session field in executable code"
);

// ── 2. Authorization is reused, never re-implemented ─────────────────────────
assert(
  recentWorkCode.includes("listRecentSessionsAction"),
  "recent work is read through the existing authorized operational action"
);
assert(
  recentWorkCode.includes('import "server-only"'),
  "the recent-work projection is server-only"
);
assert(
  !/created_by_user_id|\.userId\s*===|supabaseServer|\.from\(/.test(recentWorkCode),
  "the projection performs no ownership query or comparison of its own"
);

// ── 3. canReopen stays server-derived ────────────────────────────────────────
assert(
  recentWorkCode.includes("canReopen,"),
  "canReopen is taken from the server response, not computed"
);
assert(
  !/canReopen\s*[:=]\s*(true|false)/.test(recentWorkCode) &&
    !/canReopen\s*[:=][^,;\n]*(===|!==)/.test(recentWorkCode),
  "canReopen is never hardcoded or derived from a client-side comparison"
);
assert(row.includes("item.canReopen"), "SessionRow gates its Resume control on canReopen");
assert(!/canReopen\s*=\s*[^=]/.test(code(row)), "SessionRow never reassigns canReopen");

// ── 4. Data minimisation ─────────────────────────────────────────────────────
assert(
  !/\.\.\.session\b/.test(recentWorkCode),
  "the projection never spreads the full session transport"
);
assert(
  !recentWorkCode.includes("completedSnapshot") && !recentWorkCode.includes(".results"),
  "the projection carries no completed snapshot and no raw results"
);
assert(
  recentWorkCode.includes("session.reports.length"),
  "report volume is reduced to a count rather than carrying report bodies"
);

// ── 5. Expiry uses the authoritative field ───────────────────────────────────
assert(
  recentWorkCode.includes("session.expiresAt"),
  "expiry is read from the authoritative session expiresAt, not recomputed"
);
assert(
  !recentWorkCode.includes("calculateExpirationDate"),
  "retention is never re-derived in the dashboard layer"
);

if (failures > 0) {
  process.stdout.write(`\nDashboard recent-work verification FAILED: ${failures} assertion(s).\n`);
  process.exit(1);
}
process.stdout.write(
  "\nDashboard recent-work verification passed: Developer isolation, reused authorization, server-derived canReopen, and data minimisation all verified.\n"
);
