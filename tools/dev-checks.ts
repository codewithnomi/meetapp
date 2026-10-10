// The checks `pnpm dev` runs before starting anything (AC-F00-01, design.md section 4).
// Kept apart from tools/dev.ts so each check can be tested with fake inputs.
import { spawnSync } from "node:child_process";
import { createSocket } from "node:dgram";
import { appendFileSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { connect, createServer } from "node:net";
import { join } from "node:path";

export const DOCKER_TIMEOUT_MS = 3000;

export type DockerState = "ok" | "missing" | "not-running";

/** Is Docker installed, and does it answer within 3 s? A hanging `docker info` counts as not running. */
export function checkDocker(docker = "docker"): DockerState {
  const result = spawnSync(docker, ["info", "--format", "{{.ServerVersion}}"], {
    stdio: "ignore",
    timeout: DOCKER_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });
  const error = result.error as NodeJS.ErrnoException | undefined;
  if (error?.code === "ENOENT") return "missing";
  return result.status === 0 ? "ok" : "not-running";
}

export const DOCKER_MESSAGES: Record<Exclude<DockerState, "ok">, string> = {
  missing: "Docker isn't installed. See docs/getting-started.md.",
  "not-running": "Docker isn't running. Open Docker Desktop and try again.",
};

/** Copies .env.example to .env when .env is missing. Never overwrites. Returns true if it copied. */
export function ensureEnvFile(root: string): boolean {
  const target = join(root, ".env");
  if (existsSync(target)) return false;
  copyFileSync(join(root, ".env.example"), target);
  return true;
}

const SETTING_LINE = /^\s*([A-Z][A-Z0-9_]*)\s*=/;

/**
 * Adds to .env every setting that .env.example has and .env doesn't (settings added by later work,
 * e.g. the monitoring ports), with the comment lines above it. Existing values are never changed.
 * Docker refuses to start anything while a setting the compose file needs is missing.
 * Returns the names it added.
 */
export function addMissingSettings(root: string): string[] {
  const target = join(root, ".env");
  const current = parseEnvFile(readFileSync(target, "utf8"));
  const added: string[] = [];
  const blocks: string[] = [];
  let comments: string[] = [];
  for (const line of readFileSync(join(root, ".env.example"), "utf8").split("\n")) {
    const key = SETTING_LINE.exec(line)?.[1];
    if (key === undefined) {
      comments = line.trim().startsWith("#") ? [...comments, line] : [];
      continue;
    }
    if (!(key in current)) {
      added.push(key);
      blocks.push([...comments, line].join("\n"));
    }
    comments = [];
  }
  if (added.length > 0)
    appendFileSync(target, `\n# ---------- Added from .env.example ----------\n${blocks.join("\n")}\n`);
  return added;
}

/** Reads KEY=value lines (no interpolation). Later lines win; comments and blanks are skipped. */
export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match?.[1]) values[match[1]] = match[2] ?? "";
  }
  return values;
}

export function readEnv(root: string, overrides: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const fromFile = parseEnvFile(readFileSync(join(root, ".env"), "utf8"));
  const merged: Record<string, string> = { ...fromFile };
  for (const key of Object.keys(fromFile)) {
    const override = overrides[key];
    if (override !== undefined) merged[key] = override;
  }
  return merged;
}

export interface NeededPort {
  port: number;
  protocol: "tcp" | "udp";
  service: string;
  /** Likely other program, shown when the port is taken. */
  likely: string;
  /** The .env setting that moves it, if any. */
  setting?: string;
}

type PortSpec = Omit<NeededPort, "port"> & { fallback: number };

/** Every port `pnpm dev` needs. Ports with a `setting` can be moved in .env. */
const PORTS: PortSpec[] = [
  { fallback: 3000, protocol: "tcp", service: "backend", likely: "another web app", setting: "API_PORT" },
  { fallback: 5173, protocol: "tcp", service: "app screens (Vite)", likely: "another Vite dev server" },
  { fallback: 5432, protocol: "tcp", service: "database", likely: "a local PostgreSQL", setting: "POSTGRES_PORT" },
  { fallback: 6379, protocol: "tcp", service: "cache", likely: "a local Redis", setting: "REDIS_PORT" },
  { fallback: 7880, protocol: "tcp", service: "call server", likely: "another LiveKit", setting: "LIVEKIT_PORT" },
  { fallback: 7881, protocol: "tcp", service: "call server media", likely: "another LiveKit" },
  { fallback: 7882, protocol: "udp", service: "call server media", likely: "another LiveKit" },
  {
    fallback: 9000,
    protocol: "tcp",
    service: "file storage",
    likely: "MinIO or another S3 server",
    setting: "STORAGE_PORT",
  },
  {
    fallback: 9001,
    protocol: "tcp",
    service: "file browser",
    likely: "MinIO or another S3 server",
    setting: "STORAGE_CONSOLE_PORT",
  },
  {
    fallback: 1025,
    protocol: "tcp",
    service: "email (SMTP)",
    likely: "Mailpit or MailHog",
    setting: "MAILPIT_SMTP_PORT",
  },
  { fallback: 8025, protocol: "tcp", service: "fake inbox", likely: "Mailpit or MailHog", setting: "MAILPIT_WEB_PORT" },
];

