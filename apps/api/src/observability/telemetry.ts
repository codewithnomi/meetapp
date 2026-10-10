// Traces and logs over OTLP to the monitoring stack (Grafana Alloy → Tempo, Loki), only when
// OTEL_EXPORTER_OTLP_ENDPOINT is set (AC-F00-43). Log lines carry trace_id, so a request id leads to its trace.
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export function startTelemetry(endpoint: string): NodeSDK {
  const base = endpoint.replace(/\/+$/, "");
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: "meetapp-api" }),
    traceExporter: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: `${base}/v1/logs` }) })],
    instrumentations: [
      // Health checks and metrics scrapes would drown real requests, so they are not traced.
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request) => /^\/(metrics|api\/v1\/health)/.test(request.url ?? ""),
      }),
      new PgInstrumentation(),
      new IORedisInstrumentation(),
      new PinoInstrumentation(),
    ],
  });
  sdk.start();
  return sdk;
}
