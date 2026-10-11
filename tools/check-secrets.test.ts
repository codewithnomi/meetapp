// Tests for the commit safety check (F00 T3): the pre-commit hook runs gitleaks (in Docker) on the
// staged changes, refuses commits that contain a secret, fails closed when Docker is missing, and only
// tests/fixtures may hold fake secrets. Fake secrets are built at runtime so this file itself is clean.
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHECK = join(ROOT, "tools/check-secrets.mjs");
const DOCKER = { timeout: 120_000 };
const NO_DOCKER_MESSAGE = "Start Docker to run the secrets check";
const GIT = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** The environment without git's own variables, so an outer git hook can't redirect the temp repo. */
function cleanEnv(extra: Record<string, string> = {}) {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !key.startsWith("GIT_")) env[key] = value;
  }
  return { ...env, ...extra };
}

/** Fake AWS access key id (base32 alphabet A-Z, 2-7), assembled so no secret-looking literal exists in this file. */
function fakeAwsKey() {
  return ["AK", "IA", "Q3T7XZ5VN2W4K6RD"].join("");
}

/** Fake PEM private key block with a random base64 body. */
function fakePrivateKey() {
  const body =
    randomBytes(144)
      .toString("base64")
      .match(/.{1,64}/g) ?? [];
  const begin = ["-----BEGIN", " RSA PRIVATE", " KEY-----"].join("");
  const end = ["-----END", " RSA PRIVATE", " KEY-----"].join("");
  return [begin, ...body, end].join("\n");
}

function newRepo() {
  const repo = tempDir("meetapp-secrets-");
  const git = (args: string[]) => spawnSync(GIT, args, { cwd: repo, env: cleanEnv(), encoding: "utf8" });
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "test@example.invalid"]);
  git(["config", "user.name", "Secrets Test"]);
  git(["config", "commit.gpgsign", "false"]);
  return repo;
}

function stage(repo: string, relative: string, text: string) {
  const full = join(repo, relative);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, text);
  execFileSync(GIT, ["add", relative], { cwd: repo, env: cleanEnv() });
}

/** Installs a pre-commit hook that runs the project's check, like .husky/pre-commit does. */
function installHook(repo: string) {
  const hooks = tempDir("meetapp-secrets-hooks-");
  const hook = join(hooks, "pre-commit");
  writeFileSync(hook, `#!/bin/sh\nexec "${process.execPath}" "${CHECK}"\n`);
  chmodSync(hook, 0o755);
  execFileSync(GIT, ["config", "core.hooksPath", hooks], { cwd: repo, env: cleanEnv() });
}

function runGit(repo: string, args: string[], env = cleanEnv()) {
  const result = spawnSync(GIT, args, { cwd: repo, env, encoding: "utf8" });
  return { code: result.status, output: `${result.stdout}\n${result.stderr}` };
}

function runCheck(repo: string, env = cleanEnv()) {
  const result = spawnSync(process.execPath, [CHECK], { cwd: repo, env, encoding: "utf8" });
  return { code: result.status, output: `${result.stdout}\n${result.stderr}` };
}

/** A bin dir holding only a git symlink, plus optional extra executables (e.g. a broken docker). */
function restrictedPath(extra: Record<string, string> = {}) {
  const bin = tempDir("meetapp-secrets-bin-");
  symlinkSync(GIT, join(bin, "git"));
  for (const [name, script] of Object.entries(extra)) {
    writeFileSync(join(bin, name), script);
    chmodSync(join(bin, name), 0o755);
  }
  return bin;
}

const SECRET_FILE = "src/settings.ts";

function secretFileText() {
  return [
    "export const region = 'eu-west-1';",
    `export const awsAccessKeyId = "${fakeAwsKey()}";`,
    "export const privateKey = `",
    fakePrivateKey(),
    "`;",
    "",
  ].join("\n");
}

const CLEAN_FILE_TEXT = [
  "export const region = 'eu-west-1';",
  "export const awsAccessKeyId = process.env.AWS_KEY;",
  "",
].join("\n");

describe("TC-F00-42 [AC-F00-18] pre-commit blocks a secret", DOCKER, () => {
  it("TC-F00-42 [AC-F00-18] refuses a commit with a fake AWS key and a PEM private key, naming file and line", () => {
    const repo = newRepo();
    installHook(repo);
    stage(repo, SECRET_FILE, secretFileText());

    const commit = runGit(repo, ["commit", "-m", "x"]);
    expect(commit.code, commit.output).not.toBe(0);
    expect(commit.output).toContain("Secret found");
    expect(commit.output).toMatch(new RegExp(`File:\\s+${SECRET_FILE}`));
    expect(commit.output).toMatch(/Line:\s+2\b/);
    expect(commit.output).toMatch(/Line:\s+4\b/);
    expect(commit.output).toMatch(/RuleID:\s+aws-access-token/);
    expect(commit.output).toMatch(/RuleID:\s+private-key/);
    expect(commit.output).not.toContain(fakeAwsKey());
    expect(runGit(repo, ["rev-parse", "--verify", "HEAD"]).code).not.toBe(0);
  });

  it("TC-F00-42 [AC-F00-18] each kind of secret is flagged on its own", () => {
    for (const [text, line, rule] of [
      [`const region = "${fakeAwsKey()}";\n`, 1, "aws-access-token"],
      [`const pem = \`\n${fakePrivateKey()}\n\`;\n`, 2, "private-key"],
    ] as const) {
      const repo = newRepo();
      stage(repo, SECRET_FILE, text);
      const result = runCheck(repo);
      expect(result.code, result.output).toBe(1);
      expect(result.output).toContain("Secret found");
      expect(result.output).toMatch(new RegExp(`File:\\s+${SECRET_FILE}`));
      expect(result.output).toMatch(new RegExp(`Line:\\s+${line}\\b`));
      expect(result.output).toMatch(new RegExp(`RuleID:\\s+${rule}`));
    }
  });

  it("TC-F00-42 [AC-F00-18] the same file without the secret commits fine", () => {
    const repo = newRepo();
    installHook(repo);
    stage(repo, SECRET_FILE, CLEAN_FILE_TEXT);

    const commit = runGit(repo, ["commit", "-m", "x"]);
    expect(commit.code, commit.output).toBe(0);
    expect(runGit(repo, ["rev-parse", "--verify", "HEAD"]).code).toBe(0);
  });

  it("TC-F00-42 [AC-F00-18] only staged changes are scanned: an unstaged secret does not block", () => {
    const repo = newRepo();
    installHook(repo);
    stage(repo, SECRET_FILE, CLEAN_FILE_TEXT);
    writeFileSync(join(repo, "notes.txt"), `${fakeAwsKey()}\n`);

    const commit = runGit(repo, ["commit", "-m", "x"]);
    expect(commit.code, commit.output).toBe(0);
  });
});

