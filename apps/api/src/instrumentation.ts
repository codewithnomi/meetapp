// Loaded before the backend with `node --import ./src/instrumentation.ts` so tracing can hook into
// the libraries as they load. Does nothing unless OTEL_EXPORTER_OTLP_ENDPOINT or SENTRY_DSN is set
// (AC-F00-22): without them no tracing or error-reporting code even starts.
import { register } from "node:module";
import { isAllowedOtlpEndpoint } from "./config/otlp-endpoint.ts";
import { onShutdown } from "./observability/shutdown.ts";

const otlpEndpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
const sentryDsn = process.env["SENTRY_DSN"];

// A wrong endpoint never receives anything: the settings check then stops the backend and names it.
if (otlpEndpoint && isAllowedOtlpEndpoint(otlpEndpoint)) {
  register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);
  const { startTelemetry } = await import("./observability/telemetry.ts");
  const sdk = startTelemetry(otlpEndpoint);
  // Sends what is still batched, once: on a stop (server.ts) or when the process ends on its own
  // (where a failed final send must not crash the exit).
  let stopping: Promise<void> | undefined;
  const stopTelemetry = () => (stopping ??= sdk.shutdown());
  onShutdown(stopTelemetry);
  process.once("beforeExit", () => void stopTelemetry().catch(() => undefined));
}

if (sentryDsn) {
  const Sentry = await import("@sentry/node");
  const { sentryOptions } = await import("./observability/sentry.ts");
  Sentry.init(sentryOptions(sentryDsn));
  onShutdown(() => Sentry.close(2000));
}
