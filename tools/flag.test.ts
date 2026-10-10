// Tests for `pnpm flag` (F00 T6): bad input is refused before the database is touched (AC-F00-34).
// POSTGRES_PORT points at a closed port, so IF the command tried the database it would print
// "Can't reach the database". Seeing the usage message instead proves nothing could have changed.
import { spawnSync } from "node:child_process";
import { createServer, type AddressInfo } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FLAG = join(ROOT, "tools/flag.ts");
const USAGE = "Usage: pnpm flag";
const DB_ATTEMPT = "Can't reach the database";

let closedPort = "";

/** Finds a free port, then closes it again so nothing listens there. */
async function findClosedPort(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return String(port);
}

beforeAll(async () => {
  closedPort = await findClosedPort();
});

function flag(args: string[]) {
  const result = spawnSync(process.execPath, [FLAG, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, POSTGRES_PORT: closedPort },
  });
  return { code: result.status, output: `${result.stdout}\n${result.stderr}` };
}

describe("TC-F00-75 [AC-F00-34] flag command rejects bad input before touching the database", () => {
  it.each([
    ["no arguments", []],
    ["only a key", ["home.welcome_banner"]],
    ["'maybe' instead of on/off", ["home.welcome_banner", "maybe"]],
    ["a key containing '; drop table", ["x'; drop table feature_flags;--", "on"]],
    ["upper-case key", ["Home.Banner", "off"]],
    ["too many arguments", ["home.welcome_banner", "on", "extra"]],
    ["'list' with an extra argument", ["list", "all"]],
  ])("TC-F00-75 [AC-F00-34] %s: exits 1 with the usage message", (_name, args) => {
    const result = flag(args);
    expect(result.code, result.output).toBe(1);
    expect(result.output).toContain(USAGE);
    expect(result.output).not.toContain(DB_ATTEMPT);
    expect(result.output).not.toContain("No .env yet");
    expect(result.output).not.toContain("is now");
  });
});
