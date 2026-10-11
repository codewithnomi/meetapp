// TC-F00-96: the desktop notifier turns Gatus and Grafana webhooks into notifications, safely.
import { request } from "node:http";
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
  const headers = { "Content-Type": "application/json" };
  return fetch(`${base}${path}`, { method, headers, ...(method === "GET" ? {} : { body: payload }) });
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

  // Security review (F00): a web page open in the browser could post to 127.0.0.1 without a check
  // (a text/plain body needs no browser permission), or reach it through a look-alike address.
  it("TC-F00-96 [AC-F00-44] a body not sent as JSON is refused with 415 and notifies nothing", async () => {
    const body = JSON.stringify({ service: "Backend", status: "TRIGGERED" });
    const response = await fetch(`${base}/gatus`, { method: "POST", headers: { "Content-Type": "text/plain" }, body });
    expect(response.status).toBe(415);
    expect(calls).toEqual([]);
  });

  it.each(["evil.example.com", "127.0.0.1:1", "meetapp.local"])(
    "TC-F00-96 [AC-F00-44] a request for another address (Host %s) is refused with 403",
    async (host) => {
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const port = (server.address() as AddressInfo).port;
        const req = request(
          {
            host: "127.0.0.1",
            port,
            path: "/gatus",
            method: "POST",
            headers: { Host: host, "Content-Type": "application/json" },
          },
          (res) => {
            res.resume();
            resolve(res.statusCode);
          },
        );
        req.on("error", reject);
        req.end(JSON.stringify({ service: "Backend", status: "TRIGGERED" }));
      });
      expect(status).toBe(403);
      expect(calls).toEqual([]);
    },
  );

  it("TC-F00-96 [AC-F00-44] the addresses Docker and this computer use are accepted", async () => {
    const port = String((server.address() as AddressInfo).port);
    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`, `host.docker.internal:${port}`]) {
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const req = request(
          {
            host: "127.0.0.1",
            port: Number(port),
            path: "/gatus",
            method: "POST",
            headers: { Host: host, "Content-Type": "application/json; charset=utf-8" },
          },
          (res) => {
            res.resume();
            resolve(res.statusCode);
          },
        );
        req.on("error", reject);
        req.end(JSON.stringify({ service: "Cache", status: "RESOLVED" }));
      });
      expect(status, host).toBe(204);
    }
  });

  // Bug review (F00): one odd alert in a Grafana batch used to drop the whole batch.
  it("TC-F00-96 [AC-F00-44] a Grafana batch with some invalid alerts still notifies the valid ones", async () => {
    const body = grafana(
      { status: "firing", labels: { alertname: "Error spike" } },
      { status: "pending", labels: { alertname: "Odd one" } },
      { status: "toString", labels: { alertname: "Built-in name" } },
      { status: "resolved", labels: {} },
      { status: "resolved", labels: { alertname: "Disk nearly full" } },
    );
    expect((await send("/grafana", body)).status).toBe(204);
    expect(calls.map((c) => c.message)).toEqual(["Error spike is firing", "Disk nearly full resolved"]);
  });

  it("TC-F00-96 [AC-F00-44] more than 20 alerts in one call is refused with 413 and notifies nothing", async () => {
    const alerts = Array.from({ length: 21 }, (_, i) => ({ status: "firing", labels: { alertname: `A${String(i)}` } }));
    expect((await send("/grafana", grafana(...alerts))).status).toBe(413);
    expect(calls).toEqual([]);
  });
});
