# @meetapp/contracts

Zod schemas shared by the backend and the apps: what each endpoint receives and returns. The backend's API documentation (`/docs`, OpenAPI) is generated from them, and the mobile app's client will be generated from that file (D019).

- `src/errors.ts`: the standard error body `{ error: { code, message, requestId, details? } }`.
- `src/health.ts`: the health check response.
- **Test:** covered by the backend tests in `apps/api`.
