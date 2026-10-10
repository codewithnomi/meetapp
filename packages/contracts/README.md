# @meetapp/contracts

## What it is
Zod schemas shared by the backend and the apps: what each endpoint receives and returns. The backend's API documentation (`/docs`, OpenAPI) is generated from them, and the mobile app's client will be generated from that file (D019).

- `src/errors.ts`: the standard error body `{ error: { code, message, requestId, details? } }`.
- `src/health.ts`: the health check response.
- `src/flags.ts`: the feature flags list.

## Run it
Nothing to start: the backend and the apps import it.

## Test it
Covered by the backend tests in `apps/api` (part of `pnpm test`); types are checked by `pnpm typecheck`.
