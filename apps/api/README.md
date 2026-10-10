# @meetapp/api

The backend (Fastify). It listens on 127.0.0.1 only, checks its settings at startup, updates the database structure automatically, and answers in one standard error format.

- **Start:** `pnpm dev` from the project root starts it with everything else (or `pnpm --filter @meetapp/api dev`).
- **Docs (development only):** http://127.0.0.1:3000/docs and the OpenAPI file at `/docs/json`.
- **Layout:** `src/config` (settings), `src/plugins` (logging, errors, docs), `src/modules/<area>/` (routes → service → repository), `src/app.ts` (assembly), `src/server.ts` (start).
- **Test:** `src/**/*.test.ts` (with `app.inject`, no network); `*.integration.test.ts` with `pnpm test:integration`.
