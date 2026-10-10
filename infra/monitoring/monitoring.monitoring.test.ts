// Slow monitoring checks (F00 T20). They start the whole monitoring stack and the backend, stop services
// on purpose and watch Gatus, Grafana, Loki, Tempo and Mailpit react. Run with `pnpm test:monitoring`.
// Stop `pnpm dev` and `pnpm monitoring` first: this test needs the API and notifier ports for itself.
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNotifier, type Notification } from "../../tools/notifier.ts";
import { ROOT, type Json, compose, setting } from "./monitoring-test-support.ts";

const MIN = 60_000;
const API = `http://127.0.0.1:${setting("API_PORT")}`;
const GATUS = `http://127.0.0.1:${setting("GATUS_PORT")}`;
const GRAFANA = `http://127.0.0.1:${setting("GRAFANA_PORT")}`;
const MAILPIT = `http://127.0.0.1:${setting("MAILPIT_WEB_PORT")}`;
const GRAFANA_AUTH = `Basic ${Buffer.from(`admin:${setting("GRAFANA_ADMIN_PASSWORD")}`).toString("base64")}`;
const NAMES = ["Backend", "Database", "Cache", "Call server", "File storage", "Email"];
const SERVICE_TO_NAME: Record<string, string> = {
  redis: "Cache",
  postgres: "Database",
  livekit: "Call server",
  storage: "File storage",
  mailpit: "Email",
};

const calls: Notification[] = [];
let notifier: Server;
let backend: ChildProcess | undefined;

interface Status {
  name: string;
  results: { success: boolean; timestamp: string }[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries `check` until it returns a value (not undefined) or the time runs out. */
async function until<T>(
  what: string,
  timeoutMs: number,
  check: () => Promise<T | undefined>,
  everyMs = 3000,
): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await check().catch(() => undefined);
    if (value !== undefined) return value;
    if (Date.now() > end) throw new Error(`Timed out after ${timeoutMs / 1000}s waiting for: ${what}`);
    await sleep(everyMs);
  }
}

async function answers(url: string) {
  return fetch(url, { signal: AbortSignal.timeout(3000) }).then(
    (r) => r.ok,
    () => false,
  );
}

async function statuses(): Promise<Map<string, Status>> {
  const list = (await (await fetch(`${GATUS}/api/v1/endpoints/statuses`)).json()) as Status[];
  return new Map(list.map((s) => [s.name, s]));
}

const isGreen = (s?: Status) => s !== undefined && s.results.at(-1)?.success === true;
const isRed = (s?: Status) => s !== undefined && s.results.at(-1)?.success === false;

async function waitAllGreen(timeoutMs = 3 * MIN) {
  await until("every Gatus endpoint green", timeoutMs, async () => {
    const all = await statuses();
    return NAMES.every((n) => isGreen(all.get(n))) ? true : undefined;
  });
}

