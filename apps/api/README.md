# @meetapp/api

## What it is
The backend (Fastify). It listens on 127.0.0.1 only, checks its settings at startup, updates the database structure automatically, and answers in one standard error format. It exposes `/api/v1/health`, `/api/v1/flags` and `/metrics`, and sends traces and logs to the monitoring when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

- **Layout:** `src/config` (settings), `src/plugins` (logging, errors, docs, metrics), `src/modules/<area>/` (routes → service → repository), `src/providers` (database, cache, call server, storage, email), `src/observability` (tracing, Sentry, shutdown), `src/app.ts` (assembly), `src/server.ts` (start).
- **API docs (development only):** http://127.0.0.1:3000/docs and the OpenAPI file at `/docs/json` (port = `API_PORT` in `.env`).

## Run it
- `pnpm dev` (project root) starts it together with the services and the desktop app.
- Alone, with the services already running: `pnpm --filter @meetapp/api dev`.

## Test it
- Unit tests (`src/**/*.test.ts`, using `app.inject`, no network) run in `pnpm test` and `pnpm test:unit`.
- `*.integration.test.ts` need the local services: `pnpm test:integration` (also part of `pnpm test`).
