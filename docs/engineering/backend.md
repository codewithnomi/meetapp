---
status: draft
updated: 2026-10-09
---

# Backend Rules (API, Database, AI Worker)

## 1. Code layers (each has one job)
```
routes/        receive the request, validate input (Zod), call a service, return the response
services/      business rules ("can this user join this meeting?")
repositories/  database reads/writes only
jobs/          background work (minutes, AI indexing) via BullMQ
```
Routes never talk to the database directly. Services never know about HTTP.

## 2. Rules
- **Validation:** every input is validated with a Zod schema. Schemas live in `packages/core` and are shared with the frontend.
- **Permissions:** every service function receives the current user and checks access. Every database query that reads workspace data filters by `workspace_id` (security rule S2).
- **Errors:** one error format for every endpoint: `{ error: { code, message, requestId, details? } }`, with clear HTTP status codes (400 bad input, 401 not logged in, 403 not allowed, 404 not found, 409 conflict, 429 too many requests).
- **API docs:** generated automatically as OpenAPI from the Zod schemas, published at `/docs` in development. The Flutter mobile app's API client is generated from this file (D019).
- **API versioning:** all routes under `/api/v1/…`. The desktop and mobile apps can be older than the server, so breaking changes require a new version.
- **Database:** PostgreSQL, Drizzle ORM. Every change is a **migration** file (never edit the database by hand). Every table has `id`, `created_at`, `updated_at`; soft-delete where users can delete things.
- **Logging:** structured JSON logs (pino) with a request ID. Never log transcripts, messages, passwords or tokens (rule S10).
- **Config:** all settings come from environment variables, validated at startup; the app refuses to start if one is missing.
- **Idempotent jobs:** background jobs can safely run twice (e.g. regenerating minutes doesn't create duplicates).

## 3. AI worker (Python)
- Same rules for logs, config and errors.
- Speech-to-text and AI models sit behind interfaces (`STTProvider`, `LLMProvider`, `EmbeddingProvider`), so cloud and local versions can be swapped (decision D008).
- **All prompts live in versioned files** (`prompts/minutes.v1.md`), never inline in code, so we can track and test changes.
- **AI evaluation set:** a fixed set of sample meetings with expected minutes and Q&A answers. It's re-run whenever a prompt or model changes, so quality is measured, not guessed.
- Cost of every AI call (tokens, minutes of audio) is recorded per meeting and workspace.
