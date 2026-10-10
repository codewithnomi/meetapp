// Loaded before the backend with `node --import ./src/instrumentation.ts` so tracing can hook into
// the libraries as they load. Does nothing unless OTEL_EXPORTER_OTLP_ENDPOINT or SENTRY_DSN is set
// (AC-F00-22): without them no tracing or error-reporting code even starts.
import { register } from "node:module";

const otlpEndpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
const sentryDsn = process.env["SENTRY_DSN"];

if (otlpEndpoint) {
  register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);
  const { startTelemetry } = await import("./observability/telemetry.ts");
  const sdk = startTelemetry(otlpEndpoint);
  process.once("beforeExit", () => void sdk.shutdown());
}

if (sentryDsn) {
  const Sentry = await import("@sentry/node");
  const { sentryOptions } = await import("./observability/sentry.ts");
  Sentry.init(sentryOptions(sentryDsn));
}
