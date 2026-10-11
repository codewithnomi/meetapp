# Rules for packages/contracts
- Schemas only: no runtime logic, no imports from apps.
- A breaking change to a schema needs a new API version (`/api/v2`), because older apps may still be in use.
- Give shared schemas an `id` with `.meta({ id })` so the OpenAPI file references them.
