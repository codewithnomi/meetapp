// TC-F00-96: the desktop notifier turns Gatus and Grafana webhooks into notifications, safely.
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNotifier, macNotificationCommand, type Notification } from "./notifier.ts";

let calls: Notification[];
let server: ReturnType<typeof createNotifier>;
let base: string;

beforeEach(async () => {
  calls = [];
  server = createNotifier({ notify: (n) => void calls.push(n) });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function send(path: string, body: unknown, method = "POST") {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return fetch(`${base}${path}`, { method, ...(method === "GET" ? {} : { body: payload }) });
}

const grafana = (...alerts: unknown[]) => ({ alerts });

describe("TC-F00-96 [AC-F00-44] notifier", () => {
  it("TC-F00-96 [AC-F00-44] a Gatus TRIGGERED call notifies '<service> is down'", async () => {
    const response = await send("/gatus", { service: "Cache", status: "TRIGGERED", description: "x" });
    expect(response.status).toBe(204);
    expect(calls).toEqual([{ title: "MeetApp alert", message: "Cache is down" }]);
  });

  it("TC-F00-96 [AC-F00-44] a Gatus RESOLVED call notifies '<service> recovered'", async () => {
    expect((await send("/gatus", { service: "Cache", status: "RESOLVED" })).status).toBe(204);
    expect(calls).toEqual([{ title: "MeetApp alert", message: "Cache recovered" }]);
  });

  it("TC-F00-96 [AC-F00-44] a Grafana call notifies once per alert", async () => {
    const body = grafana(
      { status: "firing", labels: { alertname: "Error spike" }, extra: 1 },
      { status: "resolved", labels: { alertname: "Disk nearly full" } },
    );
    expect((await send("/grafana", body)).status).toBe(204);
    expect(calls.map((c) => c.message)).toEqual(["Error spike is firing", "Disk nearly full resolved"]);
  });

  it("TC-F00-96 [AC-F00-44] names longer than 100 characters are cut to 100", async () => {
    await send("/gatus", { service: "a".repeat(500), status: "TRIGGERED" });
    await send("/grafana", grafana({ status: "firing", labels: { alertname: "b".repeat(500) } }));
    expect(calls[0]?.message).toBe(`${"a".repeat(100)} is down`);
    expect(calls[1]?.message).toBe(`${"b".repeat(100)} is firing`);
  });

  it("TC-F00-96 [AC-F00-44] errors notify nothing: 404, 405, 400 and 413", async () => {
    expect((await send("/other", { service: "x", status: "TRIGGERED" })).status).toBe(404);
    expect((await send("/gatus", "", "GET")).status).toBe(405);
    expect((await send("/grafana", "", "PUT")).status).toBe(405);
    expect((await send("/gatus", "not json")).status).toBe(400);
    expect((await send("/gatus", { service: 5, status: "TRIGGERED" })).status).toBe(400);
    expect((await send("/gatus", { service: "x", status: "WEIRD" })).status).toBe(400);
    expect((await send("/grafana", { alerts: [] })).status).toBe(400);
    expect((await send("/grafana", {})).status).toBe(400);
    expect((await send("/grafana", grafana({ status: "firing", labels: {} }))).status).toBe(400);
    const tooBig = await send("/gatus", { service: "x".repeat(16 * 1024), status: "TRIGGERED" });
    expect(tooBig.status).toBe(413);
    expect(calls).toEqual([]);
  });

  it("TC-F00-96 [AC-F00-44] a name that tries to run a script is only ever passed as plain text", () => {
    const name = 'x" & do shell script "rm -rf ~" & "';
    const { command, args } = macNotificationCommand({ title: "MeetApp alert", message: `${name} is down` });
    expect(command).toBe("osascript");
    const scripts = args.filter((_, i) => args[i - 1] === "-e");
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(script).not.toContain("rm -rf");
      expect(script).not.toContain(name);
    }
    expect(args).toContain(`${name} is down`);
  });
});
