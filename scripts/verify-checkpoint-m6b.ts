import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  FIRST_LOGIN_PATH_ALLOWLIST,
} from "../src/lib/first-login-gate";
import {
  hashPassword,
  normalizeSecurityAnswer,
  verifyPassword,
} from "../src/lib/password";
import {
  CANONICAL_USERNAME_PATTERN,
  CONSECUTIVE_USERNAME_SEPARATOR_PATTERN,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  canonicalizeAndValidateUsername,
} from "../src/lib/username";
import { readJsonStore, writeJsonStoreAtomic } from "../src/lib/atomic-json-store";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`M6B verification failed: ${message}`);
}

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function trackedFiles(): string[] {
  const result = spawnSync(
    "git",
    [
      "-c",
      `safe.directory=${root.replace(/\\/g, "/")}`,
      "ls-files",
      "-z",
    ],
    { cwd: root, encoding: "utf8" }
  );
  assert(result.status === 0, "tracked-file inventory must be readable");
  return result.stdout.split("\0").filter(Boolean);
}

async function verifyScrypt(): Promise<void> {
  const value = "checkpoint-m6b-round-trip";
  const first = await hashPassword(value);
  const second = await hashPassword(value);
  assert(await verifyPassword(value, first), "scrypt must verify the correct input");
  assert(!(await verifyPassword("incorrect", first)), "scrypt must reject an incorrect input");
  assert(first !== second, "two hashes of one input must use different salts");

  for (const malformed of [
    "",
    "not-a-hash",
    // Constructed at runtime so no credential-shaped literal exists in tracked source.
    ["scrypt", "32768", "8", "1", "bad", "bad"].join("$"),
    ["scrypt", "1", "8", "1", "YWJjZGVmZ2hpamtsbW5vcA==", "YWJjZA=="].join("$"),
  ]) {
    let result = true;
    try {
      result = await verifyPassword(value, malformed);
    } catch {
      assert(false, "malformed scrypt strings must not throw");
    }
    assert(!result, "malformed scrypt strings must be rejected");
  }

  const passwordSource = read(path.join("src", "lib", "password.ts"));
  const verificationPath = /async function verifyScryptValue[\s\S]*?^}/m.exec(passwordSource)?.[0] ?? "";
  assert(
    /timingSafeEqual\s*\(/.test(verificationPath),
    "timingSafeEqual must be used in the verification path"
  );
}

function verifyAnswerNormalization(): void {
  const normalized = ["  Saint   Rose  ", "saint rose", "SAINT ROSE"].map(
    normalizeSecurityAnswer
  );
  assert(new Set(normalized).size === 1, "security-answer case and whitespace variants must match");
  assert(
    normalizeSecurityAnswer("saint-rose") !== normalized[0],
    "security-answer punctuation differences must not match"
  );
  assert(
    normalizeSecurityAnswer("saínt rose") !== normalized[0],
    "security-answer diacritic differences must not match"
  );
}

function verifyCanonicalUsernames(): void {
  assert(canonicalizeAndValidateUsername("Admin") === "admin", "Admin must canonicalize to admin");
  for (const invalid of [".admin", "admin-", "ad..min", "ab", "a".repeat(51)]) {
    assert(canonicalizeAndValidateUsername(invalid) === null, `username ${JSON.stringify(invalid)} must be rejected`);
  }
  assert(canonicalizeAndValidateUsername("abc") === "abc", "the minimum username length must be accepted");
  assert(
    canonicalizeAndValidateUsername(`a${"b".repeat(48)}c`)?.length === 50,
    "the maximum username length must be accepted"
  );
  assert(MIN_USERNAME_LENGTH === 3 && MAX_USERNAME_LENGTH === 50, "username length bounds must be 3-50");

  const tablesSql = read(path.join("supabase", "migrations", "02_tables.sql"));
  const constraint = /CONSTRAINT\s+chk_user_profiles_canonical_username\s+CHECK\s*\(([\s\S]*?)\n\s*\)/i.exec(tablesSql)?.[1] ?? "";
  assert(constraint, "chk_user_profiles_canonical_username must be present");
  assert(
    constraint.includes(`BETWEEN ${MIN_USERNAME_LENGTH} AND ${MAX_USERNAME_LENGTH}`),
    "TypeScript and SQL username length bounds must match"
  );
  assert(
    constraint.includes(`username ~ '${CANONICAL_USERNAME_PATTERN.source}'`),
    "TypeScript and SQL canonical username patterns must match"
  );
  assert(
    constraint.includes(`username !~ '${CONSECUTIVE_USERNAME_SEPARATOR_PATTERN.source}'`),
    "TypeScript and SQL separator rules must match"
  );
}

