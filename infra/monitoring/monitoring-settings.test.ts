// TC-F00-95: the monitoring settings files say what the spec says (no containers needed).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPOSE_FILE, ENV_EXAMPLE, ROOT, readYaml } from "./monitoring-test-support.ts";

const DOCKER = { timeout: 120_000 };
const GATUS = "infra/monitoring/gatus/config.yaml";
const ALERTING = "infra/monitoring/grafana/provisioning/alerting";

function composeServices(): Record<string, { profiles?: string[]; ports?: unknown[] }> {
  const result = spawnSync(
    "docker",
    ["compose", "-f", COMPOSE_FILE, "--env-file", ENV_EXAMPLE, "--profile", "*", "config", "--format", "json"],
    { cwd: ROOT, encoding: "utf8", timeout: 60_000 },
  );
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  return (JSON.parse(result.stdout) as { services: Record<string, { profiles?: string[]; ports?: unknown[] }> })
    .services;
}

describe("TC-F00-95 [AC-F00-41] [AC-F00-44] Gatus settings", () => {
  const config = readYaml(GATUS);
  const names = ["Backend", "Database", "Cache", "Call server", "File storage", "Email"];

  it("TC-F00-95 [AC-F00-41] watches the six parts every 30 seconds", () => {
    const endpoints = config.endpoints as { name: string; interval: string; url: string }[];
    expect(endpoints.map((e) => e.name).sort()).toEqual([...names].sort());
    for (const endpoint of endpoints) expect(endpoint.interval, endpoint.name).toBe("30s");
    expect(endpoints.find((e) => e.name === "Backend")?.url).toBe(
      "http://host.docker.internal:${API_PORT}/api/v1/health",
    );
  });

  it("TC-F00-95 [AC-F00-44] every endpoint alerts by email and by the desktop notifier: 3 failures, 2 successes, on resolve", () => {
    for (const endpoint of config.endpoints as { name: string; alerts: Record<string, unknown>[] }[]) {
      for (const type of ["email", "custom"]) {
        const alerts = endpoint.alerts.filter((a) => a["type"] === type);
        expect(alerts.length, `${endpoint.name} ${type}`).toBe(1);
        expect(alerts[0], `${endpoint.name} ${type}`).toMatchObject({
          "failure-threshold": 3,
          "success-threshold": 2,
          "send-on-resolved": true,
        });
      }
    }
  });

  it("TC-F00-95 [AC-F00-44] the email and custom alert targets are Mailpit and the notifier", () => {
    expect(config.alerting.email).toMatchObject({ host: "mailpit", port: 1025, to: "${ALERT_EMAIL_TO}" });
    const custom = config.alerting.custom;
    expect(custom.url).toBe("http://host.docker.internal:${NOTIFIER_PORT}/gatus");
    expect(custom.method).toBe("POST");
    expect(custom.body).toContain("[ENDPOINT_NAME]");
    expect(custom.body).toContain("[ALERT_TRIGGERED_OR_RESOLVED]");
  });
});

describe("TC-F00-95 [AC-F00-41] [AC-F00-42] compose profile", DOCKER, () => {
  it("TC-F00-95 [AC-F00-41] the monitoring services are in the monitoring profile, the normal ones are not", () => {
    const services = composeServices();
    for (const name of ["gatus", "prometheus", "alloy", "loki", "tempo", "grafana"]) {
      expect(services[name]?.profiles, name).toEqual(["monitoring"]);
    }
    for (const name of ["livekit", "postgres", "redis", "storage", "mailpit"]) {
      expect(services[name]?.profiles, name).toBeUndefined();
    }
  });

  it("TC-F00-95 [AC-F00-42] Loki and Tempo publish no port", () => {
    const services = composeServices();
    for (const name of ["loki", "tempo"]) expect(services[name]?.ports ?? [], name).toEqual([]);
  });
});

