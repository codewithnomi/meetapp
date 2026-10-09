// Secrets check before every commit (AC-F00-18, security rule S7). Run by .husky/pre-commit.
// Plain JavaScript (like preflight.mjs) so it runs on any Node version, even outside mise.
// Scans the staged changes of the current git repository with gitleaks from its Docker image,
// using this project's .gitleaks.toml. Fails closed: if Docker is not running, the commit stops.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Pinned by version and digest so the scanner cannot change silently (update via /deps-update). */
export const GITLEAKS_IMAGE =
  "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";
const CONFIG = fileURLToPath(new URL("../.gitleaks.toml", import.meta.url));

/** @param {string} message @returns {never} */
function fail(message) {
  process.stderr.write(`✗ ${message}\n`);
  process.exit(1);
}

function dockerIsRunning() {
  const result = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { stdio: "ignore" });
  return result.status === 0;
}

function repositoryRoot() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (result.status !== 0) fail("The secrets check must run inside a git repository.");
  return result.stdout.trim();
}

/** @param {string} root */
function scanStagedChanges(root) {
  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--network=none",
      ...["-v", `${root}:/repo:ro`, "-v", `${CONFIG}:/config/gitleaks.toml:ro`],
      // The mounted repo belongs to another user inside the container; tell git that is fine.
      ...["-e", "GIT_CONFIG_COUNT=1", "-e", "GIT_CONFIG_KEY_0=safe.directory", "-e", "GIT_CONFIG_VALUE_0=*"],
      GITLEAKS_IMAGE,
      ...["git", "--staged", "--redact", "--verbose", "--no-banner", "--no-color"],
      ...["--config", "/config/gitleaks.toml", "/repo"],
    ],
    { stdio: "inherit" },
  );
  return result.status;
}

if (!dockerIsRunning()) {
  fail("Start Docker to run the secrets check. The commit was stopped so no secret can slip through unchecked.");
}
const status = scanStagedChanges(repositoryRoot());
if (status === 1) {
  fail(
    "Secret found in the staged changes (see File and Line above). Remove it and keep secrets only in .env " +
      "(never committed). Deliberately fake test secrets belong in tests/fixtures/.",
  );
}
if (status !== 0) fail(`The secrets check could not run (gitleaks exit code ${String(status)}). Commit stopped.`);