function startBackend() {
  backend = spawn(
    "node",
    [
      "--env-file-if-exists=../../.env",
      "--import",
      join(ROOT, "apps/api/src/instrumentation.ts"),
      join(ROOT, "apps/api/src/server.ts"),
    ],
    {
      cwd: join(ROOT, "apps/api"),
      stdio: "ignore",
      env: {
        ...process.env,
        NODE_ENV: "test",
        OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${setting("ALLOY_OTLP_PORT")}`,
      },
    },
  );
}

async function stopBackend() {
  const child = backend;
  if (child === undefined || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await exited;
}

async function waitBackend() {
  await until(
    "the backend answers /api/v1/health",
    MIN,
    async () => ((await answers(`${API}/api/v1/health`)) ? true : undefined),
    1000,
  );
}

/** Stops one thing, expects only its endpoint red, starts it again and expects all green. */
async function breakAndRepair(name: string, stop: () => void | Promise<void>, start: () => void | Promise<void>) {
  await waitAllGreen();
  await stop();
  await until(
    `${name} red`,
    MIN,
    async () => {
      const all = await statuses();
      return isRed(all.get(name)) ? all : undefined;
    },
    2000,
  );
  const all = await statuses();
  for (const other of NAMES.filter((n) => n !== name && n !== "Backend")) {
    expect(isGreen(all.get(other)), `${other} should stay green while ${name} is down`).toBe(true);
  }
  await start();
  await until(
    `${name} green again`,
    2 * MIN,
    async () => (isGreen((await statuses()).get(name)) ? true : undefined),
    3000,
  );
}

async function grafana(path: string, init?: RequestInit) {
  const response = await fetch(`${GRAFANA}${path}`, {
    ...init,
    headers: { Authorization: GRAFANA_AUTH, "Content-Type": "application/json" },
  });
  if (response.status !== 200) throw new Error(`Grafana ${path} answered ${response.status}`);
  return response.json() as Promise<Json>;
}

interface Mail {
  ID: string;
  Subject: string;
  Created: string;
  Text: string;
}

/** Messages in Mailpit created after `since`, with their text. */
async function mailsAfter(since: number): Promise<Mail[]> {
  const list = (await (await fetch(`${MAILPIT}/api/v1/messages?limit=200`)).json()) as { messages: Mail[] };
  const recent = list.messages.filter((m) => Date.parse(m.Created) > since);
  return Promise.all(
    recent.map(async (m) => ({
      ...m,
      Text: ((await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as Mail).Text,
    })),
  );
}

const cacheMails = async (since: number, kind: RegExp) =>
  (await mailsAfter(since)).filter(
    (m) => /cache/i.test(`${m.Subject} ${m.Text}`) && kind.test(`${m.Subject} ${m.Text}`),
  );

beforeAll(async () => {
  if (await answers(`${API}/api/v1/health`)) throw new Error("The API port already answers: stop pnpm dev first.");
  const up = compose(["--profile", "monitoring", "up", "-d", "--wait"], 8 * MIN);
  if (up.code !== 0) throw new Error(`docker compose up failed:\n${up.output}`);
  notifier = createNotifier({ notify: (n) => void calls.push(n) });
  await new Promise<void>((resolve, reject) => {
    notifier.once("error", (error: NodeJS.ErrnoException) =>
      reject(
        error.code === "EADDRINUSE"
          ? new Error("Notifier port in use: close pnpm monitoring's notifier first.")
          : error,
      ),
    );
    notifier.listen(Number(setting("NOTIFIER_PORT")), "127.0.0.1", resolve);
  });
  startBackend();
  await waitBackend();
}, 10 * MIN);

afterAll(async () => {
  await stopBackend();
  await new Promise((resolve) => notifier?.close(resolve));
  for (const service of Object.keys(SERVICE_TO_NAME)) compose(["--profile", "monitoring", "start", service]);
}, 5 * MIN);

describe("monitoring checks", () => {
  it(
    "TC-F00-84 [AC-F00-41] Gatus shows the six parts, all healthy, checked every 30 seconds",
    { timeout: 6 * MIN },
    async () => {
      const all = await until("all six endpoints green", 90_000, async () => {
        const map = await statuses();
        return NAMES.every((n) => isGreen(map.get(n))) ? map : undefined;
      });
      expect([...all.keys()].sort()).toEqual([...NAMES].sort());
      const backendStatus = await until("two Backend results", 2 * MIN, async () => {
        const results = (await statuses()).get("Backend")?.results ?? [];
        return results.length >= 2 ? results : undefined;
      });
      const [previous, last] = backendStatus.slice(-2);
      const gap = (Date.parse(last?.timestamp ?? "") - Date.parse(previous?.timestamp ?? "")) / 1000;
      expect(Math.abs(gap - 30)).toBeLessThanOrEqual(5);
    },
  );

  it(
    "TC-F00-85 [AC-F00-41] stopping each part turns only its own endpoint red, and starting it turns it green",
    { timeout: 12 * MIN },
    async () => {
      for (const [service, name] of Object.entries(SERVICE_TO_NAME)) {
        await breakAndRepair(
          name,
          () => void compose(["--profile", "monitoring", "stop", service]),
          () => void compose(["--profile", "monitoring", "start", service]),
        );
      }
      await breakAndRepair("Backend", stopBackend, async () => {
        startBackend();
        await waitBackend();
      });
      expect(isGreen((await statuses()).get("Backend"))).toBe(true);
    },
  );

  it("TC-F00-86 [AC-F00-42] every dashboard panel shows data after some traffic", { timeout: 12 * MIN }, async () => {
    for (let i = 0; i < 8; i += 1) {
      await fetch(`${API}/api/v1/health`);
      await fetch(`${API}/api/v1/flags`).catch(() => undefined);
      await fetch(`${API}/__test__/error`, { method: "POST" });
    }
    const { dashboard } = await grafana("/api/dashboards/uid/meetapp-overview");
    const panels = (
      dashboard.panels as { type: string; title: string; targets: { refId: string; expr: string }[] }[]
    ).filter((p) => p.type !== "row");
    expect(panels.length).toBeGreaterThanOrEqual(7);
    let withData = 0;
    for (const panel of panels) {
      await until(
        `panel "${panel.title}" has data`,
        2 * MIN,
        async () => {
          const body = {
            queries: panel.targets.map((t) => ({
              refId: t.refId,
              datasource: { uid: "prometheus" },
              expr: t.expr,
              intervalMs: 15000,
              maxDataPoints: 100,
            })),
            from: "now-10m",
            to: "now",
          };
          const result = await grafana("/api/ds/query", { method: "POST", body: JSON.stringify(body) });
          const frames = Object.values(
            result.results as Record<string, { frames?: { data: { values: unknown[][] } }[] }>,
          ).flatMap((r) => r.frames ?? []);
          return frames.some((f) => f.data.values.some((column) => column.length > 0)) ? true : undefined;
        },
        10_000,
      );
      withData += 1;
    }
    expect(withData).toBe(panels.length);
  });

  it(
    "TC-F00-87 [AC-F00-43] one failed request is found in logs and traces, and no secret leaks",
    { timeout: 6 * MIN },
    async () => {
      const response = await fetch(`${API}/__test__/error`, { method: "POST" });
      expect(response.status).toBe(500);
      const body = (await response.json().catch(() => ({}))) as { requestId?: string };
      const requestId = body.requestId ?? response.headers.get("x-request-id");
      expect(requestId).toBeTruthy();

      const start = (Date.now() - 10 * MIN) * 1_000_000;
      const query = encodeURIComponent(`{service_name="meetapp-api"} | requestId="${requestId}"`);
      const streams = await until(
        "the failed request in Loki",
        30_000,
        async () => {
          const result = await grafana(
            `/api/datasources/proxy/uid/loki/loki/api/v1/query_range?query=${query}&start=${start}&limit=100`,
          );
          const found = result.data.result as { stream: Record<string, string>; values: string[][] }[];
          return found.some((s) => s.values.length > 0) ? found : undefined;
        },
        3000,
      );
      const traceId = streams.map((s) => s.stream["trace_id"]).find((id) => id !== undefined && id !== "");
      expect(traceId, "log stream has a trace_id label").toBeTruthy();

      const everything = JSON.stringify(streams);
      expect(everything).not.toContain("hunter2");
      expect(everything).not.toContain("alice@example.com");

      const trace = await until(
        "the trace in Tempo",
        60_000,
        async () => {
          const r = await fetch(`${GRAFANA}/api/datasources/proxy/uid/tempo/api/v2/traces/${traceId}`, {
            headers: { Authorization: GRAFANA_AUTH },
          });
          // Tempo answers 200 with an empty trace until the spans are stored, so wait for real spans.
          const found = r.status === 200 ? ((await r.json()) as Json) : undefined;
          return (found?.trace?.resourceSpans?.length ?? 0) > 0 ? (found as unknown) : undefined;
        },
        3000,
      );
      const text = JSON.stringify(trace);
      expect(text).not.toContain("hunter2");
      expect(text).not.toContain("alice@example.com");
      expect(text).toMatch(/"code":\s*("STATUS_CODE_ERROR"|2)/);
    },
  );

  it(
    "TC-F00-88 [AC-F00-44] a Cache outage sends an email and a notification within 1-2 minutes, and a recovery one",
    { timeout: 12 * MIN },
    async () => {
      await waitAllGreen();
      const t = Date.now();
      compose(["--profile", "monitoring", "stop", "redis"]);
      await sleep(2 * MIN);
      const triggered = await cacheMails(t, /trigger/i);
      expect(triggered.length, "a trigger email about Cache").toBeGreaterThan(0);
      for (const mail of triggered) {
        const age = Date.parse(mail.Created) - t;
        expect(age).toBeGreaterThanOrEqual(MIN);
        expect(age).toBeLessThanOrEqual(2 * MIN);
      }
      expect(calls.map((c) => c.message)).toContain("Cache is down");

      compose(["--profile", "monitoring", "start", "redis"]);
      await until(
        "a resolved email about Cache",
        3 * MIN,
        async () => {
          return (await cacheMails(t, /resolv/i)).length > 0 ? true : undefined;
        },
        5000,
      );
      await until("the 'Cache recovered' notification", MIN, async () =>
        calls.some((c) => c.message === "Cache recovered") ? true : undefined,
      );
    },
  );

  it("TC-F00-89 [AC-F00-44] a 20 second Cache blip sends no alert", { timeout: 8 * MIN }, async () => {
    await waitAllGreen();
    const t = Date.now();
    const before = calls.length;
    compose(["--profile", "monitoring", "stop", "redis"]);
    await sleep(20_000);
    compose(["--profile", "monitoring", "start", "redis"]);
    await sleep(2 * MIN);
    expect(await cacheMails(t, /trigger/i)).toEqual([]);
    expect(calls.slice(before).map((c) => c.message)).not.toContain("Cache is down");
  });
});
