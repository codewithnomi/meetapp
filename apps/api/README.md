# @meetapp/api

## What it is
The backend (Fastify). It listens on 127.0.0.1 only, checks its settings at startup, updates the database structure automatically, and answers in one standard error format. It exposes `/api/v1/health`, `/api/v1/flags` and `/metrics`, and sends traces and logs to the monitoring when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

Since F01 it also handles accounts and workspaces (`docs/specs/F01-accounts/design.md`):
- sign-in through Better Auth (`/api/auth/*`, only an allow-list of its routes) and our own sign-up, desktop hand-off and password routes;
- `/api/v1/me` (profile, look, photo), workspaces, members, invitations, the join link and requests;
- the invitation web page at `/invite/<link>`;
- emails through a BullMQ queue, and the daily expiry of old join requests.

Since F02 it also handles meetings and calls (`docs/specs/F02-meetings/design.md`): creating meetings and their options, finding one by link or ID and passcode, joining and the lobby (with meeting tickets in the `X-Meeting-Ticket` header), call-server rooms, passes and webhooks, in-call controls, ending, the 30-hour limit, and the meeting record. `src/meetings.ts` wires these modules together.

Since F03 it also runs meeting chat (`docs/specs/F03-chat/design.md`): messages, edits, deletes, reactions, replies, pins and polls during a call (with the meeting ticket), delivered to the room by the call server on topic `meetapp.chat`; files (checked by their content, pictures cleaned, 5-minute download links); GIF settings for the app; the chat setting per meeting; and reading a past meeting's chat (`/api/v1/meetings/:id/chat/…`, `/api/v1/me/meeting-chats`). The code is in `src/modules/chat/`.

Since F14 it also runs chats outside meetings (`docs/specs/F14-chats/design.md`): one-to-one and group conversations (`/api/v1/workspaces/:id/conversations`, `/api/v1/conversations/:id/…`), chat requests from outside the workspace, blocks, group members, read marks, and the live line `GET /api/v1/realtime` (a WebSocket that carries news, typing, Seen and status; across servers through Redis channels `conv:<id>`, `user:<id>`, `status:<id>`). The code is in `src/modules/chats/`.

Every route except a short public list needs a session (checked by `src/plugins/route-sweep.integration.test.ts`); every `:workspaceId` route answers 404 to non-members (`src/plugins/workspace-access.ts`).

- **Layout:** `src/config` (settings), `src/plugins` (logging, errors, docs, metrics, auth, session, rate limits, workspace access, idempotency), `src/emails` (templates and outbox), `src/modules/<area>/` (routes → service → repository; F02: `meetings/`, `calls/`; F03: `chat/`; F14: `chats/`), `src/meetings.ts` (meeting wiring), `src/providers` (database, cache, call server, storage, email), `src/observability` (tracing, Sentry, shutdown), `src/app.ts` (assembly), `src/server.ts` (start).
- **API docs (development only):** http://127.0.0.1:3000/docs and the OpenAPI file at `/docs/json` (port = `API_PORT` in `.env`).

## Run it
- `pnpm dev` (project root) starts it together with the services and the desktop app.
- Alone, with the services already running: `pnpm --filter @meetapp/api dev`.

## Test it
- Unit tests (`src/**/*.test.ts`, using `app.inject`, no network) run in `pnpm test` and `pnpm test:unit`.
- `*.integration.test.ts` need the local services: `pnpm test:integration` (also part of `pnpm test`).
