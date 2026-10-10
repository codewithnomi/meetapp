// `pnpm check:licenses` (part of `pnpm check`): fails, naming each library, when a license is blocked
// (GPL, AGPL, LGPL, SSPL) or unknown, unless tools/license-allowlist.json lists it with a reason.
// Options for tests: --input <pnpm licenses json> and --allowlist <file>.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, fail } from "./cli.ts";
import { findLicenseProblems, packagesFromPnpm, type AllowlistEntry } from "./licenses.ts";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const input = option("--input");
const allowlistFile = option("--allowlist") ?? join(ROOT, "tools/license-allowlist.json");
const listing = input
  ? readFileSync(input, "utf8")
  : execFileSync("pnpm", ["licenses", "list", "--json"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const allowlist = (JSON.parse(readFileSync(allowlistFile, "utf8")) as { packages: AllowlistEntry[] }).packages;
const packages = packagesFromPnpm(JSON.parse(listing) as Parameters<typeof packagesFromPnpm>[0]);
const problems = findLicenseProblems(packages, allowlist);

if (problems.length > 0) {
  fail(
    `License check failed (see docs/engineering/git-ci-release.md):\n  - ${problems.join("\n  - ")}\n` +
      "Replace the library, or add it to tools/license-allowlist.json with a reason.",
  );
}
process.stdout.write(`✓ Licenses OK (${String(packages.length)} packages checked).\n`);