/** Extra ports `pnpm monitoring` needs (design.md section 3); all can be moved in .env. */
const MONITORING_PORTS: PortSpec[] = [
  { fallback: 8080, protocol: "tcp", service: "status page", likely: "another web server", setting: "GATUS_PORT" },
  { fallback: 3001, protocol: "tcp", service: "dashboards", likely: "another web app", setting: "GRAFANA_PORT" },
  {
    fallback: 9090,
    protocol: "tcp",
    service: "metrics store",
    likely: "another Prometheus",
    setting: "PROMETHEUS_PORT",
  },
  {
    fallback: 4318,
    protocol: "tcp",
    service: "traces and logs",
    likely: "another OpenTelemetry collector",
    setting: "ALLOY_OTLP_PORT",
  },
  { fallback: 12345, protocol: "tcp", service: "collector", likely: "another Grafana Alloy", setting: "ALLOY_UI_PORT" },
  {
    fallback: 8090,
    protocol: "tcp",
    service: "alert notifier",
    likely: "`pnpm monitoring` already open in another window",
    setting: "NOTIFIER_PORT",
  },
];

function withEnv(specs: PortSpec[], env: Record<string, string>): NeededPort[] {
  return specs.map(({ fallback, ...spec }) => {
    const configured = spec.setting ? Number(env[spec.setting]) : Number.NaN;
    return { ...spec, port: Number.isInteger(configured) && configured > 0 ? configured : fallback };
  });
}

/** The needed ports with the values from .env, so a changed .env is respected. */
export function neededPorts(env: Record<string, string>): NeededPort[] {
  return withEnv(PORTS, env);
}

export function monitoringPorts(env: Record<string, string>): NeededPort[] {
  return withEnv(MONITORING_PORTS, env);
}

export function portKey(port: number, protocol: "tcp" | "udp"): string {
  return `${String(port)}/${protocol}`;
}

/** Ports already published by this project's own containers (a second `pnpm dev` must not fail). */
export function parseOwnPorts(composePsJson: string): Set<string> {
  const own = new Set<string>();
  for (const line of composePsJson.split("\n").filter((text) => text.trim() !== "")) {
    const container = JSON.parse(line) as { Publishers?: { PublishedPort: number; Protocol: string }[] };
    for (const published of container.Publishers ?? []) {
      if (published.PublishedPort > 0)
        own.add(portKey(published.PublishedPort, published.Protocol === "udp" ? "udp" : "tcp"));
    }
  }
  return own;
}

/** True when something already answers on 127.0.0.1:port (catches programs listening on all addresses). */
function tcpAnswers(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port, timeout: 1000 });
    const finish = (answered: boolean) => {
      socket.destroy();
      resolve(answered);
    };
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function canListen(port: number, protocol: "tcp" | "udp"): Promise<boolean> {
  return new Promise((resolve) => {
    if (protocol === "udp") {
      const socket = createSocket({ type: "udp4", reuseAddr: false });
      socket.once("error", () => resolve(false));
      socket.bind(port, "127.0.0.1", () => socket.close(() => resolve(true)));
      return;
    }
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen({ port, host: "127.0.0.1", exclusive: true }, () => server.close(() => resolve(true)));
  });
}

export async function isPortFree(port: number, protocol: "tcp" | "udp"): Promise<boolean> {
  if (protocol === "tcp" && (await tcpAnswers(port))) return false;
  return canListen(port, protocol);
}

export function portMessage(needed: NeededPort): string {
  const name = protocol(needed);
  const fix = needed.setting ? `Stop it or change ${needed.setting} in .env.` : "Stop it and try again.";
  return `Port ${name} is in use by another program (probably ${needed.likely}). ${fix}`;
}

function protocol(needed: NeededPort): string {
  return needed.protocol === "udp" ? `${String(needed.port)}/udp` : String(needed.port);
}

/** Messages for every needed port that is taken by something other than our own containers. */
export async function findPortProblems(ports: NeededPort[], own: Set<string>): Promise<string[]> {
  const checks = ports
    .filter((needed) => !own.has(portKey(needed.port, needed.protocol)))
    .map(async (needed) => ((await isPortFree(needed.port, needed.protocol)) ? undefined : portMessage(needed)));
  return (await Promise.all(checks)).filter((message): message is string => message !== undefined);
}

/** The address table printed when everything is up (AC-F00-01). */
export function addressTable(env: Record<string, string>, apiRunning: boolean, webRunning = false): string {
  const rows: [string, string][] = [
    ["Backend", apiRunning ? `http://127.0.0.1:${env["API_PORT"] ?? "3000"}` : "not built yet (F00 step T7)"],
    ["App screens (in a browser)", webRunning ? "http://127.0.0.1:5173" : "not built yet (F00 step T14)"],
    ["Call server (LiveKit)", `ws://127.0.0.1:${env["LIVEKIT_PORT"] ?? "7880"}`],
    ["Database (PostgreSQL)", `127.0.0.1:${env["POSTGRES_PORT"] ?? "5432"}`],
    ["Cache (Redis)", `127.0.0.1:${env["REDIS_PORT"] ?? "6379"}`],
    ["File storage (S3)", `http://127.0.0.1:${env["STORAGE_PORT"] ?? "9000"}`],
    ["File browser", `http://127.0.0.1:${env["STORAGE_CONSOLE_PORT"] ?? "9001"}`],
    ["Fake inbox (Mailpit)", `http://127.0.0.1:${env["MAILPIT_WEB_PORT"] ?? "8025"}`],
  ];
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, address]) => `  ${label.padEnd(width)}  ${address}`).join("\n");
}
