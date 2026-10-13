# @meetapp/db

## What it is
The database: table definitions (Drizzle), migrations, feature flags and sample data.

| File | What it is |
|---|---|
| `src/schema.ts` | The tables: `feature_flags`; Better Auth's `user`, `session`, `account`, `verification`; `workspaces`, `workspace_members`, `invitations`, `join_requests`, `member_removals`. |
| `migrations/` | SQL files that build the database step by step. Never edit an existing one. |
| `src/migrate.ts` | `runMigrations(url)`: applies new migrations, skips ones already applied. |
| `src/flags.ts` | Read and switch feature flags; `isValidFlagKey`. |
| `src/seed.ts`, `src/seed-people.ts` | Sample data for local development (no real personal data): flags, four example accounts and "Example team". |

## Run it
From the project root:
- `pnpm seed` adds the sample data, `pnpm seed:clear` removes it.
- `pnpm flag list` shows the feature flags; `pnpm flag <key> on|off` switches one.
- To change the database, use the `db-migration` skill: edit `src/schema.ts`, then `pnpm --filter @meetapp/db db:generate`, and review the SQL.

## Test it
`src/flags.test.ts` runs in `pnpm test:unit`; `src/database.integration.test.ts` runs with `pnpm test:integration` against a fresh throwaway database. Both are part of `pnpm test`.
