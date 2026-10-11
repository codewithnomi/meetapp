# Rules for apps/api
- Layers: routes → service → repository (backend.md). Routes validate with Zod schemas from packages/contracts and never touch the database; dependency-cruiser enforces it.
- Every query that reads workspace data filters by workspace_id (security rule S2).
- Errors: throw, and let plugins/errors.ts answer. Never put error details, stack traces or input in a response.
- Never log request bodies, secrets or personal data; use request.log (it carries the requestId). New sensitive field names go into REDACT_PATHS in plugins/logging.ts.
- New settings: add to config/config.ts AND document in the root .env.example (a test compares them).
- Test-only routes live in modules/test-support and are registered only when NODE_ENV is "test".
