// TC-F00-53 (AC-F00-22): everything works without Sentry and without OpenTelemetry. Runs the real
// `node --import src/instrumentation.ts` in a child process with a small probe script that reports
// whether Sentry was started and whether an OpenTelemetry tracer was registered.
// The probe lives inside apps/api/src (deleted afterwards) so it can import @sentry/node.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { captureLogs, fakeConfig } from "../test-support/fake-env.ts";

const API_SRC = fileURLToPath(new URL("..", import.meta.url));
const INSTRUMENTATION = join(API_SRC, "instrumentation.ts");
const PROBE = join(API_SRC, `.probe-${randomBytes(6).toString("hex")}.mjs`);
const SLOW = { timeout: 60_000 };

// The OpenTelemetry API keeps its global registrations under this symbol (major version 1).
const PROBE_SOURCE = `
const otel = globalThis[Symbol.for("opentelemetry.js.api.1")];
const Sentry = await import("@sentry/node");
process.stdout.write(JSON.stringify({
  sentry: Sentry.isInitialized(),
  otelGlobal: otel !== undefined,
  tracer: otel?.trace !== undefined,
}) + "\\n");
`;

interface ProbeResult {
  code: number | null;
  report: { sentry: boolean; otelGlobal: boolean; tracer: boolean };
  output: string;
}

function runProbe(extraEnv: Record<string, string>): Promise<ProbeResult> {
  const env: Record<string, string> = { PATH: process.env["PATH"] ?? "", NODE_ENV: "test", ...extraEnv };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", INSTRUMENTATION, PROBE], { cwd: API_SRC, env });
    const out: string[] = [];
    const err: string[] = [];
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk.toString()));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`the probe did not exit within 30 s:\n${out.join("")}${err.join("")}`));
    }, 30_000);
    child.once("exit", (code) => {
      clearTimeout(timer);
      const output = out.join("") + err.join("");
      const line = out
        .join("")
        .split("\n")
        .find((text) => text.startsWith("{"));
      if (line === undefined) {
        reject(new Error(`the probe printed no report (exit ${String(code)}):\n${output}`));
        return;
      }
      resolve({ code, report: JSON.parse(line) as ProbeResult["report"], output });
    });
  });
}

beforeAll(() => {
  writeFileSync(PROBE, PROBE_SOURCE);
});

afterAll(() => {
  rmSync(PROBE, { force: true });
});

describe("TC-F00-53 [AC-F00-22] everything works without Sentry or OpenTelemetry", () => {
  it("TC-F00-53 [AC-F00-22] with SENTRY_DSN and OTEL_EXPORTER_OTLP_ENDPOINT unset nothing starts", SLOW, async () => {
    const result = await runProbe({});
    expect(result.code, result.output).toBe(0);
    expect(result.report).toEqual({ sentry: false, otelGlobal: false, tracer: false });
  });

  it("TC-F00-53 [AC-F00-22] with both set to empty strings nothing starts", SLOW, async () => {
    const result = await runProbe({ SENTRY_DSN: "", OTEL_EXPORTER_OTLP_ENDPOINT: "" });
    expect(result.code, result.output).toBe(0);
    expect(result.report).toEqual({ sentry: false, otelGlobal: false, tracer: false });
  });

  it("TC-F00-53 [AC-F00-22] with only SENTRY_DSN set Sentry starts", SLOW, async () => {
    const result = await runProbe({ SENTRY_DSN: "https://public@127.0.0.1:9/1" });
    expect(result.code, result.output).toBe(0);
    expect(result.report.sentry).toBe(true);
  });

  it(
    "TC-F00-53 [AC-F00-22] with only OTEL_EXPORTER_OTLP_ENDPOINT set a tracer is registered and the process exits 0",
    SLOW,
    async () => {
      const result = await runProbe({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:9" });
      expect(result.code, result.output).toBe(0);
      expect(result.report).toEqual({ sentry: false, otelGlobal: true, tracer: true });
    },
  );

  it("TC-F00-53 [AC-F00-22] the backend starts without Sentry and health answers 200", async () => {
    const app = await buildApp(fakeConfig("test"), { logDestination: captureLogs().stream });
    try {
      await app.ready();
      const response = await app.inject({ method: "GET", url: "/api/v1/health" });
      expect(response.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it.todo("TC-F00-53 [AC-F00-22] the Electron main starts without SENTRY_DSN and does not init Sentry (T15)");
});
