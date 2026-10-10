// `pnpm monitoring`: starts the optional monitoring (status page, dashboards, logs, traces, alerts),
// prints where everything is, then runs the Mac notification helper until Ctrl+C
// (AC-F00-41 to 44, design.md section 3). `pnpm monitoring:stop` stops the monitoring containers.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ROOT, fail } from "./cli.ts";
import {
  DOCKER_MESSAGES,
  addMissingSettings,
  checkDocker,
  ensureEnvFile,
  findPortProblems,
  monitoringPorts,
  parseOwnPorts,
  readEnv,
} from "./dev-checks.ts";
import { createNotifier, showMacNotification } from "./notifier.ts";

const COMPOSE = [
  "compose",
  "-f",
  join(ROOT, "infra/docker-compose.yml"),
  "--env-file",
  join(ROOT, ".env"),
  "--profile",
  "monitoring",
];

/** The monitoring containers (the `monitoring` profile in infra/docker-compose.yml). */
const MONITORING_SERVICES = ["gatus", "prometheus", "alloy", "loki", "tempo", "grafana"];

function say(message: string): void {
  process.stdout.write(`${message}\n`);
}

function ownPorts(): Set<string> {
  const result = spawnSync("docker", [...COMPOSE, "ps", "--format", "json"], { encoding: "utf8", timeout: 10_000 });
  return result.status === 0 ? parseOwnPorts(result.stdout) : new Set();
}

function addresses(env: Record<string, string>): string {
  const rows: [string, string][] = [
    ["Status page (Gatus)", `http://127.0.0.1:${env["GATUS_PORT"] ?? "8080"}`],
    ["Dashboards (Grafana)", `http://127.0.0.1:${env["GRAFANA_PORT"] ?? "3001"}`],
    ["Metrics (Prometheus)", `http://127.0.0.1:${env["PROMETHEUS_PORT"] ?? "9090"}`],
    ["Collector (Alloy)", `http://127.0.0.1:${env["ALLOY_UI_PORT"] ?? "12345"}`],
    ["Alert emails (Mailpit)", `http://127.0.0.1:${env["MAILPIT_WEB_PORT"] ?? "8025"}`],
  ];
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, address]) => `  ${label.padEnd(width)}  ${address}`).join("\n");
}

async function main(): Promise<void> {
  const docker = checkDocker();
  if (docker !== "ok") fail(DOCKER_MESSAGES[docker]);
  if (ensureEnvFile(ROOT)) say("Created .env from .env.example (local development settings).");
  const added = addMissingSettings(ROOT);
  if (added.length > 0) say(`Added new settings to .env from .env.example: ${added.join(", ")}.`);
  const env = readEnv(ROOT);

  const ports = monitoringPorts(env);
  const problems = await findPortProblems(ports, ownPorts());
  if (problems.length > 0) fail(problems.join("\n✗ "));

  say("Starting monitoring (the first time downloads it, which can take a few minutes)…");
  // Fresh containers each time: after a `docker compose down` the old ones point at a deleted network
  // and can't start. Their data lives in named volumes, which are kept.
  spawnSync("docker", [...COMPOSE, "rm", "--stop", "--force", ...MONITORING_SERVICES], { stdio: "ignore" });
  const up = spawnSync("docker", [...COMPOSE, "up", "-d", "--wait"], { stdio: "inherit" });
  if (up.status !== 0) fail("Monitoring did not start. Run `docker compose -f infra/docker-compose.yml logs`.");

  say(`\nMonitoring is running on this computer:\n${addresses(env)}\n`);
  if (!env["OTEL_EXPORTER_OTLP_ENDPOINT"]) {
    const otlp = `http://127.0.0.1:${env["ALLOY_OTLP_PORT"] ?? "4318"}`;
    say(`To see the backend's logs and traces, set OTEL_EXPORTER_OTLP_ENDPOINT=${otlp} in .env and restart pnpm dev.`);
  }

  const notifierPort = ports.find((port) => port.setting === "NOTIFIER_PORT")?.port ?? 8090;
  const notifier = createNotifier({ notify: showMacNotification });
  notifier.once("error", (error) => fail(`The alert notifier could not start: ${error.message}`));
  notifier.listen(notifierPort, "127.0.0.1", () => {
    say("Keep this window open to get Mac notifications for alerts (alert emails work either way).");
    say("Ctrl+C closes the notifications only. Stop monitoring with `pnpm monitoring:stop` (data is kept).");
  });
}

await main();
