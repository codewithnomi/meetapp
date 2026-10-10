// Tests for the local services setup (F00 T4): infra/docker-compose.yml and .env.example.
// Needs only the Docker CLI (for `docker compose config` and the gitleaks image), not running services.
// The tests that need the services running live in local-services.integration.test.ts.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const COMPOSE_FILE = join(ROOT, "infra/docker-compose.yml");
const ENV_EXAMPLE = join(ROOT, ".env.example");
const DOCKER = { timeout: 120_000 };

interface ComposePort {
  host_ip?: string;
  target: number;
  published?: string;
  protocol?: string;
}
interface ComposeService {
  image?: string;
  ports?: ComposePort[];
}

/** The fully resolved compose file (all profiles), as Docker itself understands it. */
function composeConfig(): { services: Record<string, ComposeService> } {
  const result = spawnSync(
    "docker",
    ["compose", "-f", COMPOSE_FILE, "--env-file", ENV_EXAMPLE, "--profile", "*", "config", "--format", "json"],
    { cwd: ROOT, encoding: "utf8", timeout: 60_000 },
  );
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  return JSON.parse(result.stdout) as { services: Record<string, ComposeService> };
}

const ENV_LINE = /^([A-Z][A-Z0-9_]*)=(.*)$/;

function envLines() {
  return readFileSync(ENV_EXAMPLE, "utf8").split("\n");
}

/** KEY -> value for every `KEY=value` line of .env.example. */
function envEntries() {
  const entries = new Map<string, string>();
  for (const line of envLines()) {
    const match = ENV_LINE.exec(line.trim());
    if (match?.[1] !== undefined) entries.set(match[1], match[2] ?? "");
  }
  return entries;
}

/**
 * Keys without a comment: scanning upward from the key over contiguous KEY=value lines, a `#`
 * comment line must come before a blank line (or the start of the file).
 */
function undocumentedKeys(rawLines: string[]) {
  const lines = rawLines.map((line) => line.trim());
  const missing: string[] = [];
  lines.forEach((line, index) => {
    const key = ENV_LINE.exec(line)?.[1];
    if (key === undefined) return;
    let above = index - 1;
    while (above >= 0 && ENV_LINE.test(lines[above] ?? "")) above -= 1;
    if (above < 0 || !(lines[above] ?? "").startsWith("#")) missing.push(key);
  });
  return missing;
}

/** Every variable name used as `${NAME...}` in the compose file (`$${...}` is an escaped shell variable). */
function composeVariables() {
  const text = readFileSync(COMPOSE_FILE, "utf8");
  return [...new Set([...text.matchAll(/(?<!\$)\$\{([A-Za-z_][A-Za-z0-9_]*)/g)].map(([, name]) => name ?? ""))];
}

/** The pinned gitleaks image from tools/check-secrets.mjs (read as text: importing it would run the check). */
function gitleaksImage() {
  const text = readFileSync(join(ROOT, "tools/check-secrets.mjs"), "utf8");
  const image = /"(ghcr\.io\/gitleaks\/gitleaks:[^"]+)"/.exec(text)?.[1];
  expect(image, "GITLEAKS_IMAGE not found in tools/check-secrets.mjs").toBeDefined();
  return image ?? "";
}