describe("TC-F00-43 [AC-F00-18] secrets check fails closed without Docker", DOCKER, () => {
  it("TC-F00-43 [AC-F00-18] no docker on PATH: commit refused with the start-Docker message", () => {
    const repo = newRepo();
    installHook(repo);
    stage(repo, SECRET_FILE, CLEAN_FILE_TEXT);

    const commit = runGit(repo, ["commit", "-m", "x"], cleanEnv({ PATH: restrictedPath() }));
    expect(commit.code, commit.output).not.toBe(0);
    expect(commit.output).toContain(NO_DOCKER_MESSAGE);
    expect(runGit(repo, ["rev-parse", "--verify", "HEAD"]).code).not.toBe(0);
  });

  it("TC-F00-43 [AC-F00-18] docker present but not running: commit refused with the start-Docker message", () => {
    const repo = newRepo();
    installHook(repo);
    stage(repo, SECRET_FILE, CLEAN_FILE_TEXT);

    const bin = restrictedPath({ docker: "#!/bin/sh\necho 'Cannot connect to the Docker daemon' >&2\nexit 1\n" });
    const commit = runGit(repo, ["commit", "-m", "x"], cleanEnv({ PATH: bin }));
    expect(commit.code, commit.output).not.toBe(0);
    expect(commit.output).toContain(NO_DOCKER_MESSAGE);
    expect(runGit(repo, ["rev-parse", "--verify", "HEAD"]).code).not.toBe(0);
  });

  it("TC-F00-43 [AC-F00-18] the script itself exits 1 without Docker", () => {
    const repo = newRepo();
    stage(repo, SECRET_FILE, CLEAN_FILE_TEXT);

    const result = runCheck(repo, cleanEnv({ PATH: restrictedPath() }));
    expect(result.code, result.output).toBe(1);
    expect(result.output).toContain(NO_DOCKER_MESSAGE);
  });
});

describe("TC-F00-43 [AC-F00-18] .husky/pre-commit runs the secrets check first", () => {
  it("TC-F00-43 [AC-F00-18] check-secrets runs before lint-staged", () => {
    const lines = readFileSync(join(ROOT, ".husky/pre-commit"), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"));
    const secrets = lines.findIndex((line) => line.includes("node tools/check-secrets.mjs"));
    const lintStaged = lines.findIndex((line) => line.includes("pnpm exec lint-staged"));
    expect(secrets, lines.join("\n")).toBeGreaterThanOrEqual(0);
    expect(lintStaged, lines.join("\n")).toBeGreaterThan(secrets);
  });
});

/** Every `paths = [...]` list in the gitleaks config, as the regex strings it contains. */
function allowlistPaths(toml: string) {
  const lists = [...toml.matchAll(/^\s*paths\s*=\s*\[([\s\S]*?)\]/gm)].map(([, body]) => body ?? "");
  return lists.flatMap((body) =>
    [...body.matchAll(/'''([\s\S]*?)'''|"((?:[^"\\]|\\.)*)"|'([^']*)'/g)].map(
      ([, triple, double, single]) => triple ?? double ?? single,
    ),
  );
}

describe("TC-F00-44 [AC-F00-18] [AC-F00-19] fixture secrets are excluded only in tests/fixtures", DOCKER, () => {
  it("TC-F00-44 [AC-F00-18] [AC-F00-19] the gitleaks allowlist covers no path outside tests/fixtures", () => {
    const toml = readFileSync(join(ROOT, ".gitleaks.toml"), "utf8");
    const paths = allowlistPaths(toml);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(path).toMatch(/^\^tests\/fixtures\//);
  });

  it("TC-F00-44 [AC-F00-18] [AC-F00-19] a fake key in apps/api/src is flagged", () => {
    const repo = newRepo();
    stage(repo, "apps/api/src/config.ts", `export const key = "${fakeAwsKey()}";\n`);

    const result = runCheck(repo);
    expect(result.code, result.output).toBe(1);
    expect(result.output).toContain("Secret found");
    expect(result.output).toMatch(/File:\s+apps\/api\/src\/config\.ts/);
  });

  it("TC-F00-44 [AC-F00-18] [AC-F00-19] the same fake key in tests/fixtures passes", () => {
    const repo = newRepo();
    stage(repo, "tests/fixtures/secrets/fake-key.ts", `export const key = "${fakeAwsKey()}";\n`);

    const result = runCheck(repo);
    expect(result.code, result.output).toBe(0);
  });
});