async function verifyAtomicWriteFailure(): Promise<void> {
  const directory = mkdtempSync(path.join(os.tmpdir(), "m6b-atomic-"));
  const storePath = path.join(directory, "store.json");
  try {
    await writeJsonStoreAtomic(storePath, { revision: 1, value: "preserved" });
    let failed = false;
    try {
      await writeJsonStoreAtomic(storePath, { revision: 2, invalid: BigInt(1) });
    } catch {
      failed = true;
    }
    assert(failed, "the simulated failed write must fail");
    const stored = await readJsonStore(storePath, { revision: 0, value: "" });
    assert(
      stored.revision === 1 && stored.value === "preserved",
      "a failed atomic write must leave the previous valid store intact"
    );
    JSON.parse(readFileSync(storePath, "utf8"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function verifyRepositoryBoundaries(): void {
  const serviceSource = read(path.join("src", "services", "userService.ts"));
  assert(
    !/FileAuth|SupabaseAuth|CredentialStoreState|AttemptStoreState/.test(serviceSource),
    "userService must reference no concrete repository type"
  );
  assert(
    /ICredentialRepository/.test(serviceSource) && /ILoginAttemptRepository/.test(serviceSource),
    "userService must depend on repository interfaces"
  );

  const contractsSource = read(path.join("src", "repositories", "interfaces", "index.ts"));
  assert(
    !/filePath|CredentialStoreState|AttemptStoreState|FileAuth|JsonStore/.test(contractsSource),
    "repository contracts must contain no store-specific types"
  );
}

function verifySessionsAndGate(): void {
  const sessionSource = read(path.join("src", "lib", "session.ts"));
  const codecSource = read(path.join("src", "lib", "session-codec.ts"));
  assert(
    !/SESSION_SECRET[^\n]*(?:\?\?|\|\|)/.test(`${sessionSource}\n${codecSource}`),
    "SESSION_SECRET must have no fallback literal"
  );
  assert(/tokenVersion:\s*number/.test(codecSource), "tokenVersion must be present in SessionPayload");
  assert(/tokenVersion:\s*user\.tokenVersion/.test(sessionSource), "created sessions must carry the user tokenVersion");
  assert(
    JSON.stringify(FIRST_LOGIN_PATH_ALLOWLIST) ===
      JSON.stringify([
        "/first-login/password",
        "/first-login/recovery",
        "/api/auth/session",
        "/logout",
      ]),
    "first-login allowlist must contain exactly the four permitted path groups"
  );
}

function verifyNoTrackedCredentialsOrRecoverySurface(): void {
  assert(!existsSync(path.join(root, "data", "users.json")), "data/users.json must be absent");

  const encodedCredential = /(?:scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+|\$2[aby]\$\d+\$[./A-Za-z0-9]+|\$argon2(?:id|i|d)\$)/;
  const plaintextCredential = /\b(?:password|temporaryPassword|securityAnswer)\s*:\s*["'`][^"'`\r\n]+["'`]/;
  const plaintextJsonCredential = /"(?:password|temporaryPassword|securityAnswer)"\s*:\s*"[^"]+"/;

  for (const relativePath of trackedFiles()) {
    const absolutePath = path.join(root, relativePath);
    if (!existsSync(absolutePath)) continue;
    const buffer = readFileSync(absolutePath);
    if (buffer.includes(0)) continue;
    const source = buffer.toString("utf8");
    assert(!encodedCredential.test(source), `${relativePath} must not contain a credential hash`);
    assert(
      !plaintextCredential.test(source) && !plaintextJsonCredential.test(source),
      `${relativePath} must not contain a plaintext credential value`
    );
  }

  const apiDirectory = path.join(root, "src", "app", "api");
  const apiFiles = trackedFiles().filter((file) =>
    path.resolve(root, file).startsWith(`${apiDirectory}${path.sep}`)
  );
  assert(
    apiFiles.every((file) => !/(?:recovery|forgot|password-reset|reset-password)/i.test(file)),
    "no recovery or password-reset endpoint may exist"
  );

  const sourceFiles = trackedFiles().filter(
    (file) => file.startsWith("src/") && /\.[cm]?[jt]sx?$/.test(file)
  );
  const applicationSource = sourceFiles
    .filter((file) => existsSync(path.join(root, file)))
    .map(read)
    .join("\n");
  assert(
    !/(?:recovery[^\n]{0,80}(?:brute[- ]?force|rate[- ]?limit|throttl)|(?:brute[- ]?force|rate[- ]?limit|throttl)[^\n]{0,80}recovery)/i.test(applicationSource),
    "no code or comment may claim active recovery brute-force protection"
  );
}

async function main(): Promise<void> {
  await verifyScrypt();
  verifyAnswerNormalization();
  verifyCanonicalUsernames();
  await verifyAtomicWriteFailure();
  verifyRepositoryBoundaries();
  verifySessionsAndGate();
  verifyNoTrackedCredentialsOrRecoverySurface();
  process.stdout.write("M6B verification passed: authentication foundation, first-login gate, repository boundaries, atomic storage, and credential hygiene verified.\n");
}

void main();
