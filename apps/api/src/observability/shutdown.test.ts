// TC-F00-87 (AC-F00-43): a request's trace and logs must reach the monitoring even when the backend stops
// right after it. Found in T20: the stop path ended with process.exit(), so the last batch (sent every 5 s)
// was lost. Shutdown hooks now run first: the OpenTelemetry SDK sends what it still holds.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { onShutdown, runShutdownHooks } from "./shutdown.ts";

const API_SRC = fileURLToPath(new URL("..", import.meta.url));
const INSTRUMENTATION = join(API_SRC, "instrumentation.ts");
const PROBE = join(API_SRC, `.probe-shutdown-${randomBytes(6).toString("hex")}.mjs`);
const SLOW = { timeout: 60_000 };

// Makes one span (it would normally wait up to 5 s in the batch), then stops like server.ts does.
const PROBE_SOURCE = `
const otel = globalThis[Symbol.for("opentelemetry.js.api.1")];
otel.trace.getTracer("probe").startSpan("probe-span").end();
const { runShutdownHooks } = await import("./observability/shutdown.ts");
await runShutdownHooks();
process.exit(0);
`;

let collector: Server;
let endpoint: string;
const received: string[] = [];

beforeAll(async () => {
  writeFileSync(PROBE, PROBE_SOURCE);
  collector = createServer((request, response) => {
    received.push(`${request.method ?? ""} ${request.url ?? ""}`);
    request.resume();
    request.on("end", () => response.writeHead(200, { "Content-Type": "application/json" }).end("{}"));
  });
  await new Promise<void>((resolve) => collector.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${String((collector.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  rmSync(PROBE, { force: true });
  await new Promise((resolve) => collector.close(resolve));
});

function runProbe(): Promise<number | null> {
  const env = { PATH: process.env["PATH"] ?? "", NODE_ENV: "test", OTEL_EXPORTER_OTLP_ENDPOINT: endpoint };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", INSTRUMENTATION, PROBE], { cwd: API_SRC, env });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("the probe did not exit within 30 s"));
    }, 30_000);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

describe("TC-F00-87 [AC-F00-43] the last traces are sent before the backend stops", () => {
  it("TC-F00-87 [AC-F00-43] a span made just before stopping reaches the collector", SLOW, async () => {
    expect(await runProbe()).toBe(0);
    expect(received).toContain("POST /v1/traces");
  });

  it("TC-F00-87 [AC-F00-43] server.ts runs the shutdown hooks before it exits", () => {
    const source = readFileSync(join(API_SRC, "server.ts"), "utf8");
    const shutDown = /async function shutDown\(\)[^]*?\n\}/.exec(source)?.[0] ?? "";
    expect(shutDown).toMatch(/await runShutdownHooks\(\);[^]*process\.exit\(0\)/);
  });

  it("TC-F00-87 [AC-F00-43] every hook is awaited, and a hook that hangs can't block the stop", async () => {
    const done: string[] = [];
    onShutdown(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      done.push("slow");
    });
    onShutdown(() => new Promise(() => undefined));
    onShutdown(async () => {
      throw new Error("a failing hook is ignored");
    });
    const started = Date.now();
    await runShutdownHooks(300);
    expect(done).toEqual(["slow"]);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
