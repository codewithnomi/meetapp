// License rules (AC-F00-31, git-ci-release.md item 8): no library may force us to publish MeetApp's code.
// Reads SPDX license expressions ("MIT OR GPL-3.0", "Apache-2.0 WITH LLVM-exception", parentheses).

export type Verdict = { ok: true } | { ok: false; reason: string };

/** Permissive licenses (and MPL-2.0, whose sharing duty covers only changed MPL files, which we never change). */
export const APPROVED_LICENSES = new Set([
  "MIT",
  "MIT-0",
  "ISC",
  "0BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "Unlicense",
  "CC0-1.0",
  "CC-BY-4.0",
  "BlueOak-1.0.0",
  "OFL-1.1",
  "Python-2.0",
  "MPL-2.0",
  "Zlib",
]);

/** Copyleft families that would force sharing our code. */
const BLOCKED = /^(A?GPL|LGPL|SSPL)/i;

const PASS: Verdict = { ok: true };
/** License ids are case-insensitive (SPDX). */
const APPROVED_UPPER = new Set([...APPROVED_LICENSES].map((id) => id.toUpperCase()));

function single(id: string): Verdict {
  if (APPROVED_UPPER.has(id.toUpperCase())) return PASS;
  if (BLOCKED.test(id)) return { ok: false, reason: `${id} is blocked (copyleft)` };
  return { ok: false, reason: `${id || "(none)"} is an unknown license` };
}

/** Splits "(MIT OR Apache-2.0)" into tokens; returns undefined for anything that isn't an expression. */
function tokenize(expression: string): string[] | undefined {
  const tokens = expression.replace(/[()]/g, " $& ").trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 ? tokens : undefined;
}

/** A tiny recursive-descent reader: or := and ("OR" and)*; and := term ("AND" term)*; term := id [WITH id] | "(" or ")". */
class Reader {
  private index = 0;
  private readonly tokens: string[];

  constructor(tokens: string[]) {
    this.tokens = tokens;
  }

  done(): boolean {
    return this.index >= this.tokens.length;
  }

  or(): Verdict {
    let verdict = this.and();
    while (this.keyword("OR")) {
      const next = this.and();
      verdict = verdict.ok ? verdict : next;
    }
    return verdict;
  }

  private and(): Verdict {
    let verdict = this.term();
    while (this.keyword("AND")) {
      const next = this.term();
      verdict = verdict.ok ? next : verdict;
    }
    return verdict;
  }

  private term(): Verdict {
    const token = this.tokens[this.index++];
    if (token === undefined || token === ")" || /^(OR|AND|WITH)$/i.test(token)) throw new Error("bad expression");
    if (token === "(") {
      const inner = this.or();
      if (this.tokens[this.index++] !== ")") throw new Error("bad expression");
      return inner;
    }
    if (this.keyword("WITH") && this.tokens[this.index++] === undefined) throw new Error("bad expression");
    return single(token);
  }

  private keyword(word: string): boolean {
    if (this.tokens[this.index]?.toUpperCase() !== word) return false;
    this.index++;
    return true;
  }
}

export function licenseVerdict(expression: string): Verdict {
  const tokens = tokenize(expression);
  if (!tokens) return single("");
  try {
    const reader = new Reader(tokens);
    const verdict = reader.or();
    if (!reader.done()) throw new Error("bad expression");
    return verdict;
  } catch {
    return { ok: false, reason: `"${expression}" is an unknown license (unreadable)` };
  }
}

export interface PackageLicense {
  name: string;
  version: string;
  license: string;
}

export interface AllowlistEntry {
  name: string;
  license: string;
  reason: string;
}

function allowed(pkg: PackageLicense, allowlist: AllowlistEntry[]): boolean {
  return allowlist.some(
    (entry) => entry.name === pkg.name && entry.license === pkg.license && entry.reason.trim() !== "",
  );
}

/** One line per package whose license isn't acceptable and that has no allowlist entry with a reason. */
export function findLicenseProblems(packages: PackageLicense[], allowlist: AllowlistEntry[]): string[] {
  return packages.flatMap((pkg) => {
    const verdict = licenseVerdict(pkg.license);
    if (verdict.ok || allowed(pkg, allowlist)) return [];
    return [`${pkg.name}@${pkg.version}: ${verdict.reason}`];
  });
}

type PnpmLicenses = Record<string, { name: string; versions: string[]; license: string }[]>;

/** Flattens `pnpm licenses list --json` (grouped by license) into one entry per package version. */
export function packagesFromPnpm(json: PnpmLicenses): PackageLicense[] {
  return Object.values(json).flatMap((group) =>
    group.flatMap((pkg) => pkg.versions.map((version) => ({ name: pkg.name, version, license: pkg.license }))),
  );
}
