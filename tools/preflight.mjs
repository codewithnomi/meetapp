// Checks that the right Node.js and pnpm versions are in use before anything else runs (AC-F00-37).
// Plain JavaScript on purpose: it must run, and explain the problem, even on an old Node.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MISE_FILE = new URL("../mise.toml", import.meta.url);

/** Reads the pinned major versions from mise.toml, the single place versions are set. */
export function readPinnedMajors(miseToml) {
  const pinned = {};
  for (const tool of ["node", "pnpm"]) {
    const match = miseToml.match(new RegExp(`^${tool}\\s*=\\s*"(\\d+)`, "m"));
    if (!match) throw new Error(`mise.toml has no pinned version for ${tool}`);
    pinned[tool] = match[1];
  }
  return pinned;
}

function major(version) {
  return String(version).replace(/^v/, "").split(".")[0];
}

/** Returns a list of human-readable problems; empty when everything matches. */
export function findVersionProblems(actual, pinned) {
  const problems = [];
  const labels = { node: "Node", pnpm: "pnpm" };
  for (const tool of ["node", "pnpm"]) {
    const found = actual[tool];
    if (!found) {
      problems.push(`${labels[tool]} was not found. Run \`mise install\``);
    } else if (major(found) !== pinned[tool]) {
      problems.push(`Expected ${labels[tool]} ${pinned[tool]}, found ${major(found)}. Run \`mise install\``);
    }
  }
  return problems;
}

function detectPnpmVersion() {
  const agent = process.env.npm_config_user_agent || "";
  const fromAgent = agent.match(/pnpm\/(\d+[\d.]*)/);
  if (fromAgent) return fromAgent[1];
  try {
    return execFileSync("pnpm", ["--version"], { encoding: "utf8", timeout: 5000 }).trim();
  } catch {
    return undefined;
  }
}

function main() {
  const pinned = readPinnedMajors(readFileSync(MISE_FILE, "utf8"));
  const actual = {
    node: process.env.MEETAPP_FAKE_NODE_VERSION || process.versions.node,
    pnpm: process.env.MEETAPP_FAKE_PNPM_VERSION || detectPnpmVersion(),
  };
  const problems = findVersionProblems(actual, pinned);
  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`✗ ${problem}\n`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
