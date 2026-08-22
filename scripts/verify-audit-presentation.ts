/**
 * Audit presentation invariants.
 *
 * The Audit surface was built across five slices (A1 detail panel, A2 humanized labels and the
 * Outcome column, A3 filter clarity, A4 compact-width layout, A5 density). The guarantees those
 * slices established were proven at the time by session-local scripts that do not survive the
 * session. This verifier makes the ones that matter durable.
 *
 * CHARTER. Presentation integrity for `AuditLogView.tsx` only. The server-side audit boundary -
 * writers, authorization, Developer exclusion, repository contracts, the client-import boundary and
 * the "use client" pin - belongs to `verify-checkpoint-m6d.ts` and is deliberately NOT duplicated
 * here. Two verifiers asserting the same thing is two places to forget to update.
 *
 * KNOWN LIMITATION 1 - structural, not behavioural. This is source analysis, not a rendered test.
 * `resolveOutcome` is not exported and lives in a "use client" module, so importing it would
 * require a production refactor that was explicitly excluded from this slice. The compensating
 * controls are (a) fail-closed enumeration, which refuses to certify rather than silently skipping
 * a construct it cannot parse, and (b) a mutation suite proving each assertion actually bites. If
 * an assertion is ever shown to be materially evadable in practice, the answer is a
 * behavioural-testability slice, NOT an ever-growing parser.
 *
 * KNOWN LIMITATION 2 - tone NAMES, not tone APPEARANCE. Read this before trusting invariant 6.
 * This verifier checks the semantic tone name each outcome is assigned: that `eligible`, `verified`
 * and `completed` map to `neutral`, and that no emitted outcome maps to `positive`. It does NOT
 * prove that the CSS classes behind `neutral` are visually non-success-coloured, and it cannot
 * prevent someone later redefining the neutral class to a success-coloured treatment. Exact tone
 * and class styling is deliberately not pinned, so tone-name to visual-class fidelity sits outside
 * this verifier's frozen boundary. An assertion pinning class contents was considered and rejected:
 * it would freeze exactly what the contract leaves free. Invariant 6 is a naming guarantee.
 *
 * KNOWN LIMITATION 3 - invariant 13 is ONE-SIDED. It pins the UI half of a two-sided contract: that
 * the Event type chip and field guidance keep describing exact matching, and never describe fuzzy
 * matching. It does NOT read the repository, so it does not prove `.eq("event_type", ...)` is still
 * the operator - that call site is outside this verifier's source boundary. The consequence is
 * worth stating bluntly: if the query later becomes `ilike`/`contains`, this verifier keeps passing
 * AND keeps requiring the stale exact-match wording, so a maintainer who honestly updates the copy
 * would be blocked by it. Invariant 13 is a presentation contract, not proof of end-to-end
 * query/UI agreement. Adding a repository parser was deliberately declined here rather than
 * broadening this slice into cross-layer verification.
 *
 * KNOWN LIMITATION 4 - category badge wrapping is NOT protected here. An earlier revision asserted
 * that every category badge carries `shrink-0` and `whitespace-nowrap`. That assertion produced a
 * verified false PASS twice: first by locating badges through a class-order-dependent substring,
 * then - after being relocated to a per-category branch - by reading a span that belonged to the
 * NEXT branch, reporting one category as protected on another category's classes. It was removed
 * rather than hardened a third time. Badge wrap behaviour remains a real production UX property,
 * but it is presentation protection rather than audit integrity, and it is now owned by visual and
 * browser regression checking unless a component-level or rendered verifier is introduced later.
 * A verifier that names a category it did not actually inspect is worse than leaving the property
 * unpinned.
 *
 * KNOWN LIMITATION 5 - recorded, deliberately not hardened. Growing this parser further would add
 * verifier complexity faster than durable value, so these are disclosed rather than fixed:
 *   - the fuzzy-vocabulary family in invariant 13 does not cover negation or every synonym, so a
 *     hint reading "matched loosely, it need not be exact" would pass;
 *   - invariant 13 pins the literal words "raw identifier", which is narrower than the
 *     meaning-not-prose standard the rest of that invariant follows;
 *   - `enumerateOutcomeValues` gates whole files on the `.emit(` call shape, so an emitter reaching
 *     the audit service through a helper would drop its outcome values with no signal;
 *   - the invariant 8 details-cell locator takes the first right-aligned cell without a uniqueness
 *     guard (exactly one exists today);
 *   - the render-loop filter ban inspects only the span between `Object.entries` and `.map(`, so a
 *     filter applied after the map, or an early return inside it, would not be caught;
 *   - four locators scan the whole file rather than a bounded region and take the first match with
 *     no uniqueness guard: the invariant 7 Outcome cell, and the three panel constructs behind the
 *     unrecognised-key guarantee (`Object.entries(selectedEvent.details)`, the `hasOwnProperty`
 *     fallback, and the raw `JSON.stringify` payload). Each construct occurs exactly once today, so
 *     each assertion inspects what it names - but nothing enforces that, and this is the same shape
 *     the removed invariant 10 failed on twice;
 *   - the invariant 13 verb lookup is scoped to the `activeFilters` block but not to the individual
 *     filter entry: its 320-character window also reaches the next entry's `verb`. The lazy match
 *     takes the correct one today, and every neighbouring verb fails the exact-match family, so a
 *     borrow would fail loudly rather than certify falsely - but the containment is incidental.
 *
 * This file performs no imports from the application, so it runs identically with and without
 * `--conditions=react-server`.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Audit presentation verification failed: ${message}`);
}

const root = process.cwd();
const AUDIT_VIEW = "src/features/audit/components/AuditLogView.tsx";

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

const source = read(AUDIT_VIEW);

/* ------------------------------------------------------------------ source-shape helpers */