describe("TC-F00-55 [AC-F00-23] all compose ports bind to localhost", DOCKER, () => {
  it("TC-F00-55 [AC-F00-23] every published port of every service (all profiles) has host_ip 127.0.0.1", () => {
    const { services } = composeConfig();
    const names = Object.keys(services);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const ports = services[name]?.ports ?? [];
      expect(ports.length, `service ${name} publishes no port`).toBeGreaterThan(0);
      for (const port of ports) {
        expect(port.host_ip, `${name} port ${port.target}/${port.protocol ?? "tcp"}`).toBe("127.0.0.1");
      }
    }
  });

  it("TC-F00-55 [AC-F00-23] the raw compose file has no port line without 127.0.0.1", () => {
    const text = readFileSync(COMPOSE_FILE, "utf8");
    const portLines = [...text.matchAll(/^\s*ports:\s*\n((?:\s*-\s*.+\n)+)/gm)].flatMap(([, body]) =>
      (body ?? "").split("\n").filter((line) => line.trim().startsWith("-")),
    );
    expect(portLines.length).toBeGreaterThan(0);
    for (const line of portLines) expect(line.trim()).toMatch(/^-\s*"127\.0\.0\.1:/);
  });

  it("TC-F00-55 [AC-F00-23] every image is pinned by version and sha256 digest", () => {
    const { services } = composeConfig();
    for (const [name, service] of Object.entries(services)) {
      expect(service.image, `service ${name} image`).toMatch(/^[a-z0-9./_-]+:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}$/);
    }
  });

  // TC-F00-55 API default host (API_HOST=127.0.0.1): tested in apps/api/src/app.test.ts.
  it.todo("TC-F00-55 [AC-F00-23] Storybook uses --host 127.0.0.1 (needs Storybook, T11)");
  it.todo("TC-F00-55 [AC-F00-23] Vite uses --host 127.0.0.1 (needs the web/desktop app, T14)");
});

describe("TC-F00-12 [AC-F00-05] [AC-F00-06] every setting is documented in .env.example", DOCKER, () => {
  it("TC-F00-12 [AC-F00-05] every ${VAR} used in infra/docker-compose.yml is a key in .env.example", () => {
    const keys = envEntries();
    const variables = composeVariables();
    expect(variables.length).toBeGreaterThan(0);
    for (const name of variables) expect(keys.has(name), `${name} missing from .env.example`).toBe(true);
  });

  it("TC-F00-12 [AC-F00-05] every key in .env.example has a comment above it or its group", () => {
    expect(envEntries().size).toBeGreaterThan(0);
    expect(undocumentedKeys(envLines())).toEqual([]);
  });

  it("TC-F00-12 [AC-F00-05] the comment rule flags a key that has no comment (self-check)", () => {
    // Guards the helper itself: a key after a blank line with no comment must be reported.
    expect(undocumentedKeys(["# Group", "A=1", "B=2", "", "C=3", "D=4", "  # Indented", "E=5"])).toEqual(["C", "D"]);
  });

  it("TC-F00-12 [AC-F00-06] gitleaks finds no real-looking secret in .env.example", () => {
    const result = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        "--network=none",
        ...["-v", `${ENV_EXAMPLE}:/scan/.env.example:ro`],
        ...["-v", `${join(ROOT, ".gitleaks.toml")}:/config/gitleaks.toml:ro`],
        gitleaksImage(),
        ...["dir", "--no-banner", "--redact", "--config", "/config/gitleaks.toml", "/scan"],
      ],
      { cwd: ROOT, encoding: "utf8", timeout: 110_000 },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  // TC-F00-12 Zod config schema vs .env.example: tested in apps/api/src/config/config.test.ts.
});

describe("TC-F00-13 [AC-F00-06] only free accounts are needed", () => {
  const PAID_WORDS = ["credit card", "billing", "paid plan", "pro plan", "subscription", "payment"];

  it("TC-F00-13 [AC-F00-06] .env.example mentions no paid-only words", () => {
    const text = readFileSync(ENV_EXAMPLE, "utf8").toLowerCase();
    for (const word of PAID_WORDS) expect(text, `found "${word}"`).not.toContain(word);
  });

  it("TC-F00-13 [AC-F00-06] optional external settings are present and empty by default", () => {
    const keys = envEntries();
    for (const name of ["SENTRY_DSN", "OTEL_EXPORTER_OTLP_ENDPOINT"]) {
      expect(keys.has(name), `${name} missing`).toBe(true);
      expect(keys.get(name), `${name} must be empty`).toBe("");
    }
  });

  it.todo("TC-F00-13 [AC-F00-06] docs/getting-started.md mentions no paid-only words (needs the guide, T21)");
});
