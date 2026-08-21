/**
 * Navigation visibility verifier.
 *
 * Proves that role-filtered navigation matches the destinations each role is
 * actually authorized to use. UI visibility is a convenience aid and never an
 * authorization boundary — the server guards remain decisive — but a mismatch
 * here is still a defect: it either advertises a destination that will refuse
 * the caller, or hides one they are entitled to.
 *
 * This verifier imports the real module. It does not parse `navigation.ts` as
 * text, and it does not reimplement the role predicate: it consumes the same
 * `filterNavigationForRole` the sidebar and the Workspace rail consume, so a
 * drift between this check and the product is impossible by construction.
 *
 * Run:  node node_modules/tsx/dist/cli.mjs scripts/check-navigation.ts
 */
import { filterNavigationForRole, navigationConfig } from "../src/config/navigation";
import type { UserRole } from "../src/domain/types";

let failures = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ok   ${message}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL ${message}`);
}

function permitted(role: UserRole | undefined): string[] {
  return filterNavigationForRole(role).map((item) => item.href);
}

function sameSet(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    [...actual].sort().join("|") === [...expected].sort().join("|")
  );
}

console.log("Navigation configuration");
assert(navigationConfig.length > 0, "navigation config is non-empty");
assert(
  navigationConfig.every(
    (item) => Boolean(item.title) && Boolean(item.href) && Boolean(item.iconName)
  ),
  "every destination declares a title, href and iconName"
);
assert(
  new Set(navigationConfig.map((item) => item.href)).size === navigationConfig.length,
  "every destination href is unique"
);

// Expected visibility per role. These mirror the server-side authorization the
// product already enforces:
//   - requireOperationalCaller admits only Admin and User to operational data,
//     which is why Developer must not be offered /workspace or /history.
//   - checkRouteAccess restricts /users, /audit and /personnel to Admin and Developer.
//   - requireDeveloper restricts /developer/accounts to Developer.
const EXPECTED: Array<{ role: UserRole | undefined; hrefs: string[] }> = [
  { role: "Admin" as UserRole, hrefs: ["/dashboard", "/workspace", "/history", "/audit", "/users", "/personnel"] },
  { role: "User" as UserRole, hrefs: ["/dashboard", "/workspace", "/history"] },
  { role: "Developer" as UserRole, hrefs: ["/dashboard", "/audit", "/users", "/developer/accounts", "/personnel"] },
  { role: undefined, hrefs: ["/dashboard"] },
];

console.log("\nRole visibility");
for (const { role, hrefs } of EXPECTED) {
  const actual = permitted(role);
  console.log(`  ${String(role)} => ${JSON.stringify(actual)}`);
  assert(
    sameSet(actual, hrefs),
    `${String(role)} sees exactly ${JSON.stringify([...hrefs].sort())}`
  );
}

console.log("\nAuthorization-alignment invariants");
const developer = permitted("Developer" as UserRole);
assert(
  !developer.includes("/workspace") && !developer.includes("/history"),
  "Developer is not offered the operational destinations requireOperationalCaller refuses"
);
for (const role of ["Admin", "User"] as UserRole[]) {
  const visible = permitted(role);
  assert(
    visible.includes("/workspace") && visible.includes("/history"),
    `${role} retains the operational destinations it is authorized to use`
  );
}
for (const role of ["Admin", "User"] as UserRole[]) {
  assert(
    !permitted(role).includes("/developer/accounts"),
    `${role} is not offered the Developer-only account screen`
  );
}
assert(
  !permitted("User" as UserRole).some((href) =>
    ["/users", "/audit", "/personnel"].includes(href)
  ),
  "User is not offered the administrative destinations checkRouteAccess denies"
);

if (failures > 0) {
  console.error(`\nNavigation verification FAILED: ${failures} assertion(s) did not hold.`);
  process.exit(1);
}

console.log(
  `\nNavigation verification passed: ${navigationConfig.length} destinations; ` +
    `role visibility aligned with server authorization for Admin, User, Developer and unauthenticated.`
);