/**
 * Replace strings, template literals, comments and regex literals with spaces, preserving length
 * and line structure. Without this, a `details:` inside a verifier's own regex or a comment reads
 * as an emitter - which is exactly how an earlier enumeration mistook fixture text for production.
 */
function blankNonCode(input: string): string {
  const out = input.split("");
  let index = 0;
  let previousSignificant = "";
  let previousWord = "";

  const blank = (from: number, to: number): void => {
    for (let cursor = from; cursor < Math.min(to, input.length); cursor += 1) {
      if (out[cursor] !== "\n") out[cursor] = " ";
    }
  };

  while (index < input.length) {
    const character = input[index];

    if (character === '"' || character === "'") {
      let cursor = index + 1;
      while (cursor < input.length && input[cursor] !== character) {
        if (input[cursor] === "\\") cursor += 1;
        cursor += 1;
      }
      blank(index, cursor + 1);
      index = cursor + 1;
      previousSignificant = "x";
      continue;
    }

    if (character === "`") {
      let cursor = index + 1;
      while (cursor < input.length && input[cursor] !== "`") {
        if (input[cursor] === "\\") cursor += 1;
        cursor += 1;
      }
      blank(index, cursor + 1);
      index = cursor + 1;
      previousSignificant = "x";
      continue;
    }

    if (character === "/" && input[index + 1] === "/") {
      let cursor = index;
      while (cursor < input.length && input[cursor] !== "\n") cursor += 1;
      blank(index, cursor);
      index = cursor;
      continue;
    }

    if (character === "/" && input[index + 1] === "*") {
      const close = input.indexOf("*/", index + 2);
      const cursor = close >= 0 ? close + 2 : input.length;
      blank(index, cursor);
      index = cursor;
      continue;
    }

    if (
      character === "/" &&
      (previousSignificant === "" ||
        "(,=:[!&|?{};+-*%~^<>".includes(previousSignificant) ||
        previousWord === "return" ||
        previousWord === "typeof")
    ) {
      let cursor = index + 1;
      let inClass = false;
      let closed = false;
      while (cursor < input.length && input[cursor] !== "\n") {
        if (input[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (input[cursor] === "[") inClass = true;
        else if (input[cursor] === "]") inClass = false;
        else if (input[cursor] === "/" && !inClass) {
          closed = true;
          break;
        }
        cursor += 1;
      }
      if (closed) {
        let end = cursor + 1;
        while (end < input.length && /[a-z]/i.test(input[end])) end += 1;
        blank(index, end);
        index = end;
        previousSignificant = "x";
        continue;
      }
    }

    if (!/\s/.test(character)) {
      const word = /^[A-Za-z_$][\w$]*/.exec(input.slice(index));
      if (word) {
        previousWord = word[0];
        previousSignificant = "x";
        index += word[0].length;
        continue;
      }
      previousSignificant = character;
      previousWord = "";
    }
    index += 1;
  }

  return out.join("");
}

/** Index of the brace matching the `{` at `start`, or -1. */
function matchBrace(input: string, start: number): number {
  let depth = 0;
  for (let index = start; index < input.length; index += 1) {
    if (input[index] === "{") depth += 1;
    else if (input[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Split an object-literal body on top-level commas. */
function topLevelParts(body: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const character of body) {
    if ("{[(".includes(character)) depth += 1;
    else if ("}])".includes(character)) depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/**
 * A whole top-level declaration.
 *
 * Two traps here, both of which produced wrong blocks before being fixed. Matching on "newline then
 * closing brace" stops at a destructured parameter's closing brace, which also sits at column 0 -
 * so a following blank line is required. And a declaration may close with `}`, `};`, `]` or `];`
 * depending on whether it is a function, an object constant or an array constant; terminating only
 * on `}` let a `};` block run on and swallow the declarations after it.
 */
const BLOCK_TERMINATORS = ["\n}\n\n", "\n};\n\n", "\n]\n\n", "\n];\n\n"];

function topLevelBlock(input: string, header: string, label: string): string {
  const start = input.indexOf(header);
  assert(start >= 0, `${label} must be present in AuditLogView (declaration not found: ${header})`);
  let end = -1;
  let width = 0;
  for (const terminator of BLOCK_TERMINATORS) {
    const candidate = input.indexOf(terminator, start);
    if (candidate >= 0 && (end < 0 || candidate < end)) {
      end = candidate;
      width = terminator.length;
    }
  }
  // Returning the tail of the file when no terminator matches would silently widen every
  // assertion made against this block, which is how the DETAIL_LABELS block once swallowed the
  // declarations after it. Refuse instead.
  assert(end >= 0, `${label} must have a locatable end; the extracted block would otherwise run to the end of the file`);
  return input.slice(start, end + width);
}

/**
 * A named region of the view.
 *
 * The opening marker must be UNIQUE. Taking "the first match" is how a region assertion silently
 * inspects the wrong markup: `<tbody` appears in both the loading skeleton and the real table, and
 * an earlier draft of this verifier checked the skeleton - passing regardless of what the real
 * table did. A duplicated marker now fails loudly and demands a scoped extraction instead.
 */
function regionIn(container: string, open: string, close: string, label: string): string {
  const occurrences = container.split(open).length - 1;
  assert(
    occurrences === 1,
    `${label} region marker must be unique so the assertion cannot inspect the wrong markup (found ${occurrences} occurrences of: ${open})`
  );
  const start = container.indexOf(open);
  const end = container.indexOf(close, start);
  assert(end > start, `${label} region must be locatable (closing marker not found: ${close})`);
  return container.slice(start, end + close.length);
}

function region(open: string, close: string, label: string): string {
  return regionIn(source, open, close, label);
}

/* ------------------------------------------------------------------ repository walk */

const SKIP_DIRECTORIES = new Set(["node_modules", ".next", ".git", "dist", "build", "coverage"]);
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function collectSourceFiles(relativeDirectory: string, accumulator: string[]): string[] {
  const absolute = path.join(root, relativeDirectory);
  for (const entry of readdirSync(absolute)) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const relative = path.join(relativeDirectory, entry).split(path.sep).join("/");
    if (statSync(path.join(root, relative)).isDirectory()) {
      collectSourceFiles(relative, accumulator);
      continue;
    }
    if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) accumulator.push(relative);
  }
  return accumulator;
}

/**
 * Files that can emit a persisted audit event. `scripts/` counts - bootstrap-core.ts writes a real
 * event, and missing it once already produced a false inventory. Verifier and check scripts are
 * fixtures, not emitters, and this file must exclude itself for the same reason.
 */
function emitterFiles(): string[] {
  const files = [
    ...collectSourceFiles("src", []),
    ...collectSourceFiles("scripts", []),
  ];
  return files.filter((relative) => {
    const base = path.basename(relative);
    if (base.startsWith("verify-") || base.startsWith("check-")) return false;
    if (base.endsWith(".test.ts") || base.endsWith(".test.tsx")) return false;
    return relative !== AUDIT_VIEW;
  });
}

/* ------------------------------------------------------------------ INVARIANT 1 + 2 */

const TRANSPORT_FIELDS = new Set([
  "id",
  "category",
  "eventType",
  "performedByUserId",
  "performedByUsername",
  "targetReference",
  "actorRole",
  "targetRole",
  "details",
  "occurredAt",
]);

/** Value expressions that are a TYPE position rather than a constructed object. */
const TYPE_HEADS = new Set(["Record", "Json", "JsonValue", "Partial", "Readonly", "unknown", "any", "object"]);

type Unresolved = { kind: string; where: string; detail: string };

function keysFromObjectBody(
  bodyCode: string,
  bodyRaw: string,
  where: string,
  unresolved: Unresolved[]
): string[] {
  const found: string[] = [];
  let offset = 0;
  for (const part of topLevelParts(bodyCode)) {
    const raw = bodyRaw.slice(offset, offset + part.length);
    offset += part.length + 1;
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("...")) {
      unresolved.push({ kind: "spread into a details literal", where, detail: trimmed.slice(0, 60) });
      continue;
    }
    if (trimmed.startsWith("[")) {
      unresolved.push({ kind: "computed key", where, detail: trimmed.slice(0, 60) });
      continue;
    }
    const quoted = /^\s*["']([^"']+)["']\s*:/.exec(raw);
    if (quoted) {
      found.push(quoted[1]);
      continue;
    }
    const colon = /^([A-Za-z_$][\w$]*)\s*:/.exec(trimmed);
    if (colon) {
      found.push(colon[1]);
      continue;
    }
    const shorthand = /^([A-Za-z_$][\w$]*)\s*$/.exec(trimmed);
    if (shorthand) {
      found.push(shorthand[1]);
      continue;
    }
    unresolved.push({ kind: "unparsed property", where, detail: trimmed.slice(0, 60) });
  }
  return found;
}

type KeyInventory = { keys: Map<string, string>; unresolved: Unresolved[] };

function enumerateDetailKeys(): KeyInventory {
  const keys = new Map<string, string>();
  const unresolved: Unresolved[] = [];

  for (const relative of emitterFiles()) {
    const raw = read(relative);
    if (!raw.includes("details")) continue;
    const code = blankNonCode(raw);
    const lineOf = (index: number): number => raw.slice(0, index).split("\n").length;

    const record = (key: string, where: string): void => {
      if (TRANSPORT_FIELDS.has(key)) return;
      if (!keys.has(key)) keys.set(key, where);
    };

    // Named object literals in this file, so `details` built before the emit call resolves.
    const localLiterals = new Map<string, Array<{ start: number; end: number; line: number }>>();
    const declaration = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]*?)?=\s*\{/g;
    for (let match = declaration.exec(code); match; match = declaration.exec(code)) {
      const brace = code.indexOf("{", match.index + match[0].length - 1);
      const end = matchBrace(code, brace);
      if (end < 0) continue;
      const list = localLiterals.get(match[1]) ?? [];
      list.push({ start: brace + 1, end, line: lineOf(brace) });
      localLiterals.set(match[1], list);
    }

    const detailsSite = /\bdetails\s*:\s*/g;
    for (let match = detailsSite.exec(code); match; match = detailsSite.exec(code)) {
      const valueStart = match.index + match[0].length;
      const where = `${relative}:${lineOf(match.index)}`;

      if (code[valueStart] === "{") {
        const end = matchBrace(code, valueStart);
        if (end < 0) {
          unresolved.push({ kind: "unbalanced details literal", where, detail: "" });
          continue;
        }
        for (const key of keysFromObjectBody(
          code.slice(valueStart + 1, end),
          raw.slice(valueStart + 1, end),
          where,
          unresolved
        )) {
          record(key, where);
        }
        continue;
      }

      if (code.startsWith("null", valueStart) || code.startsWith("undefined", valueStart)) continue;

      const identifier = /^([A-Za-z_$][\w$]*)/.exec(code.slice(valueStart));
      if (!identifier) {
        unresolved.push({ kind: "details value is an expression", where, detail: code.slice(valueStart, valueStart + 40).split("\n")[0].trim() });
        continue;
      }
      const name = identifier[1];
      const after = code.slice(valueStart + name.length).replace(/^\s*/, "");

      // A type annotation (`details: Record<string, unknown> | null`) constructs nothing.
      if (TYPE_HEADS.has(name) || after.startsWith("<") || after.startsWith("|")) continue;
      // A pass-through (`details: entry.details`, `details: redactDetails(x)`) introduces no key.
      const tail = code.slice(valueStart, valueStart + 80);
      if (/^[A-Za-z_$][\w$]*\s*\.\s*details\b/.test(tail) || /^[A-Za-z_$][\w$]*\s*\(/.test(tail)) continue;

      const literals = localLiterals.get(name);
      if (literals) {
        for (const literal of literals) {
          const literalWhere = `${relative}:${literal.line}`;
          for (const key of keysFromObjectBody(
            code.slice(literal.start, literal.end),
            raw.slice(literal.start, literal.end),
            literalWhere,
            unresolved
          )) {
            record(key, literalWhere);
          }
        }
        continue;
      }
      unresolved.push({ kind: "details value is an unresolvable identifier", where, detail: name });
    }

    // `emit({ ..., details })` where `details` was declared above and possibly extended.
    if (/(?:^|[\s{(,])details\s*(?:,|\}|$)/m.test(code)) {
      for (const literal of localLiterals.get("details") ?? []) {
        const literalWhere = `${relative}:${literal.line}`;
        for (const key of keysFromObjectBody(
          code.slice(literal.start, literal.end),
          raw.slice(literal.start, literal.end),
          literalWhere,
          unresolved
        )) {
          record(key, literalWhere);
        }
      }
    }

    const memberAssignment = /\bdetails\s*\.\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g;
    for (let match = memberAssignment.exec(code); match; match = memberAssignment.exec(code)) {
      record(match[1], `${relative}:${lineOf(match.index)}`);
    }

    const indexAssignment = /\bdetails\s*\[\s*["']/g;
    for (let match = indexAssignment.exec(code); match; match = indexAssignment.exec(code)) {
      const literal = /["']([^"']+)["']\s*\]\s*=(?!=)/.exec(raw.slice(match.index + match[0].length - 1));
      if (literal) record(literal[1], `${relative}:${lineOf(match.index)}`);
    }

    const computedIndex = /\bdetails\s*\[\s*(?!["'\]])/g;
    for (let match = computedIndex.exec(code); match; match = computedIndex.exec(code)) {
      unresolved.push({ kind: "computed index onto details", where: `${relative}:${lineOf(match.index)}`, detail: "" });
    }
    const objectAssign = /Object\.assign\s*\(\s*details\b/g;
    for (let match = objectAssign.exec(code); match; match = objectAssign.exec(code)) {
      unresolved.push({ kind: "Object.assign onto details", where: `${relative}:${lineOf(match.index)}`, detail: "" });
    }
  }

  return { keys, unresolved };
}

function verifyDetailKeyInventoryFailsClosed(inventory: KeyInventory): void {
  // INVARIANT 1. Three separate false PASSes in this codebase came from an enumerator that met a
  // construct it did not understand and skipped it silently. Refusing to certify is the point.
  assert(
    inventory.unresolved.length === 0,
    `every audit details construct must be statically resolvable; coverage cannot be certified while any are not. Unresolved: ${inventory.unresolved
      .map((item) => `${item.kind} at ${item.where}${item.detail ? ` (${item.detail})` : ""}`)
      .join("; ")}`
  );
  assert(
    inventory.keys.size > 0,
    "the details-key enumeration must find at least one emitted key; an empty inventory means the walk or the parser broke"
  );
}

function verifyCuratedLabelCoverage(inventory: KeyInventory): void {
  // INVARIANT 2. A missing label degrades to humanizeIdentifier and is therefore invisible; an
  // extra label is dead vocabulary that implies a field the server never emits.
  const labelBlock = topLevelBlock(source, "const DETAIL_LABELS", "DETAIL_LABELS");
  const labelled = new Set<string>();
  const entry = /^ {2}([A-Za-z_$][\w$]*):\s*"/gm;
  for (let match = entry.exec(labelBlock); match; match = entry.exec(labelBlock)) labelled.add(match[1]);

  const emitted = new Set(inventory.keys.keys());
  const missing = [...emitted].filter((key) => !labelled.has(key)).sort();
  const extra = [...labelled].filter((key) => !emitted.has(key)).sort();

  assert(
    missing.length === 0,
    `every emitted audit details key must have a curated label. Missing: ${missing.join(", ")}`
  );
  assert(
    extra.length === 0,
    `DETAIL_LABELS must not carry labels for keys no emitter produces. Extra: ${extra.join(", ")}`
  );
}

/* ------------------------------------------------------------------ INVARIANT 3 + 4 + 5 + 6 */

function enumerateOutcomeValues(): { values: Set<string>; unresolved: Unresolved[] } {
  const values = new Set<string>();
  const unresolved: Unresolved[] = [];

  for (const relative of emitterFiles()) {
    const raw = read(relative);
    if (!raw.includes("outcome")) continue;
    if (!raw.includes(".emit(")) continue;
    const code = blankNonCode(raw);
    const lineOf = (index: number): number => raw.slice(0, index).split("\n").length;

    // Inline string-union declarations in this file, by variable name. Collected FIRST so an
    // identifier-valued outcome can be resolved at its use site rather than hoped for afterwards.
    const unions = new Map<string, string[]>();
    const union = /\b(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*:\s*((?:"[a-z_]+"\s*\|\s*)+"[a-z_]+")/g;
    for (let match = union.exec(raw); match; match = union.exec(raw)) {
      unions.set(match[1], (match[2].match(/"([a-z_]+)"/g) ?? []).map((literal) => literal.slice(1, -1)));
    }

    const site = /\boutcome\s*:/g;
    for (let match = site.exec(code); match; match = site.exec(code)) {
      const where = `${relative}:${lineOf(match.index)}`;
      const line = raw.slice(match.index + match[0].length).split("\n")[0];
      const literals = line.match(/"([a-z_]+)"/g);
      if (literals) {
        for (const literal of literals) values.add(literal.slice(1, -1));
        continue;
      }
      // An identifier-valued outcome is only accepted when it actually resolves to a local string
      // union. Accepting it unconditionally was a silent-skip path: a rename, or a named type
      // alias, would drop real outcome values with no signal, and this enumeration is one of the
      // two compensating controls for the structural-analysis limitation.
      const identifier = /^\s*([A-Za-z_$][\w$]*)\s*[,}]/.exec(line);
      if (identifier) {
        const resolved = unions.get(identifier[1]);
        if (resolved) {
          for (const value of resolved) values.add(value);
          continue;
        }
        unresolved.push({
          kind: "outcome value is an identifier with no resolvable local string union",
          where,
          detail: identifier[1],
        });
        continue;
      }
      unresolved.push({ kind: "outcome value is an expression", where, detail: line.trim().slice(0, 50) });
    }
  }

  return { values, unresolved };
}

function verifyOutcomeDerivation(): void {
  const body = topLevelBlock(source, "function resolveOutcome(", "resolveOutcome");

  // INVARIANT 3. Exactly three rules, evaluated in the approved order: an explicitly recorded
  // outcome, then the SecurityDenial category, then a neutral statement that claims nothing.
  //
  // Pinned by STRUCTURE, not by copy. The displayed words are explicitly not frozen, so matching
  // them character-for-character would fail a rename that changes nothing about the derivation.
  const recorded = body.indexOf("details?.outcome");
  const denial = body.indexOf('"SecurityDenial"');
  const neutral = body.lastIndexOf('tone: "neutral"');
  assert(recorded >= 0, "outcome rule 1 must read the recorded details.outcome");
  assert(
    body.includes("humanizeIdentifier(recorded)"),
    "outcome rule 1 must humanize the RECORDED value rather than classifying it"
  );
  assert(denial >= 0, "outcome rule 2 must key off the recorded SecurityDenial category");
  assert(
    /tone:\s*"negative"/.test(body.slice(denial)),
    "outcome rule 2 must report a denial with the negative tone"
  );
  assert(neutral >= 0, "outcome rule 3 must fall back to a neutral statement that claims nothing");
  assert(
    recorded < denial && denial < neutral,
    "outcome rules must be evaluated in the approved order: recorded outcome, then category, then neutral"
  );

  // INVARIANT 4. The event NAME must never drive the outcome. Names describe what was recorded;
  // inferring success or failure from them manufactures a claim the payload does not support.
  //
  // Scoped to BOTH functions in the outcome path. OutcomeBadge receives the whole event, so
  // relocating a name test there would satisfy a resolveOutcome-only check while doing exactly
  // what this invariant forbids.
  const badge = topLevelBlock(source, "function OutcomeBadge(", "OutcomeBadge");
  for (const [name, block] of [["resolveOutcome", body], ["OutcomeBadge", badge]] as const) {
    assert(
      !block.includes("eventType"),
      `${name} must never reference eventType; an outcome may not be inferred from an event name`
    );
  }
}

function verifyOutcomeToneSemantics(): void {
  const toneBlock = topLevelBlock(source, "const OUTCOME_TONES", "OUTCOME_TONES");

  const tones = new Map<string, string>();
  const entry = /^ {2}([a-z_]+):\s*"(negative|caution|positive|neutral)"/gm;
  for (let match = entry.exec(toneBlock); match; match = entry.exec(toneBlock)) tones.set(match[1], match[2]);

  // INVARIANT 5. The tone table must describe exactly the outcome values the server records.
  const { values, unresolved } = enumerateOutcomeValues();
  assert(
    unresolved.length === 0,
    `every emitted audit outcome value must be statically resolvable. Unresolved: ${unresolved
      .map((item) => `${item.kind} at ${item.where} (${item.detail})`)
      .join("; ")}`
  );
  assert(values.size > 0, "the outcome-value enumeration must find at least one emitted value");

  const missing = [...values].filter((value) => !tones.has(value)).sort();
  const extra = [...tones.keys()].filter((value) => !values.has(value)).sort();
  assert(missing.length === 0, `every emitted outcome value must carry a tone. Missing: ${missing.join(", ")}`);
  assert(extra.length === 0, `OUTCOME_TONES must not tone values no emitter produces. Extra: ${extra.join(", ")}`);

  // INVARIANT 6 - a SEMANTIC TONE NAME guarantee, and nothing more. See KNOWN LIMITATION 2.
  //
  // eligible / verified / completed are stages of an UNAUTHENTICATED account-recovery flow: they
  // record how far an attempt reached, not that it was legitimate, so they must not be classified
  // as successes. This checks the tone NAME each is assigned. It does not inspect the CSS behind
  // those names, and it must not be read as proof that the rendered result is not success-coloured.
  for (const value of ["eligible", "verified", "completed"]) {
    assert(
      tones.get(value) === "neutral",
      `recovery-progression outcome "${value}" must be assigned the semantic tone name "neutral" (found: ${tones.get(value) ?? "absent"})`
    );
  }
  const positives = [...tones.entries()].filter(([, tone]) => tone === "positive").map(([value]) => value);
  assert(
    positives.length === 0,
    `no emitted audit outcome may be assigned the semantic tone name "positive". Found: ${positives.join(", ")}`
  );
}

function verifyOutcomeIsNeverTruncated(): void {
  // INVARIANT 7. A truncated outcome misreports the record. Overflow is the acceptable failure;
  // clipping is not.
  const badge = topLevelBlock(source, "function OutcomeBadge(", "OutcomeBadge");
  assert(
    !badge.includes("truncate"),
    "the Outcome renderer must never truncate; a clipped outcome misreports what was recorded"
  );
  assert(
    badge.includes("whitespace-nowrap"),
    "the Outcome renderer must keep its label on one line"
  );

  const outcomeCell = /<td[^>]*>\s*<OutcomeBadge[^>]*\/>\s*<\/td>/.exec(source);
  assert(outcomeCell, "the Outcome table cell must render OutcomeBadge");
  assert(
    !outcomeCell[0].includes("truncate"),
    "the Outcome table cell must not impose truncation on the outcome"
  );
}

/* ------------------------------------------------------------------ INVARIANT 8 - 12 */

const MAIN_TABLE = region('<div className="hidden overflow-x-auto', "</table>", "desktop table");
const CARD_LIST = region('aria-label="Audit event log"', "</ul>", "mobile card list");
// Scoped to the real table: the loading skeleton has a <tbody> too, and checking that one instead
// would pass no matter what the rendered rows contain.
const TABLE_BODY = regionIn(MAIN_TABLE, "<tbody", "</tbody>", "desktop table body");
const PERFORMED_BY_SECTION = region('<DetailSection title="Performed by">', "</DetailSection>", "details panel Performed by section");

function verifyDetailsControlCannotForceOverflow(): void {
  // INVARIANT 8. Details is the LAST column - the only cell whose content can extend past the
  // table's right edge. Its label wrapping is the SAFE failure; `whitespace-nowrap` would convert
  // that into the horizontal scrolling this layout exists to eliminate. This assertion exists
  // precisely because "just add nowrap" is the obvious-looking fix.
  const detailsCell = /<td className="[^"]*text-right[^"]*">[\s\S]*?<\/td>/.exec(MAIN_TABLE);
  assert(detailsCell, "the Details table cell must be locatable");
  assert(
    !detailsCell[0].includes("whitespace-nowrap"),
    "the last-column Details control must not be whitespace-nowrap; it would reintroduce horizontal overflow"
  );
}

function verifyDetailsRemainsReachable(): void {
  // INVARIANT 9. Below the wide breakpoint the control is icon-only, so the accessible name is the
  // ONLY name it has - in both presentations.
  const namePattern = /aria-label=\{`[^`]*\$\{event\.eventType\}[^`]*\$\{occurred\.full\}[^`]*`\}/g;
  const occurrences = source.match(namePattern) ?? [];
  assert(
    occurrences.length === 2,
    `the Details control must carry a row-distinguishing accessible name in both the table and the card presentations (found ${occurrences.length})`
  );
  for (const [name, block] of [["table", MAIN_TABLE], ["card", CARD_LIST]] as const) {
    assert(
      namePattern.test(block) || new RegExp(namePattern.source).test(block),
      `the ${name} Details control must carry a row-distinguishing accessible name`
    );
  }
  assert(
    /<Eye className="[^"]*"\s+aria-hidden="true"\s*\/>/.test(MAIN_TABLE),
    "the icon-only Details affordance must hide its glyph from assistive technology"
  );
}

function verifyTableIsBoundedByLayout(): void {
  // INVARIANT 11. Under auto layout the widest cell decides the column and pushes the table into
  // horizontal scroll. Fixed layout plus a complete allocation is the mechanism that prevents it.
  // The individual percentages are deliberately NOT pinned - only that the allocation is complete.
  assert(
    MAIN_TABLE.includes("table-fixed"),
    "the audit table must use table-fixed so proportions, not content, decide column width"
  );
  const widthBlock = topLevelBlock(source, "const AUDIT_COLUMN_WIDTH", "AUDIT_COLUMN_WIDTH");
  const widths = [...widthBlock.matchAll(/"w-\[(\d+)%\]"/g)].map((match) => Number(match[1]));
  assert(
    widths.length === 6,
    `AUDIT_COLUMN_WIDTH must allocate all six columns (found ${widths.length})`
  );
  const total = widths.reduce((sum, width) => sum + width, 0);
  assert(
    total === 100,
    `AUDIT_COLUMN_WIDTH must be a complete allocation summing to 100% (found ${total}%)`
  );
  const headers = MAIN_TABLE.match(/<th[ >]/g) ?? [];
  assert(
    headers.length === 6,
    `the audit table must declare exactly six columns to match the allocation (found ${headers.length})`
  );
  for (let column = 0; column < 6; column += 1) {
    assert(
      MAIN_TABLE.includes(`AUDIT_COLUMN_WIDTH[${column}]`),
      `column ${column} must actually apply its declared width; a complete allocation that is never applied leaves table-fixed to divide the table into equal columns`
    );
  }
}

function verifyActorIdentifierProminence(): void {
  // INVARIANT 12. performedByUserId left the table on purpose; it must not have left the product.
  // This is a prominence guarantee in one direction and an availability guarantee in the other.
  assert(
    !TABLE_BODY.includes("performedByUserId"),
    "performedByUserId must not be rendered in the audit table body"
  );
  assert(
    PERFORMED_BY_SECTION.includes("selectedEvent.performedByUserId"),
    "performedByUserId must remain available in the details panel"
  );

  // Both operands must EXIST before their order means anything. `indexOf` returns -1 for an absent
  // needle, and -1 is less than every valid index - so deleting the username row would satisfy an
  // unguarded comparison while achieving exactly the prohibited state: the raw identifier standing
  // alone as the only actor in the section.
  const usernameIndex = PERFORMED_BY_SECTION.indexOf("performedByUsername");
  const identifierIndex = PERFORMED_BY_SECTION.indexOf("performedByUserId");
  assert(
    usernameIndex >= 0,
    "the details panel must still show the actor username; the raw identifier may not stand alone"
  );
  assert(identifierIndex >= 0, "the details panel must still show the actor identifier");
  assert(
    usernameIndex < identifierIndex,
    "the actor identifier must not be promoted above the username it belongs to"
  );
}

/**
 * Vocabulary families, not fixed sentences.
 *
 * The contract to protect is a MEANING - "this filter is matched exactly" - so the assertions below
 * accept any wording that carries it and reject any wording that carries the opposite. Pinning the
 * sentence would freeze incidental prose the contract deliberately leaves free, and a verifier that
 * blocks a harmless rewrite is a verifier someone deletes.
 */
const EXACT_MATCH_VOCABULARY = /\b(?:exact|exactly|equals|equal to|identical)\b/i;
const FUZZY_MATCH_VOCABULARY = /\b(?:contains|containing|includes|including|any part|partial|partially|substring|starts with|ends with|resembles)\b/i;

function verifyEventTypeExactMatchIsCommunicated(): void {
  // INVARIANT 13 - a ONE-SIDED presentation contract. See KNOWN LIMITATION 3.
  //
  // At the time this was written the repository matched Event type with equality against the raw
  // stored identifier (`.eq("event_type", ...)`), while Search was a wildcard predicate. If the UI
  // describes Event type in fuzzy terms while the query is exact, the viewer misdescribes its own
  // behaviour: an investigator who types a readable label sees zero rows and reasonably concludes
  // the event never happened. That is the same failure class as inferring an outcome from an event
  // name - the interface reporting something the record does not support.
  //
  // What follows pins the UI wording ONLY. The repository call site is not read here, so this
  // proves the interface keeps making an exact-match claim - never that the claim is still true.
  const filters = topLevelBlock(source, "function activeFilters(", "activeFilters");

  const eventTypeEntry = /key:\s*"eventType",[\s\S]{0,320}?verb:\s*"([^"]+)"/.exec(filters);
  assert(eventTypeEntry, "the active-filter model must describe how the Event type filter matches");
  const eventTypeVerb = eventTypeEntry[1];
  assert(
    EXACT_MATCH_VOCABULARY.test(eventTypeVerb),
    `the Event type chip must keep describing exact matching (found: "${eventTypeVerb}"). The repository operator itself is not checked here - see KNOWN LIMITATION 3`
  );
  assert(
    !FUZZY_MATCH_VOCABULARY.test(eventTypeVerb),
    `the Event type chip must not claim fuzzy matching (found: "${eventTypeVerb}"). If the repository operator genuinely changed, this assertion is the thing to revisit - it does not read the query`
  );

  // Search and Event type must stay distinguishable. Describing both identically is how two
  // different contracts came to look like one in the first place.
  const searchEntry = /key:\s*"search",[\s\S]{0,320}?verb:\s*"([^"]+)"/.exec(filters);
  assert(searchEntry, "the active-filter model must describe how the Search filter matches");
  assert(
    searchEntry[1] !== eventTypeVerb,
    `Search and Event type were built against different repository operators and must not be described identically (both: "${eventTypeVerb}")`
  );

  // The field-level guidance carries the same contract at the point of entry, where it prevents the
  // zero-result dead end rather than explaining it afterwards.
  const hint = region('<p id="audit-event-type-hint"', "</p>", "event-type discoverability hint");
  assert(
    EXACT_MATCH_VOCABULARY.test(hint),
    "the Event type field guidance must state that matching is exact"
  );
  assert(
    /raw identifier/i.test(hint),
    "the Event type field guidance must tell the operator that the raw identifier is required"
  );
  assert(
    !FUZZY_MATCH_VOCABULARY.test(hint),
    "the Event type field guidance must not describe the filter in fuzzy terms while the interface claims exact matching elsewhere"
  );
}

function verifyUnrecognisedDetailKeysStillRender(): void {
  // The guarantee that makes INVARIANT 2 safe rather than dangerous.
  //
  // Exact label coverage is only acceptable because an unlabelled key still reaches the operator,
  // humanized. Without this, a maintainer could filter the render loop to known labels - passing
  // every other assertion here - and the panel would silently withhold audit fields it received.
  // In an audit viewer, silently withholding a recorded field is the worst available outcome.
  const loop = /Object\.entries\(selectedEvent\.details\)([\s\S]{0,120}?)\.map\(/.exec(source);
  assert(loop, "the details panel must iterate the recorded detail entries");
  assert(
    !loop[1].includes(".filter("),
    "the details panel must not filter recorded detail entries; every key the server sent must reach the operator"
  );
  assert(
    /hasOwnProperty\.call\(DETAIL_LABELS,\s*key\)[\s\S]{0,120}?humanizeIdentifier\(key\)/.test(source),
    "an unlabelled detail key must fall back to a humanized label rather than being dropped"
  );

  // The raw payload is the operator's last resort when a curated view is wrong or incomplete.
  assert(
    /JSON\.stringify\(selectedEvent\.details/.test(source),
    "the details panel must retain the raw recorded payload as a secondary view"
  );
}

/* ------------------------------------------------------------------ run */

const inventory = enumerateDetailKeys();

verifyDetailKeyInventoryFailsClosed(inventory);
verifyCuratedLabelCoverage(inventory);
verifyOutcomeDerivation();
verifyOutcomeToneSemantics();
verifyOutcomeIsNeverTruncated();
verifyDetailsControlCannotForceOverflow();
verifyDetailsRemainsReachable();
verifyTableIsBoundedByLayout();
verifyActorIdentifierProminence();
verifyEventTypeExactMatchIsCommunicated();
verifyUnrecognisedDetailKeysStillRender();

process.stdout.write(
  `Audit presentation verification passed: ${inventory.keys.size} emitted detail keys fully labelled, ` +
    "outcome derivation and tone NAMES pinned, Details reachable without forcing overflow, " +
    "and the actor identifier demoted without being lost.\n"
);
