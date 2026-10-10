# @meetapp/db

The database: table definitions (Drizzle), migrations, feature flags and sample data.

| File | What it is |
|---|---|
| `src/schema.ts` | The tables. Today: `feature_flags`. |
| `migrations/` | SQL files that build the database step by step. Never edit an existing one. |
| `src/migrate.ts` | `runMigrations(url)`: applies new migrations, skips ones already applied. |
| `src/flags.ts` | Read and switch feature flags; `isValidFlagKey`. |
| `src/seed.ts` | Sample data for local development (no real personal data). |

- **Commands (from the project root):** `pnpm seed`, `pnpm seed:clear`, `pnpm flag list`, `pnpm flag <key> on|off`.
- **Change the database:** use the `db-migration` skill: edit `src/schema.ts`, then `pnpm --filter @meetapp/db db:generate`, review the SQL.
- **Test:** `src/flags.test.ts` (unit); `src/database.integration.test.ts` runs with `pnpm test:integration` against a fresh throwaway database.