describe("TC-F00-95 [AC-F00-42] [AC-F00-43] [AC-F00-44] Grafana settings", () => {
  it("TC-F00-95 [AC-F00-42] the overview dashboard has the seven panels, each with a Prometheus query", () => {
    const dashboard = readYaml("infra/monitoring/grafana/dashboards/meetapp-overview.json");
    expect(dashboard).toMatchObject({ title: "MeetApp overview", uid: "meetapp-overview" });
    const panels = (
      dashboard.panels as {
        type: string;
        title: string;
        targets?: { expr?: string; datasource?: { uid?: string } }[];
      }[]
    ).filter((p) => p.type !== "row");
    expect(panels.map((p) => p.title).sort()).toEqual(
      [
        "Requests per second",
        "Error rate (5xx)",
        "Response time (p95)",
        "Database connections",
        "Cache status",
        "CPU per container",
        "Memory per container",
      ].sort(),
    );
    for (const panel of panels) {
      expect(panel.targets?.length, panel.title).toBeGreaterThan(0);
      for (const target of panel.targets ?? []) {
        expect(String(target.expr ?? "").length, panel.title).toBeGreaterThan(0);
        expect(target.datasource?.uid, panel.title).toBe("prometheus");
      }
    }
  });

  it("TC-F00-95 [AC-F00-43] the data sources have the uids prometheus, loki and tempo", () => {
    const sources = readYaml("infra/monitoring/grafana/provisioning/datasources/datasources.yaml").datasources as {
      uid: string;
    }[];
    expect(sources.map((s) => s.uid).sort()).toEqual(["loki", "prometheus", "tempo"]);
  });

  it("TC-F00-95 [AC-F00-44] the alert rules, contact point and policy exist", () => {
    const rules = readYaml(`${ALERTING}/rules.yaml`).groups.flatMap((g: { rules: { title: string }[] }) => g.rules);
    const titles = rules.map((r: { title: string }) => r.title);
    expect(titles).toContain("Error spike");
    expect(titles).toContain("Disk nearly full");

    const points = readYaml(`${ALERTING}/contact-points.yaml`).contactPoints as {
      name: string;
      receivers: { type: string; settings: { url?: string } }[];
    }[];
    expect(points.map((p) => p.name)).toEqual(["MeetApp alerts"]);
    const receivers = points[0]?.receivers ?? [];
    expect(receivers.some((r) => r.type === "email")).toBe(true);
    expect(receivers.find((r) => r.type === "webhook")?.settings.url).toBe(
      "http://host.docker.internal:${NOTIFIER_PORT}/grafana",
    );

    expect(readYaml(`${ALERTING}/policies.yaml`).policies[0].receiver).toBe("MeetApp alerts");
  });
});

describe("TC-F00-95 [AC-F00-41] [AC-F00-42] [AC-F00-44] monitoring settings are documented", () => {
  it("TC-F00-95 [AC-F00-41] .env.example has every monitoring key", () => {
    const text = readFileSync(ENV_EXAMPLE, "utf8");
    for (const key of [
      "GATUS_PORT",
      "PROMETHEUS_PORT",
      "GRAFANA_PORT",
      "GRAFANA_ADMIN_PASSWORD",
      "ALLOY_OTLP_PORT",
      "ALLOY_UI_PORT",
      "NOTIFIER_PORT",
      "ALERT_EMAIL_TO",
    ]) {
      expect(text, key).toMatch(new RegExp(`^${key}=`, "m"));
    }
  });
});

describe("TC-F00-95 [AC-F00-41] pnpm monitoring starts after a `docker compose down`", () => {
  it("TC-F00-95 [AC-F00-41] old monitoring containers are removed (data kept) before starting", () => {
    // `down` without the profile deletes the network but leaves the stopped monitoring containers
    // pointing at it, so they could never start again (found in T20).
    const source = readFileSync(`${ROOT}/tools/monitoring.ts`, "utf8");
    const remove = source.indexOf('"rm", "--stop", "--force"');
    expect(remove, "monitoring.ts removes the monitoring containers").toBeGreaterThan(-1);
    expect(source).toMatch(/"rm", "--stop", "--force", \.\.\.MONITORING_SERVICES/);
    expect(remove).toBeLessThan(source.indexOf('"up", "-d", "--wait"'));
    expect(source).not.toMatch(/"rm"[^\n]*"-v"/);
  });
});
