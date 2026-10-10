// Test helpers: a complete environment with obviously fake values, a valid Config built from it,
// and a log stream that collects pino's JSON lines. Used only by the API tests.
import { PassThrough } from "node:stream";
import { configSchema, loadConfig, type Config } from "../config/config.ts";

type NodeEnv = Config["NODE_ENV"];

const PORT_KEYS = new Set([
  "API_PORT",
  "POSTGRES_PORT",
  "REDIS_PORT",
  "LIVEKIT_PORT",
  "STORAGE_PORT",
  "MAILPIT_SMTP_PORT",
]);

/** Every key of the config schema, in schema order. */
export const CONFIG_KEYS = Object.keys(configSchema.shape) as (keyof Config)[];

/** Settings that may be left out (they have a default or mean "off" when empty). */
export const OPTIONAL_KEYS: readonly string[] = [
  "POSTGRES_HOST",
  "REDIS_HOST",
  "LIVEKIT_HOST",
  "STORAGE_HOST",
  "MAILPIT_HOST",
  "EMAIL_FROM",
  "SENTRY_DSN",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
];

/**
 * A full environment with distinctive fake values: text settings are `val-<KEY>-123`, ports are
 * unique numbers, so a test can check that an error message never contains another setting's value.
 */
export function fakeEnv(nodeEnv: NodeEnv = "test"): Record<string, string> {
  const env: Record<string, string> = {};
  let nextPort = 41_001;
  for (const key of CONFIG_KEYS) {
    if (PORT_KEYS.has(key)) env[key] = String(nextPort++);
    else env[key] = `val-${key}-123`;
  }
  env["NODE_ENV"] = nodeEnv;
  env["API_HOST"] = "127.0.0.1";
  env["POSTGRES_HOST"] = "127.0.0.1";
  env["SENTRY_DSN"] = "";
  env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "";
  return env;
}

export function fakeConfig(nodeEnv: NodeEnv = "test"): Config {
  return loadConfig(fakeEnv(nodeEnv));
}

export interface CapturedLogs {
  stream: PassThrough;
  /** Everything written so far, as one string. */
  text: () => string;
  /** Every complete line parsed as JSON. */
  lines: () => Record<string, unknown>[];
}

export function captureLogs(): CapturedLogs {
  const stream = new PassThrough();
  const chunks: string[] = [];
  stream.on("data", (chunk: Buffer | string) => chunks.push(chunk.toString()));
  const text = () => chunks.join("");
  const lines = () =>
    text()
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { stream, text, lines };
}
